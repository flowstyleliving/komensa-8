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
    
    // OpenAI
    OPENAI_API_KEY: process.env.OPENAI_API_KEY ? 'SET' : 'NOT SET',
    OPENAI_ASSISTANT_ID: process.env.OPENAI_ASSISTANT_ID ? 'SET' : 'NOT SET',
    
    // Redis
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL ? 'SET' : 'NOT SET',
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN ? 'SET' : 'NOT SET',
    
    // Environment
    NODE_ENV: process.env.NODE_ENV,
    VERCEL_ENV: process.env.VERCEL_ENV,
    
    // Computed URLs for Google OAuth
    computed: {
      baseUrl: process.env.NEXTAUTH_URL || 'NOT SET',
      googleCallbackUrl: `${process.env.NEXTAUTH_URL || 'NOT SET'}/api/auth/callback/google`,
      requiredInGoogleConsole: `${process.env.NEXTAUTH_URL || 'NOT SET'}/api/auth/callback/google`
    }
  });
} 