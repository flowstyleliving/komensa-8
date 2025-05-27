// GPT CONTEXT:
// This file generates AI responses for Jordan (the AI user participant)
// Jordan responds as a user, not as a mediator
// Related: /features/ai/services/generateAIReply.ts

import { openai, runWithRetries } from '@/lib/openai';
import { pusherServer, getChatChannelName, PUSHER_EVENTS } from '@/lib/pusher';
import { prisma } from '@/lib/prisma';
import { setTypingIndicator } from '@/lib/redis';
import { parseStateUpdateAndCleanMessage } from './parseStateUpdate';
import { DemoTurnManager, DEMO_ROLES } from '@/features/chat/services/demoTurnManager';
import type { Run } from 'openai/resources/beta/threads/runs/runs';

// Jordan's assistant ID (hardcoded for demo)
const JORDAN_ASSISTANT_ID = 'asst_NaNyg64IlU3rbkA9kdldzZJC';

export async function generateJordanReply({
  chatId,
  jordanUserId,
  conversationContext
}: {
  chatId: string;
  jordanUserId: string;
  conversationContext: string;
}) {
  console.log('[Jordan AI] Starting Jordan reply generation...', { chatId, jordanUserId });
  
  const channelName = getChatChannelName(chatId);
  const turnManager = new DemoTurnManager(chatId);
  
  // Set typing indicator in Redis and emit via Pusher for Jordan
  await setTypingIndicator(chatId, jordanUserId, true);
  await pusherServer.trigger(channelName, PUSHER_EVENTS.USER_TYPING, { 
    userId: jordanUserId, 
    isTyping: true 
  });
  
  // Get recent conversation for context
  const recentMessages = await prisma.event.findMany({
    where: { 
      chat_id: chatId,
      type: 'message'
    },
    orderBy: { created_at: 'desc' },
    take: 5
  });

  const contextPrompt = `You are Jordan, a participant in a mediated conversation. 
Recent conversation:
${recentMessages.reverse().map((msg: any) => {
  const data = msg.data as any;
  const sender = data.senderId === 'assistant' ? 'AI Mediator' : 
                data.senderId === jordanUserId ? 'You (Jordan)' : 'User A';
  return `${sender}: ${data.content}`;
}).join('\n')}

Respond naturally as Jordan. Keep your response conversational and authentic to the discussion about budget re-evaluation.`;

  console.log('[Jordan AI] Context prompt prepared');

  // Get or create thread for Jordan
  let threadId: string;
  const existingThread = await prisma.chatTurnState.findUnique({
    where: { chat_id: chatId },
    select: { thread_id: true }
  });

  if (existingThread?.thread_id) {
    threadId = existingThread.thread_id;
    console.log('[Jordan AI] Using existing thread:', threadId);
  } else {
    console.log('[Jordan AI] Creating new thread for Jordan...');
    const thread = await runWithRetries(() => 
      openai.beta.threads.create()
    );
    threadId = thread.id;
    console.log('[Jordan AI] Created new thread:', threadId);
  }

  // Add message to thread
  console.log('[Jordan AI] Adding message to thread...');
  await runWithRetries(() =>
    openai.beta.threads.messages.create(threadId, {
      role: 'user',
      content: contextPrompt
    })
  );

  // Start run
  let fullMessage = '';
  try {
    console.log('[Jordan AI] Starting AI run for Jordan...');
    const run = await runWithRetries(() =>
      openai.beta.threads.runs.create(threadId, {
        assistant_id: JORDAN_ASSISTANT_ID
      })
    ) as Run;
    console.log('[Jordan AI] Run created:', run.id);
    
    let completedRun = await runWithRetries(() =>
      openai.beta.threads.runs.retrieve(threadId, run.id)
    );
    console.log('[Jordan AI] Initial run status:', completedRun.status);
    
    while (completedRun.status === 'in_progress' || completedRun.status === 'queued') {
      await new Promise(resolve => setTimeout(resolve, 1000));
      try {
        completedRun = await runWithRetries(() =>
          openai.beta.threads.runs.retrieve(threadId, run.id)
        );
        console.log('[Jordan AI] Run status:', completedRun.status);
      } catch (error) {
        console.error('[Jordan AI] Run retrieval failed:', error);
        throw new Error('Failed to get Jordan AI response during polling', { cause: error });
      }
    }
    
    if (completedRun.status === 'failed') {
      console.error('[Jordan AI] Run failed:', completedRun.last_error);
      throw new Error(`Jordan AI run failed: ${completedRun.last_error?.message}`);
    }
    
    // Get messages
    console.log('[Jordan AI] Retrieving messages...');
    const messages = await runWithRetries(() =>
      openai.beta.threads.messages.list(threadId)
    );
    const assistantMessage = messages.data[0];
    if (!assistantMessage || !assistantMessage.content) {
      console.error('[Jordan AI] No assistant message found');
      throw new Error('No Jordan AI message returned');
    }
    
    fullMessage = assistantMessage.content
      .filter((c: any): c is { type: 'text'; text: { value: string; annotations: any[] } } => c.type === 'text')
      .map((c: any) => c.text.value)
      .join('');
    console.log('[Jordan AI] Message retrieved:', fullMessage);
  } catch (error) {
    console.error('[Jordan AI] Failed to generate Jordan response:', error);
    // Stop typing indicator on error
    await setTypingIndicator(chatId, jordanUserId, false);
    await pusherServer.trigger(channelName, PUSHER_EVENTS.USER_TYPING, { 
      userId: jordanUserId, 
      isTyping: false 
    });
    throw error;
  }

  // Stop typing indicator
  await setTypingIndicator(chatId, jordanUserId, false);
  await pusherServer.trigger(channelName, PUSHER_EVENTS.USER_TYPING, { 
    userId: jordanUserId, 
    isTyping: false 
  });

  // Process message (no longer need to parse STATE_UPDATE_JSON)
  console.log('[Jordan AI] Processing message...');
  const cleanedMessage = fullMessage.trim();

  // Only store message if we have actual content
  if (!cleanedMessage || cleanedMessage.length === 0) {
    console.error('[Jordan AI] No content in Jordan response, skipping storage');
    throw new Error('Jordan AI returned empty response');
  }

  // Store message in database as Jordan's response
  console.log('[Jordan AI] Storing Jordan message in database...');
  const newMessage = await prisma.event.create({
    data: {
      chat_id: chatId,
      type: 'message',
      data: {
        content: cleanedMessage,
        senderId: jordanUserId
      }
    }
  });

  // Emit new message event
  await pusherServer.trigger(channelName, PUSHER_EVENTS.NEW_MESSAGE, {
    id: newMessage.id,
    created_at: newMessage.created_at.toISOString(),
    data: {
      content: cleanedMessage,
      senderId: jordanUserId
    }
  });

  // Use role-based turn management - just set turn to mediator, don't auto-trigger
  console.log('[Jordan AI] Jordan responded, setting turn to mediator...');
  await turnManager.setTurnToRole(DEMO_ROLES.MEDIATOR);
  
  console.log('[Jordan AI] Turn set to mediator - waiting for natural trigger...');

  console.log('[Jordan AI] Jordan reply generation complete');
  return { content: cleanedMessage };
} 