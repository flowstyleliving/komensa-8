// Production messages API using EventDrivenOrchestrator
// Event-driven architecture for scalable conversation management

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { EventDrivenOrchestrator } from '@/features/chat/services/EventDrivenOrchestrator';

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

    // Verify user has access to this chat
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

    // Fetch messages
    const messages = await prisma.event.findMany({
      where: { 
        chat_id: chatId,
        type: 'message'
      },
      orderBy: { created_at: 'asc' }
    });

    return NextResponse.json({ messages });
  } catch (error) {
    console.error('[Messages API] Error fetching messages:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Send a new message (SIMPLIFIED with ConversationOrchestrator)
export async function POST(req: NextRequest) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    // Authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      console.log(`[Messages API] ${requestId} - Unauthorized request`);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`[Messages API] ${requestId} - Session found for user: ${session.user.id}`);

    // Parse request
    console.log(`[Messages API] ${requestId} - Parsing request body...`);
    const { chatId, content } = await req.json();

    if (!chatId || !content) {
      console.log(`[Messages API] ${requestId} - Missing data: chatId=${!!chatId}, content=${!!content}`);
      return NextResponse.json({ error: 'Missing chatId or content' }, { status: 400 });
    }

    console.log(`[Messages API] ${requestId} - Request data: chatId=${chatId}, contentLength=${content.length}, senderId=${session.user.id}`);

    // Guest access validation
    if (session.user.isGuest && session.user.chatId !== chatId) {
      console.log(`[Messages API] ${requestId} - Guest access denied: user.chatId=${session.user.chatId}, requested=${chatId}`);
      return NextResponse.json({ error: 'Access denied - guests can only access their invited chat' }, { status: 403 });
    }

    // Verify chat access (with retry for guest users)
    console.log(`[Messages API] ${requestId} - Verifying chat access...`);
    let chat = await prisma.chat.findFirst({
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

    // GUEST USER RACE CONDITION FIX: Retry for guest users who might have just been added
    if (!chat && session.user.isGuest) {
      console.log(`[Messages API] ${requestId} - Chat not found for guest user, retrying in case of race condition...`);
      
      // Brief delay to allow database consistency
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Retry the query
      chat = await prisma.chat.findFirst({
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
      
      if (chat) {
        console.log(`[Messages API] ${requestId} - Guest access granted on retry - race condition resolved`);
      }
    }

    if (!chat) {
      console.log(`[Messages API] ${requestId} - Chat not found or access denied after all attempts`);
      return NextResponse.json({ error: 'Chat not found or access denied' }, { status: 404 });
    }

    console.log(`[Messages API] ${requestId} - Chat access verified, ${chat.participants.length} participants`);

    // 🎯 NEW: Use EventDrivenOrchestrator for everything
    console.log(`[Messages API] ${requestId} - Processing message with EventDrivenOrchestrator...`);
    
    const orchestrator = new EventDrivenOrchestrator(chatId);
    
    try {
      const result = await orchestrator.processMessage({
        chatId,
        userId: session.user.id,
        content: content.trim(),
        userAgent: req.headers.get('user-agent') || undefined,
        isGuest: session.user.isGuest || false
      });

      // Handle orchestrator result
      if (result.error) {
        console.log(`[Messages API] ${requestId} - Orchestrator error: ${result.error}`);
        return NextResponse.json({ error: result.error }, { status: 403 });
      }

      console.log(`[Messages API] ${requestId} - Message processed successfully by orchestrator`);
      console.log(`[Messages API] ${requestId} - Result: canSend=${result.canSend}, nextUser=${result.nextUserId}, aiTriggered=${result.shouldTriggerAI}`);

      return NextResponse.json({ 
        ok: true,
        state: result
      });
      
    } finally {
      // CRITICAL: Clean up event handlers to prevent duplicate AI responses
      orchestrator.cleanup();
      console.log(`[Messages API] ${requestId} - Orchestrator cleaned up`);
    }

  } catch (error) {
    console.error(`[Messages API] ${requestId} - Error processing message:`, error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 