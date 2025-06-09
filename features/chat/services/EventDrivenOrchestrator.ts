// Event-driven conversation orchestrator
import { EventBus, DomainEvent, EventHandler } from '@/features/events/EventBus';
import { DOMAIN_EVENTS, EventBuilder } from '@/features/events/DomainEvents';
import { ChatSessionStateManager } from './ChatSessionStateManager';
import { RealtimeEventService } from './RealtimeEventService';
import { TurnManager } from './turnManager';

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

export class EventDrivenOrchestrator {
  private eventBus: EventBus;
  private stateManager: ChatSessionStateManager;
  private realtimeService: RealtimeEventService;
  private turnManager: TurnManager;
  private registeredHandlers: Array<{eventType: string, handler: EventHandler}> = [];

  constructor(chatId: string, eventBus?: EventBus) {
    this.eventBus = eventBus || EventBus.getInstance();
    this.stateManager = new ChatSessionStateManager(chatId);
    this.realtimeService = new RealtimeEventService(chatId);
    this.turnManager = new TurnManager(chatId);

    // Register built-in event handlers
    this.registerHandlers();
  }

  /**
   * Main orchestration method - now event-driven
   */
  async processMessage(context: MessageContext): Promise<ConversationState> {
    console.log(`[EventDrivenOrchestrator] Processing message from ${context.userId} in chat ${context.chatId}`);
    
    try {
      // Generate correlation ID for this flow
      const correlationId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Emit the initial event - everything else is handled by event handlers
      const messageEvent = EventBuilder.messageReceived(
        context.chatId,
        context.userId,
        context.content,
        {
          isGuest: context.isGuest,
          userAgent: context.userAgent,
          correlationId
        }
      );

      await this.eventBus.emit(messageEvent);

      // Get final state after event processing
      const state = await this.stateManager.getState();
      const canSend = await this.turnManager.canUserSendMessage(context.userId);
      const shouldTriggerAI = await this.turnManager.shouldTriggerAIResponse();

      return {
        canSend,
        nextUserId: state.turnState.next_user_id,
        mode: state.turnState.mode,
        shouldTriggerAI,
      };

    } catch (error) {
      console.error(`[EventDrivenOrchestrator] Error processing message:`, error);
      
      // Emit error event
      await this.eventBus.emit({
        type: DOMAIN_EVENTS.ERROR_OCCURRED,
        chatId: context.chatId,
        userId: context.userId,
        timestamp: new Date(),
        data: {
          error: error instanceof Error ? error.message : 'Unknown error',
          context: 'message_processing'
        },
        source: 'orchestrator'
      });

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
   * Add participant via events
   */
  async addParticipant(userId: string, role: string = 'user', displayName?: string): Promise<void> {
    console.log(`[EventDrivenOrchestrator] Adding participant ${userId}`);

    const userJoinedEvent = EventBuilder.userJoined(
      this.stateManager.chatId,
      userId,
      role,
      displayName || 'User',
      false // TODO: Determine if guest
    );

    await this.eventBus.emit(userJoinedEvent);
  }

  /**
   * Update settings via events
   */
  async updateSettings(userId: string, newSettings: any): Promise<void> {
    console.log(`[EventDrivenOrchestrator] Updating settings`);

    const currentState = await this.stateManager.getState();
    const previousSettings = currentState.settings;

    const settingsEvent = EventBuilder.settingsUpdated(
      this.stateManager.chatId,
      userId,
      previousSettings,
      newSettings
    );

    await this.eventBus.emit(settingsEvent);
  }

  /**
   * Mark completion via events
   */
  async markComplete(userId: string, completionType: string = 'natural', userName?: string): Promise<void> {
    console.log(`[EventDrivenOrchestrator] Marking user ${userId} complete`);

    const completeEvent = EventBuilder.userMarkedComplete(
      this.stateManager.chatId,
      userId,
      completionType,
      userName || 'User'
    );

    await this.eventBus.emit(completeEvent);
  }

  /**
   * Get current conversation state
   */
  async getConversationState(userId: string): Promise<ConversationState> {
    try {
      const state = await this.stateManager.getState();
      const canSend = await this.turnManager.canUserSendMessage(userId);
      const shouldTriggerAI = await this.turnManager.shouldTriggerAIResponse();

      return {
        canSend,
        nextUserId: state.turnState.next_user_id,
        mode: state.turnState.mode,
        shouldTriggerAI
      };
    } catch (error) {
      console.error('[EventDrivenOrchestrator] Error getting conversation state:', error);
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
   * Register all built-in event handlers
   */
  private registerHandlers(): void {
    console.log(`[EventDrivenOrchestrator] Registering built-in event handlers`);

    // Helper function to register and track handlers
    const registerHandler = (eventType: string, handler: EventHandler, options?: any) => {
      this.eventBus.subscribe(eventType, handler, options);
      this.registeredHandlers.push({ eventType, handler });
    };

    // Register handlers with different priorities
    registerHandler(DOMAIN_EVENTS.MESSAGE_RECEIVED, new MessageValidationHandler(this), { priority: 10 });
    registerHandler(DOMAIN_EVENTS.MESSAGE_VALIDATED, new MessageStorageHandler(this), { priority: 20 });
    registerHandler(DOMAIN_EVENTS.MESSAGE_STORED, new TurnUpdateHandler(this), { priority: 30 });
    registerHandler(DOMAIN_EVENTS.MESSAGE_STORED, new AITriggerHandler(this), { priority: 40, async: true });
    
    // Turn management
    registerHandler(DOMAIN_EVENTS.TURN_CHANGED, new RealtimeTurnHandler(this), { priority: 10, async: true });
    
    // AI response handling
    registerHandler(DOMAIN_EVENTS.AI_RESPONSE_REQUESTED, new AIResponseHandler(this), { priority: 10, async: true });
    registerHandler(DOMAIN_EVENTS.AI_RESPONSE_COMPLETED, new PostAIHandler(this), { priority: 10 });
    
    // User management
    registerHandler(DOMAIN_EVENTS.USER_JOINED, new UserJoinHandler(this), { priority: 10 });
    
    // Completion handling
    registerHandler(DOMAIN_EVENTS.USER_MARKED_COMPLETE, new CompletionHandler(this), { priority: 10 });
    registerHandler(DOMAIN_EVENTS.ALL_USERS_COMPLETE, new SummaryTriggerHandler(this), { priority: 10, async: true });
    
    // Settings handling
    registerHandler(DOMAIN_EVENTS.SETTINGS_UPDATED, new SettingsHandler(this), { priority: 10 });
    
    // Real-time broadcasting
    registerHandler(DOMAIN_EVENTS.MESSAGE_STORED, new RealtimeMessageHandler(this), { priority: 50, async: true });
    registerHandler(DOMAIN_EVENTS.AI_RESPONSE_STARTED, new RealtimeAITypingHandler(this), { priority: 10, async: true });
    registerHandler(DOMAIN_EVENTS.AI_RESPONSE_COMPLETED, new RealtimeAITypingHandler(this), { priority: 10, async: true });

    console.log(`[EventDrivenOrchestrator] Registered ${this.registeredHandlers.length} event handlers for this instance`);
  }

  /**
   * Cleanup method to remove handlers when orchestrator is done
   */
  cleanup(): void {
    console.log(`[EventDrivenOrchestrator] Cleaning up ${this.registeredHandlers.length} event handlers`);
    
    for (const { eventType, handler } of this.registeredHandlers) {
      this.eventBus.unsubscribe(eventType, handler);
    }
    
    this.registeredHandlers = [];
  }

  /**
   * Get access to internal services (for handlers)
   */
  getStateManager(): ChatSessionStateManager {
    return this.stateManager;
  }

  getRealtimeService(): RealtimeEventService {
    return this.realtimeService;
  }

  getTurnManager(): TurnManager {
    return this.turnManager;
  }

  getEventBus(): EventBus {
    return this.eventBus;
  }
}

// Event Handlers

class MessageValidationHandler implements EventHandler {
  name = 'MessageValidationHandler';

  constructor(private orchestrator: EventDrivenOrchestrator) {}

  async handle(event: DomainEvent): Promise<void> {
    if (event.type !== DOMAIN_EVENTS.MESSAGE_RECEIVED) return;

    console.log(`[${this.name}] Validating message from ${event.userId}`);

    const turnManager = this.orchestrator.getTurnManager();
    const canSend = await turnManager.canUserSendMessage(event.userId!);

    if (canSend) {
      const validatedEvent = EventBuilder.messageValidated(
        event.chatId,
        event.userId!,
        event.data.content,
        true,
        event.correlationId
      );

      await this.orchestrator.getEventBus().emit(validatedEvent);
    } else {
      throw new Error('Not your turn to speak');
    }
  }
}

class MessageStorageHandler implements EventHandler {
  name = 'MessageStorageHandler';

  constructor(private orchestrator: EventDrivenOrchestrator) {}

  async handle(event: DomainEvent): Promise<void> {
    if (event.type !== DOMAIN_EVENTS.MESSAGE_VALIDATED) return;

    console.log(`[${this.name}] Storing message from ${event.userId}`);

    const stateManager = this.orchestrator.getStateManager();
    const message = await stateManager.addMessage({
      content: event.data.content,
      senderId: event.userId!,
      type: 'message'
    });

    const storedEvent = EventBuilder.messageStored(
      event.chatId,
      event.userId!,
      message.id,
      message.content,
      event.correlationId
    );

    await this.orchestrator.getEventBus().emit(storedEvent);
  }
}

class TurnUpdateHandler implements EventHandler {
  name = 'TurnUpdateHandler';

  constructor(private orchestrator: EventDrivenOrchestrator) {}

  async handle(event: DomainEvent): Promise<void> {
    if (event.type !== DOMAIN_EVENTS.MESSAGE_STORED) return;

    console.log(`[${this.name}] Updating turn state after message`);

    const turnManager = this.orchestrator.getTurnManager();
    const newTurnState = await turnManager.updateTurnAfterMessage(event.userId!);
    const mode = await turnManager.getTurnMode();

    // Update state via state manager (turn manager already updated DB, just sync cache)
    const stateManager = this.orchestrator.getStateManager();
    await stateManager.updateTurnState({
      next_user_id: newTurnState?.next_user_id,
      next_role: newTurnState?.next_role
    }, { persist: false }); // Don't persist since turn manager already did

    const turnChangedEvent = EventBuilder.turnChanged(
      event.chatId,
      newTurnState?.next_user_id || null,
      mode as any,
      {
        previousUserId: event.userId,
        correlationId: event.correlationId
      }
    );

    await this.orchestrator.getEventBus().emit(turnChangedEvent);
  }
}

class AITriggerHandler implements EventHandler {
  name = 'AITriggerHandler';

  constructor(private orchestrator: EventDrivenOrchestrator) {}

  async handle(event: DomainEvent): Promise<void> {
    if (event.type !== DOMAIN_EVENTS.MESSAGE_STORED) return;

    console.log(`[${this.name}] Checking if AI should respond`);

    try {
      const turnManager = this.orchestrator.getTurnManager();
      const shouldTrigger = await turnManager.shouldTriggerAIResponse();

      if (shouldTrigger) {
        console.log(`[${this.name}] AI should respond - triggering AI response`);
        const aiRequestEvent = EventBuilder.aiResponseRequested(
          event.chatId,
          event.userId!,
          event.data.content,
          { correlationId: event.correlationId }
        );

        await this.orchestrator.getEventBus().emit(aiRequestEvent);
      } else {
        console.log(`[${this.name}] AI should not respond - skipping`);
      }
    } catch (error) {
      console.error(`[${this.name}] Error in AI trigger logic:`, error);
    }
  }
}

class AIResponseHandler implements EventHandler {
  name = 'AIResponseHandler';

  constructor(private orchestrator: EventDrivenOrchestrator) {}

  async handle(event: DomainEvent): Promise<void> {
    if (event.type !== DOMAIN_EVENTS.AI_RESPONSE_REQUESTED) return;

    console.log(`[${this.name}] Triggering AI response`);

    try {
      // Use new focused AI service
      const { AIResponseService } = await import('../../ai/services/AIResponseService');
      
      const replyId = `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Emit AI started event
      const startedEvent = EventBuilder.aiResponseStarted(
        event.chatId,
        replyId,
        event.data.userMessage,
        event.correlationId
      );
      await this.orchestrator.getEventBus().emit(startedEvent);

      const aiService = new AIResponseService({
        chatId: event.chatId,
        userId: event.userId!,
        userMessage: event.data.userMessage,
        userAgent: event.data.userAgent,
        replyId
      });
      
      const startTime = Date.now();
      const result = await aiService.generate();
      const duration = Date.now() - startTime;

      if (result.error) {
        console.error(`[${this.name}] AI response failed: ${result.error}`);
        await this.orchestrator.getEventBus().emit({
          type: DOMAIN_EVENTS.AI_RESPONSE_FAILED,
          chatId: event.chatId,
          timestamp: new Date(),
          data: { replyId, error: result.error },
          correlationId: event.correlationId,
          source: 'ai_service'
        });
      } else {
        // Store AI message and emit completion event
        const stateManager = this.orchestrator.getStateManager();
        const aiMessage = await stateManager.addMessage({
          content: result.content,
          senderId: 'assistant',
          type: 'message'
        });

        const completedEvent = EventBuilder.aiResponseCompleted(
          event.chatId,
          replyId,
          result.content,
          aiMessage.id,
          duration,
          event.correlationId
        );
        await this.orchestrator.getEventBus().emit(completedEvent);
      }
      
      
    } catch (error) {
      console.error(`[${this.name}] AI response failed:`, error);
      
      await this.orchestrator.getEventBus().emit({
        type: DOMAIN_EVENTS.AI_RESPONSE_FAILED,
        chatId: event.chatId,
        timestamp: new Date(),
        data: { error: error instanceof Error ? error.message : 'AI generation failed' },
        correlationId: event.correlationId,
        source: 'ai_service'
      });
    }
  }
}

class PostAIHandler implements EventHandler {
  name = 'PostAIHandler';

  constructor(private orchestrator: EventDrivenOrchestrator) {}

  async handle(event: DomainEvent): Promise<void> {
    if (event.type !== DOMAIN_EVENTS.AI_RESPONSE_COMPLETED) return;

    console.log(`[${this.name}] Handling post-AI response tasks`);

    // Update turn state after AI response
    const turnManager = this.orchestrator.getTurnManager();
    const newTurnState = await turnManager.updateTurnAfterMessage('assistant');
    const mode = await turnManager.getTurnMode();

    const stateManager = this.orchestrator.getStateManager();
    await stateManager.updateTurnState({
      next_user_id: newTurnState?.next_user_id,
      next_role: newTurnState?.next_role
    }, { persist: false }); // Don't persist since turn manager already did

    const turnChangedEvent = EventBuilder.turnChanged(
      event.chatId,
      newTurnState?.next_user_id || null,
      mode as any,
      {
        previousUserId: 'assistant',
        correlationId: event.correlationId
      }
    );

    await this.orchestrator.getEventBus().emit(turnChangedEvent);
  }
}

class UserJoinHandler implements EventHandler {
  name = 'UserJoinHandler';

  constructor(private orchestrator: EventDrivenOrchestrator) {}

  async handle(event: DomainEvent): Promise<void> {
    if (event.type !== DOMAIN_EVENTS.USER_JOINED) return;

    console.log(`[${this.name}] Processing user join: ${event.data.userId}`);

    const stateManager = this.orchestrator.getStateManager();
    await stateManager.addParticipant(event.data.userId, event.data.role);

    // Reset turn state if needed
    const turnManager = this.orchestrator.getTurnManager();
    const mode = await turnManager.getTurnMode();
    if (mode === 'strict' || mode === 'rounds') {
      await turnManager.resetTurn();
    }
  }
}

class CompletionHandler implements EventHandler {
  name = 'CompletionHandler';

  constructor(private orchestrator: EventDrivenOrchestrator) {}

  async handle(event: DomainEvent): Promise<void> {
    if (event.type !== DOMAIN_EVENTS.USER_MARKED_COMPLETE) return;

    console.log(`[${this.name}] Processing completion for user: ${event.data.userId}`);

    const stateManager = this.orchestrator.getStateManager();
    const completionStatus = await stateManager.updateCompletionStatus(
      event.data.userId,
      event.data.completionType
    );

    if (completionStatus.all_complete) {
      await this.orchestrator.getEventBus().emit({
        type: DOMAIN_EVENTS.ALL_USERS_COMPLETE,
        chatId: event.chatId,
        timestamp: new Date(),
        data: {
          completedCount: completionStatus.completed_users.size,
          totalParticipants: completionStatus.total_participants,
          completionData: Object.fromEntries(completionStatus.completion_types)
        },
        correlationId: event.correlationId,
        source: 'completion_handler'
      });
    }
  }
}

class SummaryTriggerHandler implements EventHandler {
  name = 'SummaryTriggerHandler';

  constructor(private orchestrator: EventDrivenOrchestrator) {}

  async handle(event: DomainEvent): Promise<void> {
    if (event.type !== DOMAIN_EVENTS.ALL_USERS_COMPLETE) return;

    console.log(`[${this.name}] All users complete - triggering summary generation`);

    await this.orchestrator.getEventBus().emit({
      type: DOMAIN_EVENTS.SUMMARY_REQUESTED,
      chatId: event.chatId,
      timestamp: new Date(),
      data: {
        trigger: 'all_complete',
        completionData: event.data
      },
      correlationId: event.correlationId,
      source: 'summary_trigger'
    });
  }
}

class SettingsHandler implements EventHandler {
  name = 'SettingsHandler';

  constructor(private orchestrator: EventDrivenOrchestrator) {}

  async handle(event: DomainEvent): Promise<void> {
    if (event.type !== DOMAIN_EVENTS.SETTINGS_UPDATED) return;

    console.log(`[${this.name}] Processing settings update`);

    const stateManager = this.orchestrator.getStateManager();
    await stateManager.updateSettings(event.data.newSettings);

    // Reset turn state if turn mode changed
    if (event.data.changes.includes('turn_taking')) {
      const turnManager = this.orchestrator.getTurnManager();
      await turnManager.resetTurn();
    }
  }
}

// Real-time event handlers

class RealtimeMessageHandler implements EventHandler {
  name = 'RealtimeMessageHandler';

  constructor(private orchestrator: EventDrivenOrchestrator) {}

  async handle(event: DomainEvent): Promise<void> {
    if (event.type !== DOMAIN_EVENTS.MESSAGE_STORED) return;

    const realtimeService = this.orchestrator.getRealtimeService();
    realtimeService.broadcastMessage({
      id: event.data.messageId,
      created_at: event.data.timestamp,
      data: {
        content: event.data.content,
        senderId: event.data.senderId
      }
    }).catch(error => {
      console.error(`[${this.name}] Real-time message broadcast failed (non-blocking):`, error);
    });
  }
}

class RealtimeTurnHandler implements EventHandler {
  name = 'RealtimeTurnHandler';

  constructor(private orchestrator: EventDrivenOrchestrator) {}

  async handle(event: DomainEvent): Promise<void> {
    if (event.type !== DOMAIN_EVENTS.TURN_CHANGED) return;

    const realtimeService = this.orchestrator.getRealtimeService();
    realtimeService.broadcastTurnUpdate({
      next_user_id: event.data.nextUserId,
      next_role: event.data.nextRole,
      timestamp: event.timestamp.toISOString()
    }).catch(error => {
      console.error(`[${this.name}] Real-time turn update broadcast failed (non-blocking):`, error);
    });
  }
}

class RealtimeAITypingHandler implements EventHandler {
  name = 'RealtimeAITypingHandler';

  constructor(private orchestrator: EventDrivenOrchestrator) {}

  async handle(event: DomainEvent): Promise<void> {
    const realtimeService = this.orchestrator.getRealtimeService();

    if (event.type === DOMAIN_EVENTS.AI_RESPONSE_STARTED) {
      realtimeService.broadcastAssistantTyping({
        isTyping: true,
        timestamp: Date.now(),
        source: 'ai_start',
        replyId: event.data.replyId
      }).catch(error => {
        console.error(`[${this.name}] AI typing broadcast failed (non-blocking):`, error);
      });
    } else if (event.type === DOMAIN_EVENTS.AI_RESPONSE_COMPLETED) {
      realtimeService.broadcastAssistantTyping({
        isTyping: false,
        replyId: event.data.replyId
      }).catch(error => {
        console.error(`[${this.name}] AI typing broadcast failed (non-blocking):`, error);
      });
    }
  }
}