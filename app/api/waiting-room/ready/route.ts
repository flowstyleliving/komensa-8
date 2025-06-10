import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { WaitingRoomService, WaitingRoomAnswers } from '@/lib/waiting-room';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { chatId, answers } = await request.json() as {
      chatId: string;
      answers: WaitingRoomAnswers;
    };

    if (!chatId || !answers) {
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
    const initiation = await WaitingRoomService.initiateChatIfReady(chatId);
    
    if (initiation.initiated && initiation.aiIntroduction) {
      console.log('[Waiting Room] Both participants ready - chat initiated');
      
      // Send AI introduction as first message
      try {
        await prisma.event.create({
          data: {
            chat_id: chatId,
            type: 'message',
            data: {
              text: initiation.aiIntroduction,
              sender: 'ai_mediator',
              timestamp: new Date().toISOString(),
              isSystemMessage: true
            }
          }
        });

        // Notify participants that chat is starting
        const { pusherServer, getChatChannelName, PUSHER_EVENTS } = await import('@/lib/pusher');
        const channelName = getChatChannelName(chatId);
        
        await pusherServer.trigger(channelName, PUSHER_EVENTS.CHAT_INITIATED, {
          aiIntroduction: initiation.aiIntroduction,
          initiatedAt: new Date().toISOString()
        });
        
        console.log('[Waiting Room] Chat initiated successfully with AI introduction');
      } catch (pusherNotificationError) {
        console.error('[Waiting Room] Failed to send chat initiation notification:', pusherNotificationError);
      }
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