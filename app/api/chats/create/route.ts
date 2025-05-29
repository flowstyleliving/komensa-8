import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

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

    const { title, description, category, participants } = await request.json();

    if (!title || !category) {
      return NextResponse.json(
        { error: 'Title and category are required' },
        { status: 400 }
      );
    }

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
              title,
              description: description || '',
              category,
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