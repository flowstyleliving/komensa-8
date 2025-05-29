import { NextRequest, NextResponse } from 'next/server';
import { getStytchClient } from '@/lib/stytch';

export async function POST(request: NextRequest) {
  try {
    const { code, methodId, userId } = await request.json();

    if (!code || !methodId) {
      return NextResponse.json(
        { error: 'Code and method ID are required' },
        { status: 400 }
      );
    }

    const stytchClient = getStytchClient();
    
    // Verify the OTP
    const response = await stytchClient.otps.authenticate({
      method_id: methodId,
      code: code,
      session_duration_minutes: 60, // Session lasts 1 hour
    });

    if (response.status_code === 200) {
      // OTP verified successfully
      // Note: Phone number is available in response.user.phone_numbers array
      const phoneNumbers = response.user?.phone_numbers || [];
      const phoneNumber = phoneNumbers.length > 0 ? phoneNumbers[0].phone_number : null;
      
      // TODO: Update user's phone number in database once schema is updated
      // For now, we'll just return the verification success

      return NextResponse.json({
        success: true,
        verified: true,
        phoneNumber: phoneNumber,
        stytchUserId: response.user_id,
        message: 'Phone number verified successfully'
      });
    } else {
      return NextResponse.json(
        { error: 'Invalid or expired OTP' },
        { status: 400 }
      );
    }

  } catch (error: any) {
    console.error('Error verifying OTP:', error);
    
    // Handle specific Stytch errors
    if (error.error_type === 'otp_code_not_found' || error.error_type === 'otp_code_expired') {
      return NextResponse.json(
        { error: 'Invalid or expired OTP code' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { 
        error: 'Failed to verify OTP',
        details: error.error_message || error.message 
      },
      { status: 500 }
    );
  }
} 