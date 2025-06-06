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
      console.log('[Chats API] No session or user ID found');
      return NextResponse.json(
        { error: 'Unauthorized - Please sign in' },
        { status: 401 }
      );
    }

    // Guest users cannot access the general chats list - they can only access their specific chat
    if (session.user.isGuest) {
      console.log('[Chats API] Guest user attempted to access chats list');
      return NextResponse.json(
        { error: 'Access denied - Guests can only access their invited chat' },
        { status: 403 }
      );
    }

    console.log('[Chats API] Fetching chats for user:', session.user.id);

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

    console.log('[Chats API] Returning transformed chats:', transformedChats.length);

    return NextResponse.json({
      success: true,
      chats: transformedChats
    });

  } catch (error: any) {
    console.error('[Chats API] Error fetching chats:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch chats',
        details: error.message 
      },
      { status: 500 }
    );
  }
} 