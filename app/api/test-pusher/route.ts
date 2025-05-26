import { NextRequest, NextResponse } from 'next/server';
import { pusherServer, getChatChannelName, PUSHER_EVENTS } from '@/lib/pusher';

export async function POST(req: NextRequest) {
  try {
    const { chatId, message } = await req.json();
    
    if (!chatId) {
      return NextResponse.json({ error: 'Missing chatId' }, { status: 400 });
    }

    const channelName = getChatChannelName(chatId);
    
    // Test sending a message through Pusher
    await pusherServer.trigger(channelName, PUSHER_EVENTS.NEW_MESSAGE, {
      id: 'test-' + Date.now(),
      created_at: new Date().toISOString(),
      data: {
        content: message || 'Test message from Pusher',
        senderId: 'test-user'
      }
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Test message sent via Pusher',
      channel: channelName 
    });
  } catch (error) {
    console.error('Pusher test error:', error);
    return NextResponse.json({ 
      error: 'Failed to send test message',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 