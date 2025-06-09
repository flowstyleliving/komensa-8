// Focused AI response service - only handles AI generation
import { openai, runWithRetries } from '@/lib/openai';
import { prisma } from '@/lib/prisma';
import { RealtimeEventService } from '@/features/chat/services/RealtimeEventService';
import { retryOpenAIOperation, checkNetworkQuality } from '../utils/retries';
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
  private replyId: string;
  private realtimeService: RealtimeEventService;
  private isMobile: boolean;

  constructor(private context: AIGenerationContext) {
    this.replyId = context.replyId || `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.realtimeService = new RealtimeEventService(context.chatId);
    this.isMobile = context.userAgent ? /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(context.userAgent) : false;
  }

  /**
   * Main AI generation method - focused only on AI tasks
   */
  async generate(): Promise<AIGenerationResult> {
    console.log(`[AIResponseService] ${this.replyId} - Starting AI generation`);
    
    try {
      // 1. Set typing indicators
      await this.startTypingIndicators();
      
      // 2. Generate AI response
      const content = await this.generateResponse();
      
      // 3. Stop typing indicators
      await this.stopTypingIndicators();
      
      console.log(`[AIResponseService] ${this.replyId} - AI generation completed successfully`);
      return { content };
      
    } catch (error) {
      await this.stopTypingIndicators();
      console.error(`[AIResponseService] ${this.replyId} - AI generation failed:`, error);
      return { 
        content: '', 
        error: error instanceof Error ? error.message : 'AI generation failed' 
      };
    }
  }

  /**
   * Set typing indicators for AI via centralized service
   */
  private async startTypingIndicators(): Promise<void> {
    try {
      await this.realtimeService.broadcastAssistantTyping({
        isTyping: true,
        timestamp: Date.now(),
        source: 'ai_start',
        replyId: this.replyId
      });
      
      console.log(`[AIResponseService] ${this.replyId} - Typing indicators set`);
    } catch (error) {
      console.error(`[AIResponseService] ${this.replyId} - Failed to set typing indicators:`, error);
    }
  }

  /**
   * Stop typing indicators for AI via centralized service
   */
  private async stopTypingIndicators(): Promise<void> {
    try {
      await this.realtimeService.broadcastAssistantTyping({
        isTyping: false,
        replyId: this.replyId
      });
      
      console.log(`[AIResponseService] ${this.replyId} - Typing indicators stopped`);
    } catch (error) {
      console.error(`[AIResponseService] ${this.replyId} - Failed to stop typing indicators:`, error);
    }
  }

  /**
   * Generate AI response using OpenAI
   */
  private async generateResponse(): Promise<string> {
    console.log(`[AIResponseService] ${this.replyId} - Generating AI response via OpenAI`);
    
    // Get or create thread
    const threadId = await this.getOrCreateThread();
    
    // Add user message to thread
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
   * Add user message to OpenAI thread
   */
  private async addMessageToThread(threadId: string): Promise<void> {
    const fullPrompt = `${this.context.userMessage}

Respond thoughtfully as a mediator, drawing from the current emotional and conversational state.`;

    try {
      await retryOpenAIOperation(
        () => openai.beta.threads.messages.create(threadId, {
          role: 'user',
          content: fullPrompt
        }),
        'message creation',
        this.isMobile
      );
      
      console.log(`[AIResponseService] ${this.replyId} - Message added to thread`);
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

}