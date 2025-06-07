// Simplified turn management using participant arrays
import { prisma } from '@/lib/prisma';

export interface TurnState {
  next_user_id: string;
  next_role?: string;
}

export class TurnManager {
  private chatId: string;

  constructor(chatId: string) {
    this.chatId = chatId;
  }

  // Get participants array for this chat
  async getParticipants(): Promise<string[]> {
    try {
      const participants = await prisma.chatParticipant.findMany({
        where: { chat_id: this.chatId },
        include: { user: { select: { id: true } } },
        orderBy: { user_id: 'asc' } // Consistent ordering
      });
      
      return participants.map(p => p.user.id);
    } catch (error) {
      console.error('[TurnManager] Error getting participants:', error);
      return [];
    }
  }

  // Get turn style from chat settings
  async getTurnStyle(): Promise<string> {
    try {
      const chat = await prisma.chat.findUnique({
        where: { id: this.chatId },
        select: { settings: true }
      });
      
      const settings = (chat?.settings as any) || {};
      return settings.turnStyle || 'flexible';
    } catch (error) {
      return 'flexible';
    }
  }

  // Get last message sender
  async getLastMessageSender(): Promise<string | null> {
    try {
      const lastMessage = await prisma.event.findFirst({
        where: { 
          chat_id: this.chatId,
          type: 'message'
        },
        orderBy: { created_at: 'desc' },
        select: { data: true }
      });
      
      return (lastMessage?.data as any)?.senderId || null;
    } catch (error) {
      return null;
    }
  }

  // Check if user can send message - dead simple logic
  async canUserSendMessage(userId: string): Promise<boolean> {
    const style = await this.getTurnStyle();
    
    switch (style) {
      case 'flexible':
        return true; // Anyone can speak anytime
        
      case 'strict':
        const participants = await this.getParticipants();
        if (participants.length === 0) return true;
        
        const lastSender = await this.getLastMessageSender();
        if (!lastSender) return true; // First message
        
        const lastSenderIndex = participants.indexOf(lastSender);
        if (lastSenderIndex === -1) return true; // Safety fallback
        
        // Next person in the array
        const nextIndex = (lastSenderIndex + 1) % participants.length;
        return participants[nextIndex] === userId;
        
      case 'moderated':
        // Simple rate limiting: max 2 messages per minute
        const oneMinuteAgo = new Date(Date.now() - 60000);
        const recentMessages = await prisma.event.findMany({
          where: {
            chat_id: this.chatId,
            type: 'message',
            created_at: { gte: oneMinuteAgo }
          },
          select: { data: true }
        });
        
        const userMessageCount = recentMessages.filter(msg => 
          (msg.data as any)?.senderId === userId
        ).length;
        
        return userMessageCount < 2;
        
      default:
        return true;
    }
  }

  // Get current turn state (simplified)
  async getCurrentTurn(): Promise<TurnState | null> {
    const style = await this.getTurnStyle();
    
    if (style === 'flexible') {
      return { next_user_id: 'anyone' }; // Dummy state for flexible
    }
    
    const participants = await this.getParticipants();
    if (participants.length === 0) {
      return { next_user_id: 'none' };
    }
    
    const lastSender = await this.getLastMessageSender();
    if (!lastSender) {
      return { next_user_id: participants[0] }; // First participant starts
    }
    
    const lastSenderIndex = participants.indexOf(lastSender);
    const nextIndex = (lastSenderIndex + 1) % participants.length;
    
    return { next_user_id: participants[nextIndex] };
  }

  // Initialize turn state (only create DB record if needed for strict mode)
  async initializeTurn(firstUserId: string): Promise<TurnState> {
    const style = await this.getTurnStyle();
    
    if (style !== 'strict') {
      // No DB state needed for flexible/moderated
      return { next_user_id: firstUserId };
    }
    
    // Only create DB state for strict mode
    try {
      const existingState = await prisma.chatTurnState.findUnique({
        where: { chat_id: this.chatId }
      });
      
      if (existingState) {
        return {
          next_user_id: existingState.next_user_id || firstUserId,
          next_role: existingState.next_role || undefined
        };
      }
      
      const newState = await prisma.chatTurnState.create({
        data: {
          chat_id: this.chatId,
          next_user_id: firstUserId,
          next_role: 'user',
          turn_queue: [firstUserId],
          current_turn_index: 0
        }
      });
      
      return {
        next_user_id: newState.next_user_id || firstUserId,
        next_role: newState.next_role || undefined
      };
    } catch (error) {
      console.error('[TurnManager] Error initializing turn:', error);
      return { next_user_id: firstUserId };
    }
  }

  // Check if AI should respond (extensible hook)
  async shouldTriggerAIResponse(): Promise<boolean> {
    const style = await this.getTurnStyle();
    
    switch (style) {
      case 'flexible':
        return true; // AI responds after any message
        
      case 'strict':
        // AI responds after everyone has spoken once in round
        const participants = await this.getParticipants();
        const lastSender = await this.getLastMessageSender();
        
        if (!lastSender || participants.length === 0) return false;
        
        const lastSenderIndex = participants.indexOf(lastSender);
        const isLastInRound = lastSenderIndex === participants.length - 1;
        
        return isLastInRound;
        
      case 'moderated':
        return true; // AI responds to moderate conversation
        
      default:
        return true;
    }
  }

  // Reset turn state (simplified)
  async resetTurn(): Promise<TurnState> {
    const participants = await this.getParticipants();
    const firstUserId = participants[0] || 'none';
    
    try {
      // Only reset DB state for strict mode
      const style = await this.getTurnStyle();
      
      if (style === 'strict') {
        await prisma.chatTurnState.deleteMany({
          where: { chat_id: this.chatId }
        });
        
        return await this.initializeTurn(firstUserId);
      } else {
        // For flexible/moderated, just return dummy state
        return { next_user_id: 'anyone' };
      }
    } catch (error) {
      console.error('[TurnManager] Error resetting turn:', error);
      return { next_user_id: firstUserId };
    }
  }
}