// Production messages API for handling regular chat functionality
// This handles turn management and AI replies for production chats only

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { generateAIReply } from '@/features/ai/services/generateAIReply';
import { pusherServer, getChatChannelName, PUSHER_EVENTS } from '@/lib/pusher';
import { TurnManager } from '@/features/chat/services/turnManager';

// GET: Fetch messages for a given chat
export async function GET(req: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const chatId = req.nextUrl.searchParams.get('chatId');
    if (!chatId) {
      return NextResponse.json({ error: 'Missing chatId' }, { status: 400 });
    }

    // For guest users, verify they have access to this specific chat
    if (session.user.isGuest && session.user.chatId !== chatId) {
      return NextResponse.json({ error: 'Access denied - guests can only access their invited chat' }, { status: 403 });
    }

    // Verify user is a participant in this chat
    const chat = await prisma.chat.findFirst({
      where: {
        id: chatId,
        participants: {
          some: {
            user_id: session.user.id
          }
        }
      }
    });

    if (!chat) {
      return NextResponse.json({ error: 'Chat not found or access denied' }, { status: 404 });
    }

    const messages = await prisma.event.findMany({
      where: { chat_id: chatId },
      orderBy: { created_at: 'asc' },
    });

    return NextResponse.json({ messages });
  } catch (error) {
    console.error('[Messages API] Error fetching messages:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Send a new message in a production chat
export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { chatId, content } = body;

    if (!chatId || !content) {
      return NextResponse.json({ error: 'Missing chatId or content' }, { status: 400 });
    }

    console.log('[Messages API] Sending message:', { chatId, senderId: session.user.id, content, isGuest: session.user.isGuest });

    // For guest users, verify they have access to this specific chat
    if (session.user.isGuest && session.user.chatId !== chatId) {
      return NextResponse.json({ error: 'Access denied - guests can only access their invited chat' }, { status: 403 });
    }

    // Verify user is a participant and get chat info
    const chat = await prisma.chat.findFirst({
      where: {
        id: chatId,
        participants: {
          some: {
            user_id: session.user.id
          }
        }
      },
      include: { participants: true }
    });

    if (!chat) {
      return NextResponse.json({ error: 'Chat not found or access denied' }, { status: 404 });
    }

    const channelName = getChatChannelName(chatId);

    // NEW: Use EventDrivenTurnManager for all chats
    const turnManager = new TurnManager(chatId);
    console.log('[Messages API] Using EventDrivenTurnManager');
    
    // FIRST: Clear any stale typing indicators that might interfere with turn management
    try {
      const { getTypingUsers, setTypingIndicator } = await import('@/lib/redis');
      const typingUsers = await getTypingUsers(chatId);
      console.log('[Messages API] Current typing users:', typingUsers);
      
      // Clear typing indicators for users who aren't the current sender
      for (const typingUserId of typingUsers) {
        if (typingUserId !== session.user.id && typingUserId !== 'assistant') {
          console.log('[Messages API] Clearing stale typing indicator for user:', typingUserId);
          await setTypingIndicator(chatId, typingUserId, false);
          // Also emit via Pusher to clear frontend
          await pusherServer.trigger(channelName, PUSHER_EVENTS.USER_TYPING, { 
            userId: typingUserId, 
            isTyping: false 
          });
        }
      }
    } catch (typingError) {
      console.warn('[Messages API] Failed to clear stale typing indicators:', typingError);
      // Continue anyway - this is not critical
    }
    
    // Check if user can send message (EventDrivenTurnManager handles this)
    const canSend = await turnManager.canUserSendMessage(session.user.id);
    const currentTurn = await turnManager.getCurrentTurn();
    console.log('[Messages API] Turn validation details:', { 
      userId: session.user.id, 
      isGuest: session.user.isGuest,
      canSend,
      currentTurn,
      nextUserId: currentTurn?.next_user_id,
      nextRole: currentTurn?.next_role
    });
    
    if (!canSend) {
      // RECOVERY: If no turn state exists or it's pointing to assistant, try to reset
      if (!currentTurn || currentTurn.next_user_id === 'assistant') {
        console.log('[Messages API] Attempting turn recovery - no state or stuck on assistant');
        try {
          await turnManager.initializeTurn(session.user.id);
          const recoveredCanSend = await turnManager.canUserSendMessage(session.user.id);
          console.log('[Messages API] Recovery attempt result:', { recoveredCanSend });
          
          if (recoveredCanSend) {
            console.log('[Messages API] Recovery successful, allowing message');
            // Continue with message processing below
          } else {
            console.log('[Messages API] Recovery failed, blocking message');
            return NextResponse.json({ error: 'Not your turn (recovery failed)' }, { status: 403 });
          }
        } catch (recoveryError) {
          console.error('[Messages API] Turn recovery failed:', recoveryError);
          return NextResponse.json({ error: 'Not your turn (recovery error)' }, { status: 403 });
        }
      } else {
        console.log('[Messages API] Not user turn:', { 
          expected: currentTurn?.next_user_id, 
          actual: session.user.id,
          currentTurn
        });
        return NextResponse.json({ error: 'Not your turn' }, { status: 403 });
      }
    }

    // Save the message
    const newMessage = await prisma.event.create({
      data: {
        chat_id: chatId,
        type: 'message',
        data: { content, senderId: session.user.id },
        created_at: new Date(),
        seq: 0,
      },
    });
    console.log('[Messages API] Message saved to database');

    // Emit message via Pusher
    await pusherServer.trigger(channelName, PUSHER_EVENTS.NEW_MESSAGE, {
      id: newMessage.id,
      created_at: newMessage.created_at.toISOString(),
      data: { content, senderId: session.user.id }
    });
    console.log('[Messages API] Message event emitted');

    // NEW: No more manual turn management - EventDrivenTurnManager handles everything
    console.log('[Messages API] Triggering AI reply generation (turn management handled by EventDrivenTurnManager)...');
    
    // Trigger AI reply generation asynchronously - no turn management needed here
    generateAIReply({ 
      chatId, 
      userId: session.user.id, 
      userMessage: content
    }).catch(async (err: Error) => {
      console.error('[AI Reply] Failed to generate reply:', err);
      
      // Only need to reset typing indicator on failure
      try {
        await pusherServer.trigger(channelName, PUSHER_EVENTS.ASSISTANT_TYPING, { isTyping: false });
        console.log('[AI Reply] Typing indicator reset after error');
      } catch (cleanupError) {
        console.error('[AI Reply] Failed to reset typing indicator:', cleanupError);
      }
    });
    
    console.log('[Messages API] AI reply generation started');

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[Messages API] Error posting message:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 