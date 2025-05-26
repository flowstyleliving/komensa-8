import { NextRequest, NextResponse } from 'next/server';
import { generateAIReplyNoPusher } from '@/features/ai/services/generateAIReply-no-pusher';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    console.log('[Debug Test No Pusher] Starting test...');
    
    // Find a demo chat
    let testChat = await prisma.chat.findFirst({
      where: { 
        origin: 'demo',
        participants: {
          some: {
            user: {
              display_name: 'User A'
            }
          }
        }
      },
      include: {
        participants: {
          include: {
            user: true
          }
        }
      }
    });

    if (!testChat) {
      console.log('[Debug Test No Pusher] No demo chat found, please create one first');
      return NextResponse.json({ 
        error: 'No demo chat found. Please visit /api/demo/seed first to create a demo chat.' 
      }, { status: 404 });
    }

    const userA = testChat.participants.find((p: any) => p.user?.display_name === 'User A');
    if (!userA) {
      return NextResponse.json({ 
        error: 'User A not found in demo chat' 
      }, { status: 404 });
    }

    console.log('[Debug Test No Pusher] Found demo chat:', testChat.id);
    console.log('[Debug Test No Pusher] User A ID:', userA.user_id);

    // Test message
    const testMessage = "Hi, I'd like to discuss our budget allocation for this month.";

    console.log('[Debug Test No Pusher] Triggering AI mediator WITHOUT Pusher...');
    
    // Trigger the AI mediator without Pusher
    const result = await generateAIReplyNoPusher({
      chatId: testChat.id,
      userId: userA.user_id,
      userMessage: testMessage
    });

    console.log('[Debug Test No Pusher] AI mediator response:', result);

    return NextResponse.json({
      success: true,
      chatId: testChat.id,
      userId: userA.user_id,
      testMessage,
      result,
      message: 'AI mediator test (NO PUSHER) completed successfully'
    });

  } catch (error) {
    console.error('[Debug Test No Pusher] Error:', error);
    return NextResponse.json({ 
      error: 'Failed to test AI mediator (no pusher)',
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
} 