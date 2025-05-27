import { Redis } from '@upstash/redis';

// Support both REST API format and URL format
function createRedisClient() {
  // Try multiple environment variable combinations
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    // REST API format (preferred for Vercel)
    console.log('[Redis] Using UPSTASH_REDIS_REST_URL configuration');
    return new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  } else if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    // Alternative REST API format (from .env file)
    console.log('[Redis] Using KV_REST_API_URL configuration');
    return new Redis({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
    });
  } else if (process.env.REDIS_URL) {
    // URL format (fallback for local development)
    console.log('[Redis] Using REDIS_URL configuration');
    return Redis.fromEnv();
  } else if (process.env.KV_URL) {
    // Alternative URL format - set REDIS_URL temporarily
    console.log('[Redis] Using KV_URL configuration');
    const originalRedisUrl = process.env.REDIS_URL;
    process.env.REDIS_URL = process.env.KV_URL;
    const client = Redis.fromEnv();
    process.env.REDIS_URL = originalRedisUrl; // restore original
    return client;
  } else {
    throw new Error('Missing Redis environment variables. Need either UPSTASH_REDIS_REST_URL+TOKEN, KV_REST_API_URL+TOKEN, REDIS_URL, or KV_URL');
  }
}

export const redis = createRedisClient();

// Helper functions for typing indicators
export const setTypingIndicator = async (chatId: string, userId: string, isTyping: boolean) => {
  const key = `chat:${chatId}:typing:${userId}`;
  if (isTyping) {
    // Set with 30 second expiration
    await redis.setex(key, 30, '1');
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
