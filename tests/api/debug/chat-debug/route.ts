import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest, { params }: { params: Promise<{ chatId: string }> }) {
  try {
    const { chatId } = await params;
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get comprehensive chat information for debugging
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                display_name: true,
                name: true,
                email: true
              }
            }
          }
        },
        events: {
          orderBy: { created_at: 'desc' },
          take: 10
        }
      }
    });

    if (!chat) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }

    // Get turn state
    const turnState = await prisma.chatTurnState.findUnique({
      where: { chat_id: chatId }
    });

    // Check if current user is a participant
    const isParticipant = chat.participants.some(p => p.user_id === session.user.id);

    return NextResponse.json({
      chatId,
      chat: {
        id: chat.id,
        status: chat.status,
        created_at: chat.created_at,
        origin: chat.origin
      },
      participants: chat.participants.map(p => ({
        user_id: p.user_id,
        role: p.role,
        user: p.user
      })),
      currentUser: {
        id: session.user.id,
        isGuest: session.user.isGuest,
        isParticipant
      },
      turnState,
      recentEvents: chat.events.map(e => ({
        id: e.id,
        type: e.type,
        created_at: e.created_at,
        data: e.data
      })),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[Chat Debug] Error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 