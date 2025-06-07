// Production messages API for handling regular chat functionality
// This handles turn management and AI replies for production chats only

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
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
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  console.log(`[Messages API] ${requestId} - Request started`);
  console.log(`[Messages API] ${requestId} - URL:`, req.url);
  console.log(`[Messages API] ${requestId} - Method:`, req.method);
  
  try {
    console.log(`[Messages API] ${requestId} - Getting session...`);
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      console.log(`[Messages API] ${requestId} - Unauthorized: no session`);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.log(`[Messages API] ${requestId} - Session found for user: ${session.user.id}`);

    console.log(`[Messages API] ${requestId} - Parsing request body...`);
    const body = await req.json();
    const { chatId, content } = body;

    if (!chatId || !content) {
      console.log(`[Messages API] ${requestId} - Missing data: chatId=${!!chatId}, content=${!!content}`);
      return NextResponse.json({ error: 'Missing chatId or content' }, { status: 400 });
    }

    console.log(`[Messages API] ${requestId} - Request data: chatId=${chatId}, contentLength=${content.length}, senderId=${session.user.id}`);

    // For guest users, verify they have access to this specific chat
    if (session.user.isGuest && session.user.chatId !== chatId) {
      console.log(`[Messages API] ${requestId} - Guest access denied: user.chatId=${session.user.chatId}, requested=${chatId}`);
      return NextResponse.json({ error: 'Access denied - guests can only access their invited chat' }, { status: 403 });
    }

    console.log(`[Messages API] ${requestId} - Verifying chat access...`);
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
      console.log(`[Messages API] ${requestId} - Chat not found or access denied`);
      return NextResponse.json({ error: 'Chat not found or access denied' }, { status: 404 });
    }
    console.log(`[Messages API] ${requestId} - Chat access verified, ${chat.participants.length} participants`);

    const channelName = getChatChannelName(chatId);

    console.log(`[Messages API] ${requestId} - Setting up simplified turn manager...`);
    // Run typing cleanup and turn validation in parallel
    const turnManager = new TurnManager(chatId);
    
    const [, canSend] = await Promise.all([
      // Clear stale typing indicators in parallel (non-blocking)
      (async () => {
        try {
          const { getTypingUsers, setTypingIndicator } = await import('@/lib/redis');
          const typingUsers = await getTypingUsers(chatId);
          
          // Parallelize typing indicator cleanup
          const typingPromises = typingUsers
            .filter(typingUserId => typingUserId !== session.user.id && typingUserId !== 'assistant')
            .map(typingUserId => Promise.all([
              setTypingIndicator(chatId, typingUserId, false),
              pusherServer.trigger(channelName, PUSHER_EVENTS.USER_TYPING, { 
                userId: typingUserId, 
                isTyping: false 
              })
            ]));
          
          await Promise.all(typingPromises);
        } catch (typingError) {
          console.warn('[Messages API] Failed to clear stale typing indicators:', typingError);
        }
      })(),
      // Check turn permissions in parallel
      turnManager.canUserSendMessage(session.user.id)
    ]);
    
    console.log(`[Messages API] ${requestId} - Turn check: canSend=${canSend}`);
    
    if (!canSend) {
      console.log(`[Messages API] ${requestId} - Turn denied for user: ${session.user.id}`);
      return NextResponse.json({ error: 'Not your turn' }, { status: 403 });
    }

    // Generate optimistic message ID and timestamp for immediate broadcast
    const optimisticId = `opt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date();

    // Broadcast message immediately for better UX, then save to database
    const [newMessage] = await Promise.all([
      // Database write (parallel)
      prisma.event.create({
        data: {
          chat_id: chatId,
          type: 'message',
          data: { content, senderId: session.user.id },
          created_at: timestamp,
          seq: 0,
        },
      }),
      // Pusher broadcast (parallel) - users see message immediately
      pusherServer.trigger(channelName, PUSHER_EVENTS.NEW_MESSAGE, {
        id: optimisticId, // Use optimistic ID for immediate display
        created_at: timestamp.toISOString(),
        data: { content, senderId: session.user.id }
      })
    ]);

    // Send correction with real ID if different (rarely needed)
    if (newMessage.id !== optimisticId) {
      await pusherServer.trigger(channelName, 'MESSAGE_ID_UPDATE', {
        optimisticId,
        realId: newMessage.id
      });
    }

    console.log(`[Messages API] ${requestId} - Triggering AI reply generation...`);
    // Fire-and-forget AI generation (demo pattern)
    const targetUrl = `${req.nextUrl.origin}/api/ai/generate-reply`;
    try {
      const aiResponse = await fetch(targetUrl, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Cookie': req.headers.get('cookie') || '',
        },
        body: JSON.stringify({ 
          chatId, 
          userId: session.user.id, 
          userMessage: content 
        }),
      });
      console.log(`[Messages API] ${requestId} - AI generation fetch initiated: ${aiResponse.status}`);
      if (!aiResponse.ok) {
        console.error(`[Messages API] ${requestId} - AI generation failed with status: ${aiResponse.status}`);
      }
    } catch (aiError) {
      console.error(`[Messages API] ${requestId} - Error calling AI generation:`, aiError);
      // Continue - don't fail the message sending
    }

    console.log(`[Messages API] ${requestId} - Request completed successfully`);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[Messages API] Error posting message:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 