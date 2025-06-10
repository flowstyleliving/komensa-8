import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { WaitingRoomService, WaitingRoomAnswers } from '@/lib/waiting-room';

export async function POST(request: NextRequest) {
  console.log('[Waiting Room API] POST request received');
  try {
    const session = await getServerSession(authOptions);
    console.log('[Waiting Room API] Session check:', { 
      hasSession: !!session, 
      userId: session?.user?.id 
    });
    
    if (!session?.user?.id) {
      console.log('[Waiting Room API] Unauthorized - no session');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { chatId, answers } = await request.json() as {
      chatId: string;
      answers: WaitingRoomAnswers;
    };

    console.log('[Waiting Room API] Request data:', { 
      chatId, 
      hasAnswers: !!answers,
      answersReady: answers?.isReady,
      userName: answers?.name
    });

    if (!chatId || !answers) {
      console.log('[Waiting Room API] Missing data - chatId:', !!chatId, 'answers:', !!answers);
      return NextResponse.json({ error: 'Missing chatId or answers' }, { status: 400 });
    }

    // Check if user is authorized
    const isAuthorized = await WaitingRoomService.isUserAuthorized(chatId, session.user.id);
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Not a participant in this chat' }, { status: 403 });
    }

    // Submit answers
    await WaitingRoomService.submitAnswers(chatId, session.user.id, answers);
    
    // Notify other participant that this user is now ready
    try {
      const { pusherServer, getChatChannelName, PUSHER_EVENTS } = await import('@/lib/pusher');
      const channelName = getChatChannelName(chatId);
      const userType = session.user.isGuest ? 'guest' : 'host';
      
      await pusherServer.trigger(channelName, PUSHER_EVENTS.PARTICIPANT_READY, {
        userType,
        userId: session.user.id,
        userName: answers.name,
        isReady: answers.isReady
      });
      
      console.log(`[Waiting Room] Notified other participants that ${userType} (${answers.name}) is ready`);
    } catch (pusherError) {
      console.error('[Waiting Room] Failed to send readiness notification, continuing anyway:', pusherError);
    }
    
    // Check if both participants are ready and initiate chat if so
    console.log('[Waiting Room API] About to check chat initiation for:', chatId);
    const initiation = await WaitingRoomService.initiateChatIfReady(chatId);
    
    console.log('[Waiting Room API] Chat initiation result:', {
      initiated: initiation.initiated,
      hasAiIntroduction: !!initiation.aiIntroduction,
      aiIntroductionLength: initiation.aiIntroduction?.length || 0,
      error: initiation.error
    });
    
    if (initiation.initiated) {
      console.log('[Waiting Room] Both participants ready - chat initiated');

      // Notify participants that chat is starting
      try {
        const { pusherServer, getChatChannelName, PUSHER_EVENTS } = await import('@/lib/pusher');
        const channelName = getChatChannelName(chatId);
        
        await pusherServer.trigger(channelName, PUSHER_EVENTS.CHAT_INITIATED, {
          initiatedAt: new Date().toISOString(),
          chatId
        });
        
        console.log('[Waiting Room] Chat initiated Pusher notification sent successfully');
      } catch (pusherNotificationError) {
        console.error('[Waiting Room] Failed to send chat initiation notification:', pusherNotificationError);
        // Continue anyway - users can still access chat directly
      }
    } else {
      console.log('[Waiting Room] Chat not ready to initiate yet:', {
        error: initiation.error,
        bothReady: await WaitingRoomService.getReadinessState(chatId).then(state => state.bothReady)
      });
    }

    // Get current status
    const status = await WaitingRoomService.getWaitingRoomStatus(chatId, session.user.id);

    return NextResponse.json({
      success: true,
      userReady: answers.isReady,
      bothReady: status.bothReady,
      waitingForOther: !status.bothReady,
      chatInitiated: status.chatInitiated
    });

  } catch (error) {
    console.error('Error in waiting room ready endpoint:', error);
    return NextResponse.json(
      { error: 'Failed to process readiness' },
      { status: 500 }
    );
  }
}

// GET endpoint to check current readiness status
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const chatId = searchParams.get('chatId');

    if (!chatId) {
      return NextResponse.json({ error: 'Missing chatId' }, { status: 400 });
    }

    // Check if user is authorized
    const isAuthorized = await WaitingRoomService.isUserAuthorized(chatId, session.user.id);
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Not a participant' }, { status: 403 });
    }

    const status = await WaitingRoomService.getWaitingRoomStatus(chatId, session.user.id);
    
    return NextResponse.json({
      bothReady: status.bothReady || status.chatInitiated,
      userReady: status.currentUser.isReady,
      hasAnswers: status.currentUser.hasAnswers,
      waitingForOther: !status.bothReady && !status.chatInitiated && status.currentUser.isReady,
      chatInitiated: status.chatInitiated
    });

  } catch (error) {
    console.error('Error checking waiting room status:', error);
    return NextResponse.json(
      { error: 'Failed to check status' },
      { status: 500 }
    );
  }
} 