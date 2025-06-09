// Event-driven extension system
import { EventBus, DomainEvent, EventHandler } from '@/features/events/EventBus';
import { DOMAIN_EVENTS, DomainEventType } from '@/features/events/DomainEvents';

// Extension interfaces
export interface ChatExtension {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  
  // Event subscriptions
  subscribedEvents: DomainEventType[];
  
  // Lifecycle methods
  initialize?(chatId: string, config: any): Promise<void>;
  activate?(chatId: string): Promise<void>;
  deactivate?(chatId: string): Promise<void>;
  cleanup?(): Promise<void>;
  
  // Event handling
  handleEvent(event: DomainEvent): Promise<ExtensionResult>;
  
  // Configuration
  getDefaultConfig?(): any;
  validateConfig?(config: any): boolean;
  
  // Capabilities
  capabilities?: ExtensionCapabilities;
}

export interface ExtensionCapabilities {
  canModifyTurnLogic?: boolean;
  canInterceptMessages?: boolean;
  canGenerateMessages?: boolean;
  canModifyUI?: boolean;
  canAccessExternalAPIs?: boolean;
  requiredPermissions?: string[];
}

export interface ExtensionResult {
  success: boolean;
  data?: any;
  error?: string;
  modifiedEvent?: DomainEvent; // If extension wants to modify the event
  additionalEvents?: DomainEvent[]; // If extension wants to emit new events
  shouldContinue?: boolean; // If false, stops further processing
}

export interface ExtensionContext {
  chatId: string;
  userId?: string;
  extensionConfig: any;
  chatState: any;
  services: {
    eventBus: EventBus;
    emitEvent: (event: DomainEvent) => Promise<void>;
    getChatState: () => Promise<any>;
  };
}

// Extension registry and manager
export class ExtensionManager implements EventHandler {
  name = 'ExtensionManager';
  
  private extensions: Map<string, ChatExtension> = new Map();
  private activeExtensions: Map<string, Set<string>> = new Map(); // chatId -> Set<extensionId>
  private extensionConfigs: Map<string, Map<string, any>> = new Map(); // chatId -> extensionId -> config
  private eventBus: EventBus;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    
    // Subscribe to all events to route to extensions
    this.subscribeToAllEvents();
  }

  /**
   * Register an extension
   */
  async registerExtension(extension: ChatExtension): Promise<void> {
    console.log(`[ExtensionManager] Registering extension: ${extension.id}`);
    
    // Validate extension
    if (!extension.id || !extension.handleEvent) {
      throw new Error('Extension must have id and handleEvent method');
    }

    if (this.extensions.has(extension.id)) {
      console.warn(`[ExtensionManager] Extension ${extension.id} already registered`);
      return;
    }

    this.extensions.set(extension.id, extension);
    console.log(`[ExtensionManager] Extension ${extension.id} registered successfully`);
  }

  /**
   * Activate extension for a chat
   */
  async activateExtension(chatId: string, extensionId: string, config?: any): Promise<void> {
    console.log(`[ExtensionManager] Activating extension ${extensionId} for chat ${chatId}`);
    
    const extension = this.extensions.get(extensionId);
    if (!extension) {
      throw new Error(`Extension ${extensionId} not found`);
    }

    // Get or create active extensions set for this chat
    if (!this.activeExtensions.has(chatId)) {
      this.activeExtensions.set(chatId, new Set());
    }
    
    const activeSet = this.activeExtensions.get(chatId)!;
    if (activeSet.has(extensionId)) {
      console.warn(`[ExtensionManager] Extension ${extensionId} already active for chat ${chatId}`);
      return;
    }

    // Store configuration
    if (!this.extensionConfigs.has(chatId)) {
      this.extensionConfigs.set(chatId, new Map());
    }
    
    const finalConfig = config || extension.getDefaultConfig?.() || {};
    this.extensionConfigs.get(chatId)!.set(extensionId, finalConfig);

    // Initialize and activate extension
    try {
      if (extension.initialize) {
        await extension.initialize(chatId, finalConfig);
      }
      
      if (extension.activate) {
        await extension.activate(chatId);
      }

      activeSet.add(extensionId);
      console.log(`[ExtensionManager] Extension ${extensionId} activated for chat ${chatId}`);

      // Emit activation event
      await this.eventBus.emit({
        type: DOMAIN_EVENTS.EXTENSION_ACTIVATED,
        chatId,
        timestamp: new Date(),
        data: { extensionId, config: finalConfig },
        source: 'extension_manager'
      });

    } catch (error) {
      console.error(`[ExtensionManager] Failed to activate extension ${extensionId}:`, error);
      throw error;
    }
  }

  /**
   * Deactivate extension for a chat
   */
  async deactivateExtension(chatId: string, extensionId: string): Promise<void> {
    console.log(`[ExtensionManager] Deactivating extension ${extensionId} for chat ${chatId}`);
    
    const activeSet = this.activeExtensions.get(chatId);
    if (!activeSet || !activeSet.has(extensionId)) {
      console.warn(`[ExtensionManager] Extension ${extensionId} not active for chat ${chatId}`);
      return;
    }

    const extension = this.extensions.get(extensionId);
    if (extension?.deactivate) {
      try {
        await extension.deactivate(chatId);
      } catch (error) {
        console.error(`[ExtensionManager] Error deactivating extension ${extensionId}:`, error);
      }
    }

    activeSet.delete(extensionId);
    this.extensionConfigs.get(chatId)?.delete(extensionId);

    console.log(`[ExtensionManager] Extension ${extensionId} deactivated for chat ${chatId}`);

    // Emit deactivation event
    await this.eventBus.emit({
      type: DOMAIN_EVENTS.EXTENSION_DEACTIVATED,
      chatId,
      timestamp: new Date(),
      data: { extensionId },
      source: 'extension_manager'
    });
  }

  /**
   * Get active extensions for a chat
   */
  getActiveExtensions(chatId: string): ChatExtension[] {
    const activeSet = this.activeExtensions.get(chatId);
    if (!activeSet) return [];

    return Array.from(activeSet)
      .map(id => this.extensions.get(id))
      .filter(ext => ext !== undefined) as ChatExtension[];
  }

  /**
   * Get all registered extensions
   */
  getAllExtensions(): ChatExtension[] {
    return Array.from(this.extensions.values());
  }

  /**
   * Handle domain events - route to active extensions
   */
  async handle(event: DomainEvent): Promise<void> {
    const activeExtensions = this.getActiveExtensions(event.chatId);
    if (activeExtensions.length === 0) return;

    // Filter extensions that are interested in this event type
    const interestedExtensions = activeExtensions.filter(ext => 
      ext.subscribedEvents.includes(event.type as DomainEventType)
    );

    if (interestedExtensions.length === 0) return;

    console.log(`[ExtensionManager] Routing event ${event.type} to ${interestedExtensions.length} extensions`);

    // Process extensions in parallel
    const promises = interestedExtensions.map(async (extension) => {
      try {
        const config = this.extensionConfigs.get(event.chatId)?.get(extension.id) || {};
        
        const context: ExtensionContext = {
          chatId: event.chatId,
          userId: event.userId,
          extensionConfig: config,
          chatState: {}, // TODO: Populate with relevant chat state
          services: {
            eventBus: this.eventBus,
            emitEvent: (evt: DomainEvent) => this.eventBus.emit(evt),
            getChatState: async () => ({}) // TODO: Implement
          }
        };

        const result = await extension.handleEvent(event);
        
        if (result.additionalEvents) {
          for (const additionalEvent of result.additionalEvents) {
            await this.eventBus.emit(additionalEvent);
          }
        }

        if (!result.success && result.error) {
          console.error(`[ExtensionManager] Extension ${extension.id} failed:`, result.error);
        }

        return result;

      } catch (error) {
        console.error(`[ExtensionManager] Extension ${extension.id} threw error:`, error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    await Promise.allSettled(promises);
  }

  /**
   * Subscribe to all domain events
   */
  private subscribeToAllEvents(): void {
    const allEvents = Object.values(DOMAIN_EVENTS);
    
    for (const eventType of allEvents) {
      this.eventBus.subscribe(eventType, this, { 
        priority: 1000, // Low priority - run after core handlers
        async: true 
      });
    }

    console.log(`[ExtensionManager] Subscribed to ${allEvents.length} event types`);
  }

  /**
   * Clean up all extensions
   */
  async cleanup(): Promise<void> {
    console.log('[ExtensionManager] Cleaning up all extensions');
    
    for (const extension of this.extensions.values()) {
      if (extension.cleanup) {
        try {
          await extension.cleanup();
        } catch (error) {
          console.error(`[ExtensionManager] Error cleaning up extension ${extension.id}:`, error);
        }
      }
    }

    this.extensions.clear();
    this.activeExtensions.clear();
    this.extensionConfigs.clear();
  }
}

// Base extension class to make development easier
export abstract class BaseExtension implements ChatExtension {
  abstract id: string;
  abstract name: string;
  abstract version: string;
  abstract description: string;
  abstract author: string;
  abstract subscribedEvents: DomainEventType[];

  // Default implementations
  async initialize(chatId: string, config: any): Promise<void> {
    console.log(`[${this.id}] Initializing for chat ${chatId}`);
  }

  async activate(chatId: string): Promise<void> {
    console.log(`[${this.id}] Activating for chat ${chatId}`);
  }

  async deactivate(chatId: string): Promise<void> {
    console.log(`[${this.id}] Deactivating for chat ${chatId}`);
  }

  async cleanup(): Promise<void> {
    console.log(`[${this.id}] Cleaning up`);
  }

  getDefaultConfig(): any {
    return {};
  }

  validateConfig(config: any): boolean {
    return true; // Default: accept any config
  }

  // Must be implemented by concrete extensions
  abstract handleEvent(event: DomainEvent): Promise<ExtensionResult>;

  // Helper methods for extensions
  protected success(data?: any): ExtensionResult {
    return { success: true, data };
  }

  protected error(message: string): ExtensionResult {
    return { success: false, error: message };
  }

  protected emit(events: DomainEvent[]): ExtensionResult {
    return { success: true, additionalEvents: events };
  }

  protected modify(modifiedEvent: DomainEvent): ExtensionResult {
    return { success: true, modifiedEvent };
  }
}

// Extension utilities
export class ExtensionUtils {
  /**
   * Create a simple message-responding extension
   */
  static createMessageResponder(
    id: string,
    name: string,
    handler: (content: string, chatId: string, userId: string) => Promise<string | null>
  ): ChatExtension {
    return {
      id,
      name,
      version: '1.0.0',
      description: `Auto-responder extension: ${name}`,
      author: 'System',
      subscribedEvents: [DOMAIN_EVENTS.MESSAGE_STORED],
      
      async handleEvent(event: DomainEvent): Promise<ExtensionResult> {
        if (event.type !== DOMAIN_EVENTS.MESSAGE_STORED) {
          return { success: true };
        }

        try {
          const response = await handler(
            event.data.content,
            event.chatId,
            event.data.senderId
          );

          if (response) {
            return {
              success: true,
              additionalEvents: [{
                type: DOMAIN_EVENTS.MESSAGE_RECEIVED,
                chatId: event.chatId,
                userId: 'extension_' + id,
                timestamp: new Date(),
                data: {
                  content: response,
                  senderId: 'extension_' + id
                },
                source: id
              }]
            };
          }

          return { success: true };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Handler failed'
          };
        }
      }
    };
  }

  /**
   * Create a turn management extension
   */
  static createTurnModifier(
    id: string,
    name: string,
    handler: (turnEvent: DomainEvent) => Promise<{ nextUserId?: string; shouldSkip?: boolean }>
  ): ChatExtension {
    return {
      id,
      name,
      version: '1.0.0',
      description: `Turn management extension: ${name}`,
      author: 'System',
      subscribedEvents: [DOMAIN_EVENTS.TURN_VALIDATION_REQUESTED],
      
      async handleEvent(event: DomainEvent): Promise<ExtensionResult> {
        if (event.type !== DOMAIN_EVENTS.TURN_VALIDATION_REQUESTED) {
          return { success: true };
        }

        try {
          const result = await handler(event);
          
          if (result.shouldSkip) {
            return {
              success: true,
              additionalEvents: [{
                type: DOMAIN_EVENTS.TURN_SKIPPED,
                chatId: event.chatId,
                timestamp: new Date(),
                data: { reason: 'Extension override' },
                source: id
              }]
            };
          }

          return { success: true };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Turn handler failed'
          };
        }
      }
    };
  }
}