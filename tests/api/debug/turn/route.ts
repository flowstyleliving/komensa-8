import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { TurnManager } from '@/features/chat/services/turnManager';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const chatId = req.nextUrl.searchParams.get('chatId');
  
  if (!chatId) {
    return NextResponse.json({ error: 'Missing chatId' }, { status: 400 });
  }

  try {
    // Get chat details
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      include: { 
        participants: { include: { user: true } },
        turn_state: true
      }
    });

    if (!chat) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }

    // Test turn manager
    const turnManager = new TurnManager(chatId);
    
    const [turnMode, participants, lastMessageSender, currentTurn] = await Promise.all([
      turnManager.getTurnMode(),
      turnManager.getParticipants(),
      turnManager.getLastMessageSender(),
      turnManager.getCurrentTurn()
    ]);

    // Test permissions for each participant
    const participantPermissions = await Promise.all(
      chat.participants.map(async (p) => ({
        userId: p.user_id,
        displayName: p.user?.display_name,
        role: p.role,
        canSend: await turnManager.canUserSendMessage(p.user_id)
      }))
    );

    // Test current session user if they exist
    let sessionUserPermission = null;
    if (session?.user?.id) {
      sessionUserPermission = {
        userId: session.user.id,
        isGuest: session.user.isGuest,
        canSend: await turnManager.canUserSendMessage(session.user.id)
      };
    }

    return NextResponse.json({
      chatId,
      chat: {
        origin: chat.origin,
        turn_taking: chat.turn_taking,
        status: chat.status
      },
      turnState: chat.turn_state,
      turnManager: {
        turnMode,
        participants,
        lastMessageSender,
        currentTurn
      },
      participantPermissions,
      sessionUserPermission,
      session: session ? {
        userId: session.user?.id,
        isGuest: session.user?.isGuest,
        chatId: session.user?.chatId
      } : null
    });
  } catch (error) {
    console.error('[Debug Turn] Error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 