// GPT CONTEXT:
// Simplified turn management system for Komensa chat application
// Handles both demo chats (role-based) and regular chats (user-based)

import { prisma } from '@/lib/prisma';
import { pusherServer, getChatChannelName, PUSHER_EVENTS } from '@/lib/pusher';
import { setTypingIndicator, getTypingUsers } from '@/lib/redis';

// Demo roles
export const DEMO_ROLES = {
  USER_A: 'user_a',
  JORDAN: 'jordan', 
  MEDIATOR: 'mediator'
} as const;

// Default turn order for demo chats
export const DEFAULT_TURN_ORDER = [
  DEMO_ROLES.USER_A,
  DEMO_ROLES.MEDIATOR,
  DEMO_ROLES.JORDAN,
  DEMO_ROLES.MEDIATOR
];

export interface TurnState {
  next_role: string;
  next_user_id?: string;
  turn_queue: string[];
  current_turn_index: number;
}

export class TurnManager {
  constructor(private chatId: string) {}

  // Get current turn state
  async getCurrentTurn(): Promise<TurnState | null> {
    const turnState = await prisma.chatTurnState.findUnique({
      where: { chat_id: this.chatId }
    });

    if (!turnState) return null;

    return {
      next_role: (turnState as any).next_role || DEMO_ROLES.USER_A,
      next_user_id: turnState.next_user_id || undefined,
      turn_queue: ((turnState as any).turn_queue as string[]) || DEFAULT_TURN_ORDER,
      current_turn_index: (turnState as any).current_turn_index || 0
    };
  }

  // Initialize turn state for a demo chat
  async initializeDemoTurns(userAId: string): Promise<void> {
    console.log('[TurnManager] Initializing demo turns', { chatId: this.chatId, userAId });
    
    await prisma.chatTurnState.upsert({
      where: { chat_id: this.chatId },
      update: {
        next_role: DEMO_ROLES.USER_A,
        next_user_id: userAId,
        turn_queue: DEFAULT_TURN_ORDER,
        current_turn_index: 0
      } as any,
      create: {
        chat_id: this.chatId,
        next_role: DEMO_ROLES.USER_A,
        next_user_id: userAId,
        turn_queue: DEFAULT_TURN_ORDER,
        current_turn_index: 0
      } as any
    });

    // Emit turn update
    const channelName = getChatChannelName(this.chatId);
    await pusherServer.trigger(channelName, PUSHER_EVENTS.TURN_UPDATE, { 
      next_role: DEMO_ROLES.USER_A,
      next_user_id: userAId 
    });
  }

  // Set turn to a specific role
  async setTurnToRole(role: string): Promise<TurnState> {
    console.log('[TurnManager] Setting turn to role:', { chatId: this.chatId, role });
    
    const currentState = await this.getCurrentTurn();
    if (!currentState) {
      throw new Error('No turn state found for chat');
    }

    // Find the index of the role in the queue
    const roleIndex = currentState.turn_queue.indexOf(role);
    if (roleIndex === -1) {
      throw new Error(`Role ${role} not found in turn queue`);
    }

    // Get user ID for the role
    let userId: string | undefined;
    if (role === DEMO_ROLES.MEDIATOR) {
      userId = 'assistant';
    } else {
      // Get the actual user ID from the chat participants
      const chat = await prisma.chat.findUnique({
        where: { id: this.chatId },
        include: { 
          participants: {
            include: { user: true }
          }
        }
      });

      if (chat) {
                 if (role === DEMO_ROLES.USER_A) {
           const userA = chat.participants.find((p: any) => p.user.display_name === 'User A');
           userId = userA?.user_id;
         } else if (role === DEMO_ROLES.JORDAN) {
           const jordan = chat.participants.find((p: any) => p.user.display_name === 'Jordan');
           userId = jordan?.user_id;
        }
      }
    }

    const newState: TurnState = {
      next_role: role,
      next_user_id: userId,
      turn_queue: currentState.turn_queue,
      current_turn_index: roleIndex
    };

    await prisma.chatTurnState.update({
      where: { chat_id: this.chatId },
      data: {
        next_role: role,
        next_user_id: userId,
        current_turn_index: roleIndex
      } as any
    });

    // Clear stale typing indicators
    await this.clearStaleTypingIndicators(userId);
    
    // Emit turn update
    const channelName = getChatChannelName(this.chatId);
    await pusherServer.trigger(channelName, PUSHER_EVENTS.TURN_UPDATE, { 
      next_role: role,
      next_user_id: userId 
    });

    return newState;
  }

  // Check if a user can send a message
  async canUserSendMessage(userId: string): Promise<boolean> {
    const currentState = await this.getCurrentTurn();
    if (!currentState) return false;

    // Check if it's their turn by user ID
    if (currentState.next_user_id === userId) {
      return true;
    }

    // For demo chats, also check by role
    const chat = await prisma.chat.findUnique({
      where: { id: this.chatId },
      include: { 
        participants: {
          include: { user: true }
        }
      }
    });

         if (chat?.origin === 'demo') {
       const participant = chat.participants.find((p: any) => p.user_id === userId);
       if (participant) {
         const userRole = participant.user.display_name === 'User A' ? DEMO_ROLES.USER_A : DEMO_ROLES.JORDAN;
        return userRole === currentState.next_role;
      }
    }

    return false;
  }

  // Get role for a user ID (simplified)
  async getRoleForUserId(userId: string): Promise<string | null> {
    if (userId === 'assistant') {
      return DEMO_ROLES.MEDIATOR;
    }

    const chat = await prisma.chat.findUnique({
      where: { id: this.chatId },
      include: { 
        participants: {
          include: { user: true }
        }
      }
    });

    if (!chat) return null;

         const participant = chat.participants.find((p: any) => p.user_id === userId);
     if (!participant) return null;

     if (participant.user.display_name === 'User A') {
       return DEMO_ROLES.USER_A;
     } else if (participant.user.display_name === 'Jordan') {
       return DEMO_ROLES.JORDAN;
     }

     return null;
   }

   // Get user ID for a role (simplified)
   async getUserIdForRole(role: string): Promise<string | null> {
     if (role === DEMO_ROLES.MEDIATOR) {
       return 'assistant';
     }

     const chat = await prisma.chat.findUnique({
       where: { id: this.chatId },
       include: { 
         participants: {
           include: { user: true }
         }
       }
     });

     if (!chat) return null;

     if (role === DEMO_ROLES.USER_A) {
       const userA = chat.participants.find((p: any) => p.user.display_name === 'User A');
       return userA?.user_id || null;
     } else if (role === DEMO_ROLES.JORDAN) {
       const jordan = chat.participants.find((p: any) => p.user.display_name === 'Jordan');
       return jordan?.user_id || null;
    }

    return null;
  }

  // Clear stale typing indicators
  private async clearStaleTypingIndicators(newActiveUserId?: string): Promise<void> {
    try {
      const typingUsers = await getTypingUsers(this.chatId);
      const channelName = getChatChannelName(this.chatId);
      
      for (const userId of typingUsers) {
        if (userId !== newActiveUserId && userId !== 'assistant') {
          await setTypingIndicator(this.chatId, userId, false);
          await pusherServer.trigger(channelName, PUSHER_EVENTS.USER_TYPING, {
            userId,
            isTyping: false
          });
        }
      }
    } catch (error) {
      console.error('[TurnManager] Failed to clear stale typing indicators:', error);
    }
  }
} 