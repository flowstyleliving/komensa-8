// GPT CONTEXT:
// This file triggers an OpenAI Assistant response based on a user's message.
// It retrieves current state, formats the prompt, sends it to OpenAI, and stores the reply.
// Related: /lib/openai.ts, /features/ai/formatStateForPrompt.ts, /lib/prisma.ts

import { openai, runWithRetries } from '@/lib/openai';
import { pusherServer, getChatChannelName, PUSHER_EVENTS } from '@/lib/pusher';
import { prisma } from '@/lib/prisma';
import { setTypingIndicator } from '@/lib/redis';
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
  userMessage
}: {
  chatId: string;
  userId: string;
  userMessage: string;
}) {
  console.log('[AI Reply] Starting AI reply generation...', { chatId, userId, userMessage });
  console.log('[AI Reply] Environment check:', {
    OPENAI_ASSISTANT_ID: OPENAI_ASSISTANT_ID ? 'SET' : 'NOT SET',
    OPENAI_API_KEY: process.env.OPENAI_API_KEY ? 'SET' : 'NOT SET'
  });

  const channelName = getChatChannelName(chatId);
  // const turnManager = new TurnManager(chatId); // Not needed for generic reply

  // Add overall timeout to prevent hanging
  let timeoutId: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      console.error('[AI Reply] TIMEOUT: AI reply generation timed out after 90 seconds (internal)');
      reject(new Error('AI reply generation timed out after 90 seconds'));
    }, 90000); // 90 second timeout
  });

  const replyPromise = (async () => {
    try {
      // Set typing indicator in Redis first
      console.log('[AI Reply] Setting typing indicator in Redis...');
      try {
        // await setTypingIndicator(chatId, 'assistant', true); // BYPASSED
        console.log('[AI Reply] Redis typing indicator set successfully (BYPASSED)');
      } catch (redisError) {
        console.error('[AI Reply] REDIS ERROR: Failed to set typing indicator in Redis:', redisError);
        console.error('[AI Reply] Redis error details:', JSON.stringify(redisError, Object.getOwnPropertyNames(redisError)));
        if (redisError instanceof Error) {
          console.error('[AI Reply] Redis error message:', redisError.message);
          console.error('[AI Reply] Redis error stack:', redisError.stack);
          if (redisError.cause) {
            console.error('[AI Reply] Redis error cause:', redisError.cause);
          }
        }
        console.log('[AI Reply] Continuing without Redis typing indicator...');
      }
      
      console.log('[AI Reply] Attempting to emit typing indicator (Pusher trigger)...');
      try {
        await pusherServer.trigger(channelName, PUSHER_EVENTS.ASSISTANT_TYPING, { isTyping: true });
        console.log('[AI Reply] SUCCESSFULLY emitted typing indicator via Pusher.');
      } catch (pusherTriggerError) {
        console.error('[AI Reply] ERROR: Failed to emit typing indicator via Pusher:', pusherTriggerError);
        if (pusherTriggerError instanceof Error) {
          console.error('[AI Reply] Pusher error message:', pusherTriggerError.message);
          console.error('[AI Reply] Pusher error stack:', pusherTriggerError.stack);
          if ((pusherTriggerError as any).code) console.error('[AI Reply] Pusher error code:', (pusherTriggerError as any).code);
          if ((pusherTriggerError as any).statusCode) console.error('[AI Reply] Pusher error statusCode:', (pusherTriggerError as any).statusCode);
          if ((pusherTriggerError as any).response) console.error('[AI Reply] Pusher error response:', (pusherTriggerError as any).response);
          if ((pusherTriggerError as any).body) console.error('[AI Reply] Pusher error body:', (pusherTriggerError as any).body);
          if (pusherTriggerError.cause) console.error('[AI Reply] Pusher error cause:', pusherTriggerError.cause);
          console.error('[AI Reply] Pusher error all properties:', JSON.stringify(pusherTriggerError, Object.getOwnPropertyNames(pusherTriggerError)));
        } else {
          console.error('[AI Reply] Pusher error (not an Error object):', String(pusherTriggerError));
        }
        console.log('[AI Reply] Continuing despite Pusher typing indicator failure...');
      }
      console.log('[AI Reply] Proceeding after Pusher typing indicator attempt.');
    
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
      const thread = await runWithRetries(() => 
        openai.beta.threads.create()
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
      await runWithRetries(() =>
        openai.beta.threads.messages.create(threadId, {
          role: 'user',
          content: fullPrompt
        })
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
        const runCreationPromise = runWithRetries(() =>
          openai.beta.threads.runs.create(threadId, {
            assistant_id: OPENAI_ASSISTANT_ID
          })
        ) as Promise<Run>;
        
        const runCreationTimeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            console.error('[AI Reply] TIMEOUT: OpenAI run creation timed out after 30 seconds');
            reject(new Error('OpenAI run creation timed out after 30 seconds'));
          }, 30000);
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
      
      let completedRun = await runWithRetries(() =>
        openai.beta.threads.runs.retrieve(threadId, run.id)
      );
      console.log('[AI Reply] Initial run status:', completedRun.status);
      
      const maxWaitTime = 120000;
      const startTime = Date.now();
      
      while (completedRun.status === 'in_progress' || completedRun.status === 'queued') {
        if (Date.now() - startTime > maxWaitTime) {
          console.error('[AI Reply] Run timed out after 2 minutes');
          throw new Error('AI run timed out after 2 minutes');
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
        try {
          completedRun = await runWithRetries(() =>
            openai.beta.threads.runs.retrieve(threadId, run.id)
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
      
      const messages = await runWithRetries(() =>
        openai.beta.threads.messages.list(threadId)
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
      // await setTypingIndicator(chatId, 'assistant', false); // BYPASSED Ensure typing indicator is off
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
      // await setTypingIndicator(chatId, 'assistant', false); // BYPASSED
      console.log('[AI Reply] Typing indicator stopped in Redis (BYPASSED)');
    } catch (redisError) {
       console.error('[AI Reply] REDIS ERROR: Failed to stop typing indicator in Redis:', redisError);
    }
    try {
      await pusherServer.trigger(channelName, PUSHER_EVENTS.ASSISTANT_TYPING, { isTyping: false });
      console.log('[AI Reply] Typing indicator stopped via Pusher');
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

    // THIS IS THE NON-DEMO (LEGACY) TURN MANAGEMENT LOGIC
    // It was previously in an ELSE block, now it's the main path.
    console.log('[AI Reply] Non-demo chat, using legacy turn management...');
    try {
      await prisma.chatTurnState.update({
        where: { chat_id: chatId },
        data: { next_user_id: userId } // AI has responded, next turn is the user who messaged.
      });
      console.log('[AI Reply] Chat turn state updated in DB.');
    } catch (dbError) {
      console.error('[AI Reply] DATABASE ERROR: Failed to update legacy turn state:', dbError);
      if (dbError instanceof Error) {
        console.error('[AI Reply] DB update (legacy turn) error message:', dbError.message);
        console.error('[AI Reply] DB update (legacy turn) error stack:', dbError.stack);
      }
      throw dbError; // Critical for turn management
    }
    
    try {
      await pusherServer.trigger(channelName, PUSHER_EVENTS.TURN_UPDATE, { next_user_id: userId });
      console.log('[AI Reply] Pusher turn update event emitted.');
    } catch (pusherError) {
      console.error('[AI Reply] PUSHER ERROR: Failed to emit legacy turn update:', pusherError);
      // Log details, but don't re-throw as the main operation (DB update) succeeded.
    }
    // END OF NON-DEMO TURN MANAGEMENT

    console.log('[AI Reply] Generation complete');
    if (timeoutId) clearTimeout(timeoutId);
    return { content: cleanedMessage };
    
    } catch (mainError) {
      if (timeoutId) clearTimeout(timeoutId);
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
      
      try {
        // await setTypingIndicator(chatId, 'assistant', false); // BYPASSED
        await pusherServer.trigger(channelName, PUSHER_EVENTS.ASSISTANT_TYPING, { isTyping: false });
      } catch (cleanupError) {
        console.error('[AI Reply] Failed to stop typing indicator on cleanup:', cleanupError);
      }
      throw mainError;
    }
  })();

  return Promise.race([replyPromise, timeoutPromise]);
}