import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { TurnManager } from '@/features/chat/services/turnManager';

// POST: Reset turn state for a chat
export async function POST(request: NextRequest, { params }: { params: Promise<{ chatId: string }> }) {
  try {
    const { chatId } = await params;
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

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
      }
    });

    if (!chat) {
      return NextResponse.json({ error: 'Chat not found or access denied' }, { status: 404 });
    }

    // Reset the turn state
    const turnManager = new TurnManager(chatId);
    const newTurnState = await turnManager.resetTurn();

    console.log('[Reset Turn API] Turn state reset successfully:', newTurnState);

    return NextResponse.json({
      success: true,
      message: 'Turn state reset successfully',
      turnState: newTurnState
    });

  } catch (error: any) {
    console.error('[Reset Turn API] Error resetting turn state:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to reset turn state',
        details: error.message 
      },
      { status: 500 }
    );
  }
} 