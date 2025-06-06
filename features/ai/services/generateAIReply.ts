// GPT CONTEXT:
// This file triggers an OpenAI Assistant response based on a user's message.
// It retrieves current state, formats the prompt, sends it to OpenAI, and stores the reply.
// Related: /lib/openai.ts, /features/ai/formatStateForPrompt.ts, /lib/prisma.ts

import { openai, runWithRetries } from '@/lib/openai';
import { pusherServer, getChatChannelName, PUSHER_EVENTS } from '@/lib/pusher';
import { prisma } from '@/lib/prisma';
import { setTypingIndicator } from '@/lib/redis';
import { retryOpenAIOperation, checkNetworkQuality } from '../utils/retries';
// import { formatStateForPrompt } from './formatStateForPrompt'; // THIS LINE TO BE DELETED
// import { generateJordanReply } from './generateJordanReply'; // No longer needed here
// import { TurnManager, DEMO_ROLES } from '@/features/chat/services/turnManager'; // No longer needed here
import type { Run } from 'openai/resources/beta/threads/runs/runs';

// Validate critical environment variables
const OPENAI_ASSISTANT_ID = process.env.OPENAI_ASSISTANT_ID;
if (!OPENAI_ASSISTANT_ID) {
  throw new Error('OPENAI_ASSISTANT_ID environment variable is not set');
}

// Type guard to ensure assistant_id is a string
function assertAssistantId(id: string | undefined): asserts id is string {
  if (!id) {
    throw new Error('OPENAI_ASSISTANT_ID environment variable is not set');
  }
}

export async function generateAIReply({
  chatId,
  userId,
  userMessage,
  userAgent
}: {
  chatId: string;
  userId: string;
  userMessage: string;
  userAgent?: string;
}) {
  // Mobile-aware processing
  const isMobile = userAgent ? /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent) : false;
  console.log(`[AI Reply] Processing request - Mobile: ${isMobile}, UserAgent: ${userAgent?.substring(0, 100)}`);
  
  // Mobile-optimized timeouts
  const globalTimeout = isMobile ? 45000 : 60000; // 45s for mobile vs 60s desktop
  const runCreationTimeout = isMobile ? 20000 : 30000; // 20s vs 30s
  const pollingInterval = isMobile ? 2000 : 1000; // 2s vs 1s polling
  const maxWaitTime = isMobile ? 90000 : 120000; // 1.5min vs 2min
  
  // Log mobile-specific optimizations
  if (isMobile) {
    console.log(`[AI Reply] Mobile optimizations active:`, {
      globalTimeout,
      runCreationTimeout,
      pollingInterval,
      maxWaitTime
    });
  }
  console.log('[AI Reply] Starting AI reply generation...', { chatId, userId, userMessage });
  console.log('[AI Reply] Environment check:', {
    OPENAI_ASSISTANT_ID: OPENAI_ASSISTANT_ID ? 'SET' : 'NOT SET',
    OPENAI_API_KEY: process.env.OPENAI_API_KEY ? 'SET' : 'NOT SET'
  });

  const channelName = getChatChannelName(chatId);
  // const turnManager = new TurnManager(chatId); // Not needed for generic reply

  // Add multiple layers of timeout protection
  let timeoutId: NodeJS.Timeout | undefined;
  let cleanupPerformed = false;
  
  const cleanup = async () => {
    if (cleanupPerformed) return;
    cleanupPerformed = true;
    
    try {
      await pusherServer.trigger(channelName, PUSHER_EVENTS.ASSISTANT_TYPING, { isTyping: false });
      console.log('[AI Reply] Cleanup: Typing indicator reset');
    } catch (error) {
      console.error('[AI Reply] Cleanup: Failed to reset typing indicator:', error);
    }
  };

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(async () => {
      console.error('[AI Reply] GLOBAL TIMEOUT: AI reply generation timed out after 60 seconds');
      await cleanup();
      reject(new Error('AI reply generation timed out after 60 seconds'));
    }, globalTimeout); // Mobile-optimized timeout
  });

  const replyPromise = (async () => {
    try {
      // Set typing indicator immediately with parallel Redis + Pusher
      console.log('[AI Reply] Setting typing indicator...');
      await Promise.all([
        // Redis typing indicator (non-blocking if fails)
        setTypingIndicator(chatId, 'assistant', true).catch(redisError => {
          console.error('[AI Reply] Redis typing indicator failed:', redisError);
        }),
        // Pusher typing indicator (immediate user feedback)
        pusherServer.trigger(channelName, PUSHER_EVENTS.ASSISTANT_TYPING, { isTyping: true }).catch(pusherError => {
          console.error('[AI Reply] Pusher typing indicator failed:', pusherError);
        })
      ]);
      console.log('[AI Reply] Typing indicators set');
    
    // Get current state -- THIS BLOCK WILL BE REMOVED
    // console.log('[AI Reply] Formatting state for prompt...');
    // let state;
    // try {
    //   state = await formatStateForPrompt({ chatId, userId, userMessage });
    //   console.log('[AI Reply] State formatted successfully');
    // } catch (formatStateError) {
    //   console.error('[AI Reply] ERROR: Failed to format state for prompt:', formatStateError);
    //   if (formatStateError instanceof Error) {
    //     console.error('[AI Reply] Format state error message:', formatStateError.message);
    //     console.error('[AI Reply] Format state error stack:', formatStateError.stack);
    //     if (formatStateError.cause) console.error('[AI Reply] Format state error cause:', formatStateError.cause);
    //   }
    //   throw formatStateError;
    // }

    // Construct the prompt using userMessage and the static instruction
    const fullPrompt = `${userMessage}

Respond thoughtfully as a mediator, drawing from the current emotional and conversational state.`;
    console.log('[AI Reply] Full prompt prepared using userMessage directly.');

    // Get or create thread
    console.log('[AI Reply] Getting or creating thread...');
    let threadId: string;
    let existingThread;
    try {
      existingThread = await prisma.chatTurnState.findUnique({
        where: { chat_id: chatId },
        select: { thread_id: true }
      });
    } catch (dbError) {
      console.error('[AI Reply] DATABASE ERROR: Failed to query existing thread:', dbError);
      if (dbError instanceof Error) {
        console.error('[AI Reply] DB query error message:', dbError.message);
        console.error('[AI Reply] DB query error stack:', dbError.stack);
      }
      throw dbError;
    }

    if (existingThread?.thread_id) {
      threadId = existingThread.thread_id;
      console.log('[AI Reply] Using existing thread:', threadId);
    } else {
      console.log('[AI Reply] Creating new thread...');
      const thread = await retryOpenAIOperation(
        () => openai.beta.threads.create(),
        'thread creation',
        isMobile
      );
      threadId = thread.id;
      console.log('[AI Reply] Created new thread:', threadId);
      try {
        await prisma.chatTurnState.upsert({
          where: { chat_id: chatId },
          update: { thread_id: threadId },
          create: { 
            chat_id: chatId,
            thread_id: threadId,
            next_user_id: 'assistant' 
          }
        });
        console.log('[AI Reply] Thread ID stored in database');
      } catch (dbError) {
        console.error('[AI Reply] DATABASE ERROR: Failed to upsert thread ID:', dbError);
        if (dbError instanceof Error) {
          console.error('[AI Reply] DB upsert error message:', dbError.message);
          console.error('[AI Reply] DB upsert error stack:', dbError.stack);
        }
        throw dbError;
      }
    }

    // Add message to thread
    console.log('[AI Reply] Adding message to thread...');
    try {
      await retryOpenAIOperation(
        () => openai.beta.threads.messages.create(threadId, {
          role: 'user',
          content: fullPrompt
        }),
        'message creation',
        isMobile
      );
      console.log('[AI Reply] SUCCESSFULLY added message to thread.');
    } catch (openaiMessageError) {
      console.error('[AI Reply] ERROR: Failed to add message to thread:', openaiMessageError);
      if (openaiMessageError instanceof Error) {
          console.error('[AI Reply] OpenAI message error message:', openaiMessageError.message);
          console.error('[AI Reply] OpenAI message error stack:', openaiMessageError.stack);
          if ((openaiMessageError as any).code) console.error('[AI Reply] OpenAI message error code:', (openaiMessageError as any).code);
          if ((openaiMessageError as any).statusCode) console.error('[AI Reply] OpenAI message error statusCode:', (openaiMessageError as any).statusCode);
          if ((openaiMessageError as any).response) console.error('[AI Reply] OpenAI message error response:', (openaiMessageError as any).response.data || (openaiMessageError as any).response);
          if ((openaiMessageError as any).body) console.error('[AI Reply] OpenAI message error body:', (openaiMessageError as any).body);
          if (openaiMessageError.cause) console.error('[AI Reply] OpenAI message error cause:', openaiMessageError.cause);
          console.error('[AI Reply] OpenAI message error all properties:', JSON.stringify(openaiMessageError, Object.getOwnPropertyNames(openaiMessageError)));
      } else {
          console.error('[AI Reply] OpenAI message error (not an Error object):', String(openaiMessageError));
      }
      throw openaiMessageError;
    }
    console.log('[AI Reply] Proceeding after adding message to thread.');

    // Start run
    let fullMessage = '';
    try {
      console.log('[AI Reply] Starting AI run...');
      assertAssistantId(OPENAI_ASSISTANT_ID);
      console.log('[AI Reply] Attempting to create run with assistant ID:', OPENAI_ASSISTANT_ID);
      let run: Run;
      try {
        const runCreationPromise = retryOpenAIOperation(
          () => openai.beta.threads.runs.create(threadId, {
            assistant_id: OPENAI_ASSISTANT_ID
          }),
          'run creation',
          isMobile
        ) as Promise<Run>;
        
        const runCreationTimeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            console.error(`[AI Reply] TIMEOUT: OpenAI run creation timed out after ${runCreationTimeout}ms (mobile: ${isMobile})`);
            reject(new Error(`OpenAI run creation timed out after ${runCreationTimeout}ms`));
          }, runCreationTimeout);
        });
        
        run = await Promise.race([runCreationPromise, runCreationTimeoutPromise]);
        console.log('[AI Reply] SUCCESSFULLY created run:', run.id);
      } catch (runCreateError) {
        console.error('[AI Reply] ERROR: Failed to create run:', runCreateError);
        if (runCreateError instanceof Error) {
          console.error('[AI Reply] Run create error message:', runCreateError.message);
          console.error('[AI Reply] Run create error stack:', runCreateError.stack);
          if ((runCreateError as any).code) console.error('[AI Reply] Run create error code:', (runCreateError as any).code);
          if ((runCreateError as any).statusCode) console.error('[AI Reply] Run create error statusCode:', (runCreateError as any).statusCode);
          if ((runCreateError as any).status) console.error('[AI Reply] Run create error status:', (runCreateError as any).status);
          if ((runCreateError as any).response) {
            console.error('[AI Reply] Run create error response:', (runCreateError as any).response);
            if ((runCreateError as any).response?.data) {
              console.error('[AI Reply] Run create error response data:', (runCreateError as any).response.data);
            }
          }
          if ((runCreateError as any).body) console.error('[AI Reply] Run create error body:', (runCreateError as any).body);
          if (runCreateError.cause) console.error('[AI Reply] Run create error cause:', runCreateError.cause);
          console.error('[AI Reply] Run create error all properties:', JSON.stringify(runCreateError, Object.getOwnPropertyNames(runCreateError)));
        } else {
          console.error('[AI Reply] Run create error (not an Error object):', String(runCreateError));
        }
        throw runCreateError;
      }
      
      let completedRun = await retryOpenAIOperation(
        () => openai.beta.threads.runs.retrieve(threadId, run.id),
        'run retrieval',
        isMobile
      );
      console.log('[AI Reply] Initial run status:', completedRun.status);
      
      const startTime = Date.now();
      
      while (completedRun.status === 'in_progress' || completedRun.status === 'queued') {
        if (Date.now() - startTime > maxWaitTime) {
          console.error(`[AI Reply] Run timed out after ${maxWaitTime}ms (mobile: ${isMobile})`);
          throw new Error(`AI run timed out after ${maxWaitTime}ms`);
        }
        await new Promise(resolve => setTimeout(resolve, pollingInterval));
        try {
          completedRun = await retryOpenAIOperation(
            () => openai.beta.threads.runs.retrieve(threadId, run.id),
            'run polling',
            isMobile
          );
          console.log('[AI Reply] Run status:', completedRun.status);
        } catch (error) {
          console.error('[AI Reply] Run retrieval failed:', error);
          throw new Error('Failed to get AI response during polling', { cause: error });
        }
      }
      
      if (completedRun.status === 'failed') {
        console.error('[AI Reply] Run failed:', completedRun.last_error);
        throw new Error(`AI run failed: ${completedRun.last_error?.message}`);
      }
      
      const messages = await retryOpenAIOperation(
        () => openai.beta.threads.messages.list(threadId),
        'message retrieval',
        isMobile
      );
      const assistantMessage = messages.data[0];
      if (!assistantMessage || !assistantMessage.content) {
        console.error('[AI Reply] No assistant message found');
        throw new Error('No assistant message returned');
      }
      
      fullMessage = assistantMessage.content
        .filter((c: any): c is { type: 'text'; text: { value: string; annotations: any[] } } => c.type === 'text')
        .map((c: any) => c.text.value)
        .join('');
      console.log('[AI Reply] Message retrieved:', fullMessage);
    } catch (error) {
      console.error('[AI Reply] Failed to generate AI response:', error);
      await setTypingIndicator(chatId, 'assistant', false); // Ensure typing indicator is off
      try {
        await pusherServer.trigger(channelName, PUSHER_EVENTS.ASSISTANT_TYPING, { isTyping: false });
      } catch (pusherError) {
        console.error('[AI Reply] ERROR: Failed to reset typing indicator via Pusher on error:', pusherError);
      }
      throw error;
    }

    // Stop typing indicator
    console.log('[AI Reply] Stopping typing indicator...');
    try {
      await setTypingIndicator(chatId, 'assistant', false);
      console.log('[AI Reply] Typing indicator stopped in Redis');
    } catch (redisError) {
       console.error('[AI Reply] REDIS ERROR: Failed to stop typing indicator in Redis:', redisError);
    }
    try {
      await pusherServer.trigger(channelName, PUSHER_EVENTS.ASSISTANT_TYPING, { isTyping: false });
      console.log('[AI Reply] Typing indicator stopped via Pusher');
      console.log('[AI Reply] Stop typing - Channel name:', channelName);
      console.log('[AI Reply] Stop typing - Event:', PUSHER_EVENTS.ASSISTANT_TYPING);
      console.log('[AI Reply] Stop typing - Data:', { isTyping: false });
    } catch (pusherError) {
      console.error('[AI Reply] ERROR: Failed to stop typing indicator via Pusher:', pusherError);
    }

    const cleanedMessage = fullMessage.trim();

    // Store message in database
    console.log('[AI Reply] Storing message in database...');
    let newMessage;
    try {
      newMessage = await prisma.event.create({
        data: {
          chat_id: chatId,
          type: 'message',
          data: { content: cleanedMessage, senderId: 'assistant' }
        }
      });
      console.log('[AI Reply] Message stored in database');
    } catch (dbError) {
      console.error('[AI Reply] DATABASE ERROR: Failed to store new message:', dbError);
      if (dbError instanceof Error) {
        console.error('[AI Reply] DB create error message:', dbError.message);
        console.error('[AI Reply] DB create error stack:', dbError.stack);
      }
      throw dbError;
    }

    // Emit new message event
    console.log('[AI Reply] Emitting new message event...');
    try {
      await pusherServer.trigger(channelName, PUSHER_EVENTS.NEW_MESSAGE, {
        id: newMessage.id,
        created_at: newMessage.created_at.toISOString(),
        data: { content: cleanedMessage, senderId: 'assistant' }
      });
      console.log('[AI Reply] New message event emitted successfully');
    } catch (pusherError) {
      console.error('[AI Reply] ERROR: Failed to emit new message event via Pusher:', pusherError);
    }

    // Determine turn management approach based on chat type
    console.log('[AI Reply] Determining turn management approach...');
    
    // Sync ChatTurnState with EventDrivenTurnManager calculation
    try {
      const { TurnManager } = await import('@/features/chat/services/turnManager');
      const turnManager = new TurnManager(chatId);
      
      // Get the calculated next turn from EventDrivenTurnManager
      const calculatedTurn = await turnManager.getCurrentTurn();
      
      if (calculatedTurn && calculatedTurn.next_user_id) {
        // Update the ChatTurnState table to match the calculated turn
        await prisma.chatTurnState.upsert({
          where: { chat_id: chatId },
          update: { 
            next_user_id: calculatedTurn.next_user_id,
            updated_at: new Date()
          },
          create: {
            chat_id: chatId,
            next_user_id: calculatedTurn.next_user_id
          }
        });
        
        // Emit specific turn update with the calculated next user
        await pusherServer.trigger(channelName, PUSHER_EVENTS.TURN_UPDATE, { 
          next_user_id: calculatedTurn.next_user_id,
          next_role: calculatedTurn.next_role
        });
      } else {
        // Fallback: Emit a generic turn update event to refresh the frontend
        await pusherServer.trigger(channelName, PUSHER_EVENTS.TURN_UPDATE, { 
          timestamp: new Date().toISOString()
        });
      }
    } catch (turnError) {
      console.error('[AI Reply] Failed to sync turn state:', turnError);
      // Fallback: Emit a generic turn update event to refresh the frontend
      await pusherServer.trigger(channelName, PUSHER_EVENTS.TURN_UPDATE, { 
        timestamp: new Date().toISOString()
      });
    }

    console.log('[AI Reply] Generation complete');
    if (timeoutId) clearTimeout(timeoutId);
    await cleanup(); // Ensure cleanup happens
    return { content: cleanedMessage };
    
    } catch (mainError) {
      if (timeoutId) clearTimeout(timeoutId);
      await cleanup(); // Ensure cleanup happens on error
      console.error('[AI Reply] Main AI reply generation failed:', mainError);
      if (mainError instanceof Error) {
        console.error('[AI Reply] Main error message:', mainError.message);
        console.error('[AI Reply] Main error stack:', mainError.stack);
        if (mainError.cause) {
          console.error('[AI Reply] Main error cause:', mainError.cause);
        }
        for (const key in mainError) {
          console.error(`[AI Reply] Main error property ${key}:`, (mainError as any)[key]);
        }
      } else {
        console.error('[AI Reply] Main error (not an Error object):', mainError);
      }
      throw mainError;
    }
  })();

  try {
    const result = await Promise.race([replyPromise, timeoutPromise]);
    if (timeoutId) clearTimeout(timeoutId);
    return result;
  } catch (error) {
    if (timeoutId) clearTimeout(timeoutId);
    await cleanup(); // Final cleanup
    throw error;
  }
}