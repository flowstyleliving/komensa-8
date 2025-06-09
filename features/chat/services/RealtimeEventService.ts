// Centralized real-time event broadcasting service
import { pusherServer, getChatChannelName, PUSHER_EVENTS } from '@/lib/pusher';
import { setTypingIndicator } from '@/lib/redis';

// Event payload types for type safety
export interface MessageEventData {
  id: string;
  created_at: string;
  data: {
    content: string;
    senderId: string;
  };
}

export interface TurnUpdateData {
  next_user_id: string | null;
  next_role?: string;
  timestamp: string;
}

export interface TypingIndicatorData {
  userId: string;
  isTyping: boolean;
  timestamp?: number;
  source?: string;
  replyId?: string;
}

export interface CompletionUpdateData {
  userId: string;
  userName: string;
  completionType: string;
  allComplete: boolean;
  completedCount: number;
  totalParticipants: number;
}

export interface ParticipantJoinedData {
  userId: string;
  role: string;
  timestamp: string;
}

export interface StateUpdateData {
  [key: string]: any; // Flexible for different state updates
}

export interface SettingsUpdateData {
  settings: any;
  updatedBy: string;
  timestamp: string;
}

export class RealtimeEventService {
  private chatId: string;
  private channelName: string;

  constructor(chatId: string) {
    this.chatId = chatId;
    this.channelName = getChatChannelName(chatId);
  }

  /**
   * Broadcast a new message to all participants
   */
  async broadcastMessage(messageData: MessageEventData): Promise<void> {
    try {
      await pusherServer.trigger(this.channelName, PUSHER_EVENTS.NEW_MESSAGE, messageData);
      console.log(`[RealtimeEventService] Message broadcast: ${messageData.id}`);
    } catch (error) {
      // Handle timestamp authentication errors gracefully
      if (this.isPusherTimestampError(error)) {
        console.warn(`[RealtimeEventService] Pusher timestamp error for message broadcast - this is non-critical:`, error);
        return; // Don't throw for timestamp errors
      }
      console.error(`[RealtimeEventService] Failed to broadcast message:`, error);
      throw error;
    }
  }

  /**
   * Broadcast turn state update
   */
  async broadcastTurnUpdate(turnData: TurnUpdateData): Promise<void> {
    try {
      await pusherServer.trigger(this.channelName, PUSHER_EVENTS.TURN_UPDATE, turnData);
      console.log(`[RealtimeEventService] Turn update broadcast: next_user=${turnData.next_user_id}`);
    } catch (error) {
      // Handle timestamp authentication errors gracefully
      if (this.isPusherTimestampError(error)) {
        console.warn(`[RealtimeEventService] Pusher timestamp error for turn update - this is non-critical:`, error);
        return; // Don't throw for timestamp errors
      }
      console.error(`[RealtimeEventService] Failed to broadcast turn update:`, error);
      throw error;
    }
  }

  /**
   * Broadcast user typing indicator with Redis persistence
   */
  async broadcastUserTyping(typingData: TypingIndicatorData): Promise<void> {
    try {
      // Update Redis state (non-blocking)
      setTypingIndicator(this.chatId, typingData.userId, typingData.isTyping).catch(error => 
        console.warn(`[RealtimeEventService] Redis typing update failed:`, error)
      );

      // Broadcast to participants
      await pusherServer.trigger(this.channelName, PUSHER_EVENTS.USER_TYPING, typingData);
      console.log(`[RealtimeEventService] User typing broadcast: ${typingData.userId} = ${typingData.isTyping}`);
    } catch (error) {
      // Handle timestamp authentication errors gracefully
      if (this.isPusherTimestampError(error)) {
        console.warn(`[RealtimeEventService] Pusher timestamp error for user typing - this is non-critical:`, error);
        return; // Don't throw for timestamp errors
      }
      console.error(`[RealtimeEventService] Failed to broadcast user typing:`, error);
      throw error;
    }
  }

  /**
   * Broadcast AI assistant typing indicator
   */
  async broadcastAssistantTyping(typingData: Omit<TypingIndicatorData, 'userId'>): Promise<void> {
    try {
      // Update Redis state for assistant (non-blocking)
      setTypingIndicator(this.chatId, 'assistant', typingData.isTyping).catch(error => 
        console.warn(`[RealtimeEventService] Redis assistant typing failed:`, error)
      );

      // Broadcast to participants
      await pusherServer.trigger(this.channelName, PUSHER_EVENTS.ASSISTANT_TYPING, {
        isTyping: typingData.isTyping,
        timestamp: typingData.timestamp || Date.now(),
        source: typingData.source || 'ai',
        replyId: typingData.replyId
      });
      
      console.log(`[RealtimeEventService] Assistant typing broadcast: ${typingData.isTyping}`);
    } catch (error) {
      // Handle timestamp authentication errors gracefully
      if (this.isPusherTimestampError(error)) {
        console.warn(`[RealtimeEventService] Pusher timestamp error for assistant typing - this is non-critical:`, error);
        return; // Don't throw for timestamp errors
      }
      console.error(`[RealtimeEventService] Failed to broadcast assistant typing:`, error);
      throw error;
    }
  }

  /**
   * Broadcast completion status update
   */
  async broadcastCompletionUpdate(completionData: CompletionUpdateData): Promise<void> {
    try {
      await pusherServer.trigger(this.channelName, PUSHER_EVENTS.COMPLETION_UPDATE, completionData);
      console.log(`[RealtimeEventService] Completion update broadcast: ${completionData.userId} = ${completionData.completionType}`);
    } catch (error) {
      console.error(`[RealtimeEventService] Failed to broadcast completion update:`, error);
      throw error;
    }
  }

  /**
   * Broadcast when all participants have completed
   */
  async broadcastCompletionReady(): Promise<void> {
    try {
      await pusherServer.trigger(this.channelName, PUSHER_EVENTS.COMPLETION_READY, {
        allComplete: true,
        readyForSummary: true,
        timestamp: new Date().toISOString()
      });
      console.log(`[RealtimeEventService] Completion ready broadcast`);
    } catch (error) {
      console.error(`[RealtimeEventService] Failed to broadcast completion ready:`, error);
      throw error;
    }
  }

  /**
   * Broadcast new participant joined
   */
  async broadcastParticipantJoined(participantData: ParticipantJoinedData): Promise<void> {
    try {
      await pusherServer.trigger(this.channelName, PUSHER_EVENTS.PARTICIPANT_JOINED, participantData);
      console.log(`[RealtimeEventService] Participant joined broadcast: ${participantData.userId}`);
    } catch (error) {
      console.error(`[RealtimeEventService] Failed to broadcast participant joined:`, error);
      throw error;
    }
  }

  /**
   * Broadcast general state update
   */
  async broadcastStateUpdate(stateData: StateUpdateData): Promise<void> {
    try {
      await pusherServer.trigger(this.channelName, PUSHER_EVENTS.STATE_UPDATE, {
        ...stateData,
        timestamp: new Date().toISOString()
      });
      console.log(`[RealtimeEventService] State update broadcast`);
    } catch (error) {
      console.error(`[RealtimeEventService] Failed to broadcast state update:`, error);
      throw error;
    }
  }

  /**
   * Broadcast settings update
   */
  async broadcastSettingsUpdate(settingsData: SettingsUpdateData): Promise<void> {
    try {
      // Using custom event name for settings since it's not in PUSHER_EVENTS
      await pusherServer.trigger(this.channelName, 'SETTINGS_UPDATED', settingsData);
      console.log(`[RealtimeEventService] Settings update broadcast by ${settingsData.updatedBy}`);
    } catch (error) {
      console.error(`[RealtimeEventService] Failed to broadcast settings update:`, error);
      throw error;
    }
  }

  /**
   * Broadcast multiple events in parallel for better performance
   */
  async broadcastMultiple(events: Array<{
    eventType: keyof typeof PUSHER_EVENTS | string;
    data: any;
  }>): Promise<void> {
    try {
      const promises = events.map(({ eventType, data }) => 
        pusherServer.trigger(this.channelName, eventType as string, data)
      );
      
      await Promise.all(promises);
      console.log(`[RealtimeEventService] Multiple events broadcast: ${events.length} events`);
    } catch (error) {
      console.error(`[RealtimeEventService] Failed to broadcast multiple events:`, error);
      throw error;
    }
  }

  /**
   * Cleanup typing indicators for a user (when they disconnect)
   */
  async cleanupUserTyping(userId: string): Promise<void> {
    try {
      await this.broadcastUserTyping({
        userId,
        isTyping: false
      });
      console.log(`[RealtimeEventService] Cleaned up typing for user: ${userId}`);
    } catch (error) {
      console.error(`[RealtimeEventService] Failed to cleanup user typing:`, error);
    }
  }

  /**
   * Cleanup assistant typing indicators
   */
  async cleanupAssistantTyping(): Promise<void> {
    try {
      await this.broadcastAssistantTyping({
        isTyping: false
      });
      console.log(`[RealtimeEventService] Cleaned up assistant typing`);
    } catch (error) {
      console.error(`[RealtimeEventService] Failed to cleanup assistant typing:`, error);
    }
  }

  /**
   * Get chat channel name (utility method)
   */
  getChannelName(): string {
    return this.channelName;
  }

  /**
   * Check if error is a Pusher timestamp authentication error
   */
  private isPusherTimestampError(error: any): boolean {
    return error?.status === 401 && 
           error?.body?.includes('Timestamp expired') ||
           error?.message?.includes('Timestamp expired');
  }

  /**
   * Static method to create service instance
   */
  static for(chatId: string): RealtimeEventService {
    return new RealtimeEventService(chatId);
  }
}