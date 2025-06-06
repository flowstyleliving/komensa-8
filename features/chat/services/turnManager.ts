// GPT CONTEXT:
// Simplified turn management system for Komensa chat application
// Now uses EventDrivenTurnManager for production chats with fallback to legacy system

import { prisma } from '@/lib/prisma';
import { pusherServer, getChatChannelName, PUSHER_EVENTS } from '@/lib/pusher';
import { setTypingIndicator, getTypingUsers } from '@/lib/redis';
import { EventDrivenTurnManager } from './EventDrivenTurnManager';

export interface TurnState {
  next_role?: string; 
  next_user_id?: string; 
  turn_queue?: string[];
  current_turn_index?: number; 
}

// Extensible function type for determining who goes first
export type FirstTurnSelector = (participants: { id: string; role?: string }[], ...args: any[]) => string;

// Built-in selectors for who goes first
export const FirstTurnSelectors = {
  // Chat creator goes first (current default)
  creator: (participants: { id: string; role?: string }[], creatorId: string) => creatorId,
  
  // Random selection (for future coin flip feature)
  random: (participants: { id: string; role?: string }[]) => {
    const humanParticipants = participants.filter(p => p.role !== 'assistant');
    return humanParticipants[Math.floor(Math.random() * humanParticipants.length)].id;
  },
  
  // First participant in list (deterministic fallback)
  first: (participants: { id: string; role?: string }[]) => {
    const humanParticipants = participants.filter(p => p.role !== 'assistant');
    return humanParticipants[0]?.id;
  }
};

export class TurnManager {
  private eventDrivenManager: EventDrivenTurnManager;
  private useEventDriven: boolean = true; // Enable new system by default

  constructor(private chatId: string) {
    this.eventDrivenManager = new EventDrivenTurnManager(chatId);
  }

  // Check if this is a demo chat (should use legacy system)
  private async isDemoChat(): Promise<boolean> {
    const chat = await prisma.chat.findUnique({
      where: { id: this.chatId },
      select: { origin: true }
    });
    return chat?.origin === 'demo';
  }

  // Get current turn state - now uses event-driven system for production
  async getCurrentTurn(): Promise<TurnState | null> {
    try {
      // Check if this is a demo chat
      if (await this.isDemoChat()) {
        console.log('[TurnManager] Using legacy system for demo chat');
        return this.getLegacyCurrentTurn();
      }

      if (this.useEventDriven) {
        console.log('[TurnManager] Using EventDrivenTurnManager');
        const turnState = await this.eventDrivenManager.getCurrentTurn();
        return {
          next_user_id: turnState.next_user_id,
          next_role: turnState.next_role
        };
      } else {
        console.log('[TurnManager] Using legacy turn management');
        return this.getLegacyCurrentTurn();
      }
    } catch (error) {
      console.error('[TurnManager] Error in getCurrentTurn, falling back to legacy:', error);
      return this.getLegacyCurrentTurn();
    }
  }

  // Legacy turn management for demo chats and fallback
  private async getLegacyCurrentTurn(): Promise<TurnState | null> {
    const turnState = await prisma.chatTurnState.findUnique({
      where: { chat_id: this.chatId },
      select: { next_user_id: true }
    });

    if (!turnState?.next_user_id) {
      console.error('[TurnManager] No turn state found for chat');
      return null;
    }

    return {
      next_user_id: turnState.next_user_id
    };
  }

  // Check if a user can send a message in a chat
  async canUserSendMessage(userId: string): Promise<boolean> {
    try {
      // Check if this is a demo chat
      if (await this.isDemoChat()) {
        console.log('[TurnManager] Using legacy canUserSendMessage for demo chat');
        return this.getLegacyCanUserSendMessage(userId);
      }

      if (this.useEventDriven) {
        console.log('[TurnManager] Using EventDrivenTurnManager.canUserSendMessage');
        return await this.eventDrivenManager.canUserSendMessage(userId);
      } else {
        console.log('[TurnManager] Using legacy canUserSendMessage');
        return this.getLegacyCanUserSendMessage(userId);
      }
    } catch (error) {
      console.error('[TurnManager] Error in canUserSendMessage, falling back to legacy:', error);
      return this.getLegacyCanUserSendMessage(userId);
    }
  }

  // Legacy canUserSendMessage for demo chats and fallback
  private async getLegacyCanUserSendMessage(userId: string): Promise<boolean> {
    const currentState = await this.getLegacyCurrentTurn();
    
    // If no turn state exists, check if this is the first message
    if (!currentState) {
      const messageCount = await prisma.event.count({ 
        where: { 
          chat_id: this.chatId, 
          type: 'message',
          data: {
            path: ['senderId'],
            not: 'assistant'
          }
        } 
      });
      
      // Only allow the first message if there are no previous human messages
      if (messageCount === 0) {
        console.log('[TurnManager] First message in chat, allowing send');
        return true;
      }
      
      console.warn('[TurnManager] No turn state and not first message, denying send');
      return false;
    }

    // In strict turn-taking, only allow if it's the user's turn
    const canSend = currentState.next_user_id === userId;
    console.log('[TurnManager] getLegacyCanUserSendMessage:', { 
      userId, 
      expectedUser: currentState.next_user_id, 
      canSend 
    });
    return canSend;
  }

  // Initialize turn state for a new chat
  async initializeTurn(firstUserId: string): Promise<TurnState> {
    console.log('[TurnManager] Initializing turn for chat', { chatId: this.chatId, firstUserId });
    try {
      // Check if this is a demo chat
      if (await this.isDemoChat()) {
        console.log('[TurnManager] Using legacy initializeTurn for demo chat');
        return this.getLegacyInitializeTurn(firstUserId);
      }

      if (this.useEventDriven) {
        console.log('[TurnManager] Using EventDrivenTurnManager.initializeFirstTurn');
        
        // Get the actual chat creator from the chat_created event
        const chatCreator = await this.getActualChatCreator();
        const actualFirstUserId = chatCreator || firstUserId;
        
        console.log('[TurnManager] Chat creator determination:', {
          requestedFirstUserId: firstUserId,
          actualChatCreator: chatCreator,
          finalFirstUserId: actualFirstUserId
        });
        
        const turnState = await this.eventDrivenManager.initializeFirstTurn();
        
        // Override the turn state to use the actual creator
        await prisma.chatTurnState.upsert({
          where: { chat_id: this.chatId },
          update: { next_user_id: actualFirstUserId },
          create: { 
            chat_id: this.chatId, 
            next_user_id: actualFirstUserId 
          }
        });
        
        // Clear stale typing indicators
        await this.clearStaleTypingIndicators(actualFirstUserId);
        
        // Emit turn update via Pusher
        const channelName = getChatChannelName(this.chatId);
        await pusherServer.trigger(channelName, PUSHER_EVENTS.TURN_UPDATE, { 
          next_user_id: actualFirstUserId 
        });
        
        console.log('[TurnManager] Turn initialized with chat creator:', actualFirstUserId);
        return { next_user_id: actualFirstUserId };
      } else {
        console.log('[TurnManager] Using legacy initializeTurn');
        return this.getLegacyInitializeTurn(firstUserId);
      }
    } catch (error) {
      console.error('[TurnManager] Error in initializeTurn, falling back to legacy:', error);
      return this.getLegacyInitializeTurn(firstUserId);
    }
  }

  // Helper to get the actual chat creator
  private async getActualChatCreator(): Promise<string | null> {
    try {
      const chat = await prisma.chat.findUnique({
        where: { id: this.chatId },
        include: {
          events: {
            where: { type: 'chat_created' },
            take: 1
          }
        }
      });

      if (chat?.events[0]) {
        const chatCreatedEvent = chat.events[0];
        const creatorId = (chatCreatedEvent.data as any)?.createdBy;
        console.log('[TurnManager] Found chat creator from event:', creatorId);
        return creatorId || null;
      }

      console.log('[TurnManager] No chat_created event found, cannot determine creator');
      return null;
    } catch (error) {
      console.error('[TurnManager] Error getting chat creator:', error);
      return null;
    }
  }

  // Legacy initializeTurn for demo chats and fallback
  private async getLegacyInitializeTurn(firstUserId: string): Promise<TurnState> {
    try {
      // Create or update the turn state
      await prisma.chatTurnState.upsert({
        where: { chat_id: this.chatId },
        update: { next_user_id: firstUserId },
        create: { 
          chat_id: this.chatId, 
          next_user_id: firstUserId 
        }
      });

      // Clear any stale typing indicators
      await this.clearStaleTypingIndicators(firstUserId);
      
      console.log('[TurnManager] Legacy turn initialized for user:', firstUserId);
      return { next_user_id: firstUserId };
    } catch (error) {
      console.error('[TurnManager] Error in legacy initialize turn:', error);
      throw error;
    }
  }

  // Reset turn state to the first participant (chat creator if available)
  async resetTurn(): Promise<TurnState> {
    console.log('[TurnManager] Resetting turn state for chat:', this.chatId);
    
    try {
      // Check if this is a demo chat
      if (await this.isDemoChat()) {
        console.log('[TurnManager] Using legacy resetTurn for demo chat');
        return this.getLegacyResetTurn();
      }

      if (this.useEventDriven) {
        console.log('[TurnManager] Using EventDrivenTurnManager.resetTurn');
        
        // Get the first participant to reset to
        const firstUserId = await this.getFirstParticipantId();
        const turnState = await this.eventDrivenManager.resetTurn(firstUserId);
        
        // Clear stale typing indicators
        await this.clearStaleTypingIndicators(firstUserId);
        
        // Emit turn update via Pusher
        const channelName = getChatChannelName(this.chatId);
        await pusherServer.trigger(channelName, PUSHER_EVENTS.TURN_UPDATE, { 
          next_user_id: firstUserId 
        });
        
        console.log('[TurnManager] Turn reset to user using EventDrivenTurnManager:', firstUserId);
        return { next_user_id: turnState.next_user_id };
      } else {
        console.log('[TurnManager] Using legacy resetTurn');
        return this.getLegacyResetTurn();
      }
    } catch (error) {
      console.error('[TurnManager] Error in resetTurn, falling back to legacy:', error);
      return this.getLegacyResetTurn();
    }
  }

  // Helper to get the first participant ID (chat creator if available)
  private async getFirstParticipantId(): Promise<string> {
    // Get chat participants to determine who should go first
    const chat = await prisma.chat.findUnique({
      where: { id: this.chatId },
      include: {
        participants: {
          include: { user: true }
        },
        events: {
          where: { type: 'chat_created' },
          take: 1
        }
      }
    });

    if (!chat) {
      throw new Error('Chat not found when getting first participant');
    }

    // Try to get the chat creator from the chat_created event
    const chatCreatedEvent = chat.events[0];
    const creatorId = (chatCreatedEvent?.data as any)?.createdBy;
    
    // Get human participants (excluding AI)
    const humanParticipants = chat.participants
      .filter(p => p.user_id !== 'assistant')
      .map(p => p.user_id);

    if (humanParticipants.length === 0) {
      throw new Error('No human participants found when getting first participant');
    }

    // Determine who should go first: creator if available, otherwise first participant
    return creatorId && humanParticipants.includes(creatorId) 
      ? creatorId 
      : humanParticipants[0];
  }

  // Legacy resetTurn for demo chats and fallback
  private async getLegacyResetTurn(): Promise<TurnState> {
    try {
      // Get chat participants to determine who should go first
      const firstUserId = await this.getFirstParticipantId();

      // Reset the turn state
      await prisma.chatTurnState.upsert({
        where: { chat_id: this.chatId },
        update: { next_user_id: firstUserId },
        create: { 
          chat_id: this.chatId, 
          next_user_id: firstUserId 
        }
      });

      // Clear any stale typing indicators
      await this.clearStaleTypingIndicators(firstUserId);
      
      // Emit turn update via Pusher
      const channelName = getChatChannelName(this.chatId);
      await pusherServer.trigger(channelName, PUSHER_EVENTS.TURN_UPDATE, { 
        next_user_id: firstUserId 
      });
      
      console.log('[TurnManager] Legacy turn reset to user:', firstUserId);
      return { next_user_id: firstUserId };
    } catch (error) {
      console.error('[TurnManager] Error in legacy reset turn:', error);
      throw error;
    }
  }

  // Clear stale typing indicators - this is a generic utility and can stay
  private async clearStaleTypingIndicators(newActiveUserId?: string): Promise<void> {
    try {
      const typingUsers = await getTypingUsers(this.chatId);
      const channelName = getChatChannelName(this.chatId);
      
      for (const userId of typingUsers) {
        if (userId !== newActiveUserId && userId !== 'assistant') { 
          console.log('[TurnManager] Clearing stale typing for user:', userId);
          await setTypingIndicator(this.chatId, userId, false);
          await pusherServer.trigger(channelName, PUSHER_EVENTS.USER_TYPING, { userId, isTyping: false });
        }
      }
    } catch (error) {
      console.error('[TurnManager] Error clearing stale typing indicators:', error);
    }
  }
} 