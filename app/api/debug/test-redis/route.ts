import { NextResponse } from 'next/server';
import { redis } from '@/lib/redis';

export async function GET() {
  console.log('[Redis Test] Starting Redis connectivity test...');
  
  // Log environment variables (without exposing sensitive data)
  console.log('[Redis Test] Environment check:');
  console.log('[Redis Test] UPSTASH_REDIS_REST_URL exists:', !!process.env.UPSTASH_REDIS_REST_URL);
  console.log('[Redis Test] UPSTASH_REDIS_REST_TOKEN exists:', !!process.env.UPSTASH_REDIS_REST_TOKEN);
  console.log('[Redis Test] REDIS_URL exists:', !!process.env.REDIS_URL);
  
  if (process.env.UPSTASH_REDIS_REST_URL) {
    console.log('[Redis Test] UPSTASH_REDIS_REST_URL (partial):', process.env.UPSTASH_REDIS_REST_URL.substring(0, 20) + '...');
  }
  if (process.env.REDIS_URL) {
    console.log('[Redis Test] REDIS_URL (partial):', process.env.REDIS_URL.substring(0, 20) + '...');
  }

  try {
    // Test basic Redis operations
    console.log('[Redis Test] Testing Redis SET operation...');
    const testKey = `test:${Date.now()}`;
    await redis.set(testKey, 'test-value');
    console.log('[Redis Test] SET operation successful');

    console.log('[Redis Test] Testing Redis GET operation...');
    const value = await redis.get(testKey);
    console.log('[Redis Test] GET operation successful, value:', value);

    console.log('[Redis Test] Testing Redis DEL operation...');
    await redis.del(testKey);
    console.log('[Redis Test] DEL operation successful');

    console.log('[Redis Test] Testing typing indicator operations...');
    const chatId = 'test-chat';
    const userId = 'test-user';
    
    // Test setex (used by typing indicators)
    await redis.setex(`chat:${chatId}:typing:${userId}`, 30, '1');
    console.log('[Redis Test] SETEX operation successful');
    
    // Test get
    const typingValue = await redis.get(`chat:${chatId}:typing:${userId}`);
    console.log('[Redis Test] Typing indicator GET successful, value:', typingValue);
    
    // Test del
    await redis.del(`chat:${chatId}:typing:${userId}`);
    console.log('[Redis Test] Typing indicator DEL successful');

    return NextResponse.json({ 
      success: true, 
      message: 'Redis connectivity test passed',
      environment: {
        hasUpstashUrl: !!process.env.UPSTASH_REDIS_REST_URL,
        hasUpstashToken: !!process.env.UPSTASH_REDIS_REST_TOKEN,
        hasRedisUrl: !!process.env.REDIS_URL
      }
    });

  } catch (error) {
    console.error('[Redis Test] Redis connectivity test failed:', error);
    
    // Enhanced error logging
    if (error instanceof Error) {
      console.error('[Redis Test] Error message:', error.message);
      console.error('[Redis Test] Error stack:', error.stack);
      if (error.cause) {
        console.error('[Redis Test] Error cause:', error.cause);
      }
      // Log all enumerable properties
      for (const key in error) {
        console.error(`[Redis Test] Error property ${key}:`, (error as any)[key]);
      }
    } else {
      console.error('[Redis Test] Error (not an Error object):', error);
    }

    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : String(error),
      environment: {
        hasUpstashUrl: !!process.env.UPSTASH_REDIS_REST_URL,
        hasUpstashToken: !!process.env.UPSTASH_REDIS_REST_TOKEN,
        hasRedisUrl: !!process.env.REDIS_URL
      }
    }, { status: 500 });
  }
} 