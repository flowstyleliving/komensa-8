// Enhanced TurnManager that orchestrates entire conversation flow
import { prisma } from '@/lib/prisma';
import { TurnManager } from './turnManager';
import { RealtimeEventService } from './RealtimeEventService';
import { ChatSessionStateManager } from './ChatSessionStateManager';

export interface MessageContext {
  chatId: string;
  userId: string;
  content: string;
  userAgent?: string;
  isGuest?: boolean;
}

export interface ConversationState {
  canSend: boolean;
  nextUserId: string | null;
  mode: string;
  shouldTriggerAI: boolean;
  error?: string;
}

export class ConversationOrchestrator extends TurnManager {
  private realtimeService: RealtimeEventService;
  private stateManager: ChatSessionStateManager;

  constructor(chatId: string) {
    super(chatId);
    this.realtimeService = new RealtimeEventService(chatId);
    this.stateManager = new ChatSessionStateManager(chatId);
  }

  /**
   * Main orchestration method - handles complete message flow
   */
  async processMessage(context: MessageContext): Promise<ConversationState> {
    const { chatId, userId, content, userAgent } = context;
    
    console.log(`[ConversationOrchestrator] Processing message from ${userId} in chat ${chatId}`);
    
    try {
      // 1. Validate permissions
      const canSend = await this.canUserSendMessage(userId);
      if (!canSend) {
        throw new Error('Not your turn to speak');
      }

      // 2. Store the message via state manager
      const message = await this.stateManager.addMessage({
        content,
        senderId: userId,
        type: 'message'
      });
      
      // 3. Update turn state after message
      const newTurnState = await this.advanceTurn();
      
      // 4. Update turn state via state manager  
      await this.stateManager.updateTurnState({
        next_user_id: newTurnState?.next_user_id,
        next_role: newTurnState?.next_role
      });
      
      // 6. Check if AI should respond
      const shouldTriggerAI = await this.shouldTriggerAIResponse();
      
      // 7. Trigger AI response if needed
      if (shouldTriggerAI) {
        // Fire-and-forget AI generation
        this.triggerAIResponse(chatId, userId, content, userAgent).catch(error => {
          console.error('[ConversationOrchestrator] AI generation failed:', error);
        });
      }

      return {
        canSend: true,
        nextUserId: newTurnState?.next_user_id || null,
        mode: await this.getTurnMode(),
        shouldTriggerAI
      };

    } catch (error) {
      console.error('[ConversationOrchestrator] Error processing message:', error);
      return {
        canSend: false,
        nextUserId: null,
        mode: await this.getTurnMode(),
        shouldTriggerAI: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Store message in database
   */
  private async storeMessage(chatId: string, userId: string, content: string) {
    const timestamp = new Date();
    
    const message = await prisma.event.create({
      data: {
        chat_id: chatId,
        type: 'message',
        data: { content, senderId: userId },
        created_at: timestamp,
        seq: 0,
      },
    });

    console.log(`[ConversationOrchestrator] Message stored: ${message.id}`);
    return message;
  }

  /**
   * Broadcast message via centralized service
   */
  private async broadcastMessage(message: any) {
    await this.realtimeService.broadcastMessage({
      id: message.id,
      created_at: message.created_at.toISOString(),
      data: message.data
    });
    
    console.log(`[ConversationOrchestrator] Message broadcast: ${message.id}`);
  }

  /**
   * Advance turn state after message
   */
  private async advanceTurn() {
    const newTurnState = await this.getCurrentTurn();
    
    // Update database if needed (for strict/rounds modes)
    const mode = await this.getTurnMode();
    if (mode === 'strict' || mode === 'rounds') {
      try {
        await prisma.chatTurnState.upsert({
          where: { chat_id: this.chatId },
          update: { 
            next_user_id: newTurnState?.next_user_id,
            updated_at: new Date()
          },
          create: {
            chat_id: this.chatId,
            next_user_id: newTurnState?.next_user_id || 'anyone'
          }
        });
      } catch (dbError) {
        console.warn('[ConversationOrchestrator] Failed to update turn state in DB:', dbError);
      }
    }

    console.log(`[ConversationOrchestrator] Turn advanced: next_user_id=${newTurnState?.next_user_id}`);
    return newTurnState;
  }

  /**
   * Broadcast turn state update via centralized service
   */
  private async broadcastTurnUpdate(turnState: any) {
    if (turnState) {
      await this.realtimeService.broadcastTurnUpdate({
        next_user_id: turnState.next_user_id,
        next_role: turnState.next_role,
        timestamp: new Date().toISOString()
      });
      
      console.log(`[ConversationOrchestrator] Turn update broadcast: ${turnState.next_user_id}`);
    }
  }

  /**
   * Trigger AI response (fire-and-forget)
   */
  private async triggerAIResponse(chatId: string, userId: string, userMessage: string, userAgent?: string) {
    console.log(`[ConversationOrchestrator] Triggering AI response...`);
    
    try {
      // Use new focused AI service
      const { AIResponseService } = await import('../../ai/services/AIResponseService');
      
      const aiService = new AIResponseService({
        chatId,
        userId,
        userMessage,
        userAgent
      });
      
      const result = await aiService.generate();
      
      if (result.error) {
        console.error(`[ConversationOrchestrator] AI response failed: ${result.error}`);
      } else {
        console.log(`[ConversationOrchestrator] AI response completed: ${result.content.length} chars`);
        
        // Update turn state after AI response
        await this.handleAIResponseComplete();
      }
      
    } catch (error) {
      console.error(`[ConversationOrchestrator] AI response failed:`, error);
    }
  }

  /**
   * Handle post-AI response turn management
   */
  private async handleAIResponseComplete() {
    try {
      // Calculate new turn state after AI response
      const newTurnState = await this.getCurrentTurn();
      
      // Broadcast turn update
      await this.broadcastTurnUpdate(newTurnState);
      
      console.log(`[ConversationOrchestrator] Turn state updated after AI response`);
    } catch (error) {
      console.error(`[ConversationOrchestrator] Error handling AI response completion:`, error);
    }
  }

  /**
   * Get current conversation state for frontend
   */
  async getConversationState(userId: string): Promise<ConversationState> {
    try {
      const canSend = await this.canUserSendMessage(userId);
      const currentTurn = await this.getCurrentTurn();
      const mode = await this.getTurnMode();
      const shouldTriggerAI = await this.shouldTriggerAIResponse();

      return {
        canSend,
        nextUserId: currentTurn?.next_user_id || null,
        mode,
        shouldTriggerAI
      };
    } catch (error) {
      console.error('[ConversationOrchestrator] Error getting conversation state:', error);
      return {
        canSend: false,
        nextUserId: null,
        mode: 'flexible',
        shouldTriggerAI: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Handle user joining conversation via state manager
   */
  async handleUserJoin(userId: string, role: string = 'user') {
    console.log(`[ConversationOrchestrator] User ${userId} joining chat ${this.chatId}`);
    
    try {
      // Use state manager to add participant
      await this.stateManager.addParticipant(userId, role);

      // Reset turn state if needed to include new participant
      const mode = await this.getTurnMode();
      if (mode === 'strict' || mode === 'rounds') {
        await this.resetTurn();
      }

    } catch (error) {
      console.error('[ConversationOrchestrator] Error handling user join:', error);
    }
  }

  /**
   * Handle conversation settings update via state manager
   */
  async handleSettingsUpdate(userId: string, settings: any) {
    console.log(`[ConversationOrchestrator] Updating settings for chat ${this.chatId}`);
    
    try {
      // Use state manager to update settings
      await this.stateManager.updateSettings(settings);

      // Reset turn state if mode changed
      if (settings.turn_taking) {
        await this.resetTurn();
      }

      console.log(`[ConversationOrchestrator] Settings updated successfully`);
    } catch (error) {
      console.error('[ConversationOrchestrator] Error updating settings:', error);
      throw error;
    }
  }
}