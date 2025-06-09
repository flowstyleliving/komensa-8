// Demo-specific messages API for handling demo chat functionality only
// This handles turn management and AI replies for demo chats

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/app/demo/utils/demoAuth';
import { generateDemoAIReply } from '@/app/demo/features/generateDemoAIReply';
import { pusherServer, getChatChannelName, PUSHER_EVENTS } from '@/lib/pusher';
import { DemoTurnManager, DEMO_ROLES } from '@/app/demo/features/demoTurnManager';

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

  console.log('[Demo Messages API] Sending message:', { chatId, senderId, content });

  const channelName = getChatChannelName(chatId);

  const chat = await prisma.chat.findUnique({
    where: { id: chatId },
    include: { participants: true }
  });

  // This route should only handle demo chats
  if (chat?.origin !== 'demo') {
    return NextResponse.json({ error: 'Not a demo chat' }, { status: 400 });
  }

  const demoTurnManager = new DemoTurnManager(chatId);
  console.log('[Demo Messages API] Using DemoTurnManager');
  
  const canSend = await demoTurnManager.canUserSendMessage(senderId);
  if (!canSend) {
    const currentTurn = await demoTurnManager.getCurrentTurn();
    console.log('[Demo Messages API] Not user turn (demo role-based):', { 
      senderId, 
      currentRole: currentTurn?.next_role,
      currentUserId: currentTurn?.next_user_id 
    });
    return NextResponse.json({ error: 'Not your turn' }, { status: 403 });
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
  console.log('[Demo Messages API] Message saved to database');

  await pusherServer.trigger(channelName, PUSHER_EVENTS.NEW_MESSAGE, {
    id: newMessage.id,
    created_at: newMessage.created_at.toISOString(),
    data: { content, senderId }
  });

  console.log('[Demo Messages API] Demo chat: Setting turn to mediator and triggering demo AI reply');
  await demoTurnManager.setTurnToRole(DEMO_ROLES.MEDIATOR);

  const targetUrl = `${req.nextUrl.origin}/demo/api/gen-ai-reply`;
  console.log(`[Demo Messages API] Attempting fetch to: ${targetUrl}`);

  try {
    console.log(`[Demo Messages API] Fetching to: ${targetUrl}`);
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ chatId, userId: senderId, userMessage: content }),
    });
    console.log(`[Demo Messages API] Fetch response status: ${response.status}`);
    
    if (!response.ok) {
      console.error(`[Demo Messages API] Fetch response not OK: ${response.status} ${response.statusText}`);
      // Don't log the full HTML response body to avoid spam
    } else {
      const responseBody = await response.text();
      console.log(`[Demo Messages API] Fetch response: ${responseBody.substring(0, 200)}${responseBody.length > 200 ? '...' : ''}`);
    }
  } catch (err: any) {
    console.error(`[Demo Messages API] Error during fetch to ${targetUrl}:`, err?.message || err);
  }
  console.log(`[Demo Messages API] Fetch attempt to ${targetUrl} completed.`);

  return NextResponse.json({ ok: true });
}
