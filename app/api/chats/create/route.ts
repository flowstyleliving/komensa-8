import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { TurnManager } from '@/features/chat/services/turnManager';

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

    const { title, description, category, participants = [] } = await request.json();

    // Generate a unique chat ID
    const chatId = `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

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

    // Initialize turn management - chat creator goes first
    console.log('[Chat Creation] Initializing turn management...');
    const turnManager = new TurnManager(chatId);
    await turnManager.initializeTurn(session.user.id);
    console.log('[Chat Creation] Turn management initialized - chat creator goes first');

    // Generate initial AI mediator message with participant names
    console.log('[Chat Creation] Generating initial AI message...');
    const participantNames = [
      session.user.name || 'User',
      ...chat.participants
        .filter(p => p.user_id !== session.user.id)
        .map(p => p.user?.display_name || 'Participant')
    ];

    const systemPrompt = `You are an AI mediator facilitating a conversation between ${participantNames.join(' and ')}. 
    Welcome them warmly and ask an opening question to help them begin sharing. 
    Keep your message concise but welcoming. Focus on creating psychological safety.`;

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

    return NextResponse.json({
      success: true,
      conversation: chat,
      chatId: chat.id,
      redirectUrl: `/chat/${chat.id}`,
      message: 'Conversation created successfully'
    });

  } catch (error: any) {
    console.error('Error creating conversation:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to create conversation',
        details: error.message 
      },
      { status: 500 }
    );
  }
} 