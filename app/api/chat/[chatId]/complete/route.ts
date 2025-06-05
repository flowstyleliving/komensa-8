import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { pusherServer, getChatChannelName, PUSHER_EVENTS } from '@/lib/pusher';

// POST: Mark user as complete
export async function POST(request: NextRequest, { params }: { params: Promise<{ chatId: string }> }) {
  try {
    const { chatId } = await params;
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const body = await request.json();
    const { completionType = 'natural' } = body;

    // For guest users, verify they have access to this specific chat
    if (session.user.isGuest && session.user.chatId !== chatId) {
      return NextResponse.json({ error: 'Access denied - guests can only access their invited chat' }, { status: 403 });
    }

    // Verify user is a participant in this chat
    const chat = await prisma.chat.findFirst({
      where: {
        id: chatId,
        participants: {
          some: {
            user_id: userId
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
                name: true
              }
            }
          }
        }
      }
    });

    if (!chat) {
      return NextResponse.json({ error: 'Chat not found or access denied' }, { status: 404 });
    }

    // Mark user as complete (upsert to handle multiple attempts)
    await prisma.chatCompletionStatus.upsert({
      where: {
        chat_id_user_id: {
          chat_id: chatId,
          user_id: userId
        }
      },
      update: {
        marked_complete_at: new Date(),
        completion_type: completionType
      },
      create: {
        chat_id: chatId,
        user_id: userId,
        completion_type: completionType
      }
    });

    // Create completion event
    await prisma.event.create({
      data: {
        chat_id: chatId,
        type: 'completion_marked',
        data: {
          userId,
          userName: session.user.name || 'User',
          completionType,
          markedAt: new Date().toISOString()
        },
        seq: 0
      }
    });

    // Check if all participants have marked complete
    const totalParticipants = chat.participants.length;
    const completedCount = await prisma.chatCompletionStatus.count({
      where: { chat_id: chatId }
    });

    const allComplete = completedCount === totalParticipants;

    // Emit completion update via Pusher
    const channelName = getChatChannelName(chatId);
    await pusherServer.trigger(channelName, PUSHER_EVENTS.COMPLETION_UPDATE, {
      userId,
      userName: session.user.name || 'User',
      completionType,
      allComplete,
      completedCount,
      totalParticipants
    });

    // If all participants are complete, trigger summary generation
    if (allComplete) {
      await prisma.event.create({
        data: {
          chat_id: chatId,
          type: 'completion_ready',
          data: {
            allParticipantsComplete: true,
            readyForSummary: true,
            completedAt: new Date().toISOString()
          },
          seq: 0
        }
      });

      await pusherServer.trigger(channelName, PUSHER_EVENTS.COMPLETION_READY, {
        allComplete: true,
        readyForSummary: true
      });
    }

    return NextResponse.json({
      success: true,
      allComplete,
      completedCount,
      totalParticipants
    });

  } catch (error: any) {
    console.error('Error marking chat complete:', error);
    return NextResponse.json(
      { 
        error: 'Failed to mark chat complete',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

// GET: Get completion status for the chat
export async function GET(request: NextRequest, { params }: { params: Promise<{ chatId: string }> }) {
  try {
    const { chatId } = await params;
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // For guest users, verify they have access to this specific chat
    if (session.user.isGuest && session.user.chatId !== chatId) {
      return NextResponse.json({ error: 'Access denied - guests can only access their invited chat' }, { status: 403 });
    }

    // Get completion status for all participants
    const completionStatuses = await prisma.chatCompletionStatus.findMany({
      where: { chat_id: chatId },
      include: {
        user: {
          select: {
            id: true,
            display_name: true,
            name: true
          }
        }
      }
    });

    // Get total participant count
    const totalParticipants = await prisma.chatParticipant.count({
      where: { chat_id: chatId }
    });

    const allComplete = completionStatuses.length === totalParticipants;

    return NextResponse.json({
      completionStatuses,
      allComplete,
      completedCount: completionStatuses.length,
      totalParticipants
    });

  } catch (error: any) {
    console.error('Error getting completion status:', error);
    return NextResponse.json(
      { 
        error: 'Failed to get completion status',
        details: error.message 
      },
      { status: 500 }
    );
  }
} 