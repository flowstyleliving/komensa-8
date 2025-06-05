import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  try {
    // Check if user is authenticated
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { chatId } = await request.json();

    if (!chatId) {
      return NextResponse.json(
        { error: 'chatId is required' },
        { status: 400 }
      );
    }

    // Verify user is a participant in this chat and can create invites
    const chat = await prisma.chat.findFirst({
      where: {
        id: chatId,
        participants: {
          some: {
            user_id: session.user.id
          }
        }
      }
    });

    if (!chat) {
      return NextResponse.json(
        { error: 'Chat not found or access denied' },
        { status: 404 }
      );
    }

    const inviteId = uuidv4(); // Generate a unique UUID for the invite
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24-hour expiration

    // Check if invite already exists for this chat
    const existingInvite = await prisma.chatInvite.findFirst({
      where: {
        chat_id: chatId,
        accepted_at: null
      }
    });

    if (existingInvite) {
      // Update existing invite expiration
      await prisma.chatInvite.update({
        where: { id: existingInvite.id },
        data: { expires_at: expiresAt }
      });
      
      // Use the existing invite ID for the URL
      const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
      const inviteUrl = `${baseUrl}/invite/${existingInvite.id}`;
      
      return NextResponse.json({
        inviteId: existingInvite.id,
        inviteUrl
      });
    } else {
      // Create new invite record using Prisma model
      await prisma.chatInvite.create({
        data: {
          id: inviteId,
          chat_id: chatId,
          token: inviteId,
          expires_at: expiresAt
        }
      });
    }

    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const inviteUrl = `${baseUrl}/invite/${inviteId}`;

    return NextResponse.json({
      inviteId,
      inviteUrl
    });

  } catch (error: any) {
    console.error('Error generating invite:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to generate invite',
        details: error.message 
      },
      { status: 500 }
    );
  }
} 