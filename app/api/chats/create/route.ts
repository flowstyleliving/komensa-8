import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { TurnManager } from '@/features/chat/services/turnManager';
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

    const { title, description, category, participants = [], withInvite = false } = await request.json();

    // Validate current user exists in database
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id }
    });

    if (!currentUser) {
      console.error('[Chat Creation] Current user not found in database:', session.user.id);
      return NextResponse.json(
        { error: 'User not found in database' },
        { status: 400 }
      );
    }

    // Validate all participant user IDs exist in database
    if (participants.length > 0) {
      const participantIds = participants.map((p: any) => p.id);
      const existingUsers = await prisma.user.findMany({
        where: {
          id: {
            in: participantIds
          }
        },
        select: { id: true }
      });

      const existingUserIds = existingUsers.map(u => u.id);
      const missingUserIds = participantIds.filter((id: string) => !existingUserIds.includes(id));

      if (missingUserIds.length > 0) {
        console.error('[Chat Creation] Participant user IDs not found:', missingUserIds);
        return NextResponse.json(
          { 
            error: 'Some participants not found in database',
            details: `Missing user IDs: ${missingUserIds.join(', ')}`
          },
          { status: 400 }
        );
      }
    }

    // Generate a unique chat ID
    const chatId = uuidv4();

    console.log('[Chat Creation] Creating chat with participants:', {
      chatId,
      creatorId: session.user.id,
      participantIds: participants.map((p: any) => p.id)
    });

    // Create conversation in Prisma/Neon database
    // Note: Chat model only has: id, origin, mediator_style, turn_taking, status, created_at
    // We'll store title, description, category in the first Event as metadata
    const chat = await prisma.chat.create({
      data: {
        id: chatId,
        origin: 'web',
        mediator_style: 'default',
        turn_taking: 'strict',
        status: 'active',
        participants: {
          create: [
            {
              user_id: session.user.id,
              role: 'creator'
            },
            ...participants.map((participant: any) => ({
              user_id: participant.id,
              role: 'participant'
            }))
          ]
        },
        events: {
          create: {
            type: 'chat_created',
            data: {
              title: title || '',
              description: description || '',
              category: category || '',
              createdBy: session.user.id,
              createdAt: new Date().toISOString()
            },
            seq: 0
          }
        }
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                display_name: true,
                email: true
              }
            }
          }
        },
        events: {
          where: {
            type: 'chat_created'
          }
        }
      }
    });

    let inviteData = null;

    // Create invite if requested
    if (withInvite) {
      const inviteId = uuidv4(); // Generate a proper UUID for the invite
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24); // 24-hour expiration

      // Create invite record using Prisma model
      await prisma.chatInvite.create({
        data: {
          id: inviteId,
          chat_id: chatId,
          token: inviteId,
          expires_at: expiresAt
        }
      });

      const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
      const inviteUrl = `${baseUrl}/invite/${inviteId}`;

      inviteData = {
        inviteId,
        inviteUrl
      };
    }

    // Initialize turn management - chat creator goes first
    console.log('[Chat Creation] Initializing turn management...');
    const turnManager = new TurnManager(chatId);
    await turnManager.initializeTurn(session.user.id);
    console.log('[Chat Creation] Turn management initialized - chat creator goes first');

    // Generate initial AI mediator message with participant names
    console.log('[Chat Creation] Generating initial AI message...');
    
    // Use just the first name to avoid AI confusion with full names
    const creatorDisplayName = session.user.name || 'User';
    const creatorFirstName = creatorDisplayName.split(' ')[0]; // Get just first name
    
    // Check if there are other actual participants (not including the creator)
    const otherParticipants = chat.participants.filter(p => p.user_id !== session.user.id);
    
    let systemPrompt: string;
    
    if (otherParticipants.length > 0 && !withInvite) {
      // There are pre-selected participants - use their names
      const otherParticipantNames = otherParticipants.map(p => p.user?.display_name || 'Participant');
      systemPrompt = `You are an AI mediator facilitating a conversation between ${creatorFirstName} and ${otherParticipantNames.join(' and ')}. 
      Welcome them warmly and ask for context to help them begin sharing and try to get out what their intentions are for the conversation. 
      Keep your message concise but welcoming. Focus on creating psychological safety.`;
    } else {
      // Solo start or invite-based chat - refer to partner generically
      systemPrompt = `You are an AI mediator. ${creatorFirstName} is starting a conversation and will be inviting someone to join. 
      Welcome ${creatorFirstName} warmly and ask them to share what they'd like to discuss and what they hope to achieve from this conversation. 
      Let them know their partner will be invited to join after they share their initial thoughts. 
      Keep your message concise but welcoming. Focus on creating psychological safety.`;
    }

    // Generate AI response
    try {
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
          max_tokens: 200,
          temperature: 0.7,
        }),
      });

      if (aiResponse.ok) {
        const aiData = await aiResponse.json();
        const aiMessage = aiData.choices[0]?.message?.content;

        if (aiMessage) {
          // Save AI message to database
          await prisma.event.create({
            data: {
              chat_id: chatId,
              type: 'message',
              data: {
                content: aiMessage,
                senderId: 'assistant'
              },
              seq: 1,
            },
          });
          console.log('[Chat Creation] Initial AI message generated and saved');
        }
      } else {
        console.error('[Chat Creation] Failed to generate AI message:', aiResponse.status);
      }
    } catch (aiError) {
      console.error('[Chat Creation] Error generating AI message:', aiError);
      // Don't fail the entire chat creation if AI message fails
    }

    const response = {
      success: true,
      conversation: chat,
      chatId: chat.id,
      redirectUrl: `/chat/${chat.id}`,
      message: 'Conversation created successfully',
      ...(inviteData && inviteData) // Include invite data if created
    };

    return NextResponse.json(response);

  } catch (error: any) {
    console.error('Error creating conversation:', error);
    
    // Check if it's a foreign key constraint error
    if (error.code === 'P2003') {
      return NextResponse.json(
        { 
          error: 'Invalid participant - user not found in database',
          details: 'One or more participant IDs do not exist in the User table'
        },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to create conversation',
        details: error.message 
      },
      { status: 500 }
    );
  }
} 