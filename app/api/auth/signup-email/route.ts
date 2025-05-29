import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const { email, name, phone } = await request.json();

    if (!email || !name) {
      return NextResponse.json(
        { error: 'Email and name are required' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'User already exists with this email' },
        { status: 400 }
      );
    }

    // Create new user
    const user = await prisma.user.create({
      data: {
        email,
        name,
        display_name: name,
        // TODO: Add phone field once it's added to the schema
        // phone_number: phone?.replace(/\D/g, ''),
      }
    });

    return NextResponse.json({
      success: true,
      userId: user.id,
      message: 'Account created successfully'
    });

  } catch (error: any) {
    console.error('Error creating user with email:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to create account',
        details: error.message 
      },
      { status: 500 }
    );
  }
} 