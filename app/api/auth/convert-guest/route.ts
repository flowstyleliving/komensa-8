import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id || !session.user.isGuest) {
      return NextResponse.json({ error: 'Only guest users can be converted' }, { status: 400 });
    }

    const { email } = await request.json();

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
    }

    // Update the guest user to become a registered user
    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        email,
        email_verified: false,
        // Keep the display_name they used as a guest
      }
    });

    console.log('[Convert Guest API] Guest user converted:', {
      userId: session.user.id,
      email,
      displayName: updatedUser.display_name
    });

    return NextResponse.json({
      success: true,
      message: 'Account created successfully',
      userId: updatedUser.id
    });

  } catch (error: any) {
    console.error('[Convert Guest API] Error converting guest:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to create account',
        details: error.message 
      },
      { status: 500 }
    );
  }
} 