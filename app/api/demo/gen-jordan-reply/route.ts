import { NextRequest, NextResponse } from 'next/server';
import { generateJordanReply } from '@/features/ai/services/generateJordanReply';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { chatId, jordanUserId, conversationContext, apiBaseUrl } = body;

    if (!chatId || !jordanUserId || !conversationContext || !apiBaseUrl) {
      return NextResponse.json(
        { error: 'Missing chatId, jordanUserId, conversationContext, or apiBaseUrl' },
        { status: 400 }
      );
    }

    console.log('[Jordan Gen API] Received request:', { chatId, jordanUserId, apiBaseUrl });

    // Intentionally not awaiting this promise
    await generateJordanReply({ chatId, jordanUserId, conversationContext, apiBaseUrl }).catch(async (err) => {
      console.error('[Jordan Gen API] Failed to generate Jordan reply:', err);
      if (err instanceof Error) {
        console.error('[Jordan Gen API] Error message:', err.message);
        console.error('[Jordan Gen API] Error stack:', err.stack);
        if (err.cause) console.error('[Jordan Gen API] Error cause:', err.cause);
        for (const key in err) console.error(`[Jordan Gen API] Error property ${key}:`, (err as any)[key]);
      } else {
        console.error('[Jordan Gen API] Error (not an Error object):', err);
      }
      // Note: generateJordanReply itself handles typing indicators for the subsequent mediator reply if it triggers one.
      // No direct typing indicator cleanup here unless Jordan's *own* reply generation fails catastrophically before that.
    });
    console.log('[Jordan Gen API] Jordan reply generation process started in background');
    
    return NextResponse.json({ message: 'Jordan reply generation initiated' }, { status: 202 });

  } catch (error) {
    console.error('[Jordan Gen API] Error in POST handler:', error);
    let errorMessage = 'Internal Server Error';
    if (error instanceof Error) {
        errorMessage = error.message;
    }
    return NextResponse.json({ error: 'Failed to initiate Jordan reply', details: errorMessage }, { status: 500 });
  }
} 