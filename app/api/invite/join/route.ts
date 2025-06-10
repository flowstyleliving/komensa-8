import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || session.user.isGuest) {
      return NextResponse.json({ error: 'Unauthorized - signed-in users only' }, { status: 401 });
    }

    const { inviteId } = await request.json();

    if (!inviteId) {
      return NextResponse.json(
        { error: 'inviteId is required' },
        { status: 400 }
      );
    }

    // Check if invite exists and is valid
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
        error: 'Invalid invite'
      }, { status: 404 });
    }

    const now = new Date();
    const isExpired = invite.expires_at < now;

    if (isExpired) {
      return NextResponse.json({
        error: 'Invite has expired'
      }, { status: 410 });
    }

    // Verify the chat still exists and is active
    const chat = await prisma.chat.findUnique({
      where: { id: invite.chat_id }
    });

    if (!chat || chat.status !== 'active') {
      return NextResponse.json({
        error: 'Chat is no longer active'
      }, { status: 404 });
    }

    // Check if user is already a participant
    const existingParticipant = await prisma.chatParticipant.findFirst({
      where: {
        chat_id: invite.chat_id,
        user_id: session.user.id
      }
    });

    if (existingParticipant) {
      return NextResponse.json({
        success: true,
        chatId: invite.chat_id,
        alreadyParticipant: true,
        message: 'You are already a participant in this chat'
      });
    }

    // Add user as participant to the chat
    await prisma.chatParticipant.create({
      data: {
        chat_id: invite.chat_id,
        user_id: session.user.id,
        role: 'member'
      }
    });

    // Send Pusher notification
    try {
      const { pusherServer, getChatChannelName, PUSHER_EVENTS } = await import('@/lib/pusher');
      const channelName = getChatChannelName(invite.chat_id);
      
      await pusherServer.trigger(channelName, PUSHER_EVENTS.PARTICIPANT_JOINED, {
        participant: {
          id: session.user.id,
          display_name: session.user.name,
          role: 'member'
        },
        joinedAt: new Date().toISOString()
      });
    } catch (pusherError) {
      console.warn('Failed to send Pusher notification:', pusherError);
    }

    return NextResponse.json({
      success: true,
      chatId: invite.chat_id,
      alreadyParticipant: false,
      message: 'Successfully joined the chat'
    });

  } catch (error: any) {
    console.error('Error joining chat via invite:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to join chat',
        details: error.message 
      },
      { status: 500 }
    );
  }
} 