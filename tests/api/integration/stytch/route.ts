import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'debug',
    message: 'Stytch Test Information',
    credentials: {
      project_id: process.env.STYTCH_PROJECT_ID?.substring(0, 20) + '...',
      secret: process.env.STYTCH_SECRET?.substring(0, 20) + '...',
      public_token: process.env.NEXT_PUBLIC_STYTCH_PUBLIC_TOKEN?.substring(0, 20) + '...',
      using_test_credentials: process.env.STYTCH_PROJECT_ID?.includes('00000000-0000-0000-0000-000000000000')
    },
    test_phone_numbers: {
      note: 'These special phone numbers work with Stytch test environment',
      test_phone: '+15005550006',
      test_otp_code: '000000',
      instructions: [
        '1. Use phone number: +15005550006',
        '2. When prompted for OTP, enter: 000000',
        '3. This will work even with test credentials'
      ]
    },
    next_steps: {
      for_real_sms: [
        '1. Go to https://stytch.com/dashboard',
        '2. Sign up and create a project',
        '3. Get your real API keys',
        '4. Replace the test values in .env file'
      ]
    }
  });
} 