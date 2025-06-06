import { NextRequest, NextResponse } from 'next/server';
import { setTypingIndicator } from '@/lib/redis';
import { pusherServer, getChatChannelName, PUSHER_EVENTS } from '@/lib/pusher';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { chatId, isTyping } = await req.json();

  if (!chatId || typeof isTyping !== 'boolean') {
    return NextResponse.json({ error: 'Missing chatId or isTyping' }, { status: 400 });
  }

  try {
    const userId = session.user.id;

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