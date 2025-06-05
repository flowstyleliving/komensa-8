import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Fetch recent events for user's chats
    const recentEvents = await prisma.event.findMany({
      where: {
        chat: {
          participants: {
            some: {
              user_id: session.user.id
            }
          }
        },
        type: {
          in: ['message', 'ai_response', 'chat_created', 'completion_marked']
        }
      },
      include: {
        chat: {
          include: {
            participants: {
              include: {
                user: {
                  select: {
                    id: true,
                    display_name: true
                  }
                }
              }
            }
          }
        }
      },
      orderBy: {
        created_at: 'desc'
      },
      take: 10
    });

    // Transform events into activity items
    const activities = recentEvents.map(event => {
      const eventData = event.data as any;
      const chat = event.chat;
      const chatTitle = eventData.title || `Chat with ${chat.participants.filter(p => p.user_id !== session.user.id).map(p => p.user?.display_name).join(', ')}`;

      switch (event.type) {
        case 'message':
          const isFromCurrentUser = eventData.senderId === session.user.id;
          const senderName = isFromCurrentUser ? 'You' : 
            chat.participants.find(p => p.user_id === eventData.senderId)?.user?.display_name || 'Someone';
          
          return {
            type: 'message',
            description: `${senderName} sent a message in "${chatTitle}"`,
            timestamp: event.created_at,
            color: '[#D8A7B1]'
          };

        case 'ai_response':
          return {
            type: 'ai_response',
            description: `AI mediator responded in "${chatTitle}"`,
            timestamp: event.created_at,
            color: '[#D9C589]'
          };

        case 'chat_created':
          return {
            type: 'completion',
            description: `New chat "${chatTitle}" was created`,
            timestamp: event.created_at,
            color: '[#7BAFB0]'
          };

        case 'completion_marked':
          return {
            type: 'completion',
            description: `You marked "${chatTitle}" as complete`,
            timestamp: event.created_at,
            color: '[#7BAFB0]'
          };

        default:
          return null;
      }
    }).filter(Boolean);

    return NextResponse.json({
      success: true,
      activities
    });

  } catch (error: any) {
    console.error('Error fetching recent activity:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch recent activity',
        details: error.message 
      },
      { status: 500 }
    );
  }
} 