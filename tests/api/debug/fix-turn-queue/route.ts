import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const { chatId } = await req.json();
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get all participants
    const participants = await prisma.chatParticipant.findMany({
      where: { chat_id: chatId },
      include: { user: true },
      orderBy: { user_id: 'asc' }
    });

    const participantIds = participants.map(p => p.user_id);
    
    console.log(`[Fix Turn Queue] Found participants for chat ${chatId}:`, participantIds);

    // Update the turn state to include all participants
    await prisma.chatTurnState.upsert({
      where: { chat_id: chatId },
      update: {
        turn_queue: participantIds,
        next_user_id: participantIds[0], // Start with first participant
        current_turn_index: 0
      },
      create: {
        chat_id: chatId,
        next_user_id: participantIds[0],
        next_role: 'user',
        turn_queue: participantIds,
        current_turn_index: 0
      }
    });

    console.log(`[Fix Turn Queue] Updated turn queue for chat ${chatId} with all participants`);
    
    return NextResponse.json({ 
      success: true, 
      message: `Turn queue updated with ${participantIds.length} participants`,
      participants: participantIds
    });
  } catch (error) {
    console.error('[Fix Turn Queue] Error:', error);
    return NextResponse.json({ error: 'Failed to fix turn queue' }, { status: 500 });
  }
} 