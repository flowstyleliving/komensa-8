import { NextRequest, NextResponse } from 'next/server';
import { TurnManager } from '@/features/chat/services/turnManager';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const chatId = req.nextUrl.searchParams.get('chatId');
    
    if (!chatId) {
      return NextResponse.json({ error: 'Missing chatId' }, { status: 400 });
    }

    const turnManager = new TurnManager(chatId);
    
    // Get current turn state
    const currentTurn = await turnManager.getCurrentTurn();
    
    // Get chat info
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      include: { participants: true }
    });
    
    // Get recent messages
    const recentMessages = await prisma.event.findMany({
      where: { 
        chat_id: chatId,
        type: 'message'
      },
      orderBy: { created_at: 'desc' },
      take: 5
    });

    return NextResponse.json({
      chatId,
      currentTurn,
      chat: {
        origin: chat?.origin,
        participantCount: chat?.participants.length,
        participants: chat?.participants.map(p => ({
          userId: p.user_id,
          role: p.role
        }))
      },
      recentMessages: recentMessages.reverse().map(msg => ({
        senderId: (msg.data as any).senderId,
        content: (msg.data as any).content,
        timestamp: msg.created_at
      }))
    });
  } catch (error) {
    console.error('Debug turn state error:', error);
    return NextResponse.json({ 
      error: 'Failed to get turn state',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 