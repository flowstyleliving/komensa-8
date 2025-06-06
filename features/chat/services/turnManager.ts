// GPT CONTEXT:
// Simplified turn management system for Komensa chat application
// Handles regular chats, primarily user-based turns.

import { prisma } from '@/lib/prisma';
import { pusherServer, getChatChannelName, PUSHER_EVENTS } from '@/lib/pusher';
import { setTypingIndicator, getTypingUsers } from '@/lib/redis';

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
  constructor(private chatId: string) {}

  // Get current turn state
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

  // Initialize turn state (e.g., setting initial turn to a user)
  async initializeTurn(firstUserId: string): Promise<void> {
    console.log('[TurnManager] Initializing turn for chat', { chatId: this.chatId, firstUserId });
    
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

  // Initialize turn state with extensible selection method
  async initializeTurnWithSelector(
    participants: { id: string; role?: string }[], 
    selector: FirstTurnSelector = FirstTurnSelectors.first,
    ...selectorArgs: any[]
  ): Promise<void> {
    const firstUserId = selector(participants, ...selectorArgs);
    console.log('[TurnManager] Initializing turn with selector', { 
      chatId: this.chatId, 
      firstUserId, 
      participantCount: participants.length 
    });
    
    await this.initializeTurn(firstUserId);
  }

  // Set turn to a specific user ID chats
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

  // Get the next user in strict turn-taking mode
  async getNextUserAfterAI(): Promise<string | null> {
    // Get all participants in the chat
    const chat = await prisma.chat.findUnique({
      where: { id: this.chatId },
      include: {
        participants: {
          include: {
            user: true
          }
        }
      }
    });

    if (!chat) {
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
    const currentState = await this.getCurrentTurn();
    
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
    console.log('[TurnManager] canUserSendMessage:', { 
      userId, 
      nextUserId: currentState.next_user_id, 
      canSend,
      reason: canSend ? 'User turn' : 'Not user turn'
    });
    
    return canSend;
  }

  // Reset turn state to the first participant (chat creator if available)
  async resetTurn(): Promise<TurnState> {
    console.log('[TurnManager] Resetting turn state for chat:', this.chatId);
    
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
      throw new Error('Chat not found when resetting turn');
    }

    // Try to get the chat creator from the chat_created event
    const chatCreatedEvent = chat.events[0];
    const creatorId = (chatCreatedEvent?.data as any)?.createdBy;
    
    // Get human participants (excluding AI)
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
    
    // Emit turn update via Pusher
    const channelName = getChatChannelName(this.chatId);
    await pusherServer.trigger(channelName, PUSHER_EVENTS.TURN_UPDATE, { 
      next_user_id: firstUserId 
    });
    
    console.log('[TurnManager] Turn reset to user:', firstUserId);
    return { next_user_id: firstUserId };
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