import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { encode } from 'next-auth/jwt';

export async function POST(request: NextRequest) {
  try {
    const { inviteId, guestName } = await request.json();

    if (!inviteId || !guestName) {
      return NextResponse.json(
        { error: 'inviteId and guestName are required' },
        { status: 400 }
      );
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

    // Create a guest user ID
    const guestUserId = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create a guest user record in the database FIRST (before creating participant)
    try {
      await prisma.user.create({
        data: {
          id: guestUserId,
          display_name: guestName,
          name: guestName,
          email: null
        }
      });
    } catch (error) {
      console.error('Failed to create guest user record:', error);
      return NextResponse.json(
        { error: 'Failed to create guest user' },
        { status: 500 }
      );
    }

    // Add guest as participant to the chat (now the user exists)
    await prisma.chatParticipant.create({
      data: {
        chat_id: invite.chat_id,
        user_id: guestUserId,
        role: 'guest'
      }
    });
    
    // Initialize or update turn management to include the new guest participant
    console.log('[Invite Accept] Updating turn management for guest user...');
    try {
      const { TurnManager } = await import('@/features/chat/services/turnManager');
      const turnManager = new TurnManager(invite.chat_id);
      
      // Check if turn state exists
      const currentTurn = await turnManager.getCurrentTurn();
      if (!currentTurn) {
        // Initialize turn management with the guest as the first speaker
        await turnManager.initializeTurn(guestUserId);
        console.log('[Invite Accept] Turn management initialized with guest as first speaker');
      } else {
        // Set the turn to the guest user so they can immediately participate
        await turnManager.setTurnToUser(guestUserId);
        console.log('[Invite Accept] Turn set to guest user for immediate participation');
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

    // Generate AI welcome message for the guest
    console.log('[Invite Accept] Generating AI welcome message for guest...');
    try {
      const existingParticipantNames = chat.participants
        .filter(p => p.user_id !== guestUserId)
        .map(p => p.user?.display_name || p.user?.name || 'Participant');
      
      const systemPrompt = `You are an AI mediator. ${guestName} has just joined the conversation with ${existingParticipantNames.join(' and ')}. 
      Welcome ${guestName} warmly and briefly explain that you're facilitating this conversation. 
      Invite them to introduce themselves and share what brought them here. 
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

    // Set session cookie that's compatible with NextAuth
    response.cookies.set('next-auth.session-token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
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