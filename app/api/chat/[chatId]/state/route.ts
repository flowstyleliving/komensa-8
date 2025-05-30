import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTypingUsers } from '@/lib/redis';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { TurnManager } from '@/features/chat/services/turnManager';

// GET: Fetch chat state
export async function GET(request: NextRequest, { params }: { params: Promise<{ chatId: string }> }) {
  const { chatId } = await params;
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;

  // Verify user is a participant in this chat
  const chat = await prisma.chat.findFirst({
    where: {
      id: chatId,
      participants: {
        some: {
          user_id: userId
        }
      }
    },
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

  if (!chat) {
    return NextResponse.json({ error: 'Chat not found or access denied' }, { status: 404 });
  }

  // Fetch messages from Prisma
  const messages = await prisma.event.findMany({
    where: { chat_id: chatId },
    orderBy: { created_at: 'asc' },
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

  // Initialize turn state if it doesn't exist (fallback)
  if (!turnState) {
    console.log('[Chat State] Initializing turn management (fallback)');
    const turnManager = new TurnManager(chatId);
    
    // Try to get the chat creator from the chat_created event
    const chatCreatedEvent = chat.events[0];
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

  // Get participant information for the response
  const participants = chat.participants.map(p => ({
    id: p.user_id,
    display_name: p.user?.display_name || 'Unknown User'
  }));

  return NextResponse.json({
    messages,
    currentTurn: turnState,
    isAssistantTyping,
    typingUsers,
    participants,
  });
}

// PATCH: Update chat settings
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ chatId: string }> }) {
  const { chatId } = await params;
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
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