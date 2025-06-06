import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { pusherServer, getChatChannelName, PUSHER_EVENTS } from '@/lib/pusher';
import { setTypingIndicator } from '@/lib/redis';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { chatId } = await params;
    if (!chatId) {
      return NextResponse.json({ error: 'Missing chatId' }, { status: 400 });
    }

    console.log(`[AI Recovery] Manual AI recovery triggered for chat ${chatId} by user ${session.user.id}`);

    const channelName = getChatChannelName(chatId);

    // Force clear typing indicator in Redis
    try {
      await setTypingIndicator(chatId, 'assistant', false);
      console.log('[AI Recovery] Redis typing indicator cleared');
    } catch (redisError) {
      console.error('[AI Recovery] Redis cleanup failed:', redisError);
      // Continue anyway
    }

    // Force clear typing indicator via Pusher
    try {
      await pusherServer.trigger(channelName, PUSHER_EVENTS.ASSISTANT_TYPING, { 
        isTyping: false,
        forced: true,
        recoveredBy: session.user.id 
      });
      console.log('[AI Recovery] Pusher typing indicator cleared');
    } catch (pusherError) {
      console.error('[AI Recovery] Pusher cleanup failed:', pusherError);
      // Continue anyway
    }

    // Trigger a turn refresh to make sure turn state is correct
    try {
      await pusherServer.trigger(channelName, PUSHER_EVENTS.TURN_UPDATE, { 
        timestamp: new Date().toISOString(),
        recovered: true 
      });
      console.log('[AI Recovery] Turn state refresh triggered');
    } catch (turnError) {
      console.error('[AI Recovery] Turn refresh failed:', turnError);
      // Continue anyway
    }

    console.log(`[AI Recovery] Manual recovery completed for chat ${chatId}`);

    return NextResponse.json({ 
      success: true, 
      message: 'AI typing indicator cleared and turn state refreshed',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[AI Recovery] Manual recovery failed:', error);
    return NextResponse.json({ 
      error: 'Failed to recover AI state',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}