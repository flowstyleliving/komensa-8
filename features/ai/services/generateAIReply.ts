// GPT CONTEXT:
// This file triggers an OpenAI Assistant response based on a user's message.
// It retrieves current state, formats the prompt, sends it to OpenAI, and stores the reply.
// Related: /lib/openai.ts, /features/ai/formatStateForPrompt.ts, /lib/prisma.ts

import { openai, runWithRetries } from '@/lib/openai';
import { pusherServer, getChatChannelName, PUSHER_EVENTS } from '@/lib/pusher';
import { prisma } from '@/lib/prisma';
import { formatStateForPrompt } from './formatStateForPrompt';
import { parseStateUpdate, parseStateUpdateAndCleanMessage } from './parseStateUpdate';
import { generateJordanReply } from './generateJordanReply';
import { TurnManager, DEMO_ROLES } from '@/features/chat/services/turnManager';
import type { Run } from 'openai/resources/beta/threads/runs/runs';

// Validate critical environment variables
const OPENAI_ASSISTANT_ID = process.env.OPENAI_ASSISTANT_ID1;
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
  console.log('[AI Reply] Starting AI reply generation...', { chatId, userId });
  
  const channelName = getChatChannelName(chatId);
  const turnManager = new TurnManager(chatId);
  
  try {
    // Emit typing indicator
    console.log('[AI Reply] Setting typing indicator...');
    await pusherServer.trigger(channelName, PUSHER_EVENTS.ASSISTANT_TYPING, { isTyping: true });
    console.log('[AI Reply] Typing indicator set successfully');
    
    // Get current state
    console.log('[AI Reply] Formatting state for prompt...');
    const state = await formatStateForPrompt({ chatId, userId, userMessage });
    console.log('[AI Reply] State formatted successfully');

    // Add state update instruction to the prompt
    const fullPrompt = `${state}

Respond thoughtfully as a mediator, drawing from the current emotional and conversational state.`;
    console.log('[AI Reply] Full prompt prepared');

    // Get or create thread
    console.log('[AI Reply] Getting or creating thread...');
    let threadId: string;
    const existingThread = await prisma.chatTurnState.findUnique({
      where: { chat_id: chatId },
      select: { thread_id: true }
    });

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
      
      // Store thread ID for future use with proper initialization
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
    }

    // Add message to thread
    console.log('[AI Reply] Adding message to thread...');
    await runWithRetries(() =>
      openai.beta.threads.messages.create(threadId, {
        role: 'user',
        content: fullPrompt
      })
    );
    console.log('[AI Reply] Message added to thread');

    // Start run (non-streaming for simplicity and speed)
    let fullMessage = '';
    try {
      console.log('[AI Reply] Starting AI run...');
      assertAssistantId(OPENAI_ASSISTANT_ID);
      const run = await runWithRetries(() =>
        openai.beta.threads.runs.create(threadId, {
          assistant_id: OPENAI_ASSISTANT_ID
        })
      ) as Run;
      console.log('[AI Reply] Run created:', run.id);
      
      let completedRun = await runWithRetries(() =>
        openai.beta.threads.runs.retrieve(threadId, run.id)
      );
      console.log('[AI Reply] Initial run status:', completedRun.status);
      
      // Add timeout to prevent infinite polling (max 2 minutes)
      const maxWaitTime = 120000; // 2 minutes
      const startTime = Date.now();
      
      while (completedRun.status === 'in_progress' || completedRun.status === 'queued') {
        // Check timeout
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
      
      // Get messages
      console.log('[AI Reply] Retrieving messages...');
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
      // Stop typing indicator on error
      await pusherServer.trigger(channelName, PUSHER_EVENTS.ASSISTANT_TYPING, { isTyping: false });
      throw error;
    }

    // Stop typing indicator
    console.log('[AI Reply] Stopping typing indicator...');
    await pusherServer.trigger(channelName, PUSHER_EVENTS.ASSISTANT_TYPING, { isTyping: false });
    console.log('[AI Reply] Typing indicator stopped');

    // Process the message (no longer need to parse STATE_UPDATE_JSON)
    console.log('[AI Reply] Processing message...');
    const cleanedMessage = fullMessage.trim();

    // Store message in database
    console.log('[AI Reply] Storing message in database...');
    const newMessage = await prisma.event.create({
      data: {
        chat_id: chatId,
        type: 'message',
        data: {
          content: cleanedMessage,
          senderId: 'assistant'
        }
      }
    });
    console.log('[AI Reply] Message stored in database');

    // Emit new message event
    console.log('[AI Reply] Emitting new message event...');
    await pusherServer.trigger(channelName, PUSHER_EVENTS.NEW_MESSAGE, {
      id: newMessage.id,
      created_at: newMessage.created_at.toISOString(),
      data: {
        content: cleanedMessage,
        senderId: 'assistant'
      }
    });
    console.log('[AI Reply] New message event emitted');

    // Check if this is a demo chat and handle the conversation flow
    console.log('[AI Reply] Checking chat type and managing turns...');
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      include: { participants: true }
    });

    if (chat?.origin === 'demo') {
      console.log('[AI Reply] Demo chat detected, using role-based turn management...');
      
      // Get the role of the user who sent the message that triggered this mediator response
      const userRole = await turnManager.getRoleForUserId(userId);
      console.log('[AI Reply] User role who triggered mediator:', userRole);

      if (userRole === DEMO_ROLES.USER_A) {
        // Mediator just responded to User A → next turn should be Jordan
        console.log('[AI Reply] Mediator responded to User A, setting turn to Jordan...');
        await turnManager.setTurnToRole(DEMO_ROLES.JORDAN);
        
        // Trigger Jordan's response automatically
        const jordanUserId = await turnManager.getUserIdForRole(DEMO_ROLES.JORDAN);
        if (jordanUserId) {
          console.log('[AI Reply] Triggering Jordan response...');
          generateJordanReply({
            chatId,
            jordanUserId,
            conversationContext: cleanedMessage
          }).catch(error => {
            console.error('[AI Reply] Failed to generate Jordan response:', error);
          });
        }
      } else if (userRole === DEMO_ROLES.JORDAN) {
        // Mediator just responded to Jordan → next turn should be User A
        console.log('[AI Reply] Mediator responded to Jordan, setting turn to User A...');
        await turnManager.setTurnToRole(DEMO_ROLES.USER_A);
      } else {
        // Fallback: advance to next turn in sequence
        console.log('[AI Reply] Unknown user role, advancing turn normally...');
        await turnManager.advanceTurn();
      }
    } else {
      // For non-demo chats, use the old logic
      console.log('[AI Reply] Non-demo chat, using legacy turn management...');
      await prisma.chatTurnState.update({
        where: { chat_id: chatId },
        data: { next_user_id: userId }
      });
      
      // Emit turn update
      await pusherServer.trigger(channelName, PUSHER_EVENTS.TURN_UPDATE, { next_user_id: userId });
    }

    console.log('[AI Reply] Generation complete');
    return { content: cleanedMessage };
    
  } catch (error) {
    console.error('[AI Reply] CRITICAL ERROR in generateAIReply:', error);
    
    // Ensure typing indicator is always reset on any error
    try {
      console.log('[AI Reply] Resetting typing indicator due to error...');
      await pusherServer.trigger(channelName, PUSHER_EVENTS.ASSISTANT_TYPING, { isTyping: false });
      console.log('[AI Reply] Typing indicator reset successfully');
    } catch (pusherError) {
      console.error('[AI Reply] Failed to reset typing indicator:', pusherError);
    }
    
    throw error;
  }
}