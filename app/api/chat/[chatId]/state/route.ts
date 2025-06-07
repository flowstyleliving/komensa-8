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
  
  // Debug logging for guest sessions
  console.log('[Chat State] Session debug:', {
    hasSession: !!session,
    userId: session?.user?.id,
    userName: session?.user?.name,
    isGuest: session?.user?.isGuest,
    sessionChatId: session?.user?.chatId,
    requestChatId: chatId,
    sessionEmail: session?.user?.email
  });
  
  if (!session?.user?.id) {
    console.log('[Chat State] No session or user ID, returning 401');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;

  // For guest users, verify they have access to this specific chat
  if (session.user.isGuest && session.user.chatId !== chatId) {
    return NextResponse.json({ error: 'Access denied - guest can only access their invited chat' }, { status: 403 });
  }

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

  // For simplified turn management, always provide a turn state
  if (!turnState) {
    console.log('[Chat State] Creating simplified turn state');
    const turnManager = new TurnManager(chatId);
    
    // Get turn style to determine state
    const style = await turnManager.getTurnStyle();
    
    if (style === 'flexible') {
      // For flexible, create a dummy state that allows anyone
      turnState = {
        next_user_id: 'anyone',
        next_role: 'user',
        turn_queue: [] as any,
        current_turn_index: 0
      } as any;
    } else {
      // For strict/moderated, get actual turn state from simplified manager
      const currentTurn = await turnManager.getCurrentTurn();
      turnState = {
        next_user_id: currentTurn?.next_user_id || userId,
        next_role: currentTurn?.next_role || 'user',
        turn_queue: [] as any,
        current_turn_index: 0
      } as any;
    }
    
    console.log('[Chat State] Simplified turn state created:', turnState);
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

  // Guests cannot modify chat settings
  if (session.user.isGuest) {
    return NextResponse.json({ error: 'Guests cannot modify chat settings' }, { status: 403 });
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