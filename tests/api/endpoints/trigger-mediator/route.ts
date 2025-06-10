import { NextRequest, NextResponse } from 'next/server';
import { AIResponseService } from '@/features/ai/services/AIResponseService';

export async function POST(req: NextRequest) {
  try {
    const { chatId, userId, userMessage } = await req.json();
    
    if (!chatId || !userId || !userMessage) {
      return NextResponse.json({ 
        error: 'Missing required fields: chatId, userId, userMessage' 
      }, { status: 400 });
    }

    console.log('[Debug] Manually triggering mediator response...', { chatId, userId, userMessage });
    
    // Use new AIResponseService for testing
    const aiService = new AIResponseService({
      chatId,
      userId,
      userMessage
    });
    
    const result = await aiService.generateAndStore();

    return NextResponse.json({
      success: true,
      message: 'Mediator response triggered',
      result
    });
  } catch (error) {
    console.error('Debug trigger mediator error:', error);
    return NextResponse.json({ 
      error: 'Failed to trigger mediator',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 