// Event-driven turn management policies for different chat types
// This replaces the complex dual TurnManager system with a clean, extensible architecture

export interface ChatEvent {
  id: string;
  chat_id: string;
  type: string;
  data: any;
  created_at: Date;
  seq: number;
}

export interface Participant {
  id: string;
  display_name: string;
  role?: string;
}

export interface TurnState {
  next_user_id: string;
  next_role?: string;
}

export interface ChatContext {
  chatId: string;
  participants: Participant[];
  lastActivity: Date;
  messageCount: number;
}

// Base interface for all turn policies
export interface TurnPolicy {
  name: string;
  calculateNextTurn(events: ChatEvent[], participants: Participant[]): TurnState;
  canUserSendMessage(userId: string, currentTurn: TurnState, context: ChatContext): boolean;
  getDisplayText(currentTurn: TurnState, participants: Participant[]): string;
  initializeFirstTurn(participants: Participant[]): TurnState;
}

// Mediated chat policy - matches current Komensa behavior
export class MediatedTurnPolicy implements TurnPolicy {
  name = 'mediated';

  initializeFirstTurn(participants: Participant[]): TurnState {
    // Find the chat creator first, fallback to first non-assistant participant
    const humanParticipants = participants.filter(p => p.id !== 'assistant');
    
    if (humanParticipants.length > 0) {
      // For now, use the first participant as creator
      // TODO: In the future, we could pass creator info to this method
      return {
        next_user_id: humanParticipants[0].id,
        next_role: 'user'
      };
    }
    
    // Fallback: if only assistant exists, return assistant (shouldn't happen in normal flow)
    return {
      next_user_id: participants[0]?.id || 'assistant',
      next_role: 'user'
    };
  }

  calculateNextTurn(events: ChatEvent[], participants: Participant[]): TurnState {
    // If no events, return first turn
    if (events.length === 0) {
      return this.initializeFirstTurn(participants);
    }

    // Get the last message event
    const lastMessage = events
      .filter(e => e.type === 'message')
      .sort((a, b) => a.created_at.getTime() - b.created_at.getTime())
      .slice(-1)[0];

    if (!lastMessage) {
      return this.initializeFirstTurn(participants);
    }

    const senderId = lastMessage.data.senderId;

    if (senderId === 'assistant') {
      // AI just responded, determine next human participant
      const humanParticipants = participants.filter(p => p.id !== 'assistant');
      
      if (humanParticipants.length <= 1) {
        // Only one human participant, they can continue after AI responds
        return {
          next_user_id: humanParticipants[0]?.id || 'assistant',
          next_role: 'user'
        };
      }

      // Multiple participants: STRICT turn rotation - must wait for other participants
      // Get all user messages (excluding AI) to determine who spoke last
      const userMessages = events
        .filter(e => e.type === 'message' && e.data.senderId !== 'assistant')
        .sort((a, b) => a.created_at.getTime() - b.created_at.getTime());
      
      if (userMessages.length === 0) {
        // No user messages yet (shouldn't happen if we're here after AI), start with first participant
        return {
          next_user_id: humanParticipants[0].id,
          next_role: 'user'
        };
      }

      // Find the last user who spoke before this AI response
      const lastUserMessage = userMessages.slice(-1)[0];
      const lastUserSenderId = lastUserMessage.data.senderId;
      
      // STRICT POLICY: Always move to the NEXT participant in rotation
      // The previous speaker must wait for everyone else to have a turn
      const currentUserIndex = humanParticipants.findIndex(p => p.id === lastUserSenderId);
      
      if (currentUserIndex === -1) {
        // Fallback: if we can't find the user, start with first
        console.warn('[MediatedTurnPolicy] Could not find last speaker in participants, defaulting to first');
        return {
          next_user_id: humanParticipants[0].id,
          next_role: 'user'
        };
      }
      
      // Move to next participant in rotation (creator must wait for others)
      const nextUserIndex = (currentUserIndex + 1) % humanParticipants.length;
      const nextUser = humanParticipants[nextUserIndex];
      
      console.log('[MediatedTurnPolicy] STRICT turn rotation - AI finished, next participant must speak:', {
        lastUserSenderId,
        lastUserName: humanParticipants[currentUserIndex]?.display_name,
        currentUserIndex,
        nextUserIndex,
        nextUserId: nextUser.id,
        nextUserName: nextUser.display_name,
        totalHumanParticipants: humanParticipants.length,
        strictPolicy: 'creator_must_wait'
      });

      return {
        next_user_id: nextUser.id,
        next_role: 'user'
      };
    } else {
      // User just sent a message, AI's turn next
      return {
        next_user_id: 'assistant',
        next_role: 'assistant'
      };
    }
  }

  canUserSendMessage(userId: string, currentTurn: TurnState, context: ChatContext): boolean {
    // Special case: Allow first message even if other participants haven't joined
    if (context.messageCount === 0) {
      // Any human participant can send the first message to start the conversation
      const isHumanParticipant = context.participants.some(p => p.id === userId && p.id !== 'assistant');
      if (isHumanParticipant) {
        console.log('[MediatedTurnPolicy] Allowing first message from user:', userId);
        return true;
      }
    }

    // Regular turn-based behavior: users can only send when it's their turn
    const canSend = currentTurn.next_user_id === userId;
    console.log('[MediatedTurnPolicy] canUserSendMessage - DETAILED:', {
      userId,
      currentTurnNextUserId: currentTurn.next_user_id,
      currentTurnNextRole: currentTurn.next_role,
      messageCount: context.messageCount,
      participantIds: context.participants.map(p => p.id),
      canSend,
      reason: canSend ? 'user_id_match' : `expected_${currentTurn.next_user_id}_got_${userId}`
    });
    
    return canSend;
  }

  getDisplayText(currentTurn: TurnState, participants: Participant[]): string {
    if (currentTurn.next_user_id === 'assistant') {
      return 'AI Mediator is thinking...';
    }

    // Special case: If this is the first turn and multiple participants exist
    const humanParticipants = participants.filter(p => p.id !== 'assistant');
    if (humanParticipants.length > 1 && currentTurn.next_role === 'user') {
      const user = participants.find(p => p.id === currentTurn.next_user_id);
      if (user) {
        // For multi-participant chats, be explicit about waiting
        if (humanParticipants.length === 2) {
          return `Waiting for ${user.display_name || 'User'} to respond...`;
        } else {
          return `${user.display_name || 'User'}'s turn to speak...`;
        }
      } else {
        return 'Waiting for the next participant...';
      }
    }

    const user = participants.find(p => p.id === currentTurn.next_user_id);
    const userName = user?.display_name || 'Unknown User';
    
    // For multi-participant chats, emphasize the waiting aspect
    if (humanParticipants.length > 1) {
      return `Waiting for ${userName} to respond...`;
    } else {
      return `Waiting for ${userName}...`;
    }
  }
}

// Free-form policy for less structured chats
export class FreeFormTurnPolicy implements TurnPolicy {
  name = 'free-form';

  initializeFirstTurn(participants: Participant[]): TurnState {
    return {
      next_user_id: 'anyone',
      next_role: 'user'
    };
  }

  calculateNextTurn(events: ChatEvent[], participants: Participant[]): TurnState {
    // In free-form, anyone can speak at any time
    return {
      next_user_id: 'anyone',
      next_role: 'user'
    };
  }

  canUserSendMessage(userId: string, currentTurn: TurnState, context: ChatContext): boolean {
    // Anyone can send messages in free-form chats
    return userId !== 'assistant';
  }

  getDisplayText(currentTurn: TurnState, participants: Participant[]): string {
    return 'Anyone can share their thoughts...';
  }
}

// Round-robin policy for structured group chats
export class RoundRobinTurnPolicy implements TurnPolicy {
  name = 'round-robin';

  initializeFirstTurn(participants: Participant[]): TurnState {
    const firstUser = participants.find(p => p.id !== 'assistant');
    return {
      next_user_id: firstUser?.id || 'assistant',
      next_role: 'user'
    };
  }

  calculateNextTurn(events: ChatEvent[], participants: Participant[]): TurnState {
    const humanParticipants = participants.filter(p => p.id !== 'assistant');
    
    if (humanParticipants.length === 0) {
      return { next_user_id: 'assistant', next_role: 'assistant' };
    }

    // Get last message
    const lastMessage = events
      .filter(e => e.type === 'message')
      .sort((a, b) => a.created_at.getTime() - b.created_at.getTime())
      .slice(-1)[0];

    if (!lastMessage || lastMessage.data.senderId === 'assistant') {
      // Start with first participant
      return {
        next_user_id: humanParticipants[0].id,
        next_role: 'user'
      };
    }

    // Find current user's index and move to next
    const currentIndex = humanParticipants.findIndex(p => p.id === lastMessage.data.senderId);
    const nextIndex = (currentIndex + 1) % humanParticipants.length;
    
    return {
      next_user_id: humanParticipants[nextIndex].id,
      next_role: 'user'
    };
  }

  canUserSendMessage(userId: string, currentTurn: TurnState, context: ChatContext): boolean {
    return currentTurn.next_user_id === userId;
  }

  getDisplayText(currentTurn: TurnState, participants: Participant[]): string {
    if (currentTurn.next_user_id === 'assistant') {
      return 'AI Mediator is thinking...';
    }

    const user = participants.find(p => p.id === currentTurn.next_user_id);
    const userName = user?.display_name || 'Unknown User';
    
    return `${userName}'s turn to speak...`;
  }
}

// Factory function to create appropriate policy
export function createTurnPolicy(chatType: string = 'mediated'): TurnPolicy {
  switch (chatType) {
    case 'free-form':
      return new FreeFormTurnPolicy();
    case 'round-robin':
      return new RoundRobinTurnPolicy();
    case 'mediated':
    default:
      return new MediatedTurnPolicy();
  }
} 