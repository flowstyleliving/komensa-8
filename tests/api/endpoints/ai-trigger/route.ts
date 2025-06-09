import { NextRequest, NextResponse } from 'next/server';
import { TurnManager } from '@/features/chat/services/turnManager';

export async function GET(req: NextRequest) {
  try {
    const chatId = req.nextUrl.searchParams.get('chatId');
    if (!chatId) {
      return NextResponse.json({ error: 'Missing chatId' }, { status: 400 });
    }

    console.log(`[Test AI Trigger] Checking if AI should respond for chat: ${chatId}`);
    
    const turnManager = new TurnManager(chatId);
    
    // Get all the relevant info
    const [mode, participants, lastSender, shouldRespond] = await Promise.all([
      turnManager.getTurnMode(),
      turnManager.getParticipants(),
      turnManager.getLastMessageSender(),
      turnManager.shouldTriggerAIResponse()
    ]);

    const debugInfo = {
      chatId,
      mode,
      participants,
      lastSender,
      shouldRespond,
      participantCount: participants.length,
      lastSenderIndex: lastSender ? participants.indexOf(lastSender) : -1
    };

    console.log(`[Test AI Trigger] Debug info:`, debugInfo);

    return NextResponse.json(debugInfo);
  } catch (error) {
    console.error('[Test AI Trigger] Error:', error);
    return NextResponse.json({ 
      error: 'Failed to check AI trigger',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 