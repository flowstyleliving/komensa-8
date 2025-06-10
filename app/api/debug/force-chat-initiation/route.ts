import { NextRequest, NextResponse } from 'next/server';
import { WaitingRoomService } from '@/lib/waiting-room';

export async function POST(request: NextRequest) {
  try {
    const { chatId } = await request.json();
    
    if (!chatId) {
      return NextResponse.json({ error: 'Missing chatId' }, { status: 400 });
    }

    console.log(`[Debug] Force initiating chat: ${chatId}`);
    
    // Check current readiness state
    const readinessState = await WaitingRoomService.getReadinessState(chatId);
    console.log('[Debug] Current readiness state:', readinessState);
    
    // Force initiation regardless of current state
    const initiation = await WaitingRoomService.initiateChatIfReady(chatId);
    console.log('[Debug] Initiation result:', initiation);
    
    if (initiation.initiated) {
      // Send the Pusher event manually
      try {
        const { pusherServer, getChatChannelName, PUSHER_EVENTS } = await import('@/lib/pusher');
        const channelName = getChatChannelName(chatId);
        
        await pusherServer.trigger(channelName, PUSHER_EVENTS.CHAT_INITIATED, {
          initiatedAt: new Date().toISOString(),
          chatId,
          forcedByDebug: true
        });
        
        console.log('[Debug] CHAT_INITIATED event sent successfully');
      } catch (pusherError) {
        console.error('[Debug] Failed to send CHAT_INITIATED event:', pusherError);
        return NextResponse.json({
          success: false,
          error: 'Failed to send Pusher event',
          details: pusherError instanceof Error ? pusherError.message : 'Unknown error'
        }, { status: 500 });
      }
    }
    
    return NextResponse.json({
      success: true,
      initiated: initiation.initiated,
      readinessState,
      chatId
    });
    
  } catch (error) {
    console.error('[Debug] Error forcing chat initiation:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 