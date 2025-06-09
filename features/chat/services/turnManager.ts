// Simplified turn management using participant arrays
import { prisma } from '@/lib/prisma';

export interface TurnState {
  next_user_id: string;
  next_role?: string;
}

export class TurnManager {
  protected chatId: string;

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

  // Get turn mode from chat settings
  async getTurnMode(): Promise<string> {
    try {
      const chat = await prisma.chat.findUnique({
        where: { id: this.chatId },
        select: { turn_taking: true }
      });
      
      return chat?.turn_taking || 'flexible';
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
    console.log(`[TurnManager] Checking permissions for user ${userId} in chat ${this.chatId}`);
    
    const mode = await this.getTurnMode();
    console.log(`[TurnManager] Turn mode: ${mode}`);
    
    // FIRST: Check if user is a participant at all (with retry for guest users)
    let participants = await this.getParticipants();
    console.log(`[TurnManager] All participants:`, participants);
    
    // GUEST USER RACE CONDITION FIX: Retry for guest users who might have just been added
    if (!participants.includes(userId) && userId.startsWith('guest_')) {
      console.log(`[TurnManager] Guest user not found in participants, retrying in case of race condition...`);
      
      // Brief delay to allow database consistency
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Retry getting participants
      participants = await this.getParticipants();
      console.log(`[TurnManager] Participants after retry:`, participants);
      
      if (participants.includes(userId)) {
        console.log(`[TurnManager] Guest user found on retry - race condition resolved`);
      }
    }
    
    if (!participants.includes(userId)) {
      console.log(`[TurnManager] User ${userId} is not a participant after all attempts - denying access`);
      return false;
    }
    
    switch (mode) {
      case 'flexible':
        console.log(`[TurnManager] Flexible mode - allowing user ${userId}`);
        return true; // Anyone can speak anytime
        
      case 'strict':
      case 'rounds':
        const modeLabel = mode === 'strict' ? 'Strict' : 'Rounds';
        console.log(`[TurnManager] ${modeLabel} mode - participants:`, participants);
        
        if (participants.length === 0) {
          console.log(`[TurnManager] No participants found - allowing user ${userId}`);
          return true;
        }
        
        const lastSender = await this.getLastMessageSender();
        console.log(`[TurnManager] Last message sender: ${lastSender}`);
        
        if (!lastSender) {
          console.log(`[TurnManager] No last sender - allowing user ${userId} for first message`);
          return true; // First message
        }
        
        const lastSenderIndex = participants.indexOf(lastSender);
        if (lastSenderIndex === -1) {
          console.log(`[TurnManager] Last sender not in participants - allowing user ${userId}`);
          return true; // Safety fallback
        }
        
        // Next person in the array (same logic for both strict and rounds)
        const nextIndex = (lastSenderIndex + 1) % participants.length;
        const nextUserId = participants[nextIndex];
        const canSend = nextUserId === userId;
        console.log(`[TurnManager] ${modeLabel} turn check: nextUser=${nextUserId}, requesting=${userId}, canSend=${canSend}`);
        return canSend;
        
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
        
        const moderatedCanSend = userMessageCount < 2;
        console.log(`[TurnManager] Moderated mode: user ${userId} has ${userMessageCount} recent messages, canSend=${moderatedCanSend}`);
        return moderatedCanSend;
        
      default:
        console.log(`[TurnManager] Unknown mode ${mode} - allowing user ${userId}`);
        return true;
    }
  }

  // Get current turn state (simplified)
  async getCurrentTurn(): Promise<TurnState | null> {
    const mode = await this.getTurnMode();
    
    if (mode === 'flexible') {
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
    
    if (mode === 'moderated') {
      // AI-driven moderated mode: determine next speaker based on engagement
      return await this.getModeratedNextTurn(participants, lastSender);
    }
    
    // Strict and Rounds modes: simple round-robin
    const lastSenderIndex = participants.indexOf(lastSender);
    const nextIndex = (lastSenderIndex + 1) % participants.length;
    
    return { next_user_id: participants[nextIndex] };
  }

  // Initialize turn state (only create DB record if needed for strict/rounds modes)
  async initializeTurn(firstUserId: string): Promise<TurnState> {
    const mode = await this.getTurnMode();
    
    if (mode !== 'strict' && mode !== 'rounds') {
      // No DB state needed for flexible/moderated
      return { next_user_id: firstUserId };
    }
    
    // Create DB state for strict and rounds modes
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
    console.log(`[TurnManager] Checking if AI should respond...`);
    const mode = await this.getTurnMode();
    console.log(`[TurnManager] Turn mode: ${mode}`);
    
    switch (mode) {
      case 'flexible':
        console.log(`[TurnManager] Flexible mode - AI responds after any message`);
        return true; // AI responds after any message
        
      case 'strict':
        // AI responds after each person to facilitate exchanges
        console.log(`[TurnManager] Strict mode - AI responds after each person for facilitation`);
        return true;
        
      case 'rounds':
        // AI responds only after complete rounds (minimal AI involvement)
        const participants = await this.getParticipants();
        const lastSender = await this.getLastMessageSender();
        
        console.log(`[TurnManager] Rounds mode check - participants: ${participants.length}, lastSender: ${lastSender}`);
        
        if (!lastSender || participants.length === 0) {
          console.log(`[TurnManager] No last sender or no participants - AI will not respond`);
          return false;
        }
        
        // AI responds only when last person in round has spoken
        const lastSenderIndex = participants.indexOf(lastSender);
        const isLastInRound = lastSenderIndex === participants.length - 1;
        
        console.log(`[TurnManager] Rounds mode analysis - lastSenderIndex: ${lastSenderIndex}, isLastInRound: ${isLastInRound}`);
        
        return isLastInRound;
        
      case 'moderated':
        console.log(`[TurnManager] Moderated mode - AI responds to moderate conversation`);
        return true; // AI responds to moderate conversation
        
      default:
        console.log(`[TurnManager] Unknown mode - AI will respond by default`);
        return true;
    }
  }

  // AI-driven moderated turn logic
  async getModeratedNextTurn(participants: string[], lastSender: string): Promise<TurnState> {
    console.log(`[TurnManager] Calculating moderated next turn for participants: ${participants.join(', ')}`);
    
    try {
      // Get recent messages to analyze engagement patterns
      const tenMinutesAgo = new Date(Date.now() - 600000); // 10 minutes
      const recentMessages = await prisma.event.findMany({
        where: {
          chat_id: this.chatId,
          type: 'message',
          created_at: { gte: tenMinutesAgo }
        },
        orderBy: { created_at: 'desc' },
        take: 20, // Last 20 messages
        select: { data: true, created_at: true }
      });
      
      console.log(`[TurnManager] Found ${recentMessages.length} recent messages for analysis`);
      
      // Count messages per participant in recent history
      const messageCounts = participants.reduce((counts, participantId) => {
        counts[participantId] = recentMessages.filter(msg => 
          (msg.data as any)?.senderId === participantId
        ).length;
        return counts;
      }, {} as Record<string, number>);
      
      console.log(`[TurnManager] Message counts:`, messageCounts);
      
      // Exclude the last sender and assistant from next turn consideration
      const eligibleParticipants = participants.filter(p => 
        p !== lastSender && p !== 'assistant'
      );
      
      if (eligibleParticipants.length === 0) {
        console.log(`[TurnManager] No eligible participants, defaulting to first participant`);
        return { next_user_id: participants[0] || 'none' };
      }
      
      // Find participant who has spoken least recently (AI moderation logic)
      const leastActiveUser = eligibleParticipants
        .sort((a, b) => {
          const countA = messageCounts[a] || 0;
          const countB = messageCounts[b] || 0;
          
          // Sort by message count (ascending), then by participant order for tie-breaking
          if (countA !== countB) {
            return countA - countB;
          }
          
          // Tie-breaker: use participant array order
          return participants.indexOf(a) - participants.indexOf(b);
        })[0];
      
      console.log(`[TurnManager] AI moderation selected next speaker: ${leastActiveUser} (had ${messageCounts[leastActiveUser] || 0} recent messages)`);
      
      return { 
        next_user_id: leastActiveUser,
        next_role: 'user' 
      };
      
    } catch (error) {
      console.error('[TurnManager] Error in moderated turn calculation:', error);
      
      // Fallback to simple round-robin if analysis fails
      const lastSenderIndex = participants.indexOf(lastSender);
      const nextIndex = (lastSenderIndex + 1) % participants.length;
      const fallbackUser = participants[nextIndex];
      
      console.log(`[TurnManager] Falling back to round-robin: ${fallbackUser}`);
      return { next_user_id: fallbackUser };
    }
  }

  // Reset turn state (simplified)
  async resetTurn(): Promise<TurnState> {
    const participants = await this.getParticipants();
    const firstUserId = participants[0] || 'none';
    
    try {
      // Only reset DB state for strict and rounds modes
      const mode = await this.getTurnMode();
      
      if (mode === 'strict' || mode === 'rounds') {
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