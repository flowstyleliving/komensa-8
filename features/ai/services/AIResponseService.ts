// Focused AI response service - only handles AI generation
import { openai, runWithRetries } from '@/lib/openai';
import { prisma } from '@/lib/prisma';
import { RealtimeEventService } from '@/features/chat/services/RealtimeEventService';
import { retryOpenAIOperation, checkNetworkQuality } from '../utils/retries';
import { enhancedMediatorContext } from '@/lib/ai/enhanced-mediator-context';
import type { Run } from 'openai/resources/beta/threads/runs/runs';

// Validate critical environment variables
const OPENAI_ASSISTANT_ID = process.env.OPENAI_ASSISTANT_ID;
if (!OPENAI_ASSISTANT_ID) {
  throw new Error('OPENAI_ASSISTANT_ID environment variable is not set');
}

export interface AIGenerationContext {
  chatId: string;
  userId: string;
  userMessage: string;
  userAgent?: string;
  replyId?: string;
}

export interface AIGenerationResult {
  content: string;
  skipped?: boolean;
  error?: string;
}

export class AIResponseService {
  private context: AIGenerationContext;
  private isMobile: boolean;
  private replyId: string;
  private cleanupHandlers: (() => Promise<void>)[] = [];

  constructor(context: AIGenerationContext) {
    this.context = context;
    this.isMobile = context.userAgent?.toLowerCase().includes('mobile') || false;
    this.replyId = context.replyId || `ai-${Date.now()}`;
  }

  /**
   * Main entry point - orchestrates the complete AI response flow
   */
  async generateAndStore(): Promise<{ id: string; content: string }> {
    console.log(`[AIResponseService] ${this.replyId} - Starting AI response generation`);
    
    try {
      // Set network quality context
      checkNetworkQuality();
      
      // Generate the AI response
      const response = await this.generateResponse();
      
      // Store in database
      const messageId = await this.storeResponse(response);
      
      // Emit via real-time service
      await this.emitResponse(messageId, response);
      
      console.log(`[AIResponseService] ${this.replyId} - Complete: ${messageId}`);
      return { id: messageId, content: response };
      
    } catch (error) {
      console.error(`[AIResponseService] ${this.replyId} - Failed:`, error);
      throw error;
    } finally {
      // Run cleanup handlers
      await this.cleanup();
    }
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    console.log(`[AIResponseService] ${this.replyId} - Running cleanup`);
    
    for (const handler of this.cleanupHandlers) {
      try {
        await handler();
      } catch (error) {
        console.error(`[AIResponseService] ${this.replyId} - Cleanup handler failed:`, error);
      }
    }
    
    this.cleanupHandlers = [];
  }

  /**
   * Generate AI response using OpenAI
   */
  private async generateResponse(): Promise<string> {
    console.log(`[AIResponseService] ${this.replyId} - Generating AI response via OpenAI`);
    
    // Get or create thread
    const threadId = await this.getOrCreateThread();
    
    // Add user message to thread with enhanced context
    await this.addMessageToThread(threadId);
    
    // Create and run AI generation
    const response = await this.runAIGeneration(threadId);
    
    console.log(`[AIResponseService] ${this.replyId} - AI response generated: ${response.length} chars`);
    return response;
  }

  /**
   * Get existing thread or create new one
   */
  private async getOrCreateThread(): Promise<string> {
    try {
      // Check for existing thread
      const existingThread = await prisma.chatTurnState.findUnique({
        where: { chat_id: this.context.chatId },
        select: { thread_id: true }
      });

      if (existingThread?.thread_id) {
        console.log(`[AIResponseService] ${this.replyId} - Using existing thread: ${existingThread.thread_id}`);
        return existingThread.thread_id;
      }

      // Create new thread
      console.log(`[AIResponseService] ${this.replyId} - Creating new thread`);
      const thread = await retryOpenAIOperation(
        () => openai.beta.threads.create(),
        'thread creation',
        this.isMobile
      );

      // Store thread ID only - don't touch turn state
      await prisma.chatTurnState.upsert({
        where: { chat_id: this.context.chatId },
        update: { thread_id: thread.id },
        create: { 
          chat_id: this.context.chatId,
          thread_id: thread.id
          // No next_user_id - let turn manager handle this
        }
      });

      console.log(`[AIResponseService] ${this.replyId} - Created and stored new thread: ${thread.id}`);
      return thread.id;

    } catch (error) {
      console.error(`[AIResponseService] ${this.replyId} - Thread management failed:`, error);
      throw error;
    }
  }

  /**
   * Add user message to OpenAI thread with enhanced context-aware prompt
   */
  private async addMessageToThread(threadId: string): Promise<void> {
    try {
      // Generate contextual prompt using enhanced mediator context
      console.log(`[AIResponseService] ${this.replyId} - Building enhanced mediator context`);
      const contextualPrompt = await enhancedMediatorContext.generateContextualPrompt(this.context.chatId);
      
      // Combine contextual prompt with user message
      const fullPrompt = `${contextualPrompt}

CURRENT USER MESSAGE: "${this.context.userMessage}"

Please respond as Komensa, taking into account all the conversation context above. Your response should demonstrate active listening, situational awareness, and expert mediation skills.`;

      await retryOpenAIOperation(
        () => openai.beta.threads.messages.create(threadId, {
          role: 'user',
          content: fullPrompt
        }),
        'message creation',
        this.isMobile
      );
      
      console.log(`[AIResponseService] ${this.replyId} - Enhanced context message added to thread`);
    } catch (error) {
      console.error(`[AIResponseService] ${this.replyId} - Failed to add message to thread:`, error);
      throw error;
    }
  }

  /**
   * Run AI generation and poll for completion
   */
  private async runAIGeneration(threadId: string): Promise<string> {
    console.log(`[AIResponseService] ${this.replyId} - Starting AI run`);
    
    // Create run
    const run: Run = await retryOpenAIOperation(
      () => openai.beta.threads.runs.create(threadId, {
        assistant_id: OPENAI_ASSISTANT_ID!
      }),
      'run creation',
      this.isMobile
    );

    // Poll for completion
    let completedRun = run;
    const startTime = Date.now();
    const maxWaitTime = this.isMobile ? 90000 : 120000; // Mobile: 90s, Desktop: 120s
    const pollingInterval = 1000;

    while (completedRun.status === 'in_progress' || completedRun.status === 'queued') {
      if (Date.now() - startTime > maxWaitTime) {
        throw new Error(`AI generation timed out after ${maxWaitTime}ms`);
      }
      
      await new Promise(resolve => setTimeout(resolve, pollingInterval));
      
      completedRun = await retryOpenAIOperation(
        () => openai.beta.threads.runs.retrieve(threadId, run.id),
        'run polling',
        this.isMobile
      );
    }

    if (completedRun.status === 'failed') {
      throw new Error(`AI run failed: ${completedRun.last_error?.message}`);
    }

    // Get response messages
    const messages = await retryOpenAIOperation(
      () => openai.beta.threads.messages.list(threadId),
      'message retrieval',
      this.isMobile
    );

    const assistantMessage = messages.data[0];
    if (!assistantMessage || !assistantMessage.content) {
      throw new Error('No assistant message returned');
    }

    // Extract text content
    const fullMessage = assistantMessage.content
      .filter((c: any): c is { type: 'text'; text: { value: string; annotations: any[] } } => c.type === 'text')
      .map((c: any) => c.text.value)
      .join('');

    return fullMessage.trim();
  }

  /**
   * Store response in database
   */
  private async storeResponse(content: string): Promise<string> {
    try {
      const messageEvent = await prisma.event.create({
        data: {
          chat_id: this.context.chatId,
          type: 'message',
          data: {
            content,
            senderId: 'assistant'
          }
        }
      });

      console.log(`[AIResponseService] ${this.replyId} - Response stored: ${messageEvent.id}`);
      return messageEvent.id;

    } catch (error) {
      console.error(`[AIResponseService] ${this.replyId} - Failed to store response:`, error);
      throw error;
    }
  }

  /**
   * Emit response via real-time service
   */
  private async emitResponse(messageId: string, content: string): Promise<void> {
    try {
      const realtimeService = new RealtimeEventService(this.context.chatId);
      
      await realtimeService.broadcastMessage({
        id: messageId,
        created_at: new Date().toISOString(),
        data: {
          content,
          senderId: 'assistant'
        }
      });

      console.log(`[AIResponseService] ${this.replyId} - Response emitted via realtime`);

    } catch (error) {
      console.error(`[AIResponseService] ${this.replyId} - Failed to emit response:`, error);
      // Don't throw - message is already stored
    }
  }
}