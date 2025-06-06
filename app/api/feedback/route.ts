import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { chatId, rating, feedback, userType } = await request.json();

    if (!chatId || !rating) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify user has access to this chat
    const chat = await prisma.chat.findFirst({
      where: {
        id: chatId,
        participants: {
          some: {
            user_id: session.user.id
          }
        }
      }
    });

    if (!chat) {
      return NextResponse.json({ error: 'Chat not found or access denied' }, { status: 404 });
    }

    // Store feedback
    const feedbackRecord = await prisma.conversationFeedback.create({
      data: {
        chat_id: chatId,
        user_id: session.user.id,
        rating,
        feedback: feedback || null,
        user_type: userType || 'registered',
        submitted_at: new Date()
      }
    });

    console.log('[Feedback API] Feedback submitted:', {
      chatId,
      userId: session.user.id,
      rating,
      userType
    });

    return NextResponse.json({
      success: true,
      feedbackId: feedbackRecord.id
    });

  } catch (error: any) {
    console.error('[Feedback API] Error submitting feedback:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to submit feedback',
        details: error.message 
      },
      { status: 500 }
    );
  }
} 