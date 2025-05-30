// Production messages API for handling regular chat functionality
// This handles turn management and AI replies for production chats only

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { generateDemoAIReply } from '@/features/demo/generateDemoAIReply';
import { pusherServer, getChatChannelName, PUSHER_EVENTS } from '@/lib/pusher';
import { TurnManager } from '@/features/chat/services/turnManager';
import { setTypingIndicator } from '@/lib/redis';

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

    // Redirect demo chats to demo API
    if (chat.origin === 'demo') {
      return NextResponse.redirect(new URL(`/api/demo/messages?chatId=${chatId}`, req.url));
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

    console.log('[Messages API] Sending message:', { chatId, senderId: session.user.id, content });

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

    // Redirect demo chats to demo API
    if (chat.origin === 'demo') {
      return NextResponse.redirect(new URL('/api/demo/messages', req.url));
    }

    const channelName = getChatChannelName(chatId);

    // Production chat turn management
    const turnManager = new TurnManager(chatId);
    console.log('[Messages API] Using standard TurnManager');
    
    const turn = await turnManager.getCurrentTurn();
    console.log('[Messages API] Current turn state:', turn);
    
    if (turn?.next_user_id && turn.next_user_id !== session.user.id) {
      console.log('[Messages API] Not user turn:', { expected: turn.next_user_id, actual: session.user.id });
      return NextResponse.json({ error: 'Not your turn' }, { status: 403 });
    } else if (!turn && (await prisma.event.count({ where: { chat_id: chatId, type: 'message' } })) > 0) {
      console.log('[Messages API] No turn state after first message. Assuming not user turn.');
      return NextResponse.json({ error: 'Not your turn' }, { status: 403 });
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

    // Set turn to assistant and trigger AI reply
    console.log('[Messages API] Setting turn to assistant and triggering AI reply');
    await prisma.chatTurnState.upsert({
      where: { chat_id: chatId },
      update: { next_user_id: 'assistant' },
      create: { chat_id: chatId, next_user_id: 'assistant' },
    });
    
    await pusherServer.trigger(channelName, PUSHER_EVENTS.TURN_UPDATE, { next_user_id: 'assistant' });
    console.log('[Messages API] Turn update emitted to assistant');

    // Trigger AI reply generation
    generateDemoAIReply({ 
      chatId, 
      userId: session.user.id, 
      userMessage: content, 
      apiBaseUrl: req.nextUrl.origin 
    }).then(async () => {
      // After AI responds, determine the next human participant
      const turnManager = new TurnManager(chatId);
      const nextUserId = await turnManager.getNextUserAfterAI();
      
      if (nextUserId) {
        // Set turn to the next human participant
        await turnManager.setTurnToUser(nextUserId);
        console.log('[Messages API] Turn set to next participant:', nextUserId);
      } else {
        console.error('[Messages API] Failed to determine next participant');
      }
    }).catch(async (err) => {
      console.error('[AI Reply] Failed to generate reply:', err);
      if (err instanceof Error) {
        console.error('[AI Reply] Error message:', err.message);
        console.error('[AI Reply] Error stack:', err.stack);
        if (err.cause) console.error('[AI Reply] Error cause:', err.cause);
      } else {
        console.error('[AI Reply] Error (not an Error object):', err);
      }
      try {
        await setTypingIndicator(chatId, 'assistant', false);
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
