import { NextRequest, NextResponse } from 'next/server';
import { setTypingIndicator } from '@/lib/redis';
import { pusherServer, getChatChannelName, PUSHER_EVENTS } from '@/lib/pusher';
import { auth } from '@/lib/demoAuth';
import { TurnManager } from '@/features/chat/services/turnManager';
import { prisma } from '@/lib/prisma';

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

export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = getUserId(req, session);
  
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { chatId, isTyping } = await req.json();

  if (!chatId || typeof isTyping !== 'boolean') {
    return NextResponse.json({ error: 'Missing chatId or isTyping' }, { status: 400 });
  }

  try {
    // Check if this is a demo chat and validate turn-taking
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      select: { origin: true }
    });

    if (chat?.origin === 'demo' && isTyping) {
      // For demo chats, only allow typing if it's the user's turn
      const turnManager = new TurnManager(chatId);
      const canType = await turnManager.canUserSendMessage(userId);
      
      if (!canType) {
        console.log('[Typing API] User cannot type - not their turn:', { userId, chatId });
        return NextResponse.json({ error: 'Not your turn to type' }, { status: 403 });
      }
    }

    // Set typing indicator in Redis
    await setTypingIndicator(chatId, userId, isTyping);
    
    // Emit typing event via Pusher
    const channelName = getChatChannelName(chatId);
    await pusherServer.trigger(channelName, PUSHER_EVENTS.USER_TYPING, {
      userId,
      isTyping
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to set typing indicator:', error);
    return NextResponse.json({ error: 'Failed to set typing indicator' }, { status: 500 });
  }
} 