import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { 
  storeParticipantAnswers, 
  checkChatReadiness, 
  generateMediatorIntroPrompt,
  markChatInitiated,
  WaitingRoomQuestions 
} from '@/lib/waiting-room-questions';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { chatId, answers } = await request.json() as {
      chatId: string;
      answers: WaitingRoomQuestions;
    };

    if (!chatId || !answers) {
      return NextResponse.json({ error: 'Missing chatId or answers' }, { status: 400 });
    }

    // Determine if user is host or guest
    const participant = await prisma.chatParticipant.findFirst({
      where: {
        chat_id: chatId,
        user_id: session.user.id
      }
    });

    if (!participant) {
      return NextResponse.json({ error: 'Not a participant in this chat' }, { status: 403 });
    }

    const userType = session.user.isGuest ? 'guest' : 'host';
    
    // Store the participant's answers
    await storeParticipantAnswers(chatId, session.user.id, userType, answers);
    
    // Check if both participants are ready
    const readinessState = await checkChatReadiness(chatId);
    
    if (readinessState.bothReady && readinessState.hostAnswers && readinessState.guestAnswers) {
      console.log('[Waiting Room] Both participants ready - initiating chat');
      
      // Generate AI mediator introduction
      const mediatorPrompt = generateMediatorIntroPrompt(
        readinessState.hostAnswers, 
        readinessState.guestAnswers
      );
      
      // Create AI introduction message
      try {
        const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4',
            messages: [{ role: 'system', content: mediatorPrompt }],
            max_tokens: 250,
            temperature: 0.8,
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const introMessage = aiData.choices[0]?.message?.content;

          if (introMessage) {
            // Save AI introduction message to database
            await prisma.event.create({
              data: {
                chat_id: chatId,
                type: 'message',
                data: {
                  content: introMessage,
                  senderId: 'assistant'
                },
                seq: 0,
              },
            });

            // Mark chat as initiated
            await markChatInitiated(chatId);

            // Notify both participants via Pusher
            const { pusherServer, getChatChannelName, PUSHER_EVENTS } = await import('@/lib/pusher');
            const channelName = getChatChannelName(chatId);
            
            await pusherServer.trigger(channelName, PUSHER_EVENTS.NEW_MESSAGE, {
              message: {
                id: 'chat_intro',
                content: introMessage,
                senderId: 'assistant',
                timestamp: new Date().toISOString()
              },
              chatInitiated: true,
              hostName: readinessState.hostAnswers.name,
              guestName: readinessState.guestAnswers.name
            });

            console.log('[Waiting Room] Chat initiated successfully with AI introduction');
          }
        } else {
          console.error('[Waiting Room] Failed to generate AI introduction:', aiResponse.status);
        }
      } catch (aiError) {
        console.error('[Waiting Room] Error generating AI introduction:', aiError);
      }
    }

    return NextResponse.json({
      success: true,
      userReady: answers.isReady,
      bothReady: readinessState.bothReady,
      waitingForOther: !readinessState.bothReady
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

    // Check if user is participant
    const participant = await prisma.chatParticipant.findFirst({
      where: {
        chat_id: chatId,
        user_id: session.user.id
      }
    });

    if (!participant) {
      return NextResponse.json({ error: 'Not a participant' }, { status: 403 });
    }

    const readinessState = await checkChatReadiness(chatId);
    const userType = session.user.isGuest ? 'guest' : 'host';
    const userAnswers = userType === 'host' ? readinessState.hostAnswers : readinessState.guestAnswers;

    return NextResponse.json({
      bothReady: readinessState.bothReady,
      userReady: userAnswers?.isReady || false,
      hasAnswers: !!userAnswers,
      waitingForOther: !readinessState.bothReady && userAnswers?.isReady
    });

  } catch (error) {
    console.error('Error checking waiting room status:', error);
    return NextResponse.json(
      { error: 'Failed to check status' },
      { status: 500 }
    );
  }
} 