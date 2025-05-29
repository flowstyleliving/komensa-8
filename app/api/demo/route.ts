// GPT CONTEXT:
// This file handles chat message retrieval and posting, including turn-taking enforcement.
// Related modules: /features/ai/generateAIReply.ts, /lib/prisma.ts
// Do NOT modify /lib/redis.ts or /features/chat/events.ts in this file.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/demoAuth';
import { generateAIReply } from '@/features/ai/services/generateAIReply';
import { generateDemoAIReply } from '@/features/demo/generateDemoAIReply';
import { pusherServer, getChatChannelName, PUSHER_EVENTS } from '@/lib/pusher';
import { TurnManager } from '@/features/chat/services/turnManager';
import { DemoTurnManager, DEMO_ROLES } from '@/features/demo/demoTurnManager';
import { setTypingIndicator } from '@/lib/redis';
import { setTimeout } from 'timers';

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

  const chat = await prisma.chat.findUnique({
    where: { id: chatId },
    include: { participants: true }
  });

  if (chat?.origin === 'demo') {
    const demoTurnManager = new DemoTurnManager(chatId);
    console.log('[Messages API] Demo chat detected, using DemoTurnManager');
    
    const canSend = await demoTurnManager.canUserSendMessage(senderId);
    if (!canSend) {
      const currentTurn = await demoTurnManager.getCurrentTurn();
      console.log('[Messages API] Not user turn (demo role-based):', { 
        senderId, 
        currentRole: currentTurn?.next_role,
        currentUserId: currentTurn?.next_user_id 
      });
      return NextResponse.json({ error: 'Not your turn' }, { status: 403 });
    }
  } else {
    const turnManager = new TurnManager(chatId);
    console.log('[Messages API] Non-demo chat, using standard TurnManager');
    
    const turn = await turnManager.getCurrentTurn();
    console.log('[Messages API] Current turn state (non-demo):', turn);
    
    if (turn?.next_user_id && turn.next_user_id !== senderId) {
      console.log('[Messages API] Not user turn (non-demo):', { expected: turn.next_user_id, actual: senderId });
      return NextResponse.json({ error: 'Not your turn' }, { status: 403 });
    } else if (!turn && (await prisma.event.count({ where: { chat_id: chatId, type: 'message' } })) > 0) {
      console.log('[Messages API] Non-demo chat, no turn state after first message. Assuming not user turn.');
      return NextResponse.json({ error: 'Not your turn' }, { status: 403 });
    }
  }

  const newMessage = await prisma.event.create({
    data: {
      chat_id: chatId,
      type: 'message',
      data: { content, senderId },
      created_at: new Date(),
      seq: 0,
    },
  });
  console.log('[Messages API] Message saved to database');

  await pusherServer.trigger(channelName, PUSHER_EVENTS.NEW_MESSAGE, {
    id: newMessage.id,
    created_at: newMessage.created_at.toISOString(),
    data: { content, senderId }
  });

  if (chat?.origin === 'demo') {
    const demoTurnManager = new DemoTurnManager(chatId);
    console.log('[Messages API] Demo chat: Setting turn to mediator and triggering demo AI reply via new API');
    await demoTurnManager.setTurnToRole(DEMO_ROLES.MEDIATOR);

    const targetUrl = `${req.nextUrl.origin}/api/demo/gen-ai-reply`;
    console.log(`[Messages API] Attempting fire-and-forget fetch to: ${targetUrl}`);

    // Temporarily await for debugging in Vercel
    try {
      console.log(`[Messages API] Attempting to AWAIT fetch to: ${targetUrl} for debugging...`);
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ chatId, userId: senderId, userMessage: content }),
      });
      console.log(`[Messages API] AWAITED fetch response status: ${response.status}`);
      const responseBody = await response.text();
      console.log(`[Messages API] AWAITED fetch response body: ${responseBody}`);
      if (!response.ok) {
        console.error(`[Messages API] AWAITED fetch response not OK: ${response.status}`, responseBody);
      }
    } catch (err: any) { // Explicitly type err as any for accessing properties
      console.error(`[Messages API] Error during AWAITED fetch to ${targetUrl}:`, err);
      if (err instanceof Error) {
        console.error('[Messages API] AWAITED Fetch error message:', err.message);
        console.error('[Messages API] AWAITED Fetch error stack:', err.stack);
        if (err.cause) console.error('[Messages API] AWAITED Fetch error cause:', err.cause);
      } else {
        console.error('[Messages API] AWAITED Fetch error (not an Error object):', err);
      }
    }
    console.log(`[Messages API] AWAITED fetch attempt to ${targetUrl} completed.`);

  } else {
    console.log('[Messages API] Non-demo chat: Setting turn to assistant and triggering standard AI reply');
    await prisma.chatTurnState.upsert({
      where: { chat_id: chatId },
      update: { next_user_id: 'assistant' },
      create: { chat_id: chatId, next_user_id: 'assistant' },
    });
    
    await pusherServer.trigger(channelName, PUSHER_EVENTS.TURN_UPDATE, { next_user_id: 'assistant' });
    console.log('[Messages API] Non-demo turn update emitted to assistant');

    generateAIReply({ chatId, userId: senderId, userMessage: content }).catch(async (err) => {
      console.error('[Standard AI] Failed to generate reply:', err);
      if (err instanceof Error) {
        console.error('[Standard AI] Error message:', err.message);
        console.error('[Standard AI] Error stack:', err.stack);
        if (err.cause) console.error('[Standard AI] Error cause:', err.cause);
        for (const key in err) console.error(`[Standard AI] Error property ${key}:`, (err as any)[key]);
      } else {
        console.error('[Standard AI] Error (not an Error object):', err);
      }
      try {
        await setTypingIndicator(chatId, 'assistant', false);
        await pusherServer.trigger(channelName, PUSHER_EVENTS.ASSISTANT_TYPING, { isTyping: false });
        console.log('[Standard AI] Typing indicator reset after error');
      } catch (cleanupError) {
        console.error('[Standard AI] Failed to reset typing indicator:', cleanupError);
      }
    });
    console.log('[Messages API] Standard AI reply generation started');
  }

  return NextResponse.json({ ok: true });
}
