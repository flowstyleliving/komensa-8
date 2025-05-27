// GPT CONTEXT:
// Simplified turn management system for Komensa chat application
// Handles regular (non-demo) chats, primarily user-based turns.

import { prisma } from '@/lib/prisma';
import { pusherServer, getChatChannelName, PUSHER_EVENTS } from '@/lib/pusher';
import { setTypingIndicator, getTypingUsers } from '@/lib/redis';

export interface TurnState {
  // next_role?: string; // Probably not needed for non-demo
  next_user_id?: string; 
  // turn_queue?: string[]; // Probably not needed for non-demo
  // current_turn_index?: number; // Probably not needed for non-demo
}

export class TurnManager {
  constructor(private chatId: string) {}

  // Get current turn state (simplified for non-demo)
  async getCurrentTurn(): Promise<TurnState | null> {
    const turnState = await prisma.chatTurnState.findUnique({
      where: { chat_id: this.chatId },
      select: { next_user_id: true } // Only select what's relevant for non-demo
    });

    if (!turnState) return null;

    return {
      next_user_id: turnState.next_user_id || undefined,
    };
  }

  // Initialize turn state for a non-demo chat (e.g., setting initial turn to a user)
  async initializeTurn(firstUserId: string): Promise<void> {
    console.log('[TurnManager] Initializing turn for non-demo chat', { chatId: this.chatId, firstUserId });
    
    await prisma.chatTurnState.upsert({
      where: { chat_id: this.chatId },
      update: {
        next_user_id: firstUserId,
      },
      create: {
        chat_id: this.chatId,
        next_user_id: firstUserId,
      }
    });

    const channelName = getChatChannelName(this.chatId);
    await pusherServer.trigger(channelName, PUSHER_EVENTS.TURN_UPDATE, { 
      next_user_id: firstUserId 
    });
  }

  // Set turn to a specific user ID for non-demo chats
  async setTurnToUser(userId: string): Promise<TurnState> {
    console.log('[TurnManager] Setting turn to user:', { chatId: this.chatId, userId });
    
    await prisma.chatTurnState.update({
      where: { chat_id: this.chatId },
      data: {
        next_user_id: userId,
      }
    });

    await this.clearStaleTypingIndicators(userId);
    
    const channelName = getChatChannelName(this.chatId);
    await pusherServer.trigger(channelName, PUSHER_EVENTS.TURN_UPDATE, { 
      next_user_id: userId 
    });
    console.log('[TurnManager] Turn set to user and event emitted.');
    return { next_user_id: userId };
  }

  // Check if a user can send a message in a non-demo chat
  async canUserSendMessage(userId: string): Promise<boolean> {
    const currentState = await this.getCurrentTurn();
    if (!currentState) {
      // If no turn state exists, typically the first message, allow it.
      // Or, for a more strict system, this could return false and require initialization.
      // For now, let's be permissive for the first message if no state is set.
      // The API route also has a check, this is an additional layer.
      const messageCount = await prisma.event.count({ where: { chat_id: this.chatId, type: 'message' } });
      if (messageCount === 0) return true; 
      console.warn('[TurnManager] No turn state for canUserSendMessage, assuming false after first message.');
      return false; 
    }

    const canSend = currentState.next_user_id === userId;
    console.log('[TurnManager] canUserSendMessage:', { userId, nextUserId: currentState.next_user_id, canSend });
    return canSend;
  }

  // Clear stale typing indicators - this is a generic utility and can stay
  private async clearStaleTypingIndicators(newActiveUserId?: string): Promise<void> {
    try {
      const typingUsers = await getTypingUsers(this.chatId);
      const channelName = getChatChannelName(this.chatId);
      
      for (const userId of typingUsers) {
        if (userId !== newActiveUserId && userId !== 'assistant') { 
          console.log('[TurnManager] Clearing stale typing for user:', userId);
          // await setTypingIndicator(this.chatId, userId, false); // BYPASSED
          console.log('[TurnManager] Stale typing indicator cleared in Redis (BYPASSED)');
          await pusherServer.trigger(channelName, PUSHER_EVENTS.USER_TYPING, {
            userId,
            isTyping: false
          });
        }
      }
    } catch (error) {
      console.error('[TurnManager] Error clearing stale typing indicators:', error);
      // Non-critical, so don't re-throw
    }
  }
} 