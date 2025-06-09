import { NextResponse } from 'next/server';
import { setTypingIndicator, getTypingUsers, isUserTyping } from '@/lib/redis';

export async function GET() {
  console.log('[Typing Test] Starting typing indicator test...');
  
  const chatId = 'test-chat-typing';
  const userId = 'test-user-typing';

  try {
    // Test 1: Set typing indicator
    console.log('[Typing Test] Setting typing indicator...');
    await setTypingIndicator(chatId, userId, true);
    console.log('[Typing Test] Typing indicator set successfully');

    // Test 2: Check if user is typing
    console.log('[Typing Test] Checking if user is typing...');
    const isTyping = await isUserTyping(chatId, userId);
    console.log('[Typing Test] User typing status:', isTyping);

    // Test 3: Get all typing users
    console.log('[Typing Test] Getting all typing users...');
    const typingUsers = await getTypingUsers(chatId);
    console.log('[Typing Test] Typing users:', typingUsers);

    // Test 4: Clear typing indicator
    console.log('[Typing Test] Clearing typing indicator...');
    await setTypingIndicator(chatId, userId, false);
    console.log('[Typing Test] Typing indicator cleared');

    // Test 5: Verify cleared
    console.log('[Typing Test] Verifying typing indicator cleared...');
    const isTypingAfter = await isUserTyping(chatId, userId);
    console.log('[Typing Test] User typing status after clear:', isTypingAfter);

    return NextResponse.json({ 
      success: true, 
      message: 'Typing indicator test passed',
      results: {
        setTyping: true,
        wasTyping: isTyping,
        typingUsers: typingUsers,
        clearedTyping: true,
        isTypingAfterClear: isTypingAfter
      }
    });

  } catch (error) {
    console.error('[Typing Test] Typing indicator test failed:', error);
    
    // Enhanced error logging
    if (error instanceof Error) {
      console.error('[Typing Test] Error message:', error.message);
      console.error('[Typing Test] Error stack:', error.stack);
      if (error.cause) {
        console.error('[Typing Test] Error cause:', error.cause);
      }
    }

    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 