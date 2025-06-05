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

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    
    if (!query || query.trim().length < 2) {
      return NextResponse.json({
        success: true,
        results: []
      });
    }

    const searchTerm = query.trim();
    const userId = session.user.id;
    const isGuest = session.user.isGuest;
    const guestChatId = session.user.chatId;

    // Build base chat filter for user's accessible chats
    const baseChatsWhere = isGuest && guestChatId 
      ? { id: guestChatId }
      : { participants: { some: { user_id: userId } } };

    // Search across multiple types of content
    const [
      chatResults,
      messageResults,
      participantResults
    ] = await Promise.all([
      // Search in chat titles and descriptions
      prisma.event.findMany({
        where: {
          type: 'chat_created',
          chat: baseChatsWhere,
          data: {
            path: ['title', 'description'],
            string_contains: searchTerm
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
        take: 5,
        orderBy: { created_at: 'desc' }
      }).catch(async () => {
        // Fallback: Search using JSONB operators
        return await prisma.event.findMany({
          where: {
            type: 'chat_created',
            chat: baseChatsWhere,
            OR: [
              {
                data: {
                  path: ['title'],
                  string_contains: searchTerm
                }
              },
              {
                data: {
                  path: ['description'],
                  string_contains: searchTerm
                }
              }
            ]
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
          take: 5,
          orderBy: { created_at: 'desc' }
        }).catch(async () => {
          // Final fallback: Get all chat_created events and filter in JS
          const events = await prisma.event.findMany({
            where: {
              type: 'chat_created',
              chat: baseChatsWhere
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
            take: 20,
            orderBy: { created_at: 'desc' }
          });

          return events.filter(event => {
            const data = event.data as any;
            const title = data?.title?.toLowerCase() || '';
            const description = data?.description?.toLowerCase() || '';
            const term = searchTerm.toLowerCase();
            return title.includes(term) || description.includes(term);
          }).slice(0, 5);
        });
      }),

      // Search in message content
      prisma.event.findMany({
        where: {
          type: 'message',
          chat: baseChatsWhere,
          data: {
            path: ['content'],
            string_contains: searchTerm
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
      }).catch(async () => {
        // Fallback: Get all message events and filter in JS
        const events = await prisma.event.findMany({
          where: {
            type: 'message',
            chat: baseChatsWhere
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
          take: 20
        });

        return events.filter(event => {
          const data = event.data as any;
          const content = data?.content?.toLowerCase() || '';
          return content.includes(searchTerm.toLowerCase());
        }).slice(0, 5);
      }),

      // Search for participants by name (only if not a guest)
      isGuest ? [] : prisma.user.findMany({
        where: {
          display_name: {
            contains: searchTerm,
            mode: 'insensitive'
          },
          participants: {
            some: {
              chat: {
                participants: {
                  some: { user_id: userId }
                }
              }
            }
          }
        },
        include: {
          participants: {
            include: {
              chat: {
                select: { id: true, status: true }
              }
            }
          }
        },
        take: 5
      })
    ]);

    // Transform results into unified format
    const results = [
      // Chat results
      ...chatResults.map(event => {
        const eventData = event.data as any;
        const otherParticipants = event.chat.participants.filter((p: any) => p.user_id !== userId);
        
        return {
          id: `chat-${event.chat.id}`,
          type: 'chat' as const,
          title: eventData.title || `Chat with ${otherParticipants.map((p: any) => p.user?.display_name).join(', ')}`,
          description: eventData.description || 'No description',
          subtitle: `Chat • ${otherParticipants.map((p: any) => p.user?.display_name).join(', ')}`,
          actionUrl: `/chat/${event.chat.id}`,
          timestamp: event.created_at,
          relevance: calculateRelevance(searchTerm, (eventData.title || '') + ' ' + (eventData.description || ''))
        };
      }),

      // Message results
      ...messageResults.map(event => {
        const eventData = event.data as any;
        const sender = event.chat.participants.find((p: any) => p.user_id === eventData.senderId);
        const otherParticipants = event.chat.participants.filter((p: any) => p.user_id !== userId);
        const chatTitle = otherParticipants.length > 0 
          ? `Chat with ${otherParticipants.map((p: any) => p.user?.display_name).join(', ')}`
          : 'Chat';
        
        return {
          id: `message-${event.id}`,
          type: 'message' as const,
          title: highlightMatch(eventData.content || '', searchTerm),
          description: `Message from ${sender?.user?.display_name || 'Unknown'}`,
          subtitle: `Message • ${chatTitle}`,
          actionUrl: `/chat/${event.chat.id}`,
          timestamp: event.created_at,
          relevance: calculateRelevance(searchTerm, eventData.content || '')
        };
      }),

      // Participant results (only for regular users, not guests)
      ...participantResults.map(user => {
        const activeChats = user.participants
          .filter((p: any) => p.chat.status === 'active')
          .length;
        
        return {
          id: `user-${user.id}`,
          type: 'participant' as const,
          title: highlightMatch(user.display_name || 'Unknown User', searchTerm),
          description: `Chat participant • ${activeChats} active chat${activeChats !== 1 ? 's' : ''}`,
          subtitle: 'Participant',
          actionUrl: '/dashboard',
          timestamp: new Date(),
          relevance: calculateRelevance(searchTerm, user.display_name || '')
        };
      })
    ];

    // Sort by relevance and timestamp
    results.sort((a, b) => {
      const relevanceDiff = b.relevance - a.relevance;
      if (relevanceDiff !== 0) return relevanceDiff;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

    return NextResponse.json({
      success: true,
      results: results.slice(0, 8), // Limit to top 8 results
      query: searchTerm,
      isGuest: isGuest || false
    });

  } catch (error: any) {
    console.error('Error performing search:', error);
    
    return NextResponse.json(
      { 
        error: 'Search failed',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

// Helper function to calculate relevance score
function calculateRelevance(searchTerm: string, content: string): number {
  if (!content) return 0;
  
  const contentLower = content.toLowerCase();
  const termLower = searchTerm.toLowerCase();
  
  // Exact match gets highest score
  if (contentLower === termLower) return 100;
  
  // Starts with search term gets high score
  if (contentLower.startsWith(termLower)) return 80;
  
  // Contains exact phrase gets good score
  if (contentLower.includes(termLower)) return 60;
  
  // Word matches get lower score
  const words = termLower.split(' ');
  let wordMatches = 0;
  words.forEach(word => {
    if (contentLower.includes(word)) wordMatches++;
  });
  
  return (wordMatches / words.length) * 40;
}

// Helper function to highlight matched text
function highlightMatch(content: string, searchTerm: string): string {
  if (!content || !searchTerm) return content;
  
  const regex = new RegExp(`(${searchTerm})`, 'gi');
  return content.replace(regex, '<mark>$1</mark>');
} 