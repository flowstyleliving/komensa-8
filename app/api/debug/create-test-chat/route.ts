import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { DemoTurnManager } from '@/features/chat/services/demoTurnManager';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: NextRequest) {
  try {
    console.log('[Test Chat] Creating test demo chat...');

    // Create two users
    const user1 = await prisma.user.create({
      data: {
        id: uuidv4(),
        display_name: 'User A',
      },
    });

    const user2 = await prisma.user.create({
      data: {
        id: uuidv4(),
        display_name: 'Jordan',
      },
    });

    // Create chat
    const chat = await prisma.chat.create({
      data: {
        origin: 'demo',
        mediator_style: 'default',
        turn_taking: 'strict',
        status: 'active',
        participants: {
          create: [
            { user_id: user1.id, role: 'user' },
            { user_id: user2.id, role: 'user' },
          ],
        },
      },
    });

    // Initialize turn management
    const turnManager = new DemoTurnManager(chat.id);
    await turnManager.initializeDemoTurns(user1.id);

    // Add initial AI message
    await prisma.event.create({
      data: {
        chat_id: chat.id,
        type: 'message',
        data: {
          content: `Hello User A and Jordan! I'm here to help facilitate your conversation. User A, could you please share what you'd like to discuss?`,
          senderId: 'assistant',
        },
      },
    });

    console.log('[Test Chat] Created test chat:', chat.id);

    return NextResponse.json({
      success: true,
      chatId: chat.id,
      userAId: user1.id,
      jordanId: user2.id,
      message: 'Test demo chat created successfully'
    });

  } catch (error) {
    console.error('[Test Chat] Error creating test chat:', error);
    return NextResponse.json({ 
      error: 'Failed to create test chat',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 