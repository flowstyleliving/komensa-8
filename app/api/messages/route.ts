// GPT CONTEXT:
// This file handles chat message retrieval and posting, including turn-taking enforcement.
// Related modules: /features/ai/generateAIReply.ts, /lib/prisma.ts
// Do NOT modify /lib/redis.ts or /features/chat/events.ts in this file.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { generateAIReply } from '@/features/ai/services/generateAIReply';
import { pusherServer, getChatChannelName, PUSHER_EVENTS } from '@/lib/pusher';
import { TurnManager, DEMO_ROLES } from '@/features/chat/services/turnManager';
import { setTypingIndicator } from '@/lib/redis';

// Helper function to get user ID from session or demo cookie
function getUserId(req: NextRequest, session: any) {
  // First try session
  if (session?.user?.id) {
    return session.user.id;
  }
  
  // Then try demo cookie
  const demoUserCookie = req.cookies.get('demo_user')?.value;
  if (demoUserCookie) {
    try {
      const demoUser = JSON.parse(demoUserCookie);
      return demoUser.id;
    } catch (e) {
      console.error('Failed to parse demo user cookie:', e);
    }
  }
  
  return null;
}

// GET: Fetch messages for a given chat
export async function GET(req: NextRequest) {
  const chatId = req.nextUrl.searchParams.get('chatId');
  if (!chatId) {
    return NextResponse.json({ error: 'Missing chatId' }, { status: 400 });
  }

  const messages = await prisma.event.findMany({
    where: { chat_id: chatId },
    orderBy: { created_at: 'asc' },
  });

  return NextResponse.json({ messages });
}

// POST: Send a new message and update turn state
export async function POST(req: NextRequest) {
  const session = await auth();
  const senderId = getUserId(req, session);
  
  if (!senderId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { chatId, content } = body;

  if (!chatId || !content) {
    return NextResponse.json({ error: 'Missing chatId or content' }, { status: 400 });
  }

  console.log('[Messages API] Sending message:', { chatId, senderId, content });

  const channelName = getChatChannelName(chatId);
  const turnManager = new TurnManager(chatId);

  // Check if this is a demo chat
  const chat = await prisma.chat.findUnique({
    where: { id: chatId },
    include: { participants: true }
  });

  if (chat?.origin === 'demo') {
    // Use role-based turn management for demo chats
    console.log('[Messages API] Demo chat detected, using role-based turn management');
    
    const canSend = await turnManager.canUserSendMessage(senderId);
    if (!canSend) {
      const currentTurn = await turnManager.getCurrentTurn();
      console.log('[Messages API] Not user turn (role-based):', { 
        senderId, 
        currentRole: currentTurn?.next_role,
        currentUserId: currentTurn?.next_user_id 
      });
      return NextResponse.json({ error: 'Not your turn' }, { status: 403 });
    }
  } else {
    // Use legacy turn management for non-demo chats
    console.log('[Messages API] Non-demo chat, using legacy turn management');
    
    const turn = await prisma.chatTurnState.findUnique({ where: { chat_id: chatId } });
    console.log('[Messages API] Current turn state:', turn);
    
    if (turn?.next_user_id && turn.next_user_id !== senderId) {
      console.log('[Messages API] Not user turn:', { expected: turn.next_user_id, actual: senderId });
      return NextResponse.json({ error: 'Not your turn' }, { status: 403 });
    }
  }

  // Save message as event
  const newMessage = await prisma.event.create({
    data: {
      chat_id: chatId,
      type: 'message',
      data: { content, senderId },
      created_at: new Date(),
      seq: 0, // placeholder, can use Redis for atomic seq if needed
    },
  });
  console.log('[Messages API] Message saved to database');

  // Emit new message event
  await pusherServer.trigger(channelName, PUSHER_EVENTS.NEW_MESSAGE, {
    id: newMessage.id,
    created_at: newMessage.created_at.toISOString(),
    data: {
      content,
      senderId
    }
  });

  if (chat?.origin === 'demo') {
    // Use role-based turn management
    console.log('[Messages API] Setting turn to mediator for demo chat');
    await turnManager.setTurnToRole(DEMO_ROLES.MEDIATOR);
  } else {
    // Use legacy turn management
    console.log('[Messages API] Setting turn to assistant for non-demo chat');
    await prisma.chatTurnState.upsert({
      where: { chat_id: chatId },
      update: { next_user_id: 'assistant' },
      create: { chat_id: chatId, next_user_id: 'assistant' },
    });
    
    // Emit turn update
    await pusherServer.trigger(channelName, PUSHER_EVENTS.TURN_UPDATE, { next_user_id: 'assistant' });
  }

  // Begin AI response with better error handling
  generateAIReply({ chatId, userId: senderId, userMessage: content }).catch(async (err) => {
    console.error('[AI] Failed to generate reply:', err);
    
    // Ensure typing indicator is reset on error (both Redis and Pusher)
    try {
      await setTypingIndicator(chatId, 'assistant', false);
      await pusherServer.trigger(channelName, PUSHER_EVENTS.ASSISTANT_TYPING, { isTyping: false });
      console.log('[AI] Typing indicator reset after error');
    } catch (pusherError) {
      console.error('[AI] Failed to reset typing indicator:', pusherError);
    }
  });
  console.log('[Messages API] AI reply generation started');

  return NextResponse.json({ ok: true });
}
