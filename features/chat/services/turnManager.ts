// Streamlined turn management system for Komensa chat application
// Uses EventDrivenTurnManager for all chats with configurable turn-taking policies

import { prisma } from '@/lib/prisma';
import { pusherServer, getChatChannelName, PUSHER_EVENTS } from '@/lib/pusher';
import { setTypingIndicator, getTypingUsers } from '@/lib/redis';
import { EventDrivenTurnManager } from './EventDrivenTurnManager';
import { getTurnPolicy, TurnPolicy } from '@/extensions/turn-taking/policies';

export interface TurnState {
  next_role?: string; 
  next_user_id?: string; 
}

export class TurnManager {
  private eventDrivenManager: EventDrivenTurnManager;
  private turnPolicy: TurnPolicy;

  constructor(protected chatId: string, chatType: string = 'mediated') {
    this.eventDrivenManager = new EventDrivenTurnManager(chatId, chatType);
    // Default to flexible policy for better UX
    this.turnPolicy = getTurnPolicy('flexible');
  }

  // Set turn-taking policy
  async setTurnPolicy(style: string): Promise<void> {
    this.turnPolicy = getTurnPolicy(style);
    console.log(`[TurnManager] Set turn policy to: ${style}`);
  }

  // Get chat settings including turn style
  private async getChatSettings(): Promise<any> {
    try {
      const chat = await prisma.chat.findUnique({
        where: { id: this.chatId },
        select: { settings: true }
      });
      return chat?.settings || {};
    } catch (error) {
      console.error('[TurnManager] Error getting chat settings:', error);
      return {};
    }
  }

  // Initialize turn policy based on chat settings
  async initializeTurnPolicy(): Promise<void> {
    const settings = await this.getChatSettings();
    const turnStyle = settings.turnStyle || 'flexible';
    await this.setTurnPolicy(turnStyle);
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
      // Initialize turn policy if needed
      await this.initializeTurnPolicy();
      
      // Get current chat state for policy decision
      const chatState = await this.getChatStateForPolicy();
      
      // Use the configured turn policy
      return await this.turnPolicy.canUserSendMessage(userId, chatState);
    } catch (error) {
      console.error('[TurnManager] Error checking user permission:', error);
      // Default to allowing messages if there's an error
      return true;
    }
  }

  // Get chat state needed for policy decisions
  private async getChatStateForPolicy(): Promise<any> {
    try {
      const [turnState, messages, participants] = await Promise.all([
        this.eventDrivenManager.getCurrentTurn(),
        prisma.event.findMany({
          where: { chat_id: this.chatId },
          orderBy: { created_at: 'desc' },
          take: 20,
          select: { data: true, created_at: true }
        }),
        prisma.chatParticipant.findMany({
          where: { chat_id: this.chatId },
          include: { user: { select: { id: true, display_name: true } } }
        })
      ]);

      return {
        next_user_id: turnState.next_user_id,
        next_role: turnState.next_role,
        messages: messages,
        participants: participants.map(p => ({
          id: p.user.id,
          display_name: p.user.display_name
        }))
      };
    } catch (error) {
      console.error('[TurnManager] Error getting chat state:', error);
      return {};
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