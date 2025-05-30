import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth-options';

export async function GET() {
  try {
    const googleProvider = authOptions.providers.find(p => p.id === 'google');
    
    return NextResponse.json({
      status: 'success',
      googleProvider: {
        id: googleProvider?.id,
        name: googleProvider?.name,
        type: googleProvider?.type,
        // @ts-ignore - accessing authorization config
        authorization: googleProvider?.authorization,
        // @ts-ignore - accessing scope config
        scope: googleProvider?.authorization?.params?.scope,
      },
      recommendedScopes: 'openid email profile',
      note: 'These scopes should match what is configured in your Google Cloud Console OAuth consent screen'
    });
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 