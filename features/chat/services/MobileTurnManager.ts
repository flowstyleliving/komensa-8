/**
 * Mobile-optimized turn manager with offline support and connection recovery
 * Extends the foundational TurnManager with mobile-specific features
 */

import { TurnManager, TurnState } from './turnManager';
import { createMobileStateManager, MobileStateManager } from '../utils/state-management';

export interface OfflineMessage {
  id: string;
  content: string;
  senderId: string;
  timestamp: Date;
  retryCount: number;
}

export interface ConnectionState {
  isOnline: boolean;
  lastConnected: Date;
  reconnectAttempts: number;
  syncInProgress: boolean;
}

export class MobileTurnManager extends TurnManager {
  private mobileStateManager: MobileStateManager;
  private connectionState: ConnectionState;
  private reconnectTimer?: NodeJS.Timeout;
  private syncTimer?: NodeJS.Timeout;
  private readonly MAX_RECONNECT_ATTEMPTS = 5;
  private readonly RECONNECT_INTERVAL = 2000; // Start with 2 seconds
  private readonly SYNC_INTERVAL = 30000; // Sync every 30 seconds

  constructor(chatId: string, chatType: string = 'mediated') {
    super(chatId, chatType);
    this.mobileStateManager = createMobileStateManager(chatId);
    this.connectionState = {
      isOnline: navigator?.onLine ?? true,
      lastConnected: new Date(),
      reconnectAttempts: 0,
      syncInProgress: false
    };

    this.setupMobileEventListeners();
    this.startPeriodicSync();
  }

  /**
   * Send message with offline support
   */
  async sendMessage(content: string, senderId: string): Promise<boolean> {
    try {
      if (this.connectionState.isOnline) {
        // Try to send immediately
        const response = await fetch('/api/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chatId: this.chatId,
            content,
            senderId
          })
        });

        if (response.ok) {
          return true;
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      } else {
        // Queue for offline sending
        await this.mobileStateManager.queueOfflineMessage({
          content,
          senderId,
          timestamp: new Date()
        });
        return true; // Return true for optimistic UI
      }
    } catch (error) {
      console.error('[MobileTurnManager] Error sending message:', error);
      
      // Queue message for retry
      await this.mobileStateManager.queueOfflineMessage({
        content,
        senderId,
        timestamp: new Date()
      });
      
      return true; // Return true for optimistic UI
    }
  }

  /**
   * Check if user can send message with mobile considerations
   */
  async canUserSendMessage(userId: string, checkTyping: boolean = true): Promise<boolean> {
    try {
      // Always allow offline queuing
      if (!this.connectionState.isOnline) {
        return true;
      }

      // Use parent logic for online checks
      return await super.canUserSendMessage(userId, checkTyping);
    } catch (error) {
      console.error('[MobileTurnManager] Error checking send permission:', error);
      // Allow optimistic sending on error
      return true;
    }
  }

  /**
   * Set typing indicator with mobile network awareness
   */
  async setTypingIndicator(userId: string, isTyping: boolean): Promise<void> {
    try {
      if (this.connectionState.isOnline) {
        await super.setTypingIndicator(userId, isTyping);
      } else {
        // Store typing state locally for when connection returns
        localStorage.setItem(
          `typing_${this.chatId}_${userId}`,
          JSON.stringify({ isTyping, timestamp: Date.now() })
        );
      }
    } catch (error) {
      console.error('[MobileTurnManager] Error setting typing indicator:', error);
    }
  }

  /**
   * Get turn state with offline fallback
   */
  async getCurrentTurn(): Promise<TurnState | null> {
    try {
      if (this.connectionState.isOnline) {
        return await super.getCurrentTurn();
      } else {
        // Use cached state
        const cached = localStorage.getItem(`turn_state_${this.chatId}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          return {
            ...parsed,
            updated_at: new Date(parsed.updated_at)
          };
        }
        return null;
      }
    } catch (error) {
      console.error('[MobileTurnManager] Error getting current turn:', error);
      return null;
    }
  }

  /**
   * Handle connection state changes
   */
  private setupMobileEventListeners(): void {
    // Network status listeners
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.handleConnectionChange(true);
      });

      window.addEventListener('offline', () => {
        this.handleConnectionChange(false);
      });

      // Visibility change (app backgrounding/foregrounding)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          this.handleAppForeground();
        } else {
          this.handleAppBackground();
        }
      });

      // Before unload (app closing)
      window.addEventListener('beforeunload', () => {
        this.handleAppClose();
      });
    }
  }

  /**
   * Handle network connection changes
   */
  private async handleConnectionChange(isOnline: boolean): Promise<void> {
    console.log(`[MobileTurnManager] Connection changed: ${isOnline ? 'online' : 'offline'}`);
    
    const wasOnline = this.connectionState.isOnline;
    this.connectionState.isOnline = isOnline;

    if (isOnline && !wasOnline) {
      // Just came online
      this.connectionState.lastConnected = new Date();
      this.connectionState.reconnectAttempts = 0;
      
      // Clear reconnect timer
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = undefined;
      }

      // Sync state and process offline queue
      await this.syncAfterReconnection();
    } else if (!isOnline && wasOnline) {
      // Just went offline
      this.startReconnectAttempts();
    }
  }

  /**
   * Start reconnection attempts
   */
  private startReconnectAttempts(): void {
    if (this.reconnectTimer || this.connectionState.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      return;
    }

    const attempt = () => {
      this.connectionState.reconnectAttempts++;
      
      // Check if we're actually online now
      if (navigator?.onLine) {
        this.handleConnectionChange(true);
        return;
      }

      // Try again with exponential backoff
      if (this.connectionState.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS) {
        const delay = Math.min(
          this.RECONNECT_INTERVAL * Math.pow(2, this.connectionState.reconnectAttempts),
          30000 // Max 30 seconds
        );
        
        this.reconnectTimer = setTimeout(attempt, delay);
      }
    };

    this.reconnectTimer = setTimeout(attempt, this.RECONNECT_INTERVAL);
  }

  /**
   * Handle app coming to foreground
   */
  private async handleAppForeground(): Promise<void> {
    console.log('[MobileTurnManager] App foregrounded');
    
    // Check connection state
    const actuallyOnline = navigator?.onLine ?? true;
    if (actuallyOnline !== this.connectionState.isOnline) {
      await this.handleConnectionChange(actuallyOnline);
    }

    // Sync state if we've been offline for a while
    const timeSinceLastConnection = Date.now() - this.connectionState.lastConnected.getTime();
    if (timeSinceLastConnection > 30000) { // 30 seconds
      await this.syncAfterReconnection();
    }
  }

  /**
   * Handle app going to background
   */
  private handleAppBackground(): void {
    console.log('[MobileTurnManager] App backgrounded');
    
    // Save current state to localStorage
    this.saveTurnStateToLocal();
    
    // Clear typing indicators
    const userId = this.getCurrentUserId();
    if (userId) {
      this.setTypingIndicator(userId, false).catch(console.error);
    }
  }

  /**
   * Handle app closing
   */
  private handleAppClose(): void {
    console.log('[MobileTurnManager] App closing');
    
    // Save current state
    this.saveTurnStateToLocal();
    
    // Clean up timers
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
    }
  }

  /**
   * Sync state after reconnection
   */
  private async syncAfterReconnection(): Promise<void> {
    if (this.connectionState.syncInProgress) {
      return;
    }

    this.connectionState.syncInProgress = true;
    
    try {
      console.log('[MobileTurnManager] Syncing after reconnection');
      
      // Use mobile state manager's sync functionality
      await this.mobileStateManager.syncAfterReconnection();
      
      // Restore typing indicators
      await this.restoreTypingIndicators();
      
      // Update presence
      const userId = this.getCurrentUserId();
      if (userId) {
        await this.mobileStateManager.updatePresence(userId, true);
      }

      console.log('[MobileTurnManager] Sync completed successfully');
    } catch (error) {
      console.error('[MobileTurnManager] Error during sync:', error);
    } finally {
      this.connectionState.syncInProgress = false;
    }
  }

  /**
   * Start periodic state sync
   */
  private startPeriodicSync(): void {
    if (typeof window === 'undefined') return;

    this.syncTimer = setInterval(async () => {
      if (this.connectionState.isOnline && !this.connectionState.syncInProgress) {
        try {
          // Light sync - just process offline queue
          await this.mobileStateManager.processOfflineQueue();
        } catch (error) {
          console.error('[MobileTurnManager] Error in periodic sync:', error);
        }
      }
    }, this.SYNC_INTERVAL);
  }

  /**
   * Save turn state to local storage
   */
  private async saveTurnStateToLocal(): Promise<void> {
    try {
      const currentTurn = await super.getCurrentTurn();
      if (currentTurn) {
        localStorage.setItem(`turn_state_${this.chatId}`, JSON.stringify(currentTurn));
      }
    } catch (error) {
      console.error('[MobileTurnManager] Error saving turn state locally:', error);
    }
  }

  /**
   * Restore typing indicators from local storage
   */
  private async restoreTypingIndicators(): Promise<void> {
    try {
      const keys = Object.keys(localStorage).filter(key => 
        key.startsWith(`typing_${this.chatId}_`)
      );

      for (const key of keys) {
        const data = localStorage.getItem(key);
        if (data) {
          const { isTyping, timestamp } = JSON.parse(data);
          const userId = key.split('_')[2];
          
          // Only restore if timestamp is recent (within 5 minutes)
          if (Date.now() - timestamp < 300000 && isTyping) {
            await this.setTypingIndicator(userId, true);
          }
          
          // Clean up
          localStorage.removeItem(key);
        }
      }
    } catch (error) {
      console.error('[MobileTurnManager] Error restoring typing indicators:', error);
    }
  }

  /**
   * Get current user ID (you'll need to implement this based on your auth system)
   */
  private getCurrentUserId(): string | null {
    // This would typically come from your auth context or session
    // For now, return null to avoid breaking existing code
    return null;
  }

  /**
   * Get connection state
   */
  getConnectionState(): ConnectionState {
    return { ...this.connectionState };
  }

  /**
   * Force sync (for manual refresh)
   */
  async forceSync(): Promise<void> {
    await this.syncAfterReconnection();
  }

  /**
   * Get offline queue status
   */
  async getOfflineQueueStatus(): Promise<{ count: number; oldestMessage?: Date }> {
    try {
      // This would need to be implemented in the mobile state manager
      // For now, return basic info
      return { count: 0 };
    } catch (error) {
      console.error('[MobileTurnManager] Error getting offline queue status:', error);
      return { count: 0 };
    }
  }

  /**
   * Cleanup when component unmounts
   */
  destroy(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
    }

    // Remove event listeners
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleConnectionChange);
      window.removeEventListener('offline', this.handleConnectionChange);
      document.removeEventListener('visibilitychange', this.handleAppForeground);
      window.removeEventListener('beforeunload', this.handleAppClose);
    }
  }
}

/**
 * Factory function for mobile turn manager
 */
export function createMobileTurnManager(chatId: string, chatType: string = 'mediated'): MobileTurnManager {
  return new MobileTurnManager(chatId, chatType);
}