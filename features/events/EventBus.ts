// Core event bus for domain-driven architecture
import { EventEmitter } from 'events';

// Domain event interface
export interface DomainEvent {
  type: string;
  chatId: string;
  userId?: string;
  timestamp: Date;
  data: any;
  correlationId?: string;
  source?: string;
}

// Event handler interface
export interface EventHandler {
  handle(event: DomainEvent): Promise<void>;
  name: string;
  priority?: number; // Lower numbers = higher priority
}

// Event subscription options
export interface SubscriptionOptions {
  priority?: number;
  filter?: (event: DomainEvent) => boolean;
  async?: boolean; // Whether to handle async (fire-and-forget)
}

// Event bus statistics
export interface EventBusStats {
  totalEmitted: number;
  totalHandled: number;
  totalErrors: number;
  handlerCount: number;
  eventTypes: Set<string>;
}

export class EventBus {
  private emitter: EventEmitter;
  private handlers: Map<string, Array<{ handler: EventHandler; options: SubscriptionOptions }>> = new Map();
  private stats: EventBusStats = {
    totalEmitted: 0,
    totalHandled: 0,
    totalErrors: 0,
    handlerCount: 0,
    eventTypes: new Set()
  };
  private isShuttingDown = false;

  constructor() {
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(100); // Support many extensions
  }

  /**
   * Emit a domain event to all registered handlers
   */
  async emit(event: DomainEvent): Promise<void> {
    if (this.isShuttingDown) {
      console.warn('[EventBus] Cannot emit event during shutdown:', event.type);
      return;
    }

    // Add default fields if missing
    if (!event.timestamp) {
      event.timestamp = new Date();
    }
    if (!event.correlationId) {
      event.correlationId = `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    if (!event.source) {
      event.source = 'system';
    }

    console.log(`[EventBus] Emitting event: ${event.type} for chat ${event.chatId} (${event.correlationId})`);

    this.stats.totalEmitted++;
    this.stats.eventTypes.add(event.type);

    // Get handlers for this event type
    const eventHandlers = this.handlers.get(event.type) || [];
    
    if (eventHandlers.length === 0) {
      console.log(`[EventBus] No handlers registered for event type: ${event.type}`);
      return;
    }

    // Filter and sort handlers
    const applicableHandlers = eventHandlers
      .filter(({ options }) => !options.filter || options.filter(event))
      .sort((a, b) => (a.options.priority || 100) - (b.options.priority || 100));

    console.log(`[EventBus] Processing ${applicableHandlers.length} handlers for ${event.type}`);

    // Process handlers
    const handlerPromises: Promise<void>[] = [];

    for (const { handler, options } of applicableHandlers) {
      const handlerPromise = this.executeHandler(handler, event)
        .catch(error => {
          this.stats.totalErrors++;
          console.error(`[EventBus] Handler ${handler.name} failed for event ${event.type}:`, error);
          
          // Emit error event for monitoring
          this.emitInternal({
            type: 'system.handler_error',
            chatId: event.chatId,
            timestamp: new Date(),
            data: {
              handlerName: handler.name,
              originalEvent: event,
              error: error.message
            },
            correlationId: event.correlationId,
            source: 'event_bus'
          });
        });

      if (options.async) {
        // Fire and forget
        handlerPromises.push(handlerPromise);
      } else {
        // Wait for completion
        await handlerPromise;
      }
    }

    // Wait for any async handlers
    if (handlerPromises.length > 0) {
      await Promise.allSettled(handlerPromises);
    }

    console.log(`[EventBus] Completed processing event: ${event.type} (${event.correlationId})`);
  }

  /**
   * Subscribe to an event type
   */
  subscribe(eventType: string, handler: EventHandler, options: SubscriptionOptions = {}): void {
    console.log(`[EventBus] Subscribing handler ${handler.name} to event type: ${eventType}`);

    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }

    const handlers = this.handlers.get(eventType)!;
    
    // Check for duplicate handler by instance AND name
    const existingHandler = handlers.find(h => h.handler === handler || (h.handler.name === handler.name && h.handler.constructor === handler.constructor));
    if (existingHandler) {
      console.warn(`[EventBus] Handler ${handler.name} already subscribed to ${eventType} - skipping duplicate`);
      return;
    }

    handlers.push({ handler, options });
    this.stats.handlerCount++;

    console.log(`[EventBus] Handler ${handler.name} subscribed to ${eventType} (${handlers.length} total handlers)`);
  }

  /**
   * Unsubscribe from an event type
   */
  unsubscribe(eventType: string, handler: EventHandler): void {
    console.log(`[EventBus] Unsubscribing handler ${handler.name} from event type: ${eventType}`);

    const handlers = this.handlers.get(eventType);
    if (!handlers) {
      console.warn(`[EventBus] No handlers found for event type: ${eventType}`);
      return;
    }

    const index = handlers.findIndex(h => h.handler === handler);
    if (index === -1) {
      console.warn(`[EventBus] Handler ${handler.name} not found for event type: ${eventType}`);
      return;
    }

    handlers.splice(index, 1);
    this.stats.handlerCount--;

    if (handlers.length === 0) {
      this.handlers.delete(eventType);
    }

    console.log(`[EventBus] Handler ${handler.name} unsubscribed from ${eventType}`);
  }

  /**
   * Subscribe to multiple event types
   */
  subscribeToMultiple(eventTypes: string[], handler: EventHandler, options: SubscriptionOptions = {}): void {
    for (const eventType of eventTypes) {
      this.subscribe(eventType, handler, options);
    }
  }

  /**
   * Get list of registered event types
   */
  getEventTypes(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Get handlers for a specific event type
   */
  getHandlers(eventType: string): EventHandler[] {
    const handlers = this.handlers.get(eventType) || [];
    return handlers.map(h => h.handler);
  }

  /**
   * Get event bus statistics
   */
  getStats(): EventBusStats {
    return { ...this.stats };
  }

  /**
   * Clear all handlers (useful for testing)
   */
  clear(): void {
    console.log('[EventBus] Clearing all handlers');
    this.handlers.clear();
    this.stats = {
      totalEmitted: 0,
      totalHandled: 0,
      totalErrors: 0,
      handlerCount: 0,
      eventTypes: new Set()
    };
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    console.log('[EventBus] Initiating graceful shutdown');
    this.isShuttingDown = true;
    
    // Wait a bit for any in-flight events to complete
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    this.clear();
    console.log('[EventBus] Shutdown complete');
  }

  /**
   * Check if event bus is healthy
   */
  isHealthy(): boolean {
    return !this.isShuttingDown && this.stats.totalErrors < this.stats.totalEmitted * 0.1; // Less than 10% error rate
  }

  // Private methods

  private async executeHandler(handler: EventHandler, event: DomainEvent): Promise<void> {
    const startTime = Date.now();
    
    try {
      await handler.handle(event);
      this.stats.totalHandled++;
      
      const duration = Date.now() - startTime;
      if (duration > 1000) {
        console.warn(`[EventBus] Slow handler detected: ${handler.name} took ${duration}ms for event ${event.type}`);
      }
      
    } catch (error) {
      console.error(`[EventBus] Handler ${handler.name} failed:`, error);
      throw error; // Re-throw for error handling above
    }
  }

  private emitInternal(event: DomainEvent): void {
    // Internal emit that doesn't trigger handlers (to avoid infinite loops)
    this.emitter.emit('internal_event', event);
  }

  /**
   * Subscribe to internal events (for monitoring)
   */
  onInternalEvent(callback: (event: DomainEvent) => void): void {
    this.emitter.on('internal_event', callback);
  }

  /**
   * Create a scoped event bus for testing
   */
  static createTestBus(): EventBus {
    const bus = new EventBus();
    // Add test-specific configuration
    return bus;
  }

  /**
   * Create singleton instance
   */
  private static instance?: EventBus;
  
  static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }
}