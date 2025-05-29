import { NextRequest, NextResponse } from 'next/server';
import { getStytchClient } from '@/lib/stytch';

export async function POST(request: NextRequest) {
  try {
    const { phoneNumber } = await request.json();

    if (!phoneNumber) {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      );
    }

    // Format phone number (ensure it starts with +)
    const formattedPhone = phoneNumber.startsWith('+') 
      ? phoneNumber 
      : `+1${phoneNumber.replace(/\D/g, '')}`;

    const stytchClient = getStytchClient();
    
    // Send SMS OTP
    const response = await stytchClient.otps.sms.loginOrCreate({
      phone_number: formattedPhone,
      expiration_minutes: 10, // OTP expires in 10 minutes
    });

    return NextResponse.json({
      success: true,
      methodId: response.phone_id,
      phoneNumber: formattedPhone,
      message: 'OTP sent successfully'
    });

  } catch (error: any) {
    console.error('Error sending OTP:', error);
    
    // Handle specific Stytch errors
    if (error.error_type === 'phone_number_invalid') {
      return NextResponse.json(
        { error: 'Invalid phone number format' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { 
        error: 'Failed to send OTP',
        details: error.error_message || error.message 
      },
      { status: 500 }
    );
  }
} 