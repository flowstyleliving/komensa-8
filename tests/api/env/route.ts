import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    // NextAuth essentials
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ? 'SET' : 'NOT SET',
    NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'NOT SET',
    
    // Google OAuth
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ? 'SET' : 'NOT SET',
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ? 'SET' : 'NOT SET', 
    
    // Database
    DATABASE_URL: process.env.DATABASE_URL ? 'SET' : 'NOT SET',
    
    // OpenAI - CRITICAL FOR AI REPLIES
    OPENAI_API_KEY: process.env.OPENAI_API_KEY ? 'SET' : 'NOT SET',
    OPENAI_ASSISTANT_ID: process.env.OPENAI_ASSISTANT_ID ? 'SET' : 'NOT SET',
    OPENAI_ASSISTANT_ID_VALUE: process.env.OPENAI_ASSISTANT_ID || 'NOT SET', // Show actual value for debugging
    
    // Redis
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL ? 'SET' : 'NOT SET',
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN ? 'SET' : 'NOT SET',
    
    // Pusher
    PUSHER_APP_ID: process.env.PUSHER_APP_ID ? 'SET' : 'NOT SET',
    PUSHER_KEY: process.env.PUSHER_KEY ? 'SET' : 'NOT SET',
    PUSHER_SECRET: process.env.PUSHER_SECRET ? 'SET' : 'NOT SET',
    PUSHER_CLUSTER: process.env.PUSHER_CLUSTER ? 'SET' : 'NOT SET',
    
    // Environment
    NODE_ENV: process.env.NODE_ENV,
    VERCEL_ENV: process.env.VERCEL_ENV,
    
    // Computed URLs for Google OAuth
    computed: {
      baseUrl: process.env.NEXTAUTH_URL || 'NOT SET',
      googleCallbackUrl: `${process.env.NEXTAUTH_URL || 'NOT SET'}/api/auth/callback/google`,
      requiredInGoogleConsole: `${process.env.NEXTAUTH_URL || 'NOT SET'}/api/auth/callback/google`
    },
    
    // Debugging info
    debug: {
      timestamp: new Date().toISOString(),
      env_count: Object.keys(process.env).length,
      critical_missing: [
        !process.env.OPENAI_API_KEY && 'OPENAI_API_KEY',
        !process.env.OPENAI_ASSISTANT_ID && 'OPENAI_ASSISTANT_ID',
        !process.env.DATABASE_URL && 'DATABASE_URL',
        !process.env.NEXTAUTH_SECRET && 'NEXTAUTH_SECRET'
      ].filter(Boolean)
    }
  });
} 