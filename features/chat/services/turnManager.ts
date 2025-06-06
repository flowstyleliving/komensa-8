// Streamlined turn management system for Komensa chat application
// Uses EventDrivenTurnManager for all chats

import { prisma } from '@/lib/prisma';
import { pusherServer, getChatChannelName, PUSHER_EVENTS } from '@/lib/pusher';
import { setTypingIndicator, getTypingUsers } from '@/lib/redis';
import { EventDrivenTurnManager } from './EventDrivenTurnManager';

export interface TurnState {
  next_role?: string; 
  next_user_id?: string; 
}

export class TurnManager {
  private eventDrivenManager: EventDrivenTurnManager;

  constructor(private chatId: string) {
    this.eventDrivenManager = new EventDrivenTurnManager(chatId);
  }

  // Get current turn state
  async getCurrentTurn(): Promise<TurnState | null> {
    try {
      const turnState = await this.eventDrivenManager.getCurrentTurn();
      return {
        next_user_id: turnState.next_user_id,
        next_role: turnState.next_role
      };
    } catch (error) {
      console.error('[TurnManager] Error getting current turn:', error);
      return null;
    }
  }

  // Check if a user can send a message
  async canUserSendMessage(userId: string): Promise<boolean> {
    try {
      return await this.eventDrivenManager.canUserSendMessage(userId);
    } catch (error) {
      console.error('[TurnManager] Error checking user permission:', error);
      return false;
    }
  }

  // Initialize turn state for a new chat
  async initializeTurn(firstUserId: string): Promise<TurnState> {
    try {
      // Get the actual chat creator from the database
      const chatCreator = await this.getActualChatCreator();
      const actualFirstUserId = chatCreator || firstUserId;
      
      const turnState = await this.eventDrivenManager.initializeFirstTurn();
      
      // Sync with database
      await prisma.chatTurnState.upsert({
        where: { chat_id: this.chatId },
        update: { next_user_id: actualFirstUserId },
        create: { 
          chat_id: this.chatId, 
          next_user_id: actualFirstUserId 
        }
      });
      
      // Clear stale typing indicators and emit update
      await this.clearStaleTypingIndicators(actualFirstUserId);
      await this.emitTurnUpdate(actualFirstUserId);
      
      return { next_user_id: actualFirstUserId };
    } catch (error) {
      console.error('[TurnManager] Error initializing turn:', error);
      throw error;
    }
  }

  // Reset turn state
  async resetTurn(): Promise<TurnState> {
    try {
      const firstUserId = await this.getFirstParticipantId();
      const turnState = await this.eventDrivenManager.resetTurn(firstUserId);
      
      // Clear stale typing indicators and emit update
      await this.clearStaleTypingIndicators(firstUserId);
      await this.emitTurnUpdate(firstUserId);
      
      return { next_user_id: turnState.next_user_id };
    } catch (error) {
      console.error('[TurnManager] Error resetting turn:', error);
      throw error;
    }
  }

  // Helper: Get actual chat creator from database
  private async getActualChatCreator(): Promise<string | null> {
    try {
      const chatEvent = await prisma.event.findFirst({
        where: { 
          chat_id: this.chatId,
          type: 'chat_created'
        },
        orderBy: { created_at: 'asc' }
      });
      
      return (chatEvent?.data as any)?.creator_id || null;
    } catch (error) {
      console.error('[TurnManager] Error getting chat creator:', error);
      return null;
    }
  }

  // Helper: Get first participant ID
  private async getFirstParticipantId(): Promise<string> {
    const chat = await prisma.chat.findUnique({
      where: { id: this.chatId },
      include: {
        participants: {
          include: { user: true },
          where: { role: { not: 'assistant' } }
        }
      }
    });

    const firstParticipant = chat?.participants[0];
    if (!firstParticipant?.user_id) {
      throw new Error('No participants found for chat');
    }

    return firstParticipant.user_id;
  }

  // Advance turn to next participant
  async advanceTurn(): Promise<TurnState> {
    try {
      const currentTurn = await this.getCurrentTurn();
      if (!currentTurn) {
        throw new Error('No current turn state');
      }

      // Get next participant based on policy
      const events = await this.getChatEvents();
      const participants = await this.getParticipants();
      const nextTurn = await this.eventDrivenManager.getCurrentTurn();

      // Update state
      const updatedState = await this.stateManager.updateTurnState({
        next_user_id: nextTurn.next_user_id,
        next_role: nextTurn.next_role,
        current_turn_index: (currentTurn.current_turn_index || 0) + 1
      });

      // Clear typing indicators from previous user
      await this.stateManager.clearStaleTypingIndicators(nextTurn.next_user_id || undefined);

      return {
        next_user_id: updatedState.next_user_id,
        next_role: updatedState.next_role,
        current_turn_index: updatedState.current_turn_index,
        turn_queue: updatedState.turn_queue
      };
    } catch (error) {
      console.error('[TurnManager] Error advancing turn:', error);
      throw error;
    }
  }

  // Set typing indicator with turn awareness
  async setTypingIndicator(userId: string, isTyping: boolean): Promise<void> {
    try {
      await this.stateManager.setTypingIndicator(userId, isTyping);
    } catch (error) {
      console.error('[TurnManager] Error setting typing indicator:', error);
    }
  }

  // Get complete state snapshot
  async getStateSnapshot() {
    try {
      return await this.stateManager.getStateSnapshot();
    } catch (error) {
      console.error('[TurnManager] Error getting state snapshot:', error);
      throw error;
    }
  }

  // Health check
  async checkHealth() {
    try {
      return await this.stateManager.checkConnectionHealth();
    } catch (error) {
      console.error('[TurnManager] Error checking health:', error);
      return { healthy: false, lastCheck: new Date() };
    }
  }

  // Invalidate caches
  async invalidateCache(): Promise<void> {
    try {
      await this.stateManager.invalidateCache();
    } catch (error) {
      console.error('[TurnManager] Error invalidating cache:', error);
    }
  }

  // Private helper methods for backward compatibility
  
  private async getChatEvents() {
    return await prisma.event.findMany({
      where: { 
        chat_id: this.chatId,
        type: 'message'
      },
      orderBy: { created_at: 'asc' },
      select: {
        id: true,
        chat_id: true,
        type: true,
        data: true,
        created_at: true,
        seq: true
      }
    });
  }

  private async getParticipants() {
    const chat = await prisma.chat.findUnique({
      where: { id: this.chatId },
      include: {
        participants: {
          include: {
            user: {
              select: { id: true, display_name: true }
            }
          }
        }
      }
    });

    if (!chat) {
      throw new Error(`Chat not found: ${this.chatId}`);
    }

    const participants = [];

    // Add all participants from the participants table
    for (const participant of chat.participants) {
      if (participant.user) {
        participants.push({
          id: participant.user.id,
          display_name: participant.user.display_name || 'Unknown User',
          role: participant.role
        });
      }
    }

    // Always add assistant
    participants.push({
      id: 'assistant',
      display_name: 'AI Mediator',
      role: 'assistant'
    });

    return participants;
  }
} 