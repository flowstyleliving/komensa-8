// Unified chat session state management service
import { prisma } from '@/lib/prisma';
import { getTypingUsers, setTypingIndicator } from '@/lib/redis';
import { RealtimeEventService } from './RealtimeEventService';
import { TurnManager } from './turnManager';

// Unified state interfaces
export interface ChatSessionState {
  chatId: string;
  turnState: TurnState;
  participants: ParticipantInfo[];
  messages: MessageInfo[];
  typingUsers: Set<string>;
  completionStatus: CompletionState;
  settings: ChatSettings;
  extensions: ExtensionState[];
  lastUpdated: string;
}

export interface TurnState {
  next_user_id: string | null;
  next_role: string | null;
  mode: 'flexible' | 'strict' | 'moderated' | 'rounds';
  turn_queue: string[];
  current_turn_index: number;
  thread_id?: string;
}

export interface ParticipantInfo {
  user_id: string;
  role: string;
  display_name: string;
  is_guest: boolean;
  emotional_state?: {
    feelings?: string;
    needs?: string;
    viewpoints?: string;
  };
  is_typing: boolean;
  is_online: boolean;
}

export interface MessageInfo {
  id: string;
  type: 'message' | 'system_message' | 'completion_marked';
  content: string;
  sender_id: string;
  created_at: string;
  seq: number;
}

export interface CompletionState {
  completed_users: Set<string>;
  total_participants: number;
  completion_types: Map<string, string>;
  all_complete: boolean;
  ready_for_summary: boolean;
}

export interface ChatSettings {
  turn_taking: 'flexible' | 'strict' | 'moderated' | 'rounds';
  [key: string]: any;
}

export interface ExtensionState {
  extension_id: string;
  config: any;
  enabled: boolean;
}

export interface StateUpdateOptions {
  broadcast?: boolean;
  persist?: boolean;
  skipValidation?: boolean;
}

export class ChatSessionStateManager {
  private chatId: string;
  private realtimeService: RealtimeEventService;
  private turnManager: TurnManager;
  private cachedState?: ChatSessionState;
  private lastCacheTime?: number;
  private cacheTimeout: number = 5000; // 5 seconds

  constructor(chatId: string) {
    this.chatId = chatId;
    this.realtimeService = new RealtimeEventService(chatId);
    this.turnManager = new TurnManager(chatId);
  }

  /**
   * Get complete chat session state with caching
   */
  async getState(forceFresh = false): Promise<ChatSessionState> {
    console.log(`[ChatSessionStateManager] Getting state for chat ${this.chatId}`);

    // Return cached state if available and fresh
    if (!forceFresh && this.cachedState && this.lastCacheTime) {
      const cacheAge = Date.now() - this.lastCacheTime;
      if (cacheAge < this.cacheTimeout) {
        console.log(`[ChatSessionStateManager] Returning cached state (${cacheAge}ms old)`);
        return this.cachedState;
      }
    }

    try {
      // Fetch all state components in parallel
      const [
        chat,
        participants,
        messages,
        completionStatus,
        turnState,
        typingUsers,
        extensions
      ] = await Promise.all([
        this.fetchChatData(),
        this.fetchParticipants(),
        this.fetchMessages(),
        this.fetchCompletionStatus(),
        this.fetchTurnState(),
        this.fetchTypingUsers(),
        this.fetchExtensions()
      ]);

      const state: ChatSessionState = {
        chatId: this.chatId,
        turnState,
        participants,
        messages,
        typingUsers: new Set(typingUsers),
        completionStatus,
        settings: chat.settings || { turn_taking: 'flexible' },
        extensions,
        lastUpdated: new Date().toISOString()
      };

      // Cache the state
      this.cachedState = state;
      this.lastCacheTime = Date.now();

      console.log(`[ChatSessionStateManager] State assembled and cached`);
      return state;

    } catch (error) {
      console.error(`[ChatSessionStateManager] Error fetching state:`, error);
      throw error;
    }
  }

  /**
   * Update turn state with validation and broadcasting
   */
  async updateTurnState(turnData: Partial<TurnState>, options: StateUpdateOptions = {}): Promise<void> {
    console.log(`[ChatSessionStateManager] Updating turn state`);

    const { broadcast = true, persist = true, skipValidation = false } = options;

    try {
      // Validate turn update if not skipped
      if (!skipValidation) {
        await this.validateTurnUpdate(turnData);
      }

      // Update database if persistence enabled
      if (persist) {
        await prisma.chatTurnState.upsert({
          where: { chat_id: this.chatId },
          update: {
            next_user_id: turnData.next_user_id,
            next_role: turnData.next_role,
            turn_queue: turnData.turn_queue,
            current_turn_index: turnData.current_turn_index,
            thread_id: turnData.thread_id,
            updated_at: new Date()
          },
          create: {
            chat_id: this.chatId,
            next_user_id: turnData.next_user_id || null,
            next_role: turnData.next_role,
            turn_queue: turnData.turn_queue || [],
            current_turn_index: turnData.current_turn_index || 0,
            thread_id: turnData.thread_id
          }
        });
      }

      // Update cached state
      if (this.cachedState) {
        this.cachedState.turnState = { ...this.cachedState.turnState, ...turnData };
        this.cachedState.lastUpdated = new Date().toISOString();
      }

      // Broadcast update if enabled (non-blocking)
      if (broadcast) {
        this.realtimeService.broadcastTurnUpdate({
          next_user_id: turnData.next_user_id || null,
          next_role: turnData.next_role,
          timestamp: new Date().toISOString()
        }).catch(error => {
          console.error(`[ChatSessionStateManager] Turn update broadcast failed (non-blocking):`, error);
        });
      }

      console.log(`[ChatSessionStateManager] Turn state updated successfully`);

    } catch (error) {
      console.error(`[ChatSessionStateManager] Error updating turn state:`, error);
      throw error;
    }
  }

  /**
   * Update typing state for a user
   */
  async updateTypingState(userId: string, isTyping: boolean): Promise<void> {
    console.log(`[ChatSessionStateManager] Updating typing state: ${userId} = ${isTyping}`);

    try {
      // Update Redis and broadcast (non-blocking)
      this.realtimeService.broadcastUserTyping({
        userId,
        isTyping
      }).catch(error => {
        console.error(`[ChatSessionStateManager] Typing broadcast failed (non-blocking):`, error);
      });

      // Update cached state
      if (this.cachedState) {
        if (isTyping) {
          this.cachedState.typingUsers.add(userId);
        } else {
          this.cachedState.typingUsers.delete(userId);
        }
        
        // Update participant typing status
        const participant = this.cachedState.participants.find(p => p.user_id === userId);
        if (participant) {
          participant.is_typing = isTyping;
        }

        this.cachedState.lastUpdated = new Date().toISOString();
      }

    } catch (error) {
      console.error(`[ChatSessionStateManager] Error updating typing state:`, error);
      throw error;
    }
  }

  /**
   * Update completion status for a user
   */
  async updateCompletionStatus(userId: string, completionType: string): Promise<CompletionState> {
    console.log(`[ChatSessionStateManager] Updating completion status: ${userId} = ${completionType}`);

    try {
      // Update database
      await prisma.chatCompletionStatus.upsert({
        where: {
          chat_id_user_id: {
            chat_id: this.chatId,
            user_id: userId
          }
        },
        update: {
          marked_complete_at: new Date(),
          completion_type: completionType
        },
        create: {
          chat_id: this.chatId,
          user_id: userId,
          completion_type: completionType
        }
      });

      // Refresh completion state
      const completionStatus = await this.fetchCompletionStatus();

      // Update cached state
      if (this.cachedState) {
        this.cachedState.completionStatus = completionStatus;
        this.cachedState.lastUpdated = new Date().toISOString();
      }

      // Broadcast completion update (non-blocking)
      const participant = await this.getParticipant(userId);
      this.realtimeService.broadcastCompletionUpdate({
        userId,
        userName: participant?.display_name || 'User',
        completionType,
        allComplete: completionStatus.all_complete,
        completedCount: completionStatus.completed_users.size,
        totalParticipants: completionStatus.total_participants
      }).catch(error => {
        console.error(`[ChatSessionStateManager] Completion update broadcast failed (non-blocking):`, error);
      });

      // Broadcast completion ready if all complete (non-blocking)
      if (completionStatus.all_complete) {
        this.realtimeService.broadcastCompletionReady().catch(error => {
          console.error(`[ChatSessionStateManager] Completion ready broadcast failed (non-blocking):`, error);
        });
      }

      return completionStatus;

    } catch (error) {
      console.error(`[ChatSessionStateManager] Error updating completion status:`, error);
      throw error;
    }
  }

  /**
   * Add a new message to the session
   */
  async addMessage(messageData: {
    content: string;
    senderId: string;
    type?: 'message' | 'system_message';
  }): Promise<MessageInfo> {
    console.log(`[ChatSessionStateManager] Adding message from ${messageData.senderId}`);

    try {
      // Store in database
      const newMessage = await prisma.event.create({
        data: {
          chat_id: this.chatId,
          type: messageData.type || 'message',
          data: { 
            content: messageData.content, 
            senderId: messageData.senderId 
          },
          created_at: new Date(),
          seq: 0,
        },
      });

      const messageInfo: MessageInfo = {
        id: newMessage.id,
        type: messageData.type || 'message',
        content: messageData.content,
        sender_id: messageData.senderId,
        created_at: newMessage.created_at.toISOString(),
        seq: newMessage.seq
      };

      // Update cached state
      if (this.cachedState) {
        this.cachedState.messages.push(messageInfo);
        this.cachedState.lastUpdated = new Date().toISOString();
      }

      // Broadcast message (non-blocking - don't fail message storage if broadcast fails)
      this.realtimeService.broadcastMessage({
        id: messageInfo.id,
        created_at: messageInfo.created_at,
        data: {
          content: messageInfo.content,
          senderId: messageInfo.sender_id
        }
      }).catch(error => {
        console.error(`[ChatSessionStateManager] Real-time broadcast failed (non-blocking):`, error);
      });

      return messageInfo;

    } catch (error) {
      console.error(`[ChatSessionStateManager] Error adding message:`, error);
      throw error;
    }
  }

  /**
   * Add a participant to the chat
   */
  async addParticipant(userId: string, role: string = 'user'): Promise<void> {
    console.log(`[ChatSessionStateManager] Adding participant: ${userId}`);

    try {
      // Add to database
      const existingParticipant = await prisma.chatParticipant.findUnique({
        where: {
          chat_id_user_id: {
            chat_id: this.chatId,
            user_id: userId
          }
        }
      });

      if (!existingParticipant) {
        await prisma.chatParticipant.create({
          data: {
            chat_id: this.chatId,
            user_id: userId,
            role: role
          }
        });

        // Invalidate cache to force refresh
        this.invalidateCache();

        // Broadcast participant joined (non-blocking)
        this.realtimeService.broadcastParticipantJoined({
          userId,
          role,
          timestamp: new Date().toISOString()
        }).catch(error => {
          console.error(`[ChatSessionStateManager] Participant joined broadcast failed (non-blocking):`, error);
        });
      }

    } catch (error) {
      console.error(`[ChatSessionStateManager] Error adding participant:`, error);
      throw error;
    }
  }

  /**
   * Update chat settings
   */
  async updateSettings(newSettings: Partial<ChatSettings>): Promise<void> {
    console.log(`[ChatSessionStateManager] Updating settings`);

    try {
      // Get current settings
      const currentSettings = this.cachedState?.settings || await this.fetchChatData().then(c => c.settings);
      const mergedSettings = { ...currentSettings, ...newSettings };

      // Update database
      await prisma.chat.update({
        where: { id: this.chatId },
        data: { settings: mergedSettings }
      });

      // Update cached state
      if (this.cachedState) {
        this.cachedState.settings = mergedSettings;
        this.cachedState.lastUpdated = new Date().toISOString();
      }

      // Broadcast settings update (non-blocking)
      this.realtimeService.broadcastSettingsUpdate({
        settings: mergedSettings,
        updatedBy: 'system', // Could be passed as parameter
        timestamp: new Date().toISOString()
      }).catch(error => {
        console.error(`[ChatSessionStateManager] Settings update broadcast failed (non-blocking):`, error);
      });

    } catch (error) {
      console.error(`[ChatSessionStateManager] Error updating settings:`, error);
      throw error;
    }
  }

  /**
   * Invalidate cached state
   */
  invalidateCache(): void {
    this.cachedState = undefined;
    this.lastCacheTime = undefined;
    console.log(`[ChatSessionStateManager] Cache invalidated`);
  }

  /**
   * Get a specific participant
   */
  async getParticipant(userId: string): Promise<ParticipantInfo | null> {
    const state = await this.getState();
    return state.participants.find(p => p.user_id === userId) || null;
  }

  /**
   * Check if user can send message (delegation to TurnManager)
   */
  async canUserSendMessage(userId: string): Promise<boolean> {
    return this.turnManager.canUserSendMessage(userId);
  }

  /**
   * Determine if AI should respond (delegation to TurnManager)
   */
  async shouldTriggerAIResponse(): Promise<boolean> {
    return this.turnManager.shouldTriggerAIResponse();
  }

  // Private helper methods for fetching state components

  private async fetchChatData() {
    return prisma.chat.findUniqueOrThrow({
      where: { id: this.chatId },
      select: { 
        id: true, 
        settings: true,
        turn_taking: true,
        status: true 
      }
    });
  }

  private async fetchParticipants(): Promise<ParticipantInfo[]> {
    const participants = await prisma.chatParticipant.findMany({
      where: { chat_id: this.chatId },
      include: {
        user: {
          select: {
            id: true,
            display_name: true,
            name: true,
            email: true
          }
        }
      }
    });

    return participants.map(p => ({
      user_id: p.user_id,
      role: p.role,
      display_name: p.user.display_name || p.user.name || 'User',
      is_guest: p.user.email?.includes('guest@') || false,
      is_typing: false, // Will be updated from Redis
      is_online: true // Could be enhanced with presence detection
    }));
  }

  private async fetchMessages(): Promise<MessageInfo[]> {
    const events = await prisma.event.findMany({
      where: { 
        chat_id: this.chatId,
        type: { in: ['message', 'system_message', 'completion_marked'] }
      },
      orderBy: { created_at: 'asc' },
      take: 100 // Limit for performance
    });

    return events.map(event => ({
      id: event.id,
      type: event.type as any,
      content: (event.data as any)?.content || '',
      sender_id: (event.data as any)?.senderId || 'system',
      created_at: event.created_at.toISOString(),
      seq: event.seq
    }));
  }

  private async fetchCompletionStatus(): Promise<CompletionState> {
    const [completions, totalParticipants] = await Promise.all([
      prisma.chatCompletionStatus.findMany({
        where: { chat_id: this.chatId }
      }),
      prisma.chatParticipant.count({
        where: { chat_id: this.chatId }
      })
    ]);

    const completed_users = new Set(completions.map(c => c.user_id));
    const completion_types = new Map(
      completions.map(c => [c.user_id, c.completion_type])
    );

    return {
      completed_users,
      total_participants: totalParticipants,
      completion_types,
      all_complete: completed_users.size === totalParticipants,
      ready_for_summary: completed_users.size === totalParticipants
    };
  }

  private async fetchTurnState(): Promise<TurnState> {
    const turnState = await this.turnManager.getCurrentTurn();
    const mode = await this.turnManager.getTurnMode();

    return {
      next_user_id: turnState?.next_user_id || null,
      next_role: turnState?.next_role || null,
      mode: mode as any,
      turn_queue: turnState?.turn_queue || [],
      current_turn_index: turnState?.current_turn_index || 0,
      thread_id: turnState?.thread_id
    };
  }

  private async fetchTypingUsers(): Promise<string[]> {
    try {
      return await getTypingUsers(this.chatId);
    } catch (error) {
      console.warn(`[ChatSessionStateManager] Error fetching typing users:`, error);
      return [];
    }
  }

  private async fetchExtensions(): Promise<ExtensionState[]> {
    try {
      const extensions = await prisma.chatExtension.findMany({
        where: { chat_id: this.chatId }
      });

      return extensions.map(ext => ({
        extension_id: ext.extension_id,
        config: ext.config || {},
        enabled: ext.enabled
      }));
    } catch (error) {
      console.warn(`[ChatSessionStateManager] Error fetching extensions:`, error);
      return [];
    }
  }

  private async validateTurnUpdate(turnData: Partial<TurnState>): Promise<void> {
    // Add validation logic here
    // e.g., check if next_user_id is a valid participant
    if (turnData.next_user_id) {
      const participant = await this.getParticipant(turnData.next_user_id);
      if (!participant) {
        throw new Error(`Invalid next_user_id: ${turnData.next_user_id} is not a participant`);
      }
    }
  }

  /**
   * Static factory method
   */
  static for(chatId: string): ChatSessionStateManager {
    return new ChatSessionStateManager(chatId);
  }
}