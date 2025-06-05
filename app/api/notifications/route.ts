import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

// Simple in-memory store for read notifications (in production, use Redis or database)
const readNotifications = new Map<string, Set<string>>();

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Get user's read notifications
    const userReadNotifications = readNotifications.get(userId) || new Set();

    // Fetch various types of notifications
    const [
      newMessages,
      chatInvites,
      completionRequests,
      yourTurnChats
    ] = await Promise.all([
      // New messages in user's chats (last 24 hours)
      prisma.event.findMany({
        where: {
          type: 'message',
          created_at: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
          },
          chat: {
            participants: {
              some: { user_id: userId }
            }
          },
          data: {
            path: ['senderId'],
            not: userId // Not from the current user
          }
        },
        include: {
          chat: {
            include: {
              participants: {
                include: {
                  user: {
                    select: { id: true, display_name: true }
                  }
                }
              }
            }
          }
        },
        orderBy: { created_at: 'desc' },
        take: 5
      }),

      // Chat invites
      prisma.chatInvite.findMany({
        where: {
          email: session.user.email,
          accepted_at: null,
          expires_at: {
            gte: new Date()
          }
        },
        include: {
          chat: true
        },
        orderBy: { expires_at: 'desc' }
      }),

      // Completion requests (when others mark chats as complete)
      prisma.event.findMany({
        where: {
          type: 'completion_marked',
          created_at: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last week
          },
          chat: {
            participants: {
              some: { user_id: userId }
            }
          },
          data: {
            path: ['userId'],
            not: userId // Not marked complete by current user
          }
        },
        include: {
          chat: {
            include: {
              participants: {
                include: {
                  user: {
                    select: { id: true, display_name: true }
                  }
                }
              }
            }
          }
        },
        orderBy: { created_at: 'desc' },
        take: 3
      }),

      // Chats where it's user's turn (simplified check)
      prisma.chat.findMany({
        where: {
          status: 'active',
          participants: {
            some: { user_id: userId }
          },
          // Last event was not from current user
          events: {
            some: {
              type: 'message',
              data: {
                path: ['senderId'],
                not: userId
              }
            }
          }
        },
        include: {
          participants: {
            include: {
              user: {
                select: { id: true, display_name: true }
              }
            }
          },
          events: {
            where: { type: 'message' },
            orderBy: { created_at: 'desc' },
            take: 1
          }
        },
        take: 3
      })
    ]);

    // Transform data into notification format
    const notifications = [
      // New message notifications
      ...newMessages.map(event => {
        const eventData = event.data as any;
        const sender = event.chat.participants.find(p => p.user_id === eventData.senderId);
        const chatTitle = eventData.title || `Chat with ${event.chat.participants.filter(p => p.user_id !== userId).map(p => p.user?.display_name).join(', ')}`;
        const notificationId = `message-${event.id}`;
        
        return {
          id: notificationId,
          type: 'message',
          title: 'New message',
          description: `${sender?.user?.display_name || 'Someone'} sent a message in "${chatTitle}"`,
          timestamp: event.created_at,
          priority: 'high',
          actionUrl: `/chat/${event.chat_id}`,
          unread: !userReadNotifications.has(notificationId)
        };
      }),

      // Chat invite notifications
      ...chatInvites.map(invite => {
        const notificationId = `invite-${invite.id}`;
        return {
          id: notificationId,
          type: 'invite',
          title: 'Chat invitation',
          description: `You've been invited to join a chat`,
          timestamp: invite.expires_at,
          priority: 'medium',
          actionUrl: `/invite/${invite.chat_id}`,
          unread: !userReadNotifications.has(notificationId)
        };
      }),

      // Completion request notifications
      ...completionRequests.map(event => {
        const eventData = event.data as any;
        const user = event.chat.participants.find(p => p.user_id === eventData.userId);
        const chatTitle = eventData.title || `Chat with ${event.chat.participants.filter(p => p.user_id !== userId).map(p => p.user?.display_name).join(', ')}`;
        const notificationId = `completion-${event.id}`;
        
        return {
          id: notificationId,
          type: 'completion',
          title: 'Ready to wrap up',
          description: `${user?.user?.display_name || 'Someone'} marked "${chatTitle}" as complete`,
          timestamp: event.created_at,
          priority: 'medium',
          actionUrl: `/chat/${event.chat_id}`,
          unread: !userReadNotifications.has(notificationId)
        };
      }),

      // Your turn notifications
      ...yourTurnChats.map(chat => {
        const otherParticipants = chat.participants.filter(p => p.user_id !== userId);
        const chatTitle = `Chat with ${otherParticipants.map(p => p.user?.display_name).join(', ')}`;
        const lastEvent = chat.events[0];
        const notificationId = `turn-${chat.id}`;
        
        return {
          id: notificationId,
          type: 'turn',
          title: 'Your turn',
          description: `It's your turn to respond in "${chatTitle}"`,
          timestamp: lastEvent?.created_at || chat.created_at,
          priority: 'high',
          actionUrl: `/chat/${chat.id}`,
          unread: !userReadNotifications.has(notificationId)
        };
      })
    ];

    // Sort by timestamp and priority
    notifications.sort((a, b) => {
      // First sort by priority
      const priorityWeight = { high: 3, medium: 2, low: 1 };
      const priorityDiff = priorityWeight[b.priority as keyof typeof priorityWeight] - priorityWeight[a.priority as keyof typeof priorityWeight];
      if (priorityDiff !== 0) return priorityDiff;
      
      // Then by timestamp
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

    return NextResponse.json({
      success: true,
      notifications: notifications.slice(0, 10), // Limit to 10 most recent
      unreadCount: notifications.filter(n => n.unread).length
    });

  } catch (error: any) {
    console.error('Error fetching notifications:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch notifications',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

// Mark notifications as read
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const { action = 'mark_read', notificationIds = [] } = await request.json();

    // Get or create user's read notifications set
    if (!readNotifications.has(userId)) {
      readNotifications.set(userId, new Set());
    }
    const userReadNotifications = readNotifications.get(userId)!;

    if (action === 'mark_all_read') {
      // Generate all possible notification IDs without making internal fetch
      // This duplicates some logic from GET but avoids DOM conflicts
      const [newMessages, chatInvites, completionRequests, yourTurnChats] = await Promise.all([
        prisma.event.findMany({
          where: {
            type: 'message',
            created_at: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
            chat: { participants: { some: { user_id: userId } } },
            data: { path: ['senderId'], not: userId }
          },
          select: { id: true }
        }),
        prisma.chatInvite.findMany({
          where: {
            email: session.user.email,
            accepted_at: null,
            expires_at: { gte: new Date() }
          },
          select: { id: true }
        }),
        prisma.event.findMany({
          where: {
            type: 'completion_marked',
            created_at: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
            chat: { participants: { some: { user_id: userId } } },
            data: { path: ['userId'], not: userId }
          },
          select: { id: true }
        }),
        prisma.chat.findMany({
          where: {
            status: 'active',
            participants: { some: { user_id: userId } },
            events: {
              some: {
                type: 'message',
                data: { path: ['senderId'], not: userId }
              }
            }
          },
          select: { id: true }
        })
      ]);

      // Mark all current notifications as read
      newMessages.forEach(event => userReadNotifications.add(`message-${event.id}`));
      chatInvites.forEach(invite => userReadNotifications.add(`invite-${invite.id}`));
      completionRequests.forEach(event => userReadNotifications.add(`completion-${event.id}`));
      yourTurnChats.forEach(chat => userReadNotifications.add(`turn-${chat.id}`));
      
    } else if (action === 'mark_read' && Array.isArray(notificationIds)) {
      // Mark specific notifications as read
      notificationIds.forEach((id: string) => userReadNotifications.add(id));
    }
    
    return NextResponse.json({
      success: true,
      message: action === 'mark_all_read' ? 'All notifications marked as read' : 'Notifications marked as read',
      readCount: userReadNotifications.size
    });

  } catch (error: any) {
    console.error('Error marking notifications as read:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to mark notifications as read',
        details: error.message 
      },
      { status: 500 }
    );
  }
} 