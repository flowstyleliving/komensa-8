import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const inviteId = searchParams.get('inviteId');

    if (!inviteId) {
      return NextResponse.json(
        { error: 'inviteId is required' },
        { status: 400 }
      );
    }

    // Check if invite exists using Prisma model
    const invite = await prisma.chatInvite.findFirst({
      where: {
        OR: [
          { id: inviteId },
          { token: inviteId }
        ]
      }
    });

    if (!invite) {
      return NextResponse.json({
        valid: false,
        expired: false
      });
    }

    const now = new Date();
    const isExpired = invite.expires_at < now;
    // Allow multiple uses of the same invite - don't check for accepted_at
    // const isUsed = invite.accepted_at !== null;

    if (isExpired) {
      return NextResponse.json({
        valid: false,
        expired: isExpired,
        used: false, // Always false since we allow multiple uses
        chatId: invite.chat_id
      });
    }

    // Verify the chat still exists and is active
    const chat = await prisma.chat.findUnique({
      where: { id: invite.chat_id }
    });

    if (!chat || chat.status !== 'active') {
      return NextResponse.json({
        valid: false,
        expired: false,
        chatInactive: true
      });
    }

    return NextResponse.json({
      valid: true,
      chatId: invite.chat_id,
      expired: false
    });

  } catch (error: any) {
    console.error('Error validating invite:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to validate invite',
        details: error.message 
      },
      { status: 500 }
    );
  }
} 