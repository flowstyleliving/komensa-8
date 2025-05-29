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

    // Check if user exists with this phone number
    // Note: You'll need to add phone_number field to your User model first
    const existingUser = await prisma.user.findFirst({
      where: {
        // For now, we'll check by email since phone field doesn't exist yet
        // You can update this once you add phone_number to the User model
        email: {
          contains: formattedPhone // Temporary workaround
        }
      }
    });

    return NextResponse.json({
      exists: !!existingUser,
      phone: formattedPhone
    });

  } catch (error: any) {
    console.error('Error checking phone:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to check phone number',
        details: error.message 
      },
      { status: 500 }
    );
  }
} 