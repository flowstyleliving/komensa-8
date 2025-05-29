// GPT CONTEXT:\n// Turn management system specifically for DEMO CHATS in Komensa.\n// Handles role-based turn transitions (Michael, Jordan, Mediator)

// GPT CONTEXT:
// Simplified turn management system for Komensa chat application
// Handles regular (non-demo) chats, primarily user-based turns.

import { prisma } from '@/lib/prisma';
import { pusherServer, getChatChannelName, PUSHER_EVENTS } from '@/lib/pusher';
import { setTypingIndicator, getTypingUsers } from '@/lib/redis';

// Demo roles - Central to this manager
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

export interface DemoTurnState {
  next_role: string;
  next_user_id?: string; // User ID corresponding to the next_role
  turn_queue: string[];
  current_turn_index: number;
}

export class DemoTurnManager {
  constructor(private chatId: string) {}

  async getCurrentTurn(): Promise<DemoTurnState | null> {
    const turnState = await prisma.chatTurnState.findUnique({
      where: { chat_id: this.chatId }
    });

    if (!turnState) {
      console.warn('[DemoTurnManager] No turn state found for chat, attempting to initialize for Michael default.', { chatId: this.chatId });
      const userAParticipant = await prisma.chatParticipant.findFirst({
        where: {
          chat_id: this.chatId,
          user: { display_name: 'Michael' } 
        },
        select: { user_id: true }
      });
      if (userAParticipant?.user_id) {
        return this.initializeDemoTurns(userAParticipant.user_id, DEMO_ROLES.USER_A);
      }
      return null;
    }

    return {
      next_role: (turnState as any).next_role || DEFAULT_TURN_ORDER[0],
      next_user_id: turnState.next_user_id || undefined, 
      turn_queue: ((turnState as any).turn_queue as string[])?.length ? ((turnState as any).turn_queue as string[]) : DEFAULT_TURN_ORDER,
      current_turn_index: typeof (turnState as any).current_turn_index === 'number' ? (turnState as any).current_turn_index : 0
    };
  }

  async initializeDemoTurns(userAId: string, startingRole: typeof DEMO_ROLES[keyof typeof DEMO_ROLES] = DEMO_ROLES.USER_A): Promise<DemoTurnState> {
    console.log('[DemoTurnManager] Initializing demo turns', { chatId: this.chatId, userAId, startingRole });
    const startingIndex = DEFAULT_TURN_ORDER.indexOf(startingRole);
    if (startingIndex === -1) {
      throw new Error(`Invalid starting role for demo: ${startingRole}`);
    }

    let nextUserIdForInit = userAId;
    if (startingRole === DEMO_ROLES.MEDIATOR) {
      nextUserIdForInit = 'assistant';
    } else if (startingRole === DEMO_ROLES.JORDAN) {
      const jordan = await this.getUserIdForRole(DEMO_ROLES.JORDAN);
      if (!jordan) throw new Error('Could not find Jordan to initialize demo turn.');
      nextUserIdForInit = jordan;
    }

    const newTurnStateData = {
      next_role: startingRole,
      next_user_id: nextUserIdForInit,
      turn_queue: DEFAULT_TURN_ORDER,
      current_turn_index: startingIndex
    };

    await prisma.chatTurnState.upsert({
      where: { chat_id: this.chatId },
      update: newTurnStateData as any, 
      create: { chat_id: this.chatId, ...newTurnStateData } as any
    });

    const channelName = getChatChannelName(this.chatId);
    await pusherServer.trigger(channelName, PUSHER_EVENTS.TURN_UPDATE, { 
      next_role: startingRole,
      next_user_id: nextUserIdForInit 
    });
    console.log('[DemoTurnManager] Demo turns initialized and event emitted.', newTurnStateData);
    return newTurnStateData;
  }

  async setTurnToRole(role: typeof DEMO_ROLES[keyof typeof DEMO_ROLES]): Promise<DemoTurnState> {
    console.log('[DemoTurnManager] Setting turn to role:', { chatId: this.chatId, role });
    let currentState = await this.getCurrentTurn(); // Make mutable for potential re-initialization
    if (!currentState) {
      console.warn('[DemoTurnManager] No current turn state, attempting to initialize for role:', role);
      const userA = await this.getUserIdForRole(DEMO_ROLES.USER_A); 
      if (!userA) throw new Error('Cannot set turn: Michael not found for demo initialization.');
      currentState = await this.initializeDemoTurns(userA, role);
    }

    const roleIndex = currentState.turn_queue.indexOf(role);
    if (roleIndex === -1) {
      console.error(`[DemoTurnManager] Role ${role} not found in turn queue: `, currentState.turn_queue);
      throw new Error(`Role ${role} not found in turn queue`);
    }

    const userId = await this.getUserIdForRole(role);
    if (!userId && role !== DEMO_ROLES.MEDIATOR) {
        console.error(`[DemoTurnManager] Could not get user ID for role ${role} and it is not Mediator.`);
        throw new Error (`Could not determine user ID for role: ${role}`);
    }
    const finalUserId = role === DEMO_ROLES.MEDIATOR ? 'assistant' : userId;

    const newState: DemoTurnState = {
      ...currentState, 
      next_role: role,
      next_user_id: finalUserId || undefined,
      current_turn_index: roleIndex
    };

    await prisma.chatTurnState.update({
      where: { chat_id: this.chatId },
      data: {
        next_role: role,
        next_user_id: finalUserId || undefined,
        current_turn_index: roleIndex,
        turn_queue: currentState.turn_queue 
      } as any
    });

    await this.clearStaleTypingIndicators(finalUserId || undefined);
    
    const channelName = getChatChannelName(this.chatId);
    await pusherServer.trigger(channelName, PUSHER_EVENTS.TURN_UPDATE, { 
      next_role: role,
      next_user_id: finalUserId 
    });
    console.log('[DemoTurnManager] Turn set to role and event emitted.', newState);
    return newState;
  }

  async advanceTurn(): Promise<DemoTurnState> {
    console.log('[DemoTurnManager] Advancing turn for chat:', this.chatId);
    const currentState = await this.getCurrentTurn();
    if (!currentState) {
      throw new Error('Cannot advance turn: No current turn state found for chat.');
    }

    const nextIndex = (currentState.current_turn_index + 1) % currentState.turn_queue.length;
    const nextRoleInQueue = currentState.turn_queue[nextIndex];
    
    console.log('[DemoTurnManager] Advancing from:', currentState.next_role, 'to:', nextRoleInQueue);
    return this.setTurnToRole(nextRoleInQueue as typeof DEMO_ROLES[keyof typeof DEMO_ROLES]);
  }

  async canUserSendMessage(userId: string): Promise<boolean> {
    const currentState = await this.getCurrentTurn();
    if (!currentState) {
      console.warn('[DemoTurnManager] No turn state for canUserSendMessage, assuming false.', { chatId: this.chatId });
      return false; 
    }
    
    if (currentState.next_user_id === userId) {
      console.log('[DemoTurnManager] canUserSendMessage: true (direct user ID match)', { userId, next_user_id: currentState.next_user_id });
      return true;
    }
    
    const userRole = await this.getRoleForUserId(userId);
    if (userRole === currentState.next_role) {
       console.log('[DemoTurnManager] canUserSendMessage: true (role match)', { userId, userRole, next_role: currentState.next_role });
      return true;
    }
    
    console.log('[DemoTurnManager] canUserSendMessage: false', { userId, userRole, currentTurn: currentState });
    return false;
  }

  async getRoleForUserId(userId: string): Promise<typeof DEMO_ROLES[keyof typeof DEMO_ROLES] | null> {
    if (userId === 'assistant') {
      return DEMO_ROLES.MEDIATOR;
    }

    const participant = await prisma.chatParticipant.findFirst({
      where: { chat_id: this.chatId, user_id: userId },
      include: { user: { select: { display_name: true } } }
    });

    if (!participant?.user?.display_name) return null;

    if (participant.user.display_name === 'Michael') {
      return DEMO_ROLES.USER_A;
    } else if (participant.user.display_name === 'Jordan') {
      return DEMO_ROLES.JORDAN;
    }
    return null;
  }

  async getUserIdForRole(role: typeof DEMO_ROLES[keyof typeof DEMO_ROLES]): Promise<string | null> {
    if (role === DEMO_ROLES.MEDIATOR) {
      return 'assistant';
    }
    let displayNameQuery: string;
    if (role === DEMO_ROLES.USER_A) {
      displayNameQuery = 'Michael';
    } else if (role === DEMO_ROLES.JORDAN) {
      displayNameQuery = 'Jordan';
    } else {
      console.warn('[DemoTurnManager] Unknown role for getUserIdForRole:', role);
      return null;
    }

    const participant = await prisma.chatParticipant.findFirst({
      where: { chat_id: this.chatId, user: { display_name: displayNameQuery } },
      select: { user_id: true }
    });
    return participant?.user_id || null;
  }

  private async clearStaleTypingIndicators(newActiveUserId?: string): Promise<void> {
    try {
      const typingUsers = await getTypingUsers(this.chatId);
      const channelName = getChatChannelName(this.chatId);
      
      for (const userId of typingUsers) {
        if (userId !== newActiveUserId && userId !== 'assistant') { 
          console.log('[DemoTurnManager] Clearing stale typing for user:', userId);
          // await setTypingIndicator(this.chatId, userId, false); // BYPASSED
          console.log('[DemoTurnManager] Stale typing indicator cleared in Redis (BYPASSED)');
          await pusherServer.trigger(channelName, PUSHER_EVENTS.USER_TYPING, { userId, isTyping: false });
        }
      }
    } catch (error) {
      console.error('[DemoTurnManager] Error clearing stale typing indicators:', error);
    }
  }
} 