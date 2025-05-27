// GPT CONTEXT:
// This file generates AI responses for Jordan (the AI user participant)
// Jordan responds as a user, not as a mediator
// Related: /features/ai/services/generateAIReply.ts

import { openai, runWithRetries } from '@/lib/openai';
import { pusherServer, getChatChannelName, PUSHER_EVENTS } from '@/lib/pusher';
import { prisma } from '@/lib/prisma';
// import { setTypingIndicator } from '@/lib/redis'; // BYPASSED
// import { parseStateUpdateAndCleanMessage } from './parseStateUpdate'; // Not used
import { DemoTurnManager, DEMO_ROLES, DEFAULT_TURN_ORDER } from '@/features/chat/services/demoTurnManager';
import type { Run } from 'openai/resources/beta/threads/runs/runs';
import { generateDemoAIReply } from './generateDemoAIReply'; // ADDED: To trigger Mediator

// Jordan's assistant ID (hardcoded for demo)
const JORDAN_ASSISTANT_ID = 'asst_NaNyg64IlU3rbkA9kdldzZJC';

export async function generateJordanReply({
  chatId,
  jordanUserId,
  conversationContext // This is the Mediator's message to User A
}: {
  chatId: string;
  jordanUserId: string;
  conversationContext: string; // Keep this for context if needed, but Jordan will primarily use recent messages
}) {
  console.log('[Jordan AI] Starting Jordan reply generation...', { chatId, jordanUserId, conversationContext });
  
  const channelName = getChatChannelName(chatId);
  // const turnManager = new DemoTurnManager(chatId); // turnManager instance not strictly needed here anymore for setTurnToRole

  // Set typing indicator in Redis and emit via Pusher for Jordan
  // await setTypingIndicator(chatId, jordanUserId, true); // BYPASSED
  console.log('[Jordan AI] Typing indicator set in Redis (BYPASSED)');
  await pusherServer.trigger(channelName, PUSHER_EVENTS.USER_TYPING, { 
    userId: jordanUserId, 
    isTyping: true 
  });
  
  // Get recent conversation for context for Jordan's reply
  const recentMessages = await prisma.event.findMany({
    where: { 
      chat_id: chatId,
      type: 'message'
    },
    orderBy: { created_at: 'desc' },
    take: 10 // Increased context for Jordan
  });

  const contextPrompt = `You are Jordan, a participant in a mediated conversation.
The Mediator has just said: "${conversationContext}"
Recent conversation history (last 10 messages, newest first):
${recentMessages.map((msg: any) => { // Newest first for prompt clarity
  const data = msg.data as any;
  const sender = data.senderId === 'assistant' ? 'AI Mediator' : 
                data.senderId === jordanUserId ? 'You (Jordan)' : 'User A';
  return `${sender}: ${data.content}`;
}).join('\n')}

Respond naturally as Jordan based on the Mediator's last message and the recent history. Keep your response conversational and authentic.`;

  console.log('[Jordan AI] Context prompt prepared for Jordan');

  // Get or create thread for Jordan (or use existing chat thread)
  // For simplicity and to keep all demo interactions in one thread, let's use the existing threadId from chatTurnState
  let threadId: string;
  const turnState = await prisma.chatTurnState.findUnique({
    where: { chat_id: chatId },
    select: { thread_id: true }
  });

  if (turnState?.thread_id) {
    threadId = turnState.thread_id;
    console.log('[Jordan AI] Using existing chat thread for Jordan:', threadId);
  } else {
    // This case should ideally not happen if generateDemoAIReply has run before for this chat
    console.error('[Jordan AI] ERROR: No thread_id found in chatTurnState. This should not happen.');
    // Fallback: create a new thread, though this will separate Jordan's context
    const thread = await runWithRetries(() => 
      openai.beta.threads.create()
    );
    threadId = thread.id;
    console.log('[Jordan AI] Created new thread for Jordan as fallback:', threadId);
     // Attempt to store it, though this is off-nominal
    await prisma.chatTurnState.upsert({
        where: { chat_id: chatId },
        update: { thread_id: threadId },
        create: { chat_id: chatId, thread_id: threadId, next_role: DEMO_ROLES.JORDAN, current_turn_index: 2, turn_queue: DEFAULT_TURN_ORDER } // Sensible defaults
    });
  }

  // Add message to thread (Jordan's perspective, prompted by Mediator's interaction with User A)
  console.log('[Jordan AI] Adding Jordan context message to thread as user...');
  await runWithRetries(() =>
    openai.beta.threads.messages.create(threadId, {
      role: 'user', // Jordan is a user in this context for the OpenAI thread
      content: contextPrompt 
    })
  );

  // Start run for Jordan's reply
  let jordanFullMessage = '';
  try {
    console.log('[Jordan AI] Starting AI run for Jordan using assistant:', JORDAN_ASSISTANT_ID);
    const run = await runWithRetries(() =>
      openai.beta.threads.runs.create(threadId, {
        assistant_id: JORDAN_ASSISTANT_ID // Jordan's dedicated assistant
      })
    ) as Run;
    console.log('[Jordan AI] Jordan Run created:', run.id);
    
    let completedRun = await runWithRetries(() =>
      openai.beta.threads.runs.retrieve(threadId, run.id)
    );
    console.log('[Jordan AI] Jordan Initial run status:', completedRun.status);
    
    const maxWaitTime = 120000; 
    const startTime = Date.now();

    while (completedRun.status === 'in_progress' || completedRun.status === 'queued') {
      if (Date.now() - startTime > maxWaitTime) {
        console.error('[Jordan AI] Jordan Run timed out after 2 minutes');
        throw new Error('Jordan AI run timed out after 2 minutes');
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
      try {
        completedRun = await runWithRetries(() =>
          openai.beta.threads.runs.retrieve(threadId, run.id)
        );
        console.log('[Jordan AI] Jordan Run status:', completedRun.status);
      } catch (error) {
        console.error('[Jordan AI] Jordan Run retrieval failed:', error);
        throw new Error('Failed to get Jordan AI response during polling', { cause: error });
      }
    }
    
    if (completedRun.status === 'failed') {
      console.error('[Jordan AI] Jordan Run failed:', completedRun.last_error);
      throw new Error(`Jordan AI run failed: ${completedRun.last_error?.message}`);
    }
    
    const messages = await runWithRetries(() =>
      openai.beta.threads.messages.list(threadId, { order: 'desc', limit: 1 }) // Get the latest message
    );
    const assistantMessage = messages.data[0]; // This should be Jordan's reply

    if (assistantMessage?.role === 'assistant' && assistantMessage.content) {
       jordanFullMessage = assistantMessage.content
        .filter((c: any): c is { type: 'text'; text: { value: string; annotations: any[] } } => c.type === 'text')
        .map((c: any) => c.text.value)
        .join('');
      console.log('[Jordan AI] Jordan Message retrieved:', jordanFullMessage);
    } else {
      console.error('[Jordan AI] No assistant message found or latest message not from assistant for Jordan');
      throw new Error('No Jordan AI message returned or malformed response');
    }
  } catch (error) {
    console.error('[Jordan AI] Failed to generate Jordan response:', error);
    // Stop typing indicator on error
    // await setTypingIndicator(chatId, jordanUserId, false); // BYPASSED
    console.log('[Jordan AI] Typing indicator stopped in Redis on error (BYPASSED)');
    await pusherServer.trigger(channelName, PUSHER_EVENTS.USER_TYPING, { 
      userId: jordanUserId, 
      isTyping: false 
    });
    throw error; // Rethrow to prevent further execution in this function
  }

  // Stop Jordan's typing indicator
  // await setTypingIndicator(chatId, jordanUserId, false); // BYPASSED
  console.log('[Jordan AI] Typing indicator stopped in Redis (BYPASSED)');
  await pusherServer.trigger(channelName, PUSHER_EVENTS.USER_TYPING, { 
    userId: jordanUserId, 
    isTyping: false 
  });

  const cleanedJordanMessage = jordanFullMessage.trim();

  if (!cleanedJordanMessage || cleanedJordanMessage.length === 0) {
    console.error('[Jordan AI] No content in Jordan response, skipping storage and further actions.');
    // Potentially set turn to User A here as a fallback? Or let it error out?
    // For now, let it be an error state that stops the demo flow here.
    throw new Error('Jordan AI returned empty response');
  }

  // Store Jordan's message in database
  console.log('[Jordan AI] Storing Jordan message in database...');
  const newMessage = await prisma.event.create({
    data: {
      chat_id: chatId,
      type: 'message',
      data: {
        content: cleanedJordanMessage,
        senderId: jordanUserId // Jordan's actual user ID
      }
    }
  });

  // Emit Jordan's new message event
  await pusherServer.trigger(channelName, PUSHER_EVENTS.NEW_MESSAGE, {
    id: newMessage.id,
    created_at: newMessage.created_at.toISOString(),
    data: {
      content: cleanedJordanMessage,
      senderId: jordanUserId
    }
  });

  console.log('[Jordan AI] Jordan responded. Now triggering Mediator (generateDemoAIReply) to respond to Jordan.');
  
  // MODIFIED: Instead of just setting turn, now trigger the Mediator's response to Jordan.
  // The Mediator (generateDemoAIReply) will then handle setting the turn to User A.
  // We pass jordanUserId as the 'userId' that triggered the Mediator.
  // We pass Jordan's message as the 'userMessage' for the Mediator.
  try {
    await generateDemoAIReply({
      chatId,
      userId: jordanUserId, // Mediator is responding TO Jordan
      userMessage: cleanedJordanMessage // Jordan's message that Mediator will respond to
    });
    console.log('[Jordan AI] Successfully triggered Mediator response to Jordan.');
  } catch (mediatorError) {
    console.error('[Jordan AI] ERROR: Failed to trigger Mediator response after Jordan reply:', mediatorError);
    // If Mediator fails, what should the turn be? This is a critical error in demo flow.
    // For now, log and let the error propagate if generateDemoAIReply throws.
  }

  // REMOVED: Explicit turn setting here, as generateDemoAIReply will handle it.
  // console.log('[Jordan AI] Jordan responded, setting turn to mediator...');
  // await turnManager.setTurnToRole(DEMO_ROLES.MEDIATOR); 
  // console.log('[Jordan AI] Turn set to mediator - waiting for natural trigger...');

  console.log('[Jordan AI] Jordan reply generation and Mediator trigger complete');
  return { content: cleanedJordanMessage }; // Return Jordan's message
} 