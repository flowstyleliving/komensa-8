import { prisma } from '@/lib/prisma';
import { pusherServer, getChatChannelName, PUSHER_EVENTS } from '@/lib/pusher';
import { setTypingIndicator, getTypingUsers } from '@/lib/redis';

// Define the roles in the demo chat
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
  next_user_id?: string; // For backward compatibility
  turn_queue: string[];
  current_turn_index: number;
}

export interface TurnConfig {
  turnOrder: string[];
  initialRole: string;
  initialIndex: number;
}

export interface RoleResolver {
  getUserIdForRole(chatId: string, role: string): Promise<string | null>;
  getRoleForUserId(chatId: string, userId: string): Promise<string | null>;
}

// Demo-specific role resolver
export class DemoRoleResolver implements RoleResolver {
  async getUserIdForRole(chatId: string, role: string): Promise<string | null> {
    if (role === DEMO_ROLES.MEDIATOR) {
      return 'assistant'; // Special case for mediator
    }

    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      include: { 
        participants: {
          include: { user: true }
        }
      }
    });

    if (!chat) return null;

    // For demo chats, identify User A by display name, Jordan by display name
    if (role === DEMO_ROLES.USER_A) {
      const userA = chat.participants.find(p => p.user.display_name === 'User A');
      return userA?.user_id || null;
    } else if (role === DEMO_ROLES.JORDAN) {
      const jordan = chat.participants.find(p => p.user.display_name === 'Jordan');
      return jordan?.user_id || null;
    }

    return null;
  }

  async getRoleForUserId(chatId: string, userId: string): Promise<string | null> {
    if (userId === 'assistant') {
      return DEMO_ROLES.MEDIATOR;
    }

    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      include: { 
        participants: {
          include: { user: true }
        }
      }
    });

    if (!chat) return null;

    // For demo chats, identify User A vs Jordan by display name
    const participant = chat.participants.find(p => p.user_id === userId);
    if (!participant) return null;

    if (participant.user.display_name === 'User A') {
      return DEMO_ROLES.USER_A;
    } else if (participant.user.display_name === 'Jordan') {
      return DEMO_ROLES.JORDAN;
    }

    return null;
  }
}

// Turn state manager - handles database operations
export class TurnStateManager {
  constructor(private chatId: string) {}

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

  async updateTurnState(state: Partial<TurnState>): Promise<void> {
    await prisma.chatTurnState.update({
      where: { chat_id: this.chatId },
      data: {
        next_role: state.next_role,
        next_user_id: state.next_user_id,
        current_turn_index: state.current_turn_index
      } as any
    });
  }

  async initializeTurnState(config: TurnConfig, initialUserId?: string): Promise<void> {
    await prisma.chatTurnState.upsert({
      where: { chat_id: this.chatId },
      update: {
        next_role: config.initialRole,
        next_user_id: initialUserId,
        turn_queue: config.turnOrder,
        current_turn_index: config.initialIndex
      } as any,
      create: {
        chat_id: this.chatId,
        next_role: config.initialRole,
        next_user_id: initialUserId,
        turn_queue: config.turnOrder,
        current_turn_index: config.initialIndex
      } as any
    });
  }
}

// Event emitter for real-time updates
export class TurnEventEmitter {
  constructor(private chatId: string) {}

  async emitTurnUpdate(state: TurnState): Promise<void> {
    const channelName = getChatChannelName(this.chatId);
    await pusherServer.trigger(channelName, PUSHER_EVENTS.TURN_UPDATE, { 
      next_role: state.next_role,
      next_user_id: state.next_user_id 
    });
  }

  // Clear typing indicators for users who are no longer in turn
  async clearStaleTypingIndicators(newActiveUserId?: string): Promise<void> {
    try {
      const typingUsers = await getTypingUsers(this.chatId);
      const channelName = getChatChannelName(this.chatId);
      
      for (const userId of typingUsers) {
        // Clear typing for users who are not the new active user
        if (userId !== newActiveUserId && userId !== 'assistant') {
          await setTypingIndicator(this.chatId, userId, false);
          await pusherServer.trigger(channelName, PUSHER_EVENTS.USER_TYPING, {
            userId,
            isTyping: false
          });
          console.log('[TurnEventEmitter] Cleared stale typing indicator for user:', userId);
        }
      }
    } catch (error) {
      console.error('[TurnEventEmitter] Failed to clear stale typing indicators:', error);
    }
  }
}

// Main turn manager - orchestrates the components
export class TurnManager {
  private stateManager: TurnStateManager;
  private eventEmitter: TurnEventEmitter;
  private roleResolver: RoleResolver;

  constructor(
    private chatId: string, 
    roleResolver?: RoleResolver
  ) {
    this.stateManager = new TurnStateManager(chatId);
    this.eventEmitter = new TurnEventEmitter(chatId);
    this.roleResolver = roleResolver || new DemoRoleResolver();
  }

  // Initialize turn state for a demo chat
  async initializeDemoTurns(userAId: string, jordanId: string): Promise<void> {
    console.log('[TurnManager] Initializing demo turns', { chatId: this.chatId, userAId, jordanId });
    
    const config: TurnConfig = {
      turnOrder: DEFAULT_TURN_ORDER,
      initialRole: DEMO_ROLES.USER_A,
      initialIndex: 0
    };

    await this.stateManager.initializeTurnState(config, userAId);
    
    const state: TurnState = {
      next_role: config.initialRole,
      next_user_id: userAId,
      turn_queue: config.turnOrder,
      current_turn_index: config.initialIndex
    };

    await this.eventEmitter.emitTurnUpdate(state);
  }

  // Get current turn state
  async getCurrentTurn(): Promise<TurnState | null> {
    return this.stateManager.getCurrentTurn();
  }

  // Advance to the next turn
  async advanceTurn(): Promise<TurnState> {
    console.log('[TurnManager] Advancing turn for chat:', this.chatId);
    
    const currentState = await this.getCurrentTurn();
    if (!currentState) {
      throw new Error('No turn state found for chat');
    }

    const nextIndex = (currentState.current_turn_index + 1) % currentState.turn_queue.length;
    const nextRole = currentState.turn_queue[nextIndex];
    const nextUserId = await this.roleResolver.getUserIdForRole(this.chatId, nextRole);

    console.log('[TurnManager] Next turn:', { nextRole, nextUserId, nextIndex });

    const newState: TurnState = {
      next_role: nextRole,
      next_user_id: nextUserId || undefined,
      turn_queue: currentState.turn_queue,
      current_turn_index: nextIndex
    };

    await this.stateManager.updateTurnState(newState);
    
    // Clear stale typing indicators before emitting turn update
    await this.eventEmitter.clearStaleTypingIndicators(nextUserId || undefined);
    await this.eventEmitter.emitTurnUpdate(newState);

    return newState;
  }

  // Set turn to a specific role (for mediator responses)
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

    const userId = await this.roleResolver.getUserIdForRole(this.chatId, role);

    const newState: TurnState = {
      next_role: role,
      next_user_id: userId || undefined,
      turn_queue: currentState.turn_queue,
      current_turn_index: roleIndex
    };

    await this.stateManager.updateTurnState(newState);
    
    // Clear stale typing indicators before emitting turn update
    await this.eventEmitter.clearStaleTypingIndicators(userId || undefined);
    await this.eventEmitter.emitTurnUpdate(newState);

    return newState;
  }

  // Check if a user can send a message based on their role
  async canUserSendMessage(userId: string): Promise<boolean> {
    const currentState = await this.getCurrentTurn();
    if (!currentState) return false;

    // Check if it's their turn by user ID (backward compatibility)
    if (currentState.next_user_id === userId) {
      return true;
    }

    // Check if it's their turn by role
    const userRole = await this.roleResolver.getRoleForUserId(this.chatId, userId);
    return userRole === currentState.next_role;
  }

  // Get role for a user ID
  async getRoleForUserId(userId: string): Promise<string | null> {
    return this.roleResolver.getRoleForUserId(this.chatId, userId);
  }

  // Get user ID for a role
  async getUserIdForRole(role: string): Promise<string | null> {
    return this.roleResolver.getUserIdForRole(this.chatId, role);
  }


}

// Factory functions for different chat types
export function createDemoTurnManager(chatId: string): TurnManager {
  return new TurnManager(chatId, new DemoRoleResolver());
}

export function createCustomTurnManager(
  chatId: string, 
  roleResolver: RoleResolver,
  config?: TurnConfig
): TurnManager {
  return new TurnManager(chatId, roleResolver);
} 