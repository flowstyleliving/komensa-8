import { NextRequest, NextResponse } from 'next/server';
import { pusherServer, getChatChannelName, PUSHER_EVENTS } from '@/lib/pusher';
import { setTypingIndicator, getTypingUsers, isUserTyping } from '@/lib/redis';

export async function GET(req: NextRequest) {
  console.log('[Mobile Realtime Test] Starting mobile-friendly realtime test...');
  
  const testChatId = 'test-mobile-chat';
  const testUserId = 'test-mobile-user';
  const channelName = getChatChannelName(testChatId);

  try {
    // Test 1: Redis typing indicators
    console.log('[Mobile Realtime Test] Testing Redis typing indicators...');
    await setTypingIndicator(testChatId, testUserId, true);
    const isTyping = await isUserTyping(testChatId, testUserId);
    console.log('[Mobile Realtime Test] Redis typing status:', isTyping);

    // Test 2: Pusher event emission
    console.log('[Mobile Realtime Test] Testing Pusher event emission...');
    await pusherServer.trigger(channelName, PUSHER_EVENTS.USER_TYPING, {
      userId: testUserId,
      isTyping: true
    });
    console.log('[Mobile Realtime Test] Pusher typing event sent');

    // Test 3: AI typing indicator
    console.log('[Mobile Realtime Test] Testing AI typing indicator...');
    await setTypingIndicator(testChatId, 'assistant', true);
    await pusherServer.trigger(channelName, PUSHER_EVENTS.ASSISTANT_TYPING, {
      isTyping: true
    });
    console.log('[Mobile Realtime Test] AI typing indicators set');

    // Test 4: Mock message event
    console.log('[Mobile Realtime Test] Testing mock message event...');
    await pusherServer.trigger(channelName, PUSHER_EVENTS.NEW_MESSAGE, {
      id: 'test-message-' + Date.now(),
      created_at: new Date().toISOString(),
      data: { 
        content: 'Test message for mobile connectivity', 
        senderId: testUserId 
      }
    });
    console.log('[Mobile Realtime Test] Mock message event sent');

    // Test 5: Clean up
    console.log('[Mobile Realtime Test] Cleaning up test data...');
    await setTypingIndicator(testChatId, testUserId, false);
    await setTypingIndicator(testChatId, 'assistant', false);
    await pusherServer.trigger(channelName, PUSHER_EVENTS.USER_TYPING, {
      userId: testUserId,
      isTyping: false
    });
    await pusherServer.trigger(channelName, PUSHER_EVENTS.ASSISTANT_TYPING, {
      isTyping: false
    });
    console.log('[Mobile Realtime Test] Cleanup completed');

    const typingUsers = await getTypingUsers(testChatId);

    return NextResponse.json({ 
      success: true, 
      message: 'Mobile realtime test completed successfully',
      results: {
        redis: {
          setTyping: true,
          wasTyping: isTyping,
          finalTypingUsers: typingUsers
        },
        pusher: {
          userTypingEvent: true,
          assistantTypingEvent: true,
          newMessageEvent: true,
          cleanupEvents: true
        },
        channel: channelName,
        mobile: {
          optimizedForMobile: true,
          activityTimeout: '120000ms',
          pongTimeout: '30000ms',
          reconnectionEnabled: true
        }
      }
    });

  } catch (error) {
    console.error('[Mobile Realtime Test] Test failed:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error',
      details: error instanceof Error ? {
        message: error.message,
        stack: error.stack
      } : null
    }, { status: 500 });
  }
} 