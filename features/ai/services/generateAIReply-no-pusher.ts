// TEMPORARY FILE FOR DEBUGGING - Copy of generateAIReply.ts WITHOUT Pusher triggers
// This will help us determine if Pusher is causing the Vercel timeout issue

import { openai, runWithRetries } from '@/lib/openai';
import { prisma } from '@/lib/prisma';
import { setTypingIndicator } from '@/lib/redis';
import { parseStateUpdate, parseStateUpdateAndCleanMessage } from './parseStateUpdate';
import { generateJordanReply } from './generateJordanReply';
import { DemoTurnManager, DEMO_ROLES } from '@/features/chat/services/demoTurnManager';
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

export async function generateAIReplyNoPusher({
  chatId,
  userId,
  userMessage
}: {
  chatId: string;
  userId: string;
  userMessage: string;
}) {
  console.log('[AI Reply NO PUSHER] Starting AI reply generation...', { chatId, userId });
  
  const turnManager = new DemoTurnManager(chatId);
  
  try {
    // Set typing indicator in Redis ONLY (no Pusher)
    console.log('[AI Reply NO PUSHER] Setting typing indicator in Redis only...');
    // await setTypingIndicator(chatId, 'assistant', true); // BYPASSED
    console.log('[AI Reply NO PUSHER] Typing indicator set in Redis successfully (BYPASSED)');
    
    // Construct the prompt using userMessage and the static instruction
    const fullPrompt = `${userMessage}

Respond thoughtfully as a mediator, drawing from the current emotional and conversational state.`;
    console.log('[AI Reply NO PUSHER] Full prompt prepared using userMessage directly.');

    // Get or create thread
    console.log('[AI Reply NO PUSHER] Getting or creating thread...');
    let threadId: string;
    const existingThread = await prisma.chatTurnState.findUnique({
      where: { chat_id: chatId },
      select: { thread_id: true }
    });

    if (existingThread?.thread_id) {
      threadId = existingThread.thread_id;
      console.log('[AI Reply NO PUSHER] Using existing thread:', threadId);
    } else {
      console.log('[AI Reply NO PUSHER] Creating new thread...');
      const thread = await runWithRetries(() => 
        openai.beta.threads.create()
      );
      threadId = thread.id;
      console.log('[AI Reply NO PUSHER] Created new thread:', threadId);
      
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
      console.log('[AI Reply NO PUSHER] Thread ID stored in database');
    }

    // Add message to thread
    console.log('[AI Reply NO PUSHER] Adding message to thread...');
    await runWithRetries(() =>
      openai.beta.threads.messages.create(threadId, {
        role: 'user',
        content: fullPrompt
      })
    );
    console.log('[AI Reply NO PUSHER] Message added to thread');

    // Start run (non-streaming for simplicity and speed)
    let fullMessage = '';
    try {
      console.log('[AI Reply NO PUSHER] Starting AI run...');
      assertAssistantId(OPENAI_ASSISTANT_ID);
      const run = await runWithRetries(() =>
        openai.beta.threads.runs.create(threadId, {
          assistant_id: OPENAI_ASSISTANT_ID
        })
      ) as Run;
      console.log('[AI Reply NO PUSHER] Run created:', run.id);
      
      let completedRun = await runWithRetries(() =>
        openai.beta.threads.runs.retrieve(threadId, run.id)
      );
      console.log('[AI Reply NO PUSHER] Initial run status:', completedRun.status);
      
      // Add timeout to prevent infinite polling (max 2 minutes)
      const maxWaitTime = 120000; // 2 minutes
      const startTime = Date.now();
      
      while (completedRun.status === 'in_progress' || completedRun.status === 'queued') {
        // Check timeout
        if (Date.now() - startTime > maxWaitTime) {
          console.error('[AI Reply NO PUSHER] Run timed out after 2 minutes');
          throw new Error('AI run timed out after 2 minutes');
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        try {
          completedRun = await runWithRetries(() =>
            openai.beta.threads.runs.retrieve(threadId, run.id)
          );
          console.log('[AI Reply NO PUSHER] Run status:', completedRun.status);
        } catch (error) {
          console.error('[AI Reply NO PUSHER] Run retrieval failed:', error);
          throw new Error('Failed to get AI response during polling', { cause: error });
        }
      }
      
      if (completedRun.status === 'failed') {
        console.error('[AI Reply NO PUSHER] Run failed:', completedRun.last_error);
        throw new Error(`AI run failed: ${completedRun.last_error?.message}`);
      }
      
      // Get messages
      console.log('[AI Reply NO PUSHER] Retrieving messages...');
      const messages = await runWithRetries(() =>
        openai.beta.threads.messages.list(threadId)
      );
      const assistantMessage = messages.data[0];
      if (!assistantMessage || !assistantMessage.content) {
        console.error('[AI Reply NO PUSHER] No assistant message found');
        throw new Error('No assistant message returned');
      }
      
      fullMessage = assistantMessage.content
        .filter((c: any): c is { type: 'text'; text: { value: string; annotations: any[] } } => c.type === 'text')
        .map((c: any) => c.text.value)
        .join('');
      console.log('[AI Reply NO PUSHER] Message retrieved:', fullMessage);
    } catch (error) {
      console.error('[AI Reply NO PUSHER] Failed to generate AI response:', error);
      // Stop typing indicator on error (Redis only)
      // await setTypingIndicator(chatId, 'assistant', false); // BYPASSED
      console.log('[AI Reply NO PUSHER] Typing indicator reset in Redis after error (BYPASSED)');
      throw error;
    }

    // Stop typing indicator (Redis only)
    console.log('[AI Reply NO PUSHER] Stopping typing indicator...');
    // await setTypingIndicator(chatId, 'assistant', false); // BYPASSED
    console.log('[AI Reply NO PUSHER] Typing indicator stopped in Redis (BYPASSED)');

    // Process the message
    console.log('[AI Reply NO PUSHER] Processing message...');
    const cleanedMessage = fullMessage.trim();

    // Store message in database
    console.log('[AI Reply NO PUSHER] Storing message in database...');
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
    console.log('[AI Reply NO PUSHER] Message stored in database');

    // NO PUSHER EVENTS - just log what we would have done
    console.log('[AI Reply NO PUSHER] Would have emitted new message event via Pusher (skipped)');

    // Check if this is a demo chat and handle the conversation flow
    console.log('[AI Reply NO PUSHER] Checking chat type and managing turns...');
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      include: { participants: true }
    });

    if (chat?.origin === 'demo') {
      console.log('[AI Reply NO PUSHER] Demo chat detected, using role-based turn management...');
      
      // Get the role of the user who sent the message that triggered this mediator response
      const userRole = await turnManager.getRoleForUserId(userId);
      console.log('[AI Reply NO PUSHER] User role who triggered mediator:', userRole);

      if (userRole === DEMO_ROLES.USER_A) {
        // Mediator just responded to User A → next turn should be Jordan
        console.log('[AI Reply NO PUSHER] Mediator responded to User A, setting turn to Jordan...');
        await turnManager.setTurnToRole(DEMO_ROLES.JORDAN);
        
        // Trigger Jordan's response automatically
        const jordanUserId = await turnManager.getUserIdForRole(DEMO_ROLES.JORDAN);
        if (jordanUserId) {
          console.log('[AI Reply NO PUSHER] Triggering Jordan response...');
          generateJordanReply({
            chatId,
            jordanUserId,
            conversationContext: cleanedMessage
          }).catch(error => {
            console.error('[AI Reply NO PUSHER] Failed to generate Jordan response:', error);
          });
        }
      } else if (userRole === DEMO_ROLES.JORDAN) {
        // Mediator just responded to Jordan → next turn should be User A
        console.log('[AI Reply NO PUSHER] Mediator responded to Jordan, setting turn to User A...');
        await turnManager.setTurnToRole(DEMO_ROLES.USER_A);
      } else {
        // Fallback: set turn to User A (since this is a demo chat)
        console.log('[AI Reply NO PUSHER] Unknown user role, setting turn to User A...');
        await turnManager.setTurnToRole(DEMO_ROLES.USER_A);
      }
    } else {
      // For non-demo chats, use the old logic
      console.log('[AI Reply NO PUSHER] Non-demo chat, using legacy turn management...');
      await prisma.chatTurnState.update({
        where: { chat_id: chatId },
        data: { next_user_id: userId }
      });
      
      console.log('[AI Reply NO PUSHER] Would have emitted turn update via Pusher (skipped)');
    }

    console.log('[AI Reply NO PUSHER] Generation complete');
    return { content: cleanedMessage };
    
  } catch (error) {
    console.error('[AI Reply NO PUSHER] CRITICAL ERROR in generateAIReply:', error);
    
    // Ensure typing indicator is always reset on any error (Redis only)
    try {
      console.log('[AI Reply NO PUSHER] Resetting typing indicator due to error...');
      // await setTypingIndicator(chatId, 'assistant', false); // BYPASSED
      console.log('[AI Reply NO PUSHER] Typing indicator reset in Redis successfully (BYPASSED)');
    } catch (redisError) {
      console.error('[AI Reply NO PUSHER] ERROR: Failed to reset typing indicator in Redis:', redisError);
    }
    
    throw error;
  }
} 