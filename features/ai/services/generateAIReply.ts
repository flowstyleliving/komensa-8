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
  const replyId = `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  console.log(`[AI Reply] ${replyId} - Starting AI reply generation`);
  console.log(`[AI Reply] ${replyId} - Parameters: chatId=${chatId}, userId=${userId}, messageLength=${userMessage.length}`);
  
  // Mobile-aware processing
  const isMobile = userAgent ? /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent) : false;
  console.log(`[AI Reply] ${replyId} - Mobile detection: ${isMobile}, UserAgent: ${userAgent?.substring(0, 100)}`);
  
  // Simplified timeouts (demo pattern)
  const globalTimeout = 90000; // 90 seconds
  const runCreationTimeout = 30000; // 30 seconds
  const pollingInterval = 1000; // 1 second
  const maxWaitTime = 120000; // 2 minutes max
  
  // Log mobile-specific optimizations
  console.log(`[AI Reply] ${replyId} - Timeouts configured:`, {
    isMobile,
    globalTimeout,
    runCreationTimeout,
    pollingInterval,
    maxWaitTime
  });
  
  console.log(`[AI Reply] ${replyId} - Environment check:`, {
    OPENAI_ASSISTANT_ID: OPENAI_ASSISTANT_ID ? 'SET' : 'NOT SET',
    OPENAI_API_KEY: process.env.OPENAI_API_KEY ? 'SET' : 'NOT SET',
    NODE_ENV: process.env.NODE_ENV,
    VERCEL_ENV: process.env.VERCEL_ENV,
    IS_PRODUCTION: process.env.NODE_ENV === 'production'
  });
  
  // Check network connectivity for mobile prod issues
  console.log(`[AI Reply] ${replyId} - Network diagnostics:`, {
    timestamp: new Date().toISOString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
  });

  const channelName = getChatChannelName(chatId);
  // const turnManager = new TurnManager(chatId); // Not needed for generic reply

  // Add multiple layers of timeout protection
  let timeoutId: NodeJS.Timeout | undefined;
  let cleanupPerformed = false;
  
  const cleanup = async (source: string = 'timeout') => {
    if (cleanupPerformed) return;
    cleanupPerformed = true;
    
    console.log(`[AI Reply] ${replyId} - Cleanup initiated from: ${source}`);
    
    // Simplified cleanup (demo pattern)
    try {
      await pusherServer.trigger(channelName, PUSHER_EVENTS.ASSISTANT_TYPING, { 
        isTyping: false
      });
      console.log(`[AI Reply] ${replyId} - Pusher cleanup completed`);
    } catch (pusherError) {
      console.error(`[AI Reply] ${replyId} - Pusher cleanup failed:`, pusherError);
    }
    
    // Non-blocking Redis cleanup
    setTypingIndicator(chatId, 'assistant', false).catch(err => 
      console.warn(`[AI Reply] ${replyId} - Redis cleanup failed:`, err)
    );
  };

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(async () => {
      console.error(`[AI Reply] ${replyId} - GLOBAL TIMEOUT: AI reply generation timed out after ${globalTimeout}ms`);
      await cleanup('global_timeout');
      reject(new Error(`AI reply generation timed out after ${globalTimeout}ms`));
    }, globalTimeout); // Mobile-optimized timeout
  });

  const replyPromise = (async () => {
    try {
      console.log(`[AI Reply] ${replyId} - Starting main reply promise...`);
      // Set typing indicator with mobile-safe sequencing
      console.log(`[AI Reply] ${replyId} - Setting typing indicator...`);
      let typingSetSuccessfully = false;
      
      try {
        // Mobile-safe: Set Pusher first (immediate user feedback), then Redis
        await pusherServer.trigger(channelName, PUSHER_EVENTS.ASSISTANT_TYPING, { 
          isTyping: true,
          timestamp: Date.now(), // Add timestamp for mobile ordering
          source: 'ai_start',
          replyId
        });
        console.log(`[AI Reply] ${replyId} - Pusher typing indicator set`);
        
        // Set Redis with non-blocking approach (demo pattern)
        console.log(`[AI Reply] ${replyId} - About to set Redis typing indicator...`);
        setTypingIndicator(chatId, 'assistant', true).catch(err => 
          console.warn(`[AI Reply] ${replyId} - Redis failed, continuing:`, err)
        );
        console.log(`[AI Reply] ${replyId} - Redis typing indicator initiated`);
        typingSetSuccessfully = true;
      } catch (error) {
        console.error(`[AI Reply] ${replyId} - Failed to set typing indicators:`, error);
        // If we fail to set typing, still proceed but log the issue
        // The timeout mechanism will still clear any stuck state
      }
      
      console.log(`[AI Reply] ${replyId} - About to proceed to thread lookup...`);
    
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
      console.log(`[AI Reply] ${replyId} - Full prompt prepared using userMessage directly.`);

      // Get or create thread with timeout protection
      console.log(`[AI Reply] ${replyId} - Getting or creating thread...`);
      let threadId: string;
      let existingThread;
      
      try {
        console.log(`[AI Reply] ${replyId} - Querying existing thread from database...`);
        
        // Add database query timeout for mobile
        const dbTimeout = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Database query timeout')), 5000);
        });
        
        const dbQuery = prisma.chatTurnState.findUnique({
          where: { chat_id: chatId },
          select: { thread_id: true }
        });
        
        existingThread = await Promise.race([dbQuery, dbTimeout]) as any;
        console.log(`[AI Reply] ${replyId} - Database query successful, found thread: ${!!existingThread?.thread_id}`);
      } catch (dbError) {
        console.error(`[AI Reply] ${replyId} - DATABASE ERROR: Failed to query existing thread:`, dbError);
        
        // For mobile, skip thread lookup and create new one
        if (isMobile) {
          console.log(`[AI Reply] ${replyId} - Mobile: skipping thread lookup, will create new thread`);
          existingThread = null;
        } else {
          if (dbError instanceof Error) {
            console.error(`[AI Reply] ${replyId} - DB query error message:`, dbError.message);
            console.error(`[AI Reply] ${replyId} - DB query error stack:`, dbError.stack);
          }
          throw dbError;
        }
      }

      if (existingThread?.thread_id) {
        threadId = existingThread.thread_id;
        console.log(`[AI Reply] ${replyId} - Using existing thread: ${threadId}`);
      } else {
        console.log(`[AI Reply] ${replyId} - Creating new thread...`);
        try {
          const thread = await retryOpenAIOperation(
            () => openai.beta.threads.create(),
            'thread creation',
            isMobile
          );
          threadId = thread.id;
          console.log(`[AI Reply] ${replyId} - Created new thread: ${threadId}`);
        } catch (threadError) {
          console.error(`[AI Reply] ${replyId} - OPENAI ERROR: Thread creation failed:`, threadError);
          throw threadError;
        }
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
        await cleanup('ai_error');
        throw error;
      }

      // Stop typing indicator using unified cleanup
      await cleanup('ai_success');

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
      console.log(`[AI Reply] ${replyId} - Emitting new message event...`);
      try {
        const messagePayload = {
          id: newMessage.id,
          created_at: newMessage.created_at.toISOString(),
          data: { content: cleanedMessage, senderId: 'assistant' }
        };
        console.log(`[AI Reply] ${replyId} - Message payload:`, messagePayload);
        console.log(`[AI Reply] ${replyId} - Channel:`, channelName);
        console.log(`[AI Reply] ${replyId} - Event:`, PUSHER_EVENTS.NEW_MESSAGE);
        
        await pusherServer.trigger(channelName, PUSHER_EVENTS.NEW_MESSAGE, messagePayload);
        console.log(`[AI Reply] ${replyId} - New message event emitted successfully`);
      } catch (pusherError) {
        console.error(`[AI Reply] ${replyId} - ERROR: Failed to emit new message event via Pusher:`, pusherError);
        // Log additional details
        if (pusherError instanceof Error) {
          console.error(`[AI Reply] ${replyId} - Pusher error message:`, pusherError.message);
          console.error(`[AI Reply] ${replyId} - Pusher error stack:`, pusherError.stack);
        }
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
      await cleanup('ai_complete'); // Ensure cleanup happens
      return { content: cleanedMessage };
      
    } catch (mainError) {
      if (timeoutId) clearTimeout(timeoutId);
      await cleanup('ai_error'); // Ensure cleanup happens on error
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
    await cleanup('final_error'); // Final cleanup
    throw error;
  }
}