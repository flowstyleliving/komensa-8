import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Check if user exists with this email
    const user = await prisma.user.findUnique({
      where: {
        email: email.toLowerCase(),
      },
      select: {
        id: true,
      },
    });

    return NextResponse.json({
      exists: !!user,
    });

  } catch (error: any) {
    console.error('Error checking email:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to check email',
        details: error.message 
      },
      { status: 500 }
    );
  }
} 