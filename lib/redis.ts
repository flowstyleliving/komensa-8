import { Redis } from '@upstash/redis';

// Support both REST API format and URL format
function createRedisClient() {
  console.log('[Redis] Initializing Redis client...');
  
  // Method 1: Official Upstash environment variables (preferred for production)
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    console.log('[Redis] Using official UPSTASH_REDIS_REST_URL configuration');
    return new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  
  // Method 2: Try Redis.fromEnv() which automatically looks for UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN
  try {
    console.log('[Redis] Attempting Redis.fromEnv() for automatic configuration');
    return Redis.fromEnv();
  } catch (envError) {
    const errorMessage = envError instanceof Error ? envError.message : String(envError);
    console.log('[Redis] Redis.fromEnv() failed, trying alternative configurations:', errorMessage);
  }
  
  // Method 3: Alternative REST API format (Vercel KV integration)
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    console.log('[Redis] Using KV_REST_API_URL configuration (Vercel KV)');
    return new Redis({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
    });
  }
  
  // Method 4: Traditional Redis URL format
  if (process.env.REDIS_URL) {
    console.log('[Redis] Using REDIS_URL configuration');
    // Temporarily set the environment variable for fromEnv()
    const originalUpstashUrl = process.env.UPSTASH_REDIS_REST_URL;
    process.env.UPSTASH_REDIS_REST_URL = process.env.REDIS_URL;
    try {
      const client = Redis.fromEnv();
      return client;
    } finally {
      // Restore original value
      if (originalUpstashUrl) {
        process.env.UPSTASH_REDIS_REST_URL = originalUpstashUrl;
      } else {
        delete process.env.UPSTASH_REDIS_REST_URL;
      }
    }
  }
  
  // Method 5: Alternative URL format (KV_URL)
  if (process.env.KV_URL) {
    console.log('[Redis] Using KV_URL configuration');
    // Temporarily set the environment variable for fromEnv()
    const originalUpstashUrl = process.env.UPSTASH_REDIS_REST_URL;
    process.env.UPSTASH_REDIS_REST_URL = process.env.KV_URL;
    try {
      const client = Redis.fromEnv();
      return client;
    } finally {
      // Restore original value
      if (originalUpstashUrl) {
        process.env.UPSTASH_REDIS_REST_URL = originalUpstashUrl;
      } else {
        delete process.env.UPSTASH_REDIS_REST_URL;
      }
    }
  }
  
  // Log available environment variables for debugging
  console.error('[Redis] No valid Redis configuration found. Available environment variables:');
  console.error('[Redis] UPSTASH_REDIS_REST_URL:', !!process.env.UPSTASH_REDIS_REST_URL);
  console.error('[Redis] UPSTASH_REDIS_REST_TOKEN:', !!process.env.UPSTASH_REDIS_REST_TOKEN);
  console.error('[Redis] KV_REST_API_URL:', !!process.env.KV_REST_API_URL);
  console.error('[Redis] KV_REST_API_TOKEN:', !!process.env.KV_REST_API_TOKEN);
  console.error('[Redis] REDIS_URL:', !!process.env.REDIS_URL);
  console.error('[Redis] KV_URL:', !!process.env.KV_URL);
  
  throw new Error('Missing Redis environment variables. Need either UPSTASH_REDIS_REST_URL+TOKEN, KV_REST_API_URL+TOKEN, REDIS_URL, or KV_URL');
}

export const redis = createRedisClient();

// Helper functions for typing indicators
export const setTypingIndicator = async (chatId: string, userId: string, isTyping: boolean) => {
  const key = `chat:${chatId}:typing:${userId}`;
  if (isTyping) {
    // Mobile-optimized: Longer TTL for mobile network reliability 
    // 10 seconds instead of 3 to handle mobile latency
    const ttl = userId === 'assistant' ? 60 : 10; // AI gets 60s, users get 10s
    await redis.setex(key, ttl, '1');
  } else {
    await redis.del(key);
  }
};

export const getTypingUsers = async (chatId: string): Promise<string[]> => {
  const pattern = `chat:${chatId}:typing:*`;
  const keys = await redis.keys(pattern);
  return keys.map(key => key.split(':')[3]).filter(Boolean);
};

export const isUserTyping = async (chatId: string, userId: string): Promise<boolean> => {
  const key = `chat:${chatId}:typing:${userId}`;
  const result = await redis.get(key);
  return Boolean(result);
};
