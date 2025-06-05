import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    // Check if user is authenticated
    const session = await getServerSession(authOptions);
    
    console.log('[Chats API] Session debug:', {
      hasSession: !!session,
      userId: session?.user?.id,
      isGuest: session?.user?.isGuest,
      chatId: session?.user?.chatId
    });
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Fetch chats where the user is a participant
    const chats = await prisma.chat.findMany({
      where: {
        participants: {
          some: {
            user_id: session.user.id
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
            type: {
              in: ['chat_created', 'message']
            }
          },
          orderBy: {
            created_at: 'desc'
          },
          take: 1 // Get most recent event for last activity
        }
      },
      orderBy: {
        created_at: 'desc'
      }
    });

    console.log('[Chats API] Found chats:', chats.length);

    // Transform data for frontend
    const transformedChats = chats.map(chat => {
      const chatCreatedEvent = chat.events.find(e => e.type === 'chat_created');
      const lastMessageEvent = chat.events.find(e => e.type === 'message');
      
      // Get other participants (not the current user)
      const otherParticipants = chat.participants.filter(p => p.user_id !== session.user.id);
      
      // Get chat metadata from the chat_created event
      const metadata = chatCreatedEvent?.data as any || {};
      
      return {
        id: chat.id,
        title: metadata.title || `Chat with ${otherParticipants.map(p => p.user?.display_name).join(', ')}`,
        description: metadata.description || 'No description',
        lastActive: lastMessageEvent?.created_at || chat.created_at,
        participants: chat.participants.map(p => ({
          id: p.user_id,
          display_name: p.user?.display_name || 'Unknown',
          role: p.role
        })),
        status: chat.status,
        created_at: chat.created_at
      };
    });

    return NextResponse.json({
      success: true,
      chats: transformedChats
    });

  } catch (error: any) {
    console.error('Error fetching chats:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch chats',
        details: error.message 
      },
      { status: 500 }
    );
  }
} 