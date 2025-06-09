import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { encode } from 'next-auth/jwt';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';

export async function POST(request: NextRequest) {
  try {
    const { inviteId, guestName } = await request.json();

    if (!inviteId || !guestName) {
      return NextResponse.json(
        { error: 'inviteId and guestName are required' },
        { status: 400 }
      );
    }

    // Check if user already has a guest session
    const session = await getServerSession(authOptions);
    let guestUserId: string;
    
    if (session?.user?.isGuest && session.user.id) {
      // Reuse existing guest session ID to prevent turn management mismatch
      guestUserId = session.user.id;
      console.log('[Invite Accept] Reusing existing guest session:', { guestUserId, guestName });
    } else {
      // Create a new guest user ID only if no existing guest session
      guestUserId = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      console.log('[Invite Accept] Creating new guest session:', { guestUserId, guestName });
    }

    // Check if invite exists and is valid using Prisma model
    const invite = await prisma.chatInvite.findFirst({
      where: {
        OR: [
          { id: inviteId },
          { token: inviteId }
        ]
      }
    });

    if (!invite) {
      return NextResponse.json(
        { error: 'Invalid invite' },
        { status: 404 }
      );
    }

    const now = new Date();
    const isExpired = invite.expires_at < now;
    const isUsed = invite.accepted_at !== null;

    if (isExpired) {
      return NextResponse.json(
        { error: 'Invite has expired' },
        { status: 410 }
      );
    }

    if (isUsed) {
      return NextResponse.json(
        { error: 'Invite has already been used' },
        { status: 409 }
      );
    }

    // Verify the chat still exists and is active
    const chat = await prisma.chat.findUnique({
      where: { id: invite.chat_id },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                display_name: true,
                name: true
              }
            }
          }
        }
      }
    });

    if (!chat || chat.status !== 'active') {
      return NextResponse.json(
        { error: 'Chat is no longer available' },
        { status: 404 }
      );
    }

    // Mark invite as accepted
    await prisma.chatInvite.update({
      where: { id: invite.id },
      data: { accepted_at: now }
    });

    // Create a guest user record in the database FIRST (before creating participant)
    try {
      if (session?.user?.isGuest && session.user.id) {
        // Update existing guest user with new name if different
        await prisma.user.upsert({
          where: { id: guestUserId },
          update: { 
            display_name: guestName,
            name: guestName 
          },
          create: {
            id: guestUserId,
            display_name: guestName,
            name: guestName,
            email: null
          }
        });
        console.log('[Invite Accept] Updated existing guest user record:', { guestUserId, guestName });
      } else {
        // Create new guest user
        await prisma.user.create({
          data: {
            id: guestUserId,
            display_name: guestName,
            name: guestName,
            email: null
          }
        });
        console.log('[Invite Accept] Created new guest user record:', { guestUserId, guestName });
      }
    } catch (error) {
      console.error('Failed to create/update guest user record:', error);
      return NextResponse.json(
        { error: 'Failed to create guest user' },
        { status: 500 }
      );
    }

    // Add guest as participant to the chat (now the user exists)
    // Check if guest is already a participant in this chat
    const existingParticipant = await prisma.chatParticipant.findFirst({
      where: {
        chat_id: invite.chat_id,
        user_id: guestUserId
      }
    });

    if (!existingParticipant) {
      await prisma.chatParticipant.create({
        data: {
          chat_id: invite.chat_id,
          user_id: guestUserId,
          role: 'guest'
        }
      });
      console.log('[Invite Accept] Added guest as new participant:', { guestUserId, chatId: invite.chat_id });
    } else {
      console.log('[Invite Accept] Guest already participant in this chat:', { guestUserId, chatId: invite.chat_id });
    }

    // CRITICAL: Ensure participant record is fully committed before proceeding
    // This prevents race conditions when guest immediately tries to access chat
    await prisma.chatParticipant.findFirst({
      where: {
        chat_id: invite.chat_id,
        user_id: guestUserId
      }
    });
    console.log('[Invite Accept] Participant record verified as committed');
    
    // Create session token first - this enables immediate success response
    const sessionToken = await encode({
      token: {
        id: guestUserId,
        name: guestName,
        email: null,
        picture: null,
        isGuest: true,
        chatId: invite.chat_id,
        waitingRoom: true, // Flag to indicate guest starts in waiting room
        sub: guestUserId, // Required by NextAuth JWT
        iat: Math.floor(Date.now() / 1000), // issued at
        exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // expires in 24 hours
        jti: `guest-${guestUserId}` // JWT ID
      },
      secret: process.env.NEXTAUTH_SECRET!,
      maxAge: 24 * 60 * 60 // 24 hours
    });

    console.log('[Invite Accept] Created waiting room session token for guest:', {
      guestUserId,
      guestName,
      chatId: invite.chat_id,
      tokenLength: sessionToken.length
    });

    // Store initial waiting room status in Redis
    console.log('[Invite Accept] Setting waiting room status in Redis...');
    try {
      const { setWaitingRoomStatus } = await import('@/lib/redis-waiting-room');
      await setWaitingRoomStatus(guestUserId, {
        chatId: invite.chat_id,
            guestName,
        status: 'setup_starting',
        progress: 0,
        timestamp: now.toISOString()
      });
    } catch (redisError) {
      console.warn('[Invite Accept] Failed to set Redis status:', redisError);
    }

    // Queue background setup (non-blocking) - this includes:
    // - Turn management setup
    // - AI welcome message generation  
    // - Pusher notifications
    // - Final participant activation
    setImmediate(() => {
      setupGuestInChatBackground(invite.chat_id, guestUserId, guestName, chat, now)
        .catch((error: any) => {
          console.error('[Invite Accept] Background guest setup failed:', error);
        });
    });

    // Set the session cookie
    const response = NextResponse.json({
      success: true,
      sessionToken,
      chatId: invite.chat_id,
      guestUserId,
      waitingRoom: true // Indicate guest will start in waiting room
    });

    // Set session cookie that's compatible with NextAuth in all environments
    const isProduction = process.env.NODE_ENV === 'production';
    const isSecure = process.env.NEXTAUTH_URL?.startsWith('https://') || isProduction;
    
    // In production with HTTPS, NextAuth expects __Secure- prefix for session cookies
    const cookieName = isSecure 
      ? '__Secure-next-auth.session-token'
      : 'next-auth.session-token';

    console.log('[Invite Accept] Setting session cookie:', {
      cookieName,
      isProduction,
      isSecure,
      nextAuthUrl: process.env.NEXTAUTH_URL
    });

    response.cookies.set(cookieName, sessionToken, {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax',
      maxAge: 24 * 60 * 60, // 24 hours
      path: '/'
    });

    return response;

  } catch (error: any) {
    console.error('Error accepting invite:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to accept invite',
        details: error.message 
      },
      { status: 500 }
    );
  }
} 

/**
 * Background setup function for guest joining
 * This runs after the invite accept response is sent
 */
async function setupGuestInChatBackground(
  chatId: string, 
  guestUserId: string, 
  guestName: string, 
  chat: any, 
  joinedAt: Date
): Promise<void> {
  console.log('[Background Setup] Starting guest setup for:', { chatId, guestUserId, guestName });

  try {
    // 1. Initialize or update turn management 
    console.log('[Background Setup] Setting up turn management...');
    try {
      const { TurnManager } = await import('@/features/chat/services/turnManager');
      const turnManager = new TurnManager(chatId);
      
      // Get the chat to check turn mode
      const chatDetails = await prisma.chat.findUnique({
        where: { id: chatId },
        select: { turn_taking: true }
      });
      
      // Only manage turn state for strict/rounds modes that require database state
      if (chatDetails?.turn_taking === 'strict' || chatDetails?.turn_taking === 'rounds') {
        console.log('[Background Setup] Updating turn state for strict/rounds mode');
        
        // Get all current participants (including the new guest)
        const allParticipants = await prisma.chatParticipant.findMany({
          where: { chat_id: chatId },
          select: { user_id: true },
          orderBy: { user_id: 'asc' }
        });
        
        const participantIds = allParticipants.map(p => p.user_id);
        
        // Create or update the turn state to include all participants
        await prisma.chatTurnState.upsert({
          where: { chat_id: chatId },
          update: {
            turn_queue: participantIds
          },
          create: {
            chat_id: chatId,
            next_user_id: participantIds[0] || guestUserId,
            next_role: 'user',
            turn_queue: participantIds,
            current_turn_index: 0
          }
        });
        
        console.log('[Background Setup] Updated turn queue:', participantIds);
      } else {
        console.log('[Background Setup] Flexible/moderated mode - no turn state changes needed');
      }
    } catch (turnError) {
      console.warn('[Background Setup] Turn management setup failed:', turnError);
    }

    // 2. Create guest joined event
    console.log('[Background Setup] Creating guest joined event...');
    try {
      await prisma.event.create({
        data: {
          chat_id: chatId,
          type: 'guest_joined',
          data: {
            guestName,
            guestUserId,
            joinedAt: joinedAt.toISOString()
          },
          seq: 0
        }
      });
    } catch (eventError) {
      console.warn('[Background Setup] Failed to create guest joined event:', eventError);
    }

    // 3. Send Pusher notifications
    console.log('[Background Setup] Sending Pusher notifications...');
    try {
      const { pusherServer, getChatChannelName, PUSHER_EVENTS } = await import('@/lib/pusher');
      const channelName = getChatChannelName(chatId);
      
      await pusherServer.trigger(channelName, PUSHER_EVENTS.PARTICIPANT_JOINED, {
        participant: {
          id: guestUserId,
          display_name: guestName,
          role: 'guest'
        },
        joinedAt: joinedAt.toISOString()
      });
      console.log('[Background Setup] Pusher notification sent');
    } catch (pusherError) {
      console.warn('[Background Setup] Pusher notification failed:', pusherError);
    }

    // 4. Note: AI welcome message now handled by waiting room when both participants are ready
    // No individual guest welcome message needed since both enter together with contextual intro
    console.log('[Background Setup] Skipping individual AI welcome - waiting room will handle chat initiation');

    // 5. Update participant status to fully joined (remove waiting room flag)
    console.log('[Background Setup] Finalizing guest status...');
    try {
      await prisma.chatParticipant.update({
        where: {
          chat_id_user_id: {
            chat_id: chatId,
            user_id: guestUserId
          }
        },
        data: {
          role: 'guest' // Change from 'guest_joining' to 'guest'
        }
      });

      // Send final notification that guest is ready (using participant joined event)
      const { pusherServer, getChatChannelName, PUSHER_EVENTS } = await import('@/lib/pusher');
      const channelName = getChatChannelName(chatId);
      
      await pusherServer.trigger(channelName, PUSHER_EVENTS.PARTICIPANT_JOINED, {
        participant: {
          id: guestUserId,
          display_name: guestName,
          role: 'guest'
        },
        status: 'ready',
        timestamp: new Date().toISOString()
      });
      
      console.log('[Background Setup] Guest setup completed successfully');
    } catch (finalizeError) {
      console.warn('[Background Setup] Failed to finalize guest status:', finalizeError);
    }

  } catch (error) {
    console.error('[Background Setup] Overall setup failed:', error);
  }
}