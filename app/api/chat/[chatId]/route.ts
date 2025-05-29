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

    // Generate a unique chat ID (using chatId for consistency with existing system)
    const chatId = `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // TODO: Create chat in database when Chat model is available
    // For now, we'll return a mock response
    const mockChat = {
      id: chatId,
      title,
      description: description || '',
      category,
      participants: [
        {
          id: session.user.id,
          display_name: session.user.name || 'You',
          email: session.user.email || '',
          role: 'creator'
        },
        ...participants.map((p: any) => ({
          ...p,
          role: 'participant'
        }))
      ],
      createdBy: session.user.id,
      createdAt: new Date().toISOString(),
      status: 'active'
    };

    return NextResponse.json({
      success: true,
      chat: mockChat,
      chatId,
      redirectUrl: `/chat/${chatId}`,
      message: 'Chat created successfully'
    });

    /* 
    // Uncomment when Chat model is available:
    const chat = await prisma.chat.create({
      data: {
        id: chatId,
        title,
        description: description || '',
        category,
        createdBy: session.user.id,
        status: 'active',
        participants: {
          create: [
            {
              userId: session.user.id,
              role: 'creator',
              joinedAt: new Date()
            },
            ...participants.map((participant: any) => ({
              userId: participant.id,
              role: 'participant',
              joinedAt: new Date()
            }))
          ]
        }
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                display_name: true,
                email: true,
                avatar: true
              }
            }
          }
        }
      }
    });

    return NextResponse.json({
      success: true,
      chat,
      chatId: chat.id,
      redirectUrl: `/chat/${chat.id}`,
      message: 'Chat created successfully'
    });
    */

  } catch (error: any) {
    console.error('Error creating chat:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to create chat',
        details: error.message 
      },
      { status: 500 }
    );
  }
} 