/**
 * Foundational state management for chat turn flow system
 * Provides unified state access, caching, and synchronization
 */

import { prisma } from '@/lib/prisma';
import { redis, setTypingIndicator, getTypingUsers } from '@/lib/redis';
import { pusherServer, getChatChannelName, PUSHER_EVENTS } from '@/lib/pusher';

// Core state interfaces
export interface ChatTurnState {
  chat_id: string;
  next_user_id: string | null;
  next_role: string | null;
  current_turn_index: number;
  turn_queue: string[];
  updated_at: Date;
  thread_id?: string | null;
}

export interface ParticipantPresence {
  userId: string;
  isOnline: boolean;
  isTyping: boolean;
  lastSeen: Date;
}

export interface ChatStateSnapshot {
  turnState: ChatTurnState;
  participants: ParticipantPresence[];
  messageCount: number;
  lastActivity: Date;
}

// Cache keys for Redis
const CACHE_KEYS = {
  turnState: (chatId: string) => `chat:${chatId}:turn_state`,
  presence: (chatId: string, userId: string) => `chat:${chatId}:presence:${userId}`,
  messageCount: (chatId: string) => `chat:${chatId}:message_count`,
  lastActivity: (chatId: string) => `chat:${chatId}:last_activity`,
  connectionHealth: (chatId: string) => `chat:${chatId}:health`,
} as const;

// Cache TTLs (in seconds)
const CACHE_TTL = {
  turnState: 300,      // 5 minutes
  presence: 60,        // 1 minute  
  messageCount: 180,   // 3 minutes
  lastActivity: 300,   // 5 minutes
  connectionHealth: 30, // 30 seconds
} as const;

/**
 * Unified state manager for chat turn flow
 */
export class ChatStateManager {
  constructor(private chatId: string) {}

  /**
   * Get current turn state with caching
   */
  async getTurnState(): Promise<ChatTurnState | null> {
    try {
      // Try cache first
      const cached = await redis.get(CACHE_KEYS.turnState(this.chatId));
      if (cached) {
        return JSON.parse(cached as string);
      }

      // Fallback to database
      const dbState = await prisma.chatTurnState.findUnique({
        where: { chat_id: this.chatId }
      });

      if (dbState) {
        const turnState: ChatTurnState = {
          chat_id: dbState.chat_id,
          next_user_id: dbState.next_user_id,
          next_role: dbState.next_role,
          current_turn_index: dbState.current_turn_index || 0,
          turn_queue: (dbState.turn_queue as string[]) || [],
          updated_at: dbState.updated_at,
          thread_id: dbState.thread_id
        };

        // Cache for next time
        await redis.setex(
          CACHE_KEYS.turnState(this.chatId),
          CACHE_TTL.turnState,
          JSON.stringify(turnState)
        );

        return turnState;
      }

      return null;
    } catch (error) {
      console.error('[ChatStateManager] Error getting turn state:', error);
      return null;
    }
  }

  /**
   * Update turn state with atomic database + cache sync
   */
  async updateTurnState(update: Partial<ChatTurnState>): Promise<ChatTurnState> {
    try {
      // Update database first (source of truth)
      const updated = await prisma.chatTurnState.upsert({
        where: { chat_id: this.chatId },
        update: {
          ...update,
          updated_at: new Date()
        },
        create: {
          chat_id: this.chatId,
          next_user_id: update.next_user_id || null,
          next_role: update.next_role || null,
          current_turn_index: update.current_turn_index || 0,
          turn_queue: (update.turn_queue as any) || [],
          thread_id: update.thread_id || null
        }
      });

      const turnState: ChatTurnState = {
        chat_id: updated.chat_id,
        next_user_id: updated.next_user_id,
        next_role: updated.next_role,
        current_turn_index: updated.current_turn_index || 0,
        turn_queue: (updated.turn_queue as string[]) || [],
        updated_at: updated.updated_at,
        thread_id: updated.thread_id
      };

      // Update cache
      await redis.setex(
        CACHE_KEYS.turnState(this.chatId),
        CACHE_TTL.turnState,
        JSON.stringify(turnState)
      );

      // Broadcast turn update
      await this.broadcastTurnUpdate(turnState);

      return turnState;
    } catch (error) {
      console.error('[ChatStateManager] Error updating turn state:', error);
      throw error;
    }
  }

  /**
   * Get participant presence with typing awareness
   */
  async getParticipantPresence(): Promise<ParticipantPresence[]> {
    try {
      const participants = await prisma.chatParticipant.findMany({
        where: { chat_id: this.chatId },
        include: { user: { select: { id: true } } }
      });

      const presence: ParticipantPresence[] = [];
      const typingUsers = await getTypingUsers(this.chatId);

      for (const participant of participants) {
        if (!participant.user) continue;

        const userId = participant.user.id;
        const isTyping = typingUsers.includes(userId);
        
        // Check presence cache
        const presenceKey = CACHE_KEYS.presence(this.chatId, userId);
        const cachedPresence = await redis.get(presenceKey);
        
        let isOnline = false;
        let lastSeen = new Date();

        if (cachedPresence) {
          const parsed = JSON.parse(cachedPresence as string);
          isOnline = parsed.isOnline;
          lastSeen = new Date(parsed.lastSeen);
        }

        presence.push({
          userId,
          isOnline,
          isTyping,
          lastSeen
        });
      }

      return presence;
    } catch (error) {
      console.error('[ChatStateManager] Error getting participant presence:', error);
      return [];
    }
  }

  /**
   * Update user presence (online/offline)
   */
  async updatePresence(userId: string, isOnline: boolean): Promise<void> {
    try {
      const presenceData = {
        isOnline,
        lastSeen: new Date().toISOString()
      };

      await redis.setex(
        CACHE_KEYS.presence(this.chatId, userId),
        CACHE_TTL.presence,
        JSON.stringify(presenceData)
      );

      // Broadcast presence update
      const channelName = getChatChannelName(this.chatId);
      await pusherServer.trigger(channelName, PUSHER_EVENTS.USER_PRESENCE, {
        userId,
        isOnline,
        lastSeen: presenceData.lastSeen
      });
    } catch (error) {
      console.error('[ChatStateManager] Error updating presence:', error);
    }
  }

  /**
   * Set typing indicator with turn awareness
   */
  async setTypingIndicator(userId: string, isTyping: boolean): Promise<void> {
    try {
      // Check if user can type (turn permission)
      const currentTurn = await this.getTurnState();
      if (isTyping && currentTurn && currentTurn.next_user_id !== userId) {
        // User is trying to type when it's not their turn
        // Allow typing indicator but with shorter TTL
        if (isTyping) {
          await redis.setex(`chat:${this.chatId}:typing:${userId}`, 1, '1');
        } else {
          await redis.del(`chat:${this.chatId}:typing:${userId}`);
        }
      } else {
        // Normal typing indicator
        await setTypingIndicator(this.chatId, userId, isTyping);
      }

      // Always broadcast typing state
      const channelName = getChatChannelName(this.chatId);
      await pusherServer.trigger(channelName, PUSHER_EVENTS.USER_TYPING, {
        userId,
        isTyping
      });

      // Update presence if typing
      if (isTyping) {
        await this.updatePresence(userId, true);
      }
    } catch (error) {
      console.error('[ChatStateManager] Error setting typing indicator:', error);
    }
  }

  /**
   * Get complete chat state snapshot
   */
  async getStateSnapshot(): Promise<ChatStateSnapshot> {
    try {
      const [turnState, participants, messageCount] = await Promise.all([
        this.getTurnState(),
        this.getParticipantPresence(),
        this.getMessageCount()
      ]);

      const lastActivity = await this.getLastActivity();

      return {
        turnState: turnState || {
          chat_id: this.chatId,
          next_user_id: null,
          next_role: null,
          current_turn_index: 0,
          turn_queue: [],
          updated_at: new Date()
        },
        participants,
        messageCount,
        lastActivity
      };
    } catch (error) {
      console.error('[ChatStateManager] Error getting state snapshot:', error);
      throw error;
    }
  }

  /**
   * Clear stale typing indicators (cleanup utility)
   */
  async clearStaleTypingIndicators(excludeUserId?: string): Promise<void> {
    try {
      const typingUsers = await getTypingUsers(this.chatId);
      const channelName = getChatChannelName(this.chatId);
      
      for (const userId of typingUsers) {
        if (userId !== excludeUserId && userId !== 'assistant') {
          await setTypingIndicator(this.chatId, userId, false);
          await pusherServer.trigger(channelName, PUSHER_EVENTS.USER_TYPING, { 
            userId, 
            isTyping: false 
          });
        }
      }
    } catch (error) {
      console.warn('[ChatStateManager] Failed to clear stale typing indicators:', error);
    }
  }

  /**
   * Invalidate all caches for this chat
   */
  async invalidateCache(): Promise<void> {
    try {
      const keys = [
        CACHE_KEYS.turnState(this.chatId),
        CACHE_KEYS.messageCount(this.chatId),
        CACHE_KEYS.lastActivity(this.chatId),
      ];

      await Promise.all(keys.map(key => redis.del(key)));
    } catch (error) {
      console.error('[ChatStateManager] Error invalidating cache:', error);
    }
  }

  /**
   * Health check for connection state
   */
  async checkConnectionHealth(): Promise<{ healthy: boolean; lastCheck: Date }> {
    try {
      const healthKey = CACHE_KEYS.connectionHealth(this.chatId);
      const health = await redis.get(healthKey);
      
      if (health) {
        const parsed = JSON.parse(health as string);
        return {
          healthy: parsed.healthy,
          lastCheck: new Date(parsed.lastCheck)
        };
      }

      // Perform health check
      const isHealthy = await this.performHealthCheck();
      const healthData = {
        healthy: isHealthy,
        lastCheck: new Date().toISOString()
      };

      await redis.setex(healthKey, CACHE_TTL.connectionHealth, JSON.stringify(healthData));

      return {
        healthy: isHealthy,
        lastCheck: new Date(healthData.lastCheck)
      };
    } catch (error) {
      console.error('[ChatStateManager] Error checking connection health:', error);
      return { healthy: false, lastCheck: new Date() };
    }
  }

  // Private helper methods

  private async getMessageCount(): Promise<number> {
    try {
      const cached = await redis.get(CACHE_KEYS.messageCount(this.chatId));
      if (cached) {
        return parseInt(cached as string, 10);
      }

      const count = await prisma.event.count({
        where: { 
          chat_id: this.chatId,
          type: 'message'
        }
      });

      await redis.setex(
        CACHE_KEYS.messageCount(this.chatId),
        CACHE_TTL.messageCount,
        count.toString()
      );

      return count;
    } catch (error) {
      console.error('[ChatStateManager] Error getting message count:', error);
      return 0;
    }
  }

  private async getLastActivity(): Promise<Date> {
    try {
      const cached = await redis.get(CACHE_KEYS.lastActivity(this.chatId));
      if (cached) {
        return new Date(cached as string);
      }

      const lastEvent = await prisma.event.findFirst({
        where: { chat_id: this.chatId },
        orderBy: { created_at: 'desc' },
        select: { created_at: true }
      });

      const lastActivity = lastEvent?.created_at || new Date();

      await redis.setex(
        CACHE_KEYS.lastActivity(this.chatId),
        CACHE_TTL.lastActivity,
        lastActivity.toISOString()
      );

      return lastActivity;
    } catch (error) {
      console.error('[ChatStateManager] Error getting last activity:', error);
      return new Date();
    }
  }

  private async broadcastTurnUpdate(turnState: ChatTurnState): Promise<void> {
    try {
      const channelName = getChatChannelName(this.chatId);
      await pusherServer.trigger(channelName, PUSHER_EVENTS.TURN_UPDATE, {
        next_user_id: turnState.next_user_id,
        next_role: turnState.next_role,
        current_turn_index: turnState.current_turn_index,
        updated_at: turnState.updated_at.toISOString()
      });
    } catch (error) {
      console.warn('[ChatStateManager] Failed to broadcast turn update:', error);
    }
  }

  private async performHealthCheck(): Promise<boolean> {
    try {
      // Check database connectivity
      await prisma.chat.findUnique({
        where: { id: this.chatId },
        select: { id: true }
      });

      // Check Redis connectivity
      await redis.ping();

      // Check if turn state is consistent
      const turnState = await this.getTurnState();
      
      return true;
    } catch (error) {
      console.error('[ChatStateManager] Health check failed:', error);
      return false;
    }
  }
}

/**
 * Global state manager factory
 */
export function createChatStateManager(chatId: string): ChatStateManager {
  return new ChatStateManager(chatId);
}

/**
 * Mobile-specific state utilities
 */
export class MobileStateManager extends ChatStateManager {
  /**
   * Queue message for offline sending
   */
  async queueOfflineMessage(message: {
    content: string;
    senderId: string;
    timestamp: Date;
  }): Promise<void> {
    try {
      const queueKey = `chat:${this.chatId}:offline_queue`;
      const queuedMessage = {
        id: crypto.randomUUID(),
        ...message,
        timestamp: message.timestamp.toISOString(),
        retryCount: 0
      };

      await redis.lpush(queueKey, JSON.stringify(queuedMessage));
      await redis.expire(queueKey, 86400); // 24 hours
    } catch (error) {
      console.error('[MobileStateManager] Error queueing offline message:', error);
    }
  }

  /**
   * Process offline message queue
   */
  async processOfflineQueue(): Promise<void> {
    try {
      const queueKey = `chat:${this.chatId}:offline_queue`;
      const messages = await redis.lrange(queueKey, 0, -1);

      for (const messageStr of messages) {
        try {
          const message = JSON.parse(messageStr as string);
          
          // Send message via API
          const response = await fetch('/api/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chatId: this.chatId,
              content: message.content,
              senderId: message.senderId
            })
          });

          if (response.ok) {
            // Remove from queue
            await redis.lrem(queueKey, 1, messageStr);
          } else {
            // Increment retry count
            message.retryCount = (message.retryCount || 0) + 1;
            if (message.retryCount > 3) {
              // Remove after 3 failed attempts
              await redis.lrem(queueKey, 1, messageStr);
            } else {
              // Update retry count
              await redis.lrem(queueKey, 1, messageStr);
              await redis.lpush(queueKey, JSON.stringify(message));
            }
          }
        } catch (error) {
          console.error('[MobileStateManager] Error processing queued message:', error);
          // Remove malformed message
          await redis.lrem(queueKey, 1, messageStr);
        }
      }
    } catch (error) {
      console.error('[MobileStateManager] Error processing offline queue:', error);
    }
  }

  /**
   * Sync state after reconnection
   */
  async syncAfterReconnection(): Promise<void> {
    try {
      // Invalidate all caches to force fresh data
      await this.invalidateCache();
      
      // Process any offline messages
      await this.processOfflineQueue();
      
      // Get fresh state
      const snapshot = await this.getStateSnapshot();
      
      // Update presence
      const currentUserId = await this.getCurrentUserId();
      if (currentUserId) {
        await this.updatePresence(currentUserId, true);
      }

      // Broadcast state refresh
      const channelName = getChatChannelName(this.chatId);
      await pusherServer.trigger(channelName, 'STATE_REFRESH', {
        snapshot,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('[MobileStateManager] Error syncing after reconnection:', error);
    }
  }

  private async getCurrentUserId(): Promise<string | null> {
    // This would be implemented based on your auth system
    // For now, return null to avoid breaking existing code
    return null;
  }
}

/**
 * Create mobile-optimized state manager
 */
export function createMobileStateManager(chatId: string): MobileStateManager {
  return new MobileStateManager(chatId);
}