import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTypingUsers } from '@/lib/redis';
import { auth } from '@/lib/demoAuth';
import { TurnManager } from '@/features/chat/services/turnManager';
import { DemoTurnManager } from '@/features/demo/demoTurnManager';

// GET: Fetch chat state
export async function GET(request: NextRequest, { params }: { params: Promise<{ chatId: string }> }) {
  const { chatId } = await params;
  const session = await auth() as { user?: { id: string } };
  
  // Check for demo user cookie
  const demoUser = request.cookies.get('demo_user')?.value;
  const userId = demoUser ? JSON.parse(demoUser).id : session?.user?.id;

  // Fetch messages from Prisma
  const messages = await prisma.event.findMany({
    where: { chat_id: chatId },
    orderBy: { created_at: 'asc' },
  });

  // Check if this is a demo chat
  const chat = await prisma.chat.findUnique({
    where: { id: chatId },
    include: { 
      participants: {
        include: { user: true }
      }
    }
  });

  // Fetch turn state from Prisma
  let turnState = await prisma.chatTurnState.findUnique({
    where: { chat_id: chatId },
    select: { 
      next_user_id: true,
      next_role: true,
      turn_queue: true,
      current_turn_index: true
    } as any,
  });

  // For demo chats, initialize role-based turn management if needed
  if (chat?.origin === 'demo' && (!turnState || !(turnState as any).next_role)) {
    console.log('[Chat State] Initializing demo turn management');
    const turnManager = new DemoTurnManager(chatId);
    
    // Get participants and identify Michael and Jordan by display name
    const michael = chat.participants.find((p: any) => p.user?.display_name === 'Michael');
    const jordan = chat.participants.find((p: any) => p.user?.display_name === 'Jordan');
    
    if (michael) {
      await turnManager.initializeDemoTurns(michael.user_id);
      
      // Fetch updated turn state
      turnState = await prisma.chatTurnState.findUnique({
        where: { chat_id: chatId },
        select: { 
          next_user_id: true,
          next_role: true,
          turn_queue: true,
          current_turn_index: true
        } as any,
      });
    }
  } else if (!turnState && userId) {
    // For non-demo chats, initialize turn state only if it doesn't exist
    // (it should already exist from chat creation, but this is a fallback)
    console.log('[Chat State] Initializing non-demo turn management (fallback)');
    const turnManager = new TurnManager(chatId);
    
    // Try to determine who should go first
    // If this is the chat creator, they should go first
    // Otherwise, we'll need to look up the creator from the chat
    const chatInfo = await prisma.chat.findUnique({
      where: { id: chatId },
      include: { 
        participants: {
          include: { user: true }
        },
        events: {
          where: { type: 'chat_created' },
          take: 1
        }
      }
    });
    
    // Try to get the chat creator from the chat_created event
    const chatCreatedEvent = chatInfo?.events[0];
    const creatorId = (chatCreatedEvent?.data as any)?.createdBy;
    
    // Initialize with creator going first, or fallback to current user
    const firstUserId = creatorId || userId;
    await turnManager.initializeTurn(firstUserId);
    console.log('[Chat State] Turn management initialized with first user:', firstUserId);
    
    // Update turn state after creation
    turnState = await prisma.chatTurnState.findUnique({
      where: { chat_id: chatId },
      select: { 
        next_user_id: true,
        next_role: true,
        turn_queue: true,
        current_turn_index: true
      } as any,
    });
  }

  // Get typing users from Redis
  let typingUsers: string[] = [];
  let isAssistantTyping = false;
  try {
    typingUsers = await getTypingUsers(chatId);
    isAssistantTyping = typingUsers.includes('assistant');
  } catch {
    // ignore redis errors for now
  }

  return NextResponse.json({
    messages,
    currentTurn: turnState,
    isAssistantTyping,
    typingUsers,
  });
}

// PATCH: Update chat settings
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ chatId: string }> }) {
  const { chatId } = await params;
  const session = await auth() as { user?: { id: string } };
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { mediator_style, turn_taking, chat_extensions } = body;

  try {
    const chat = await prisma.chat.update({
      where: { id: chatId },
      data: {
        mediator_style,
        turn_taking,
        extensions: chat_extensions ? {
          update: chat_extensions
        } : undefined
      }
    });

    return NextResponse.json(chat);
  } catch (error) {
    console.error('[Chat] Failed to update settings:', error);
    return NextResponse.json(
      { error: 'Failed to update chat settings' },
      { status: 500 }
    );
  }
} 