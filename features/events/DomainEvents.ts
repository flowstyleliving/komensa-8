// Domain events for chat system
import { DomainEvent } from './EventBus';

// Event type constants
export const DOMAIN_EVENTS = {
  // Message Lifecycle Events
  MESSAGE_RECEIVED: 'message.received',
  MESSAGE_VALIDATED: 'message.validated',
  MESSAGE_STORED: 'message.stored',
  MESSAGE_PROCESSING_FAILED: 'message.processing_failed',

  // Turn Management Events
  TURN_VALIDATION_REQUESTED: 'turn.validation_requested',
  TURN_CHANGED: 'turn.changed',
  TURN_SKIPPED: 'turn.skipped',
  TURN_RESET: 'turn.reset',

  // AI Events
  AI_RESPONSE_REQUESTED: 'ai.response_requested',
  AI_RESPONSE_STARTED: 'ai.response_started',
  AI_RESPONSE_COMPLETED: 'ai.response_completed',
  AI_RESPONSE_FAILED: 'ai.response_failed',
  AI_TYPING_STARTED: 'ai.typing_started',
  AI_TYPING_STOPPED: 'ai.typing_stopped',

  // User Events
  USER_JOINED: 'user.joined',
  USER_LEFT: 'user.left',
  USER_TYPING_STARTED: 'user.typing_started',
  USER_TYPING_STOPPED: 'user.typing_stopped',

  // Completion Events
  USER_MARKED_COMPLETE: 'completion.user_marked',
  ALL_USERS_COMPLETE: 'completion.all_complete',
  COMPLETION_RESET: 'completion.reset',

  // Summary Events
  SUMMARY_REQUESTED: 'summary.requested',
  SUMMARY_GENERATED: 'summary.generated',
  SUMMARY_FAILED: 'summary.failed',

  // Settings Events
  SETTINGS_UPDATED: 'settings.updated',
  TURN_MODE_CHANGED: 'settings.turn_mode_changed',

  // Extension Events
  EXTENSION_ACTIVATED: 'extension.activated',
  EXTENSION_DEACTIVATED: 'extension.deactivated',
  EXTENSION_EVENT: 'extension.event',

  // System Events
  CHAT_CREATED: 'chat.created',
  CHAT_ARCHIVED: 'chat.archived',
  STATE_REFRESH_REQUESTED: 'state.refresh_requested',
  ERROR_OCCURRED: 'system.error_occurred',

  // Real-time Events (for Pusher broadcasting)
  REALTIME_MESSAGE: 'realtime.message',
  REALTIME_TURN_UPDATE: 'realtime.turn_update',
  REALTIME_TYPING: 'realtime.typing',
  REALTIME_COMPLETION: 'realtime.completion',
  REALTIME_STATE_UPDATE: 'realtime.state_update'
} as const;

// Type-safe event type
export type DomainEventType = typeof DOMAIN_EVENTS[keyof typeof DOMAIN_EVENTS];

// Specific event interfaces for type safety

export interface MessageReceivedEvent extends DomainEvent {
  type: typeof DOMAIN_EVENTS.MESSAGE_RECEIVED;
  data: {
    content: string;
    senderId: string;
    isGuest?: boolean;
    userAgent?: string;
  };
}

export interface MessageValidatedEvent extends DomainEvent {
  type: typeof DOMAIN_EVENTS.MESSAGE_VALIDATED;
  data: {
    content: string;
    senderId: string;
    validated: boolean;
    canSend: boolean;
  };
}

export interface MessageStoredEvent extends DomainEvent {
  type: typeof DOMAIN_EVENTS.MESSAGE_STORED;
  data: {
    messageId: string;
    content: string;
    senderId: string;
    timestamp: string;
  };
}

export interface TurnChangedEvent extends DomainEvent {
  type: typeof DOMAIN_EVENTS.TURN_CHANGED;
  data: {
    previousUserId?: string;
    nextUserId: string | null;
    nextRole?: string;
    turnMode: 'flexible' | 'strict' | 'moderated' | 'rounds';
    turnIndex?: number;
  };
}

export interface AIResponseRequestedEvent extends DomainEvent {
  type: typeof DOMAIN_EVENTS.AI_RESPONSE_REQUESTED;
  data: {
    userMessage: string;
    triggerUserId: string;
    userAgent?: string;
  };
}

export interface AIResponseStartedEvent extends DomainEvent {
  type: typeof DOMAIN_EVENTS.AI_RESPONSE_STARTED;
  data: {
    replyId: string;
    userMessage: string;
  };
}

export interface AIResponseCompletedEvent extends DomainEvent {
  type: typeof DOMAIN_EVENTS.AI_RESPONSE_COMPLETED;
  data: {
    replyId: string;
    content: string;
    messageId: string;
    duration: number;
  };
}

export interface UserJoinedEvent extends DomainEvent {
  type: typeof DOMAIN_EVENTS.USER_JOINED;
  data: {
    userId: string;
    role: string;
    displayName: string;
    isGuest: boolean;
  };
}

export interface UserMarkCompleteEvent extends DomainEvent {
  type: typeof DOMAIN_EVENTS.USER_MARKED_COMPLETE;
  data: {
    userId: string;
    completionType: string;
    userName: string;
  };
}

export interface AllUsersCompleteEvent extends DomainEvent {
  type: typeof DOMAIN_EVENTS.ALL_USERS_COMPLETE;
  data: {
    completedCount: number;
    totalParticipants: number;
    completionData: Record<string, string>;
  };
}

export interface SettingsUpdatedEvent extends DomainEvent {
  type: typeof DOMAIN_EVENTS.SETTINGS_UPDATED;
  data: {
    previousSettings: any;
    newSettings: any;
    updatedBy: string;
    changes: string[];
  };
}

export interface ExtensionEventData extends DomainEvent {
  type: typeof DOMAIN_EVENTS.EXTENSION_EVENT;
  data: {
    extensionId: string;
    eventName: string;
    payload: any;
  };
}

// Event builder helpers for type safety

export class EventBuilder {
  static messageReceived(
    chatId: string,
    userId: string,
    content: string,
    options?: { isGuest?: boolean; userAgent?: string; correlationId?: string }
  ): MessageReceivedEvent {
    return {
      type: DOMAIN_EVENTS.MESSAGE_RECEIVED,
      chatId,
      userId,
      timestamp: new Date(),
      data: {
        content,
        senderId: userId,
        isGuest: options?.isGuest,
        userAgent: options?.userAgent
      },
      correlationId: options?.correlationId,
      source: 'user'
    };
  }

  static messageValidated(
    chatId: string,
    userId: string,
    content: string,
    canSend: boolean,
    correlationId?: string
  ): MessageValidatedEvent {
    return {
      type: DOMAIN_EVENTS.MESSAGE_VALIDATED,
      chatId,
      userId,
      timestamp: new Date(),
      data: {
        content,
        senderId: userId,
        validated: true,
        canSend
      },
      correlationId,
      source: 'turn_manager'
    };
  }

  static messageStored(
    chatId: string,
    userId: string,
    messageId: string,
    content: string,
    correlationId?: string
  ): MessageStoredEvent {
    return {
      type: DOMAIN_EVENTS.MESSAGE_STORED,
      chatId,
      userId,
      timestamp: new Date(),
      data: {
        messageId,
        content,
        senderId: userId,
        timestamp: new Date().toISOString()
      },
      correlationId,
      source: 'state_manager'
    };
  }

  static turnChanged(
    chatId: string,
    nextUserId: string | null,
    turnMode: 'flexible' | 'strict' | 'moderated' | 'rounds',
    options?: { 
      previousUserId?: string; 
      nextRole?: string; 
      turnIndex?: number;
      correlationId?: string;
    }
  ): TurnChangedEvent {
    return {
      type: DOMAIN_EVENTS.TURN_CHANGED,
      chatId,
      timestamp: new Date(),
      data: {
        previousUserId: options?.previousUserId,
        nextUserId,
        nextRole: options?.nextRole,
        turnMode,
        turnIndex: options?.turnIndex
      },
      correlationId: options?.correlationId,
      source: 'turn_manager'
    };
  }

  static aiResponseRequested(
    chatId: string,
    userId: string,
    userMessage: string,
    options?: { userAgent?: string; correlationId?: string }
  ): AIResponseRequestedEvent {
    return {
      type: DOMAIN_EVENTS.AI_RESPONSE_REQUESTED,
      chatId,
      userId,
      timestamp: new Date(),
      data: {
        userMessage,
        triggerUserId: userId,
        userAgent: options?.userAgent
      },
      correlationId: options?.correlationId,
      source: 'ai_trigger'
    };
  }

  static aiResponseStarted(
    chatId: string,
    replyId: string,
    userMessage: string,
    correlationId?: string
  ): AIResponseStartedEvent {
    return {
      type: DOMAIN_EVENTS.AI_RESPONSE_STARTED,
      chatId,
      timestamp: new Date(),
      data: {
        replyId,
        userMessage
      },
      correlationId,
      source: 'ai_service'
    };
  }

  static aiResponseCompleted(
    chatId: string,
    replyId: string,
    content: string,
    messageId: string,
    duration: number,
    correlationId?: string
  ): AIResponseCompletedEvent {
    return {
      type: DOMAIN_EVENTS.AI_RESPONSE_COMPLETED,
      chatId,
      timestamp: new Date(),
      data: {
        replyId,
        content,
        messageId,
        duration
      },
      correlationId,
      source: 'ai_service'
    };
  }

  static userJoined(
    chatId: string,
    userId: string,
    role: string,
    displayName: string,
    isGuest: boolean,
    correlationId?: string
  ): UserJoinedEvent {
    return {
      type: DOMAIN_EVENTS.USER_JOINED,
      chatId,
      userId,
      timestamp: new Date(),
      data: {
        userId,
        role,
        displayName,
        isGuest
      },
      correlationId,
      source: 'user_manager'
    };
  }

  static userMarkedComplete(
    chatId: string,
    userId: string,
    completionType: string,
    userName: string,
    correlationId?: string
  ): UserMarkCompleteEvent {
    return {
      type: DOMAIN_EVENTS.USER_MARKED_COMPLETE,
      chatId,
      userId,
      timestamp: new Date(),
      data: {
        userId,
        completionType,
        userName
      },
      correlationId,
      source: 'completion_manager'
    };
  }

  static settingsUpdated(
    chatId: string,
    updatedBy: string,
    previousSettings: any,
    newSettings: any,
    correlationId?: string
  ): SettingsUpdatedEvent {
    return {
      type: DOMAIN_EVENTS.SETTINGS_UPDATED,
      chatId,
      userId: updatedBy,
      timestamp: new Date(),
      data: {
        previousSettings,
        newSettings,
        updatedBy,
        changes: Object.keys(newSettings)
      },
      correlationId,
      source: 'settings_manager'
    };
  }

  static extensionEvent(
    chatId: string,
    extensionId: string,
    eventName: string,
    payload: any,
    correlationId?: string
  ): ExtensionEventData {
    return {
      type: DOMAIN_EVENTS.EXTENSION_EVENT,
      chatId,
      timestamp: new Date(),
      data: {
        extensionId,
        eventName,
        payload
      },
      correlationId,
      source: extensionId
    };
  }
}

// Event filtering helpers
export class EventFilters {
  static byChatId(chatId: string) {
    return (event: DomainEvent): boolean => event.chatId === chatId;
  }

  static byUserId(userId: string) {
    return (event: DomainEvent): boolean => event.userId === userId;
  }

  static byEventTypes(eventTypes: string[]) {
    return (event: DomainEvent): boolean => eventTypes.includes(event.type);
  }

  static bySource(source: string) {
    return (event: DomainEvent): boolean => event.source === source;
  }

  static isMessageEvent() {
    return (event: DomainEvent): boolean => event.type.startsWith('message.');
  }

  static isAIEvent() {
    return (event: DomainEvent): boolean => event.type.startsWith('ai.');
  }

  static isTurnEvent() {
    return (event: DomainEvent): boolean => event.type.startsWith('turn.');
  }

  static isRealtimeEvent() {
    return (event: DomainEvent): boolean => event.type.startsWith('realtime.');
  }
}