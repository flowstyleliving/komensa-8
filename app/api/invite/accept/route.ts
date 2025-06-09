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
    
    // Initialize or update turn management to include the new guest participant
    console.log('[Invite Accept] Updating turn management for guest user...');
    try {
      const { TurnManager } = await import('@/features/chat/services/turnManager');
      const turnManager = new TurnManager(invite.chat_id);
      
      // Get the chat to check turn mode
      const chatDetails = await prisma.chat.findUnique({
        where: { id: invite.chat_id },
        select: { turn_taking: true }
      });
      
      // Check if turn state exists
      const currentTurn = await turnManager.getCurrentTurn();
      if (!currentTurn) {
        // No turn state exists - initialize
        const creator = chat.participants.find(p => p.role === 'user' || p.role === 'creator');
        const creatorId = creator?.user_id;
        
        if (creatorId) {
          await turnManager.initializeTurn(creatorId);
          console.log('[Invite Accept] Turn management initialized with creator as first speaker');
        } else {
          await turnManager.initializeTurn(guestUserId);
          console.log('[Invite Accept] Turn management initialized with guest as first speaker (no creator found)');
        }
      } else if (chatDetails?.turn_taking === 'strict') {
        // Turn state exists and we're in strict mode - update the turn queue to include the new guest
        console.log('[Invite Accept] Updating strict mode turn queue to include new guest');
        
        // Get all current participants (including the new guest)
        const allParticipants = await prisma.chatParticipant.findMany({
          where: { chat_id: invite.chat_id },
          select: { user_id: true },
          orderBy: { user_id: 'asc' }
        });
        
        const participantIds = allParticipants.map(p => p.user_id);
        
        // Update the turn state to include all participants
        await prisma.chatTurnState.update({
          where: { chat_id: invite.chat_id },
          data: {
            turn_queue: participantIds
            // Keep the current next_user_id and current_turn_index as they are
          }
        });
        
        console.log('[Invite Accept] Updated turn queue to include all participants:', participantIds);
      } else {
        // Flexible or moderated mode - no changes needed
        console.log('[Invite Accept] Flexible/moderated mode - no turn state changes needed');
      }
    } catch (turnError) {
      console.warn('[Invite Accept] Failed to update turn management for guest:', turnError);
      // Don't fail the invite acceptance if turn management fails
    }

    // Create a JWT token for the guest session using NextAuth's encode function
    const sessionToken = await encode({
      token: {
        id: guestUserId,
        name: guestName,
        email: null,
        picture: null,
        isGuest: true,
        chatId: invite.chat_id,
        sub: guestUserId, // Required by NextAuth JWT
        iat: Math.floor(Date.now() / 1000), // issued at
        exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // expires in 24 hours
        jti: `guest-${guestUserId}` // JWT ID
      },
      secret: process.env.NEXTAUTH_SECRET!,
      maxAge: 24 * 60 * 60 // 24 hours
    });

    console.log('[Invite Accept] Created session token for guest:', {
      guestUserId,
      guestName,
      chatId: invite.chat_id,
      tokenLength: sessionToken.length
    });

    // Create an event to log the guest joining
    try {
      await prisma.event.create({
        data: {
          chat_id: invite.chat_id,
          type: 'guest_joined',
          data: {
            guestName,
            guestUserId,
            joinedAt: now.toISOString()
          },
          seq: 0 // We'll let the database handle sequencing
        }
      });
    } catch (error) {
      console.warn('Failed to create guest joined event:', error);
    }

    // Notify existing participants about the new guest joining via Pusher
    try {
      const { pusherServer, getChatChannelName, PUSHER_EVENTS } = await import('@/lib/pusher');
      const channelName = getChatChannelName(invite.chat_id);
      
      await pusherServer.trigger(channelName, PUSHER_EVENTS.PARTICIPANT_JOINED, {
        participant: {
          id: guestUserId,
          display_name: guestName,
          role: 'guest'
        },
        joinedAt: now.toISOString()
      });
      console.log('[Invite Accept] Pusher notification sent for new guest participant');
    } catch (error) {
      console.warn('Failed to send Pusher notification for guest joining:', error);
    }

    // Generate AI welcome message for the guest
    console.log('[Invite Accept] Generating AI welcome message for guest...');
    try {
      const existingParticipantNames = chat.participants
        .filter(p => p.user_id !== guestUserId)
        .map(p => {
          const fullName = p.user?.display_name || p.user?.name || 'Participant';
          return fullName.split(' ')[0]; // Use just first name
        });
      
      const guestFirstName = guestName.split(' ')[0]; // Use just first name for guest too
      
      const systemPrompt = `You are an AI mediator. ${guestFirstName} has just joined the conversation with ${existingParticipantNames.join(' and ')}. 
      Welcome ${guestFirstName} warmly, briefly acknowledge that they've joined the ongoing conversation, and invite them to introduce themselves. 
      Ask them to share what brought them here and what they hope to get from this conversation.
      Keep it concise, welcoming, and create psychological safety for everyone.`;

      const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: systemPrompt
            }
          ],
          max_tokens: 150,
          temperature: 0.7,
        }),
      });

      if (aiResponse.ok) {
        const aiData = await aiResponse.json();
        const aiMessage = aiData.choices[0]?.message?.content;

        if (aiMessage) {
          // Save AI welcome message to database
          await prisma.event.create({
            data: {
              chat_id: invite.chat_id,
              type: 'message',
              data: {
                content: aiMessage,
                senderId: 'assistant'
              },
              seq: 0,
            },
          });
          console.log('[Invite Accept] AI welcome message generated and saved for guest');
        }
      } else {
        console.error('[Invite Accept] Failed to generate AI welcome message:', aiResponse.status);
      }
    } catch (aiError) {
      console.error('[Invite Accept] Error generating AI welcome message:', aiError);
      // Don't fail the invite acceptance if AI message fails
    }

    // Set the session cookie
    const response = NextResponse.json({
      success: true,
      sessionToken,
      chatId: invite.chat_id,
      guestUserId
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