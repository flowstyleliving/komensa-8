// GPT CONTEXT:
// Simplified turn management system for Komensa chat application
// Now uses EventDrivenTurnManager for production chats with fallback to legacy systemts with fallback to legacy systemts with fallback to legacy system

import { prisma } from '@/lib/prisma';
import { pusherServer, getChatChannelName, PUSHER_EVENTS } from '@/lib/pusher';
import { setTypingIndicator, getTypingUsers } from '@/lib/redis';
import { EventDrivenTurnManager } from './EventDrivenTurnManager';
import { EventDrivenTurnManager } from './EventDrivenTurnManager';
import { EventDrivenTurnManager } from './EventDrivenTurnManager';
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
  private eventDrivenManager: EventDrivenTurnManager;
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

  // Get current turn state - now uses event-driven system for productionoolean = true; // Enable new system by default
  private eventDrivenManager: EventDrivenTurnManager;
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
  constructor(private chatId: string) {
    this.eventDrivenManager = new EventDrivenTurnManager(chatId);
      select: { next_user_id: true }

  // Check if this is a demo chat (should use legacy system)
  private async isDemoChat(): Promise<boolean> {
    const chat = await prisma.chat.findUnique({
      where: { id: this.chatId },
      select: { origin: true }
    });
    return chat?.origin === 'demo';
  }

  // Get current turn state - now uses event-driven system for productionoolean = true; // Enable new system by default
    console.log('[TurnManager] Initializing turn for chat', { chatId: this.chatId, firstUserId });
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
  constructor(private chatId: string) {
    this.eventDrivenManager = new EventDrivenTurnManager(chatId);
      select: { next_user_id: true }

  // Check if this is a demo chat (should use legacy system)
  private async isDemoChat(): Promise<boolean> {
    const chat = await prisma.chat.findUnique({
      where: { id: this.chatId },
      select: { origin: true }
    });
    return chat?.origin === 'demo';
  }

  // Get current turn state - now uses event-driven system for production
      data: {
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
    });

      select: { next_user_id: true }
      console.error('[TurnManager] Chat not found when getting next user');
      return null;
    }

    // Get human participants (excluding AI)
    const humanParticipants = chat.participants
      .filter(p => p.user_id !== 'assistant')
      .map(p => p.user_id);

    if (humanParticipants.length === 0) {
      console.error('[TurnManager] No human participants found');
      return null;
    }

    // Get the last message to determine who spoke last
    const lastMessage = await prisma.event.findFirst({
      where: {
        chat_id: this.chatId,
        type: 'message',
        data: {
          path: ['senderId'],
          not: 'assistant'
        }
      },
      orderBy: { created_at: 'desc' }
    });

    if (!lastMessage) {
      // If no previous message, start with the first participant
      return humanParticipants[0];
    }

    // Get the last human speaker's ID
    const lastSpeakerId = (lastMessage.data as any).senderId;
    
    // Find the index of the last speaker
    const lastSpeakerIndex = humanParticipants.indexOf(lastSpeakerId);
    
    // Get the next participant in the rotation
    const nextIndex = (lastSpeakerIndex + 1) % humanParticipants.length;
    return humanParticipants[nextIndex];
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
    const humanParticipants = chat.participants
      .filter(p => p.user_id !== 'assistant')
      .map(p => p.user_id);

    if (humanParticipants.length === 0) {
      throw new Error('No human participants found when resetting turn');
    }

    // Determine who should go first: creator if available, otherwise first participant
    const firstUserId = creatorId && humanParticipants.includes(creatorId) 
      ? creatorId 
      : humanParticipants[0];

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
    
    console.log('[TurnManager] getLegacyCanUserSendMessage:', { 
    const channelName = getChatChannelName(this.chatId);
      expectedUser: currentState.next_user_id, 
      canSend r_id: firstUserId 
    });
    
    console.log('[TurnManager] Legacy turn reset to user:', firstUserId);
    return { next_user_id: firstUserId };
  }

  // Clear stale typing indicators - this is a generic utility and can stay
  private async clearStaleTypingIndicators(newActiveUserId?: string): Promise<void> {
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
    const currentState = await this.getLegacyCurrentTurn();    console.log('[TurnManager] canUserSendMessage:', {       nextUserId: currentState.next_user_id, 
      canSend,
      reason: canSend ? 'User turn' : 'Not user turn'    
    console.log('[TurnManager] getLegacyCanUserSendMessage:', {       expectedUser: currentState.next_user_id, 
      canSend     console.log('[TurnManager] Legacy turn reset to user:', firstUserId);