import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const { phone, name } = await request.json();

    if (!phone || !name) {
      return NextResponse.json(
        { error: 'Phone number and name are required' },
        { status: 400 }
      );
    }

    // Format phone number consistently
    const formattedPhone = phone.replace(/\D/g, '');

    // Check if user already exists with this phone
    // Note: This is a placeholder since phone field doesn't exist in User model yet
    const existingUser = await prisma.user.findFirst({
      where: {
        // Temporary workaround - you'll need to add phone_number field to User model
        email: {
          contains: formattedPhone
        }
      }
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'User already exists with this phone number' },
        { status: 400 }
      );
    }

    // Create new user with phone number
    // For now, we'll use a generated email since email is required
    const generatedEmail = `${formattedPhone}@phone.komensa.app`;
    
    const user = await prisma.user.create({
      data: {
        email: generatedEmail,
        name,
        display_name: name,
        // TODO: Add phone field once it's added to the schema
        // phone_number: formattedPhone,
      }
    });

    return NextResponse.json({
      success: true,
      userId: user.id,
      message: 'Account created successfully'
    });

  } catch (error: any) {
    console.error('Error creating user with phone:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to create account',
        details: error.message 
      },
      { status: 500 }
    );
  }
} 