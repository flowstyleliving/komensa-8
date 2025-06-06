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
    // Find the first non-assistant participant (usually the chat creator)
    const firstUser = participants.find(p => p.id !== 'assistant');
    
    if (firstUser) {
      return {
        next_user_id: firstUser.id,
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
      // AI just responded, turn goes back to the original user who triggered the AI
      // We need to look at the message before the AI's message
      const userMessages = events
        .filter(e => e.type === 'message' && e.data.senderId !== 'assistant')
        .sort((a, b) => a.created_at.getTime() - b.created_at.getTime());
      
      const lastUserMessage = userMessages.slice(-1)[0];
      const nextUserId = lastUserMessage?.data.senderId || participants.find(p => p.id !== 'assistant')?.id;

      return {
        next_user_id: nextUserId || 'assistant',
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
    return currentTurn.next_user_id === userId;
  }

  getDisplayText(currentTurn: TurnState, participants: Participant[]): string {
    if (currentTurn.next_user_id === 'assistant') {
      return 'AI Mediator is thinking...';
    }

    // Special case: If this is the first turn and multiple participants exist
    const humanParticipants = participants.filter(p => p.id !== 'assistant');
    if (humanParticipants.length > 1 && currentTurn.next_role === 'user') {
      // Check if this might be the initial state where anyone can start
      const user = participants.find(p => p.id === currentTurn.next_user_id);
      if (user) {
        return `${user.display_name || 'User'} can start the conversation...`;
      } else {
        return 'Anyone can start the conversation...';
      }
    }

    const user = participants.find(p => p.id === currentTurn.next_user_id);
    const userName = user?.display_name || 'Unknown User';
    
    return `Waiting for ${userName}...`;
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