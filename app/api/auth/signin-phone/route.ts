import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const { phone } = await request.json();

    if (!phone) {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      );
    }

    // Format phone number consistently
    const formattedPhone = phone.replace(/\D/g, '');

    // Find user by phone number
    // Note: This is a placeholder since phone field doesn't exist in User model yet
    const user = await prisma.user.findFirst({
      where: {
        // Temporary workaround - you'll need to add phone_number field to User model
        email: {
          contains: formattedPhone
        }
      }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found with this phone number' },
        { status: 404 }
      );
    }

    // TODO: Implement actual phone-based authentication
    // For now, we'll just return success if user exists
    return NextResponse.json({
      success: true,
      userId: user.id,
      message: 'Phone sign-in successful'
    });

  } catch (error: any) {
    console.error('Error signing in with phone:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to sign in with phone',
        details: error.message 
      },
      { status: 500 }
    );
  }
} 