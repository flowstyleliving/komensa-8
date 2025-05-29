import { NextResponse } from 'next/server';
import GoogleProvider from "next-auth/providers/google";

export async function GET() {
  try {
    // Test if Google Provider can be initialized
    const googleProvider = GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    });

    return NextResponse.json({
      status: 'success',
      googleProvider: {
        id: googleProvider.id,
        name: googleProvider.name,
        type: googleProvider.type,
        hasClientId: !!process.env.GOOGLE_CLIENT_ID,
        hasClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
        clientIdLength: process.env.GOOGLE_CLIENT_ID?.length || 0,
        clientSecretLength: process.env.GOOGLE_CLIENT_SECRET?.length || 0,
        clientIdPrefix: process.env.GOOGLE_CLIENT_ID?.substring(0, 20) + '...',
      }
    });
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      hasClientId: !!process.env.GOOGLE_CLIENT_ID,
      hasClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
    });
  }
} 