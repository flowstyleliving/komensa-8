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

  // Verify user is a participant in this chat (with retry for guest users)
  let chat = await prisma.chat.findFirst({
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
        include: { 
          user: {
            select: {
              id: true,
              display_name: true,
              name: true,
              email: true
            }
          }
        }
      },
      events: {
        where: { type: 'chat_created' },
        take: 1
      }
    }
  });

  console.log('[Chat State] Initial chat query result:', {
    chatId,
    userId,
    foundChat: !!chat,
    participantCount: chat?.participants?.length || 0,
    participantsDetail: chat?.participants?.map(p => ({
      user_id: p.user_id,
      role: p.role,
      user_display_name: p.user?.display_name,
      user_name: p.user?.name,
      user_email: p.user?.email,
      user_object: p.user
    })) || []
  });

  // GUEST USER RACE CONDITION FIX: Retry for guest users who might have just been added
  if (!chat && session.user.isGuest) {
    console.log('[Chat State] Chat not found for guest user, retrying in case of race condition...');
    
    // Brief delay to allow database consistency
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Retry the query
    chat = await prisma.chat.findFirst({
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
    
    if (chat) {
      console.log('[Chat State] Guest access granted on retry - race condition resolved');
    }
  }

  if (!chat) {
    console.log('[Chat State] Access denied after all attempts:', { userId, chatId, isGuest: session.user.isGuest });
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

  // Ensure turn state exists and is properly initialized
  if (!turnState) {
    console.log('[Chat State] No turn state found, ensuring it exists');
    const turnManager = new TurnManager(chatId);
    
    // Use the new method to ensure turn state exists
    const ensuredTurnState = await turnManager.ensureTurnStateExists();
    
    turnState = {
      next_user_id: ensuredTurnState.next_user_id,
      next_role: ensuredTurnState.next_role || 'user',
      turn_queue: [] as any,
      current_turn_index: 0
    } as any;
    
    console.log('[Chat State] Turn state ensured:', turnState);
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
    display_name: p.user?.display_name || p.user?.name || 'Unknown User'
  }));

  console.log('[Chat State] Returning participants:', {
    chatId,
    participantCount: participants.length,
    participants: participants.map(p => ({ id: p.id, display_name: p.display_name })),
    rawData: chat.participants.map(p => ({ 
      user_id: p.user_id, 
      user_display_name: p.user?.display_name,
      user_name: p.user?.name 
    }))
  });

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