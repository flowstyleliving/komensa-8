import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';

export async function GET(req: NextRequest) {
  const testId = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  console.log(`[Prod Test] ${testId} - Production environment test started`);
  
  try {
    // Test environment variables
    console.log(`[Prod Test] ${testId} - Environment check:`, {
      NODE_ENV: process.env.NODE_ENV,
      VERCEL_ENV: process.env.VERCEL_ENV,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY ? 'SET' : 'NOT SET',
      OPENAI_ASSISTANT_ID: process.env.OPENAI_ASSISTANT_ID ? 'SET' : 'NOT SET',
      UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL ? 'SET' : 'NOT SET',
      PUSHER_APP_ID: process.env.PUSHER_APP_ID ? 'SET' : 'NOT SET'
    });

    // Test session
    console.log(`[Prod Test] ${testId} - Testing session...`);
    const session = await getServerSession(authOptions);
    console.log(`[Prod Test] ${testId} - Session result:`, {
      hasSession: !!session,
      hasUser: !!session?.user,
      userId: session?.user?.id,
      isGuest: session?.user?.isGuest
    });

    // Test database connectivity
    console.log(`[Prod Test] ${testId} - Testing database...`);
    const { prisma } = await import('@/lib/prisma');
    const dbTest = await prisma.$queryRaw`SELECT 1 as test`;
    console.log(`[Prod Test] ${testId} - Database connected successfully`);

    // Test Redis connectivity
    console.log(`[Prod Test] ${testId} - Testing Redis...`);
    const { redis } = await import('@/lib/redis');
    await redis.set(`test:${testId}`, 'test-value', { ex: 10 });
    const redisValue = await redis.get(`test:${testId}`);
    console.log(`[Prod Test] ${testId} - Redis test:`, { 
      setValue: 'test-value', 
      getValue: redisValue,
      success: redisValue === 'test-value'
    });

    // Test OpenAI connectivity
    console.log(`[Prod Test] ${testId} - Testing OpenAI...`);
    const { openai } = await import('@/lib/openai');
    const models = await openai.models.list();
    console.log(`[Prod Test] ${testId} - OpenAI connected, found ${models.data.length} models`);

    // Test Pusher connectivity
    console.log(`[Prod Test] ${testId} - Testing Pusher...`);
    const { pusherServer } = await import('@/lib/pusher');
    await pusherServer.trigger('test-channel', 'test-event', { testId });
    console.log(`[Prod Test] ${testId} - Pusher test message sent`);

    return NextResponse.json({
      success: true,
      testId,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      tests: {
        environment: 'PASS',
        session: !!session,
        database: 'PASS',
        redis: redisValue === 'test-value' ? 'PASS' : 'FAIL',
        openai: 'PASS',
        pusher: 'PASS'
      }
    });

  } catch (error) {
    console.error(`[Prod Test] ${testId} - Test failed:`, error);
    return NextResponse.json({
      success: false,
      testId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}