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

  constructor(protected chatId: string, chatType: string = 'mediated') {
    this.eventDrivenManager = new EventDrivenTurnManager(chatId, chatType);
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
      
      // Emit turn update
      const channelName = getChatChannelName(this.chatId);
      await pusherServer.trigger(channelName, PUSHER_EVENTS.TURN_UPDATE, { 
        next_user_id: actualFirstUserId 
      });
      
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
      
      // Emit turn update
      const channelName = getChatChannelName(this.chatId);
      await pusherServer.trigger(channelName, PUSHER_EVENTS.TURN_UPDATE, { 
        next_user_id: firstUserId 
      });
      
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

} 