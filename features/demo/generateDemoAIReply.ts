// GPT CONTEXT:
// This file triggers an OpenAI Assistant response based on a user's message for DEMO CHATS.
// It retrieves current state, formats the prompt, sends it to OpenAI, and stores the reply.
// It also handles demo-specific turn management, including triggering Jordan's replies.
// Related: /lib/openai.ts, /features/ai/formatStateForPrompt.ts, /lib/prisma.ts, generateAIReply.ts

import { openai, runWithRetries } from '@/lib/openai';
import { pusherServer, getChatChannelName, PUSHER_EVENTS } from '@/lib/pusher';
import { prisma } from '@/lib/prisma';
import { setTypingIndicator } from '@/lib/redis';
import { generateJordanReply } from '@/features/demo/generateJordanReply';
import { DemoTurnManager, DEMO_ROLES } from '@/features/demo/demoTurnManager';
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

export async function generateDemoAIReply({ // Renamed function
  chatId,
  userId,
  userMessage,
  apiBaseUrl
}: {
  chatId: string;
  userId: string;
  userMessage: string;
  apiBaseUrl: string;
}) {
  console.log('[Demo AI Reply] Starting AI reply generation...', { chatId, userId, userMessage, apiBaseUrl });

  const channelName = getChatChannelName(chatId);
  const turnManager = new DemoTurnManager(chatId);

  // Add overall timeout to prevent hanging
  let timeoutId: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      console.error('[Demo AI Reply] TIMEOUT: AI reply generation timed out after 90 seconds (internal)');
      reject(new Error('AI reply generation timed out after 90 seconds'));
    }, 90000); // 90 second timeout
  });

  const replyPromise = (async () => {
    try {
      // Set typing indicator in Redis first
      console.log('[Demo AI Reply] Setting typing indicator in Redis...');
      try {
        // await setTypingIndicator(chatId, 'assistant', true); // BYPASSED
        console.log('[Demo AI Reply] Redis typing indicator set successfully (BYPASSED)');
      } catch (redisError) {
        console.error('[Demo AI Reply] REDIS ERROR: Failed to set typing indicator in Redis:', redisError);
        console.error('[Demo AI Reply] Redis error details:', JSON.stringify(redisError, Object.getOwnPropertyNames(redisError)));
        if (redisError instanceof Error) {
          console.error('[Demo AI Reply] Redis error message:', redisError.message);
          console.error('[Demo AI Reply] Redis error stack:', redisError.stack);
          if (redisError.cause) {
            console.error('[Demo AI Reply] Redis error cause:', redisError.cause);
          }
        }
        // Continue without Redis typing indicator
        console.log('[Demo AI Reply] Continuing without Redis typing indicator...');
      }
      
            // START: ROBUST PUSHER DEBUGGING WITH FULL ERROR LOGGING
      console.log('[Demo AI Reply] Attempting to emit typing indicator (Pusher trigger)...');
      try {
        await pusherServer.trigger(channelName, PUSHER_EVENTS.ASSISTANT_TYPING, { isTyping: true });
        console.log('[Demo AI Reply] SUCCESSFULLY emitted typing indicator via Pusher.');
      } catch (pusherTriggerError) {
        console.error('[Demo AI Reply] ERROR: Failed to emit typing indicator via Pusher:', pusherTriggerError);
        // Log all properties of the error object
        if (pusherTriggerError instanceof Error) {
          console.error('[Demo AI Reply] Pusher error message:', pusherTriggerError.message);
          console.error('[Demo AI Reply] Pusher error stack:', pusherTriggerError.stack);
          if ((pusherTriggerError as any).code) console.error('[Demo AI Reply] Pusher error code:', (pusherTriggerError as any).code);
          if ((pusherTriggerError as any).statusCode) console.error('[Demo AI Reply] Pusher error statusCode:', (pusherTriggerError as any).statusCode);
          if ((pusherTriggerError as any).response) console.error('[Demo AI Reply] Pusher error response:', (pusherTriggerError as any).response);
          if ((pusherTriggerError as any).body) console.error('[Demo AI Reply] Pusher error body:', (pusherTriggerError as any).body);
          if (pusherTriggerError.cause) console.error('[Demo AI Reply] Pusher error cause:', pusherTriggerError.cause);
          // Log all enumerable properties
          console.error('[Demo AI Reply] Pusher error all properties:', JSON.stringify(pusherTriggerError, Object.getOwnPropertyNames(pusherTriggerError)));
        } else {
          console.error('[Demo AI Reply] Pusher error (not an Error object):', String(pusherTriggerError));
        }
        // Continue execution instead of throwing - typing indicator failure shouldn't break AI response
        console.log('[Demo AI Reply] Continuing despite Pusher typing indicator failure...');
      }
      console.log('[Demo AI Reply] Proceeding after Pusher typing indicator attempt.');
      // END: ROBUST PUSHER DEBUGGING
    
    // Construct the prompt using userMessage and the static instruction
    const fullPrompt = `${userMessage}

Respond thoughtfully as a mediator, drawing from the current emotional and conversational state.`;
    console.log('[Demo AI Reply] Full prompt prepared using userMessage directly.');

    // Get or create thread
    console.log('[Demo AI Reply] Getting or creating thread...');
    let threadId: string;
    let existingThread;
    try {
      existingThread = await prisma.chatTurnState.findUnique({
        where: { chat_id: chatId },
        select: { thread_id: true }
      });
    } catch (dbError) {
      console.error('[Demo AI Reply] DATABASE ERROR: Failed to query existing thread:', dbError);
      if (dbError instanceof Error) {
        console.error('[Demo AI Reply] DB query error message:', dbError.message);
        console.error('[Demo AI Reply] DB query error stack:', dbError.stack);
      }
      throw dbError; // Re-throw
    }

    if (existingThread?.thread_id) {
      threadId = existingThread.thread_id;
      console.log('[Demo AI Reply] Using existing thread:', threadId);
    } else {
      console.log('[Demo AI Reply] Creating new thread...');
      const thread = await runWithRetries(() => 
        openai.beta.threads.create()
      );
      threadId = thread.id;
      console.log('[Demo AI Reply] Created new thread:', threadId);
      
      // Store thread ID for future use with proper initialization
      try {
        await prisma.chatTurnState.upsert({
          where: { chat_id: chatId },
          update: { thread_id: threadId },
          create: { 
            chat_id: chatId,
            thread_id: threadId,
            next_user_id: 'assistant' // Default for new threads
          }
        });
        console.log('[Demo AI Reply] Thread ID stored in database');
      } catch (dbError) {
        console.error('[Demo AI Reply] DATABASE ERROR: Failed to upsert thread ID:', dbError);
        if (dbError instanceof Error) {
          console.error('[Demo AI Reply] DB upsert error message:', dbError.message);
          console.error('[Demo AI Reply] DB upsert error stack:', dbError.stack);
        }
        throw dbError; // Re-throw
      }
    }

    // Add message to thread
    console.log('[Demo AI Reply] Adding message to thread...');
    console.log('[Demo AI Reply] Attempting to add message to thread...');
    try {
      await runWithRetries(() =>
        openai.beta.threads.messages.create(threadId, {
          role: 'user',
          content: fullPrompt
        })
      );
      console.log('[Demo AI Reply] SUCCESSFULLY added message to thread.');
    } catch (openaiMessageError: any) {
      console.error('[Demo AI Reply] ERROR: Failed to add message to thread:', openaiMessageError);
      if (openaiMessageError instanceof Error) {
          console.error('[Demo AI Reply] OpenAI message error message:', openaiMessageError.message);
          console.error('[Demo AI Reply] OpenAI message error stack:', openaiMessageError.stack);
          if ((openaiMessageError as any).code) console.error('[Demo AI Reply] OpenAI message error code:', (openaiMessageError as any).code);
          if ((openaiMessageError as any).statusCode) console.error('[Demo AI Reply] OpenAI message error statusCode:', (openaiMessageError as any).statusCode);
          if ((openaiMessageError as any).response) console.error('[Demo AI Reply] OpenAI message error response:', (openaiMessageError as any).response.data || (openaiMessageError as any).response);
          if ((openaiMessageError as any).body) console.error('[Demo AI Reply] OpenAI message error body:', (openaiMessageError as any).body);
          if (openaiMessageError.cause) console.error('[Demo AI Reply] OpenAI message error cause:', openaiMessageError.cause);
          console.error('[Demo AI Reply] OpenAI message error all properties:', JSON.stringify(openaiMessageError, Object.getOwnPropertyNames(openaiMessageError)));
      } else {
          console.error('[Demo AI Reply] OpenAI message error (not an Error object):', String(openaiMessageError));
      }
      throw openaiMessageError;
    }
    console.log('[Demo AI Reply] Proceeding after adding message to thread.');

    let fullMessage = '';
    try {
      console.log('[Demo AI Reply] Starting AI run...');
      assertAssistantId(OPENAI_ASSISTANT_ID);
      console.log('[Demo AI Reply] Attempting to create run with assistant ID:', OPENAI_ASSISTANT_ID);
      let run: Run;
      try {
        console.log('[Demo AI Reply] About to call runWithRetries for OpenAI run creation...');
        if (!OPENAI_ASSISTANT_ID) {
            throw new Error('LINTER_GUARD: OPENAI_ASSISTANT_ID is undefined before run creation.');
        }
        const runCreationPromise = runWithRetries(() =>
          openai.beta.threads.runs.create(threadId, {
            assistant_id: OPENAI_ASSISTANT_ID
          })
        ) as Promise<Run>;
        
        const runCreationTimeoutPromise = new Promise<never>((_, reject) => { // Renamed to avoid conflict
          setTimeout(() => {
            console.error('[Demo AI Reply] TIMEOUT: OpenAI run creation timed out after 30 seconds');
            reject(new Error('OpenAI run creation timed out after 30 seconds'));
          }, 30000);
        });
        
        run = await Promise.race([runCreationPromise, runCreationTimeoutPromise]);
        console.log('[Demo AI Reply] SUCCESSFULLY created run:', run.id);
      } catch (runCreateError: any) {
        console.error('[Demo AI Reply] ERROR: Failed to create run:', runCreateError);
        if (runCreateError instanceof Error) {
          console.error('[Demo AI Reply] Run create error message:', runCreateError.message);
          console.error('[Demo AI Reply] Run create error stack:', runCreateError.stack);
          if ((runCreateError as any).code) console.error('[Demo AI Reply] Run create error code:', (runCreateError as any).code);
          if ((runCreateError as any).statusCode) console.error('[Demo AI Reply] Run create error statusCode:', (runCreateError as any).statusCode);
          if ((runCreateError as any).status) console.error('[Demo AI Reply] Run create error status:', (runCreateError as any).status);
          if ((runCreateError as any).response) {
            console.error('[Demo AI Reply] Run create error response:', (runCreateError as any).response);
            if ((runCreateError as any).response?.data) {
              console.error('[Demo AI Reply] Run create error response data:', (runCreateError as any).response.data);
            }
          }
          if ((runCreateError as any).body) console.error('[Demo AI Reply] Run create error body:', (runCreateError as any).body);
          if (runCreateError.cause) console.error('[Demo AI Reply] Run create error cause:', runCreateError.cause);
          console.error('[Demo AI Reply] Run create error all properties:', JSON.stringify(runCreateError, Object.getOwnPropertyNames(runCreateError)));
        } else {
          console.error('[Demo AI Reply] Run create error (not an Error object):', String(runCreateError));
        }
        throw runCreateError;
      }
      
      let completedRun = await runWithRetries(() =>
        openai.beta.threads.runs.retrieve(threadId, run.id)
      );
      console.log('[Demo AI Reply] Initial run status:', completedRun.status);
      
      const maxWaitTime = 120000; 
      const startTime = Date.now();
      
      while (completedRun.status === 'in_progress' || completedRun.status === 'queued') {
        if (Date.now() - startTime > maxWaitTime) {
          console.error('[Demo AI Reply] Run timed out after 2 minutes');
          throw new Error('AI run timed out after 2 minutes');
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        try {
          completedRun = await runWithRetries(() =>
            openai.beta.threads.runs.retrieve(threadId, run.id)
          );
          console.log('[Demo AI Reply] Run status:', completedRun.status);
        } catch (error) {
          console.error('[Demo AI Reply] Run retrieval failed:', error);
          throw new Error('Failed to get AI response during polling', { cause: error });
        }
      }
      
      if (completedRun.status === 'failed') {
        console.error('[Demo AI Reply] Run failed:', completedRun.last_error);
        throw new Error(`AI run failed: ${completedRun.last_error?.message}`);
      }
      
      const messages = await runWithRetries(() =>
        openai.beta.threads.messages.list(threadId)
      );
      const assistantMessage = messages.data[0];
      if (!assistantMessage || !assistantMessage.content) {
        console.error('[Demo AI Reply] No assistant message found');
        throw new Error('No assistant message returned');
      }
      
      fullMessage = assistantMessage.content
        .filter((c: any): c is { type: 'text'; text: { value: string; annotations: any[] } } => c.type === 'text')
        .map((c: any) => c.text.value)
        .join('');
      console.log('[Demo AI Reply] Message retrieved:', fullMessage);
    } catch (error) {
      console.error('[Demo AI Reply] Failed to generate AI response:', error);
      // await setTypingIndicator(chatId, 'assistant', false); // BYPASSED Ensure typing indicator is off
      try {
        await pusherServer.trigger(channelName, PUSHER_EVENTS.ASSISTANT_TYPING, { isTyping: false });
      } catch (pusherError) {
        console.error('[Demo AI Reply] ERROR: Failed to reset typing indicator via Pusher on error:', pusherError);
      }
      throw error;
    }

    // Stop typing indicator
    console.log('[Demo AI Reply] Stopping typing indicator...');
    try {
      // await setTypingIndicator(chatId, 'assistant', false); // BYPASSED
      console.log('[Demo AI Reply] Typing indicator stopped in Redis (BYPASSED)');
    } catch (redisError) {
       console.error('[Demo AI Reply] REDIS ERROR: Failed to stop typing indicator in Redis:', redisError);
    }
    try {
      await pusherServer.trigger(channelName, PUSHER_EVENTS.ASSISTANT_TYPING, { isTyping: false });
      console.log('[Demo AI Reply] Typing indicator stopped via Pusher');
    } catch (pusherError) {
      console.error('[Demo AI Reply] ERROR: Failed to stop typing indicator via Pusher:', pusherError);
    }

    console.log('[Demo AI Reply] Processing message...');
    const cleanedMessage = fullMessage.trim();

    console.log('[Demo AI Reply] Storing message in database...');
    let newMessage;
    try {
      newMessage = await prisma.event.create({
        data: {
          chat_id: chatId,
          type: 'message',
          data: { content: cleanedMessage, senderId: 'assistant' }
        }
      });
      console.log('[Demo AI Reply] Message stored in database');
    } catch (dbError: any) {
      console.error('[Demo AI Reply] DATABASE ERROR: Failed to store new message:', dbError);
      if (dbError instanceof Error) {
        console.error('[Demo AI Reply] DB create error message:', dbError.message);
        console.error('[Demo AI Reply] DB create error stack:', dbError.stack);
      }
      throw dbError;
    }

    console.log('[Demo AI Reply] Emitting new message event...');
    try {
      await pusherServer.trigger(channelName, PUSHER_EVENTS.NEW_MESSAGE, {
        id: newMessage.id,
        created_at: newMessage.created_at.toISOString(),
        data: { content: cleanedMessage, senderId: 'assistant' }
      });
      console.log('[Demo AI Reply] New message event emitted successfully');
    } catch (pusherError) {
      console.error('[Demo AI Reply] ERROR: Failed to emit new message event via Pusher:', pusherError);
    }

    // This is DEMO specific logic
    console.log('[Demo AI Reply] Demo chat detected, using role-based turn management...');
    let userRole;
    try {
      userRole = await turnManager.getRoleForUserId(userId);
      console.log('[Demo AI Reply] User role who triggered mediator:', userRole);
    } catch (turnError: any) {
      console.error('[Demo AI Reply] TURN MANAGER ERROR: Failed to get user role:', turnError);
      if (turnError instanceof Error) {
        console.error('[Demo AI Reply] Get user role error message:', turnError.message);
        console.error('[Demo AI Reply] Get user role error stack:', turnError.stack);
      }
      throw turnError;
    }

    if (userRole === DEMO_ROLES.USER_A) {
      console.log('[Demo AI Reply] Mediator responded to Michael, setting turn to Jordan...');
      try {
        await turnManager.setTurnToRole(DEMO_ROLES.JORDAN);
      } catch (turnError: any) {
        console.error('[Demo AI Reply] TURN MANAGER ERROR: Failed to set turn to Jordan:', turnError);
        if (turnError instanceof Error) {
          console.error('[Demo AI Reply] Set turn (Jordan) error message:', turnError.message);
          console.error('[Demo AI Reply] Set turn (Jordan) error stack:', turnError.stack);
        }
        throw turnError;
      }
      
      let jordanUserId;
      try {
        jordanUserId = await turnManager.getUserIdForRole(DEMO_ROLES.JORDAN);
      } catch (turnError: any) {
        console.error('[Demo AI Reply] TURN MANAGER ERROR: Failed to get Jordan user ID:', turnError);
        // Log and continue, as Michael's turn is set if this fails.
      }

      if (jordanUserId) {
        console.log('[Demo AI Reply] Triggering Jordan response via API call...');
        // Fire-and-forget call to the new Jordan reply API endpoint
        try {
          const response = await fetch(`${apiBaseUrl}/api/demo/gen-jordan-reply`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ chatId, jordanUserId, conversationContext: cleanedMessage, apiBaseUrl }),
          });
          
          if (!response.ok) {
            console.error('[Demo AI Reply] Jordan API call failed with status:', response.status, response.statusText);
            const errorText = await response.text();
            console.error('[Demo AI Reply] Jordan API error response:', errorText);
          } else {
            console.log('[Demo AI Reply] Jordan API call successful, status:', response.status);
          }
        } catch (err) {
          // This catch is for network errors or issues initiating the fetch itself
          console.error('[Demo AI Reply] Error calling /api/demo/gen-jordan-reply:', err);
          if (err instanceof Error) {
            console.error('[Demo AI Reply] Fetch error message:', err.message);
            console.error('[Demo AI Reply] Fetch error stack:', err.stack);
          }
        }
      }
    } else if (userRole === DEMO_ROLES.JORDAN) {
      console.log('[Demo AI Reply] Mediator responded to Jordan, setting turn to Michael...');
      try {
        await turnManager.setTurnToRole(DEMO_ROLES.USER_A);
      } catch (turnError: any) {
        console.error('[Demo AI Reply] TURN MANAGER ERROR: Failed to set turn to Michael (after Jordan):', turnError);
        if (turnError instanceof Error) {
          console.error('[Demo AI Reply] Set turn (Michael) error message:', turnError.message);
          console.error('[Demo AI Reply] Set turn (Michael) error stack:', turnError.stack);
        }
        throw turnError;
      }
    }
    // END OF DEMO SPECIFIC LOGIC

    console.log('[Demo AI Reply] Generation complete');
    if (timeoutId) clearTimeout(timeoutId);
    return { content: cleanedMessage };
    
    } catch (mainError: any) {
      if (timeoutId) clearTimeout(timeoutId);
      console.error('[Demo AI Reply] Main AI reply generation failed:', mainError);
      if (mainError instanceof Error) {
        console.error('[Demo AI Reply] Main error message:', mainError.message);
        console.error('[Demo AI Reply] Main error stack:', mainError.stack);
        if (mainError.cause) {
          console.error('[Demo AI Reply] Main error cause:', mainError.cause);
        }
        for (const key in mainError) {
          console.error(`[Demo AI Reply] Main error property ${key}:`, (mainError as any)[key]);
        }
      } else {
        console.error('[Demo AI Reply] Main error (not an Error object):', mainError);
      }
      
      try {
        // await setTypingIndicator(chatId, 'assistant', false); // BYPASSED
        await pusherServer.trigger(channelName, PUSHER_EVENTS.ASSISTANT_TYPING, { isTyping: false });
        console.log('[Demo AI Reply] Typing indicator stopped successfully due to main error (Redis BYPASSED).');
      } catch (cleanupError) {
        console.error('[Demo AI Reply] Failed to stop typing indicator on cleanup:', cleanupError);
      }
      throw mainError;
    }
  })();

  return Promise.race([replyPromise, timeoutPromise]);
} 