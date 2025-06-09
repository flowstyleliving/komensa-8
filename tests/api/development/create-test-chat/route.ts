import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { DemoTurnManager } from '@/app/demo/features/demoTurnManager';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: NextRequest) {
  try {
    console.log('[Test Chat] Creating test demo chat...');

    // Use virtual demo users (no database creation)
    const user1 = {
      id: 'demo-michael-' + uuidv4().slice(0, 8),
      display_name: 'Michael',
    };

    const user2 = {
      id: 'demo-jordan-' + uuidv4().slice(0, 8),
      display_name: 'Jordan',
    };

    // Create chat without database participants (virtual demo users)
    const chat = await prisma.chat.create({
      data: {
        origin: 'demo',
        mediator_style: 'default',
        turn_taking: 'strict',
        status: 'active',
        // No participants needed - demo users are virtual
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
          content: `Hello Michael and Jordan! I'm here to help facilitate your conversation. Michael, could you please share what you'd like to discuss?`,
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