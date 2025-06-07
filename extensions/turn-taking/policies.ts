// Turn-taking policy implementations

export interface TurnPolicy {
  canUserSendMessage(userId: string, chatState: any): Promise<boolean>;
  getNextUserId(chatState: any, lastSenderId?: string): Promise<string | null>;
  initializeTurn(chatId: string, userId: string): Promise<void>;
}

export class StrictTurnPolicy implements TurnPolicy {
  async canUserSendMessage(userId: string, chatState: any): Promise<boolean> {
    // Traditional strict turn-based logic
    return chatState?.next_user_id === userId || chatState?.next_user_id === null;
  }

  async getNextUserId(chatState: any, lastSenderId?: string): Promise<string | null> {
    // Cycle through participants
    const participants = chatState.participants || [];
    if (participants.length === 0) return null;
    
    const currentIndex = participants.findIndex((p: any) => p.id === lastSenderId);
    const nextIndex = (currentIndex + 1) % participants.length;
    return participants[nextIndex]?.id || null;
  }

  async initializeTurn(chatId: string, userId: string): Promise<void> {
    // Initialize with the first user
    // Implementation would update database
    console.log(`[StrictTurnPolicy] Initializing turn for ${userId} in chat ${chatId}`);
  }
}

export class FlexibleTurnPolicy implements TurnPolicy {
  async canUserSendMessage(userId: string, chatState: any): Promise<boolean> {
    // Anyone can send a message anytime
    return true;
  }

  async getNextUserId(chatState: any, lastSenderId?: string): Promise<string | null> {
    // In flexible mode, there's no predetermined next user
    // The next person to speak will be determined dynamically
    return null;
  }

  async initializeTurn(chatId: string, userId: string): Promise<void> {
    // No initialization needed for flexible turns
    console.log(`[FlexibleTurnPolicy] No turn initialization needed for chat ${chatId}`);
  }
}

export class ModeratedTurnPolicy implements TurnPolicy {
  async canUserSendMessage(userId: string, chatState: any): Promise<boolean> {
    // AI-moderated logic - could be enhanced with ML
    const recentMessages = chatState.messages?.slice(-5) || [];
    const recentSenders = recentMessages.map((m: any) => m.data?.senderId);
    
    // Prevent spam: max 3 consecutive messages from same user
    const consecutiveCount = this.getConsecutiveMessageCount(recentSenders, userId);
    if (consecutiveCount >= 3) {
      console.log(`[ModeratedTurnPolicy] Blocking ${userId} - too many consecutive messages`);
      return false;
    }
    
    // Allow if user hasn't spoken recently
    return true;
  }

  async getNextUserId(chatState: any, lastSenderId?: string): Promise<string | null> {
    // AI determines who should speak next based on context
    const participants = chatState.participants || [];
    const recentMessages = chatState.messages?.slice(-10) || [];
    
    // Simple logic: find participant who has spoken least recently
    const messageCounts = participants.reduce((counts: any, p: any) => {
      counts[p.id] = recentMessages.filter((m: any) => m.data?.senderId === p.id).length;
      return counts;
    }, {});
    
    const leastActiveUser = participants
      .filter((p: any) => p.id !== lastSenderId && p.id !== 'assistant')
      .sort((a: any, b: any) => messageCounts[a.id] - messageCounts[b.id])[0];
    
    return leastActiveUser?.id || null;
  }

  async initializeTurn(chatId: string, userId: string): Promise<void> {
    console.log(`[ModeratedTurnPolicy] Initializing moderated turn for ${userId} in chat ${chatId}`);
  }

  private getConsecutiveMessageCount(recentSenders: string[], userId: string): number {
    let count = 0;
    for (let i = recentSenders.length - 1; i >= 0; i--) {
      if (recentSenders[i] === userId) {
        count++;
      } else {
        break;
      }
    }
    return count;
  }
}

// Factory function to get the appropriate policy
export function getTurnPolicy(style: string): TurnPolicy {
  switch (style) {
    case 'strict':
      return new StrictTurnPolicy();
    case 'flexible':
      return new FlexibleTurnPolicy();
    case 'moderated':
      return new ModeratedTurnPolicy();
    default:
      return new FlexibleTurnPolicy(); // Default to flexible
  }
}