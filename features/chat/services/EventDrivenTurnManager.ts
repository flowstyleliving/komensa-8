import { prisma } from '@/lib/prisma';
import { createTurnPolicy, TurnPolicy, ChatEvent, Participant, TurnState, ChatContext } from './turnPolicies';

export class EventDrivenTurnManager {
  private policy: TurnPolicy;
  private chatId: string;

  constructor(chatId: string, chatType: string = 'mediated') {
    this.chatId = chatId;
    this.policy = createTurnPolicy(chatType);
  }

  /**
   * Get current turn state by analyzing chat events
   */
  async getCurrentTurn(): Promise<TurnState> {
    try {
      // Get chat events (messages) sorted by creation time
      const events = await this.getChatEvents();
      const participants = await this.getParticipants();

      // Use policy to calculate current turn
      const turnState = this.policy.calculateNextTurn(events, participants);
      
      console.log('[EventDrivenTurnManager] Current turn calculated:', {
        chatId: this.chatId,
        policy: this.policy.name,
        turnState,
        eventCount: events.length,
        participantCount: participants.length
      });

      return turnState;
    } catch (error) {
      console.error('[EventDrivenTurnManager] Error getting current turn:', error);
      
      // Fallback: Initialize first turn
      const participants = await this.getParticipants();
      return this.policy.initializeFirstTurn(participants);
    }
  }

  /**
   * Check if a user can send a message right now
   */
  async canUserSendMessage(userId: string): Promise<boolean> {
    try {
      const currentTurn = await this.getCurrentTurn();
      const participants = await this.getParticipants();
      const context: ChatContext = {
        chatId: this.chatId,
        participants,
        lastActivity: new Date(),
        messageCount: await this.getMessageCount()
      };

      const canSend = this.policy.canUserSendMessage(userId, currentTurn, context);
      
      console.log('[EventDrivenTurnManager] Can user send message - DETAILED:', {
        chatId: this.chatId,
        userId,
        currentTurn,
        participants: participants.map(p => ({ id: p.id, name: p.display_name })),
        messageCount: context.messageCount,
        canSend,
        policyName: this.policy.name
      });

      return canSend;
    } catch (error) {
      console.error('[EventDrivenTurnManager] Error checking user permission:', error);
      return false;
    }
  }

  /**
   * Get display text for current turn state
   */
  async getTurnDisplayText(): Promise<string> {
    try {
      const currentTurn = await this.getCurrentTurn();
      const participants = await this.getParticipants();
      
      return this.policy.getDisplayText(currentTurn, participants);
    } catch (error) {
      console.error('[EventDrivenTurnManager] Error getting display text:', error);
      return 'Loading...';
    }
  }

  /**
   * Reset turn to a specific user (for admin/recovery)
   */
  async resetTurn(userId: string): Promise<TurnState> {
    try {
      // Update the ChatTurnState table directly
      await prisma.chatTurnState.upsert({
        where: { chat_id: this.chatId },
        update: { 
          next_user_id: userId,
          updated_at: new Date()
        },
        create: {
          chat_id: this.chatId,
          next_user_id: userId
        }
      });

      console.log('[EventDrivenTurnManager] Turn reset to user:', { chatId: this.chatId, userId });

      return {
        next_user_id: userId,
        next_role: 'user'
      };
    } catch (error) {
      console.error('[EventDrivenTurnManager] Error resetting turn:', error);
      throw error;
    }
  }

  /**
   * Initialize first turn for a new chat
   */
  async initializeFirstTurn(): Promise<TurnState> {
    try {
      const participants = await this.getParticipants();
      const firstTurn = this.policy.initializeFirstTurn(participants);

      // Update ChatTurnState with first turn
      await prisma.chatTurnState.upsert({
        where: { chat_id: this.chatId },
        update: { 
          next_user_id: firstTurn.next_user_id,
          updated_at: new Date()
        },
        create: {
          chat_id: this.chatId,
          next_user_id: firstTurn.next_user_id
        }
      });

      console.log('[EventDrivenTurnManager] First turn initialized:', {
        chatId: this.chatId,
        firstTurn
      });

      return firstTurn;
    } catch (error) {
      console.error('[EventDrivenTurnManager] Error initializing first turn:', error);
      throw error;
    }
  }

  /**
   * Get chat events (messages) for turn calculation
   */
  private async getChatEvents(): Promise<ChatEvent[]> {
    const events = await prisma.event.findMany({
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

    return events.map((event) => ({
      id: event.id,
      chat_id: event.chat_id,
      type: event.type,
      data: event.data as any,
      created_at: event.created_at,
      seq: event.seq
    }));
  }

  /**
   * Get chat participants
   */
  private async getParticipants(): Promise<Participant[]> {
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

    const participants: Participant[] = [];

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

  /**
   * Get message count for context
   */
  private async getMessageCount(): Promise<number> {
    return await prisma.event.count({
      where: { 
        chat_id: this.chatId,
        type: 'message'
      }
    });
  }
} 