# Upstash Redis Deployment Guide

Based on official Upstash documentation: https://upstash.com/docs/redis/sdks/ts/deployment

## Node.js / Browser (Vercel, Netlify, AWS Lambda)

For Node.js environments like Vercel, you should set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` as environment variables.

### Environment Variables

```bash
UPSTASH_REDIS_REST_URL=https://your-redis-instance.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token-here
```

### Basic Usage

```typescript
import { Redis } from "@upstash/redis"

// Method 1: Explicit configuration
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
})

// Method 2: Load directly from environment variables
const redis = Redis.fromEnv()
```

### Important Notes

1. **Environment Variable Names**: The official SDK expects `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
2. **REST API Format**: This is the preferred format for serverless environments like Vercel
3. **Automatic Loading**: `Redis.fromEnv()` automatically looks for the standard environment variable names

## Alternative Environment Variable Names

Some platforms or integrations might use different variable names:
- `KV_REST_API_URL` and `KV_REST_API_TOKEN` (Vercel KV integration)
- `REDIS_URL` (traditional Redis URL format)

## Error Handling

Always wrap Redis operations in try-catch blocks:

```typescript
try {
  await redis.set('key', 'value');
  const value = await redis.get('key');
} catch (error) {
  console.error('Redis operation failed:', error);
}
```

## Telemetry

The Upstash Redis SDK sends anonymous telemetry data. You can opt out by setting:

```bash
UPSTASH_DISABLE_TELEMETRY=1
``` 