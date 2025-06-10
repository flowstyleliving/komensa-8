import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const inviteId = searchParams.get('inviteId');

    console.log('[Invite Validate] Starting validation for inviteId:', inviteId);

    if (!inviteId) {
      console.log('[Invite Validate] Missing inviteId');
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

    console.log('[Invite Validate] Database lookup result:', {
      inviteId,
      found: !!invite,
      inviteData: invite ? {
        id: invite.id,
        chatId: invite.chat_id,
        expiresAt: invite.expires_at,
        acceptedAt: invite.accepted_at
      } : null
    });

    if (!invite) {
      console.log('[Invite Validate] Invite not found in database');
      return NextResponse.json({
        valid: false,
        expired: false,
        error: 'Invite not found'
      });
    }

    const now = new Date();
    const isExpired = invite.expires_at < now;
    // Allow multiple uses of the same invite - don't check for accepted_at
    // const isUsed = invite.accepted_at !== null;

    console.log('[Invite Validate] Checking expiration:', {
      now: now.toISOString(),
      expiresAt: invite.expires_at.toISOString(),
      isExpired
    });

    if (isExpired) {
      console.log('[Invite Validate] Invite has expired');
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

    console.log('[Invite Validate] Chat lookup result:', {
      chatId: invite.chat_id,
      found: !!chat,
      status: chat?.status
    });

    if (!chat || chat.status !== 'active') {
      console.log('[Invite Validate] Chat not found or inactive');
      return NextResponse.json({
        valid: false,
        expired: false,
        chatInactive: true
      });
    }

    // Check if the current user is already a participant (for signed-in users)
    const session = await getServerSession(authOptions);
    let alreadyParticipant = false;
    
    if (session?.user?.id && !session.user.isGuest) {
      const existingParticipant = await prisma.chatParticipant.findFirst({
        where: {
          chat_id: invite.chat_id,
          user_id: session.user.id
        }
      });
      alreadyParticipant = !!existingParticipant;
    }

    console.log('[Invite Validate] Validation successful:', {
      chatId: invite.chat_id,
      alreadyParticipant
    });

    return NextResponse.json({
      valid: true,
      chatId: invite.chat_id,
      expired: false,
      alreadyParticipant
    });

  } catch (error: any) {
    console.error('[Invite Validate] Error validating invite:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to validate invite',
        details: error.message 
      },
      { status: 500 }
    );
  }
} 