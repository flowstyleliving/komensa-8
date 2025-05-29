import { NextResponse } from 'next/server';

export async function GET() {
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  
  return NextResponse.json({
    baseUrl,
    googleSignInUrl: `${baseUrl}/api/auth/signin/google`,
    googleCallbackUrl: `${baseUrl}/api/auth/callback/google`,
    requiredRedirectURI: `${baseUrl}/api/auth/callback/google`,
    googleClientId: process.env.GOOGLE_CLIENT_ID?.substring(0, 20) + '...',
    instructions: {
      step1: 'Go to Google Cloud Console',
      step2: 'Navigate to APIs & Services → Credentials',
      step3: 'Click on your OAuth 2.0 Client ID',
      step4: `Add this EXACT URL to "Authorized redirect URIs": ${baseUrl}/api/auth/callback/google`,
      step5: `Add this EXACT URL to "Authorized JavaScript origins": ${baseUrl}`,
      step6: 'Save the changes and try again'
    }
  });
} 