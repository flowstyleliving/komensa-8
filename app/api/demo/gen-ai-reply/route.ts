import { NextRequest, NextResponse } from 'next/server';
import { generateDemoAIReply } from '@/features/ai/services/generateDemoAIReply';
import { setTypingIndicator } from '@/lib/redis';
import { pusherServer, getChatChannelName, PUSHER_EVENTS } from '@/lib/pusher';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { chatId, userId, userMessage } = body;

    if (!chatId || !userId || !userMessage) {
      return NextResponse.json({ error: 'Missing chatId, userId, or userMessage' }, { status: 400 });
    }

    console.log('[Demo AI Gen API] Received request:', { chatId, userId });
    const apiBaseUrl = req.nextUrl.origin;

    // Intentionally not awaiting this promise
    await generateDemoAIReply({ chatId, userId, userMessage, apiBaseUrl }).catch(async (err) => {
      const channelName = getChatChannelName(chatId);
      console.error('[Demo AI Gen API] Failed to generate demo reply:', err);
      if (err instanceof Error) {
        console.error('[Demo AI Gen API] Error message:', err.message);
        console.error('[Demo AI Gen API] Error stack:', err.stack);
        if (err.cause) console.error('[Demo AI Gen API] Error cause:', err.cause);
        for (const key in err) console.error(`[Demo AI Gen API] Error property ${key}:`, (err as any)[key]);
      } else {
        console.error('[Demo AI Gen API] Error (not an Error object):', err);
      }
      try {
        await setTypingIndicator(chatId, 'assistant', false);
        await pusherServer.trigger(channelName, PUSHER_EVENTS.ASSISTANT_TYPING, { isTyping: false });
        console.log('[Demo AI Gen API] Typing indicator reset after error');
      } catch (cleanupError) {
        console.error('[Demo AI Gen API] Failed to reset typing indicator:', cleanupError);
      }
    });
    console.log('[Demo AI Gen API] Demo AI reply generation process started in background');
    
    // Respond quickly to the client that initiated this background task
    return NextResponse.json({ message: 'Demo AI reply generation initiated' }, { status: 202 });

  } catch (error) {
    console.error('[Demo AI Gen API] Error in POST handler:', error);
    let errorMessage = 'Internal Server Error';
    if (error instanceof Error) {
        errorMessage = error.message;
    }
    return NextResponse.json({ error: 'Failed to initiate demo AI reply', details: errorMessage }, { status: 500 });
  }
} 