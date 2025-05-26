import { Redis } from '@upstash/redis';

// Support both REST API format and URL format
function createRedisClient() {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    // REST API format (preferred for Vercel)
    return new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  } else if (process.env.REDIS_URL) {
    // URL format (fallback for local development)
    return Redis.fromEnv();
  } else {
    throw new Error('Missing Redis environment variables. Need either UPSTASH_REDIS_REST_URL+TOKEN or REDIS_URL');
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
