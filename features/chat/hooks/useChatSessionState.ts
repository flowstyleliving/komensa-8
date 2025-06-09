// Unified chat session state hook using new ChatSessionStateManager
import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { pusherClient, getChatChannelName, PUSHER_EVENTS } from '@/lib/pusher';

// Import types from the state manager
export interface ChatSessionState {
  chatId: string;
  turnState: TurnState;
  participants: ParticipantInfo[];
  messages: MessageInfo[];
  typingUsers: string[];
  completionStatus: CompletionState;
  settings: ChatSettings;
  extensions: ExtensionState[];
  lastUpdated: string;
  userContext?: {
    userId: string;
    canSendMessage: boolean;
    isGuest: boolean;
    participant: ParticipantInfo;
  };
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
  completed_users: string[];
  total_participants: number;
  completion_types: Record<string, string>;
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

interface UseChatSessionStateOptions {
  enableRealtime?: boolean;
  cacheTimeout?: number;
  retryCount?: number;
}

interface UseChatSessionStateReturn {
  state: ChatSessionState | null;
  loading: boolean;
  error: string | null;
  refreshState: (forceFresh?: boolean) => Promise<void>;
  updateSettings: (settings: Partial<ChatSettings>) => Promise<void>;
  updateTyping: (isTyping: boolean) => Promise<void>;
  markComplete: (completionType?: string) => Promise<void>;
  addMessage: (content: string) => Promise<void>;
  canSendMessage: boolean;
  isConnected: boolean;
}

export function useChatSessionState(
  chatId: string,
  options: UseChatSessionStateOptions = {}
): UseChatSessionStateReturn {
  const { data: session } = useSession();
  const {
    enableRealtime = true,
    cacheTimeout = 30000, // 30 seconds
    retryCount = 3
  } = options;

  // State
  const [state, setState] = useState<ChatSessionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Refs for cleanup and optimization
  const channelRef = useRef<any>(null);
  const lastFetchTime = useRef<number>(0);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch state from API
  const fetchState = useCallback(async (forceFresh = false) => {
    if (!session?.user?.id || !chatId) return;

    try {
      setLoading(true);
      setError(null);

      // Check cache timeout
      const now = Date.now();
      if (!forceFresh && state && (now - lastFetchTime.current) < cacheTimeout) {
        setLoading(false);
        return;
      }

      const params = forceFresh ? '?forceFresh=true' : '';
      const response = await fetch(`/api/chat/${chatId}/session-state${params}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch state: ${response.status}`);
      }

      const newState = await response.json();
      setState(newState);
      lastFetchTime.current = now;

      console.log(`[useChatSessionState] State fetched for chat ${chatId}`);

    } catch (err) {
      console.error('[useChatSessionState] Error fetching state:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [session, chatId, state, cacheTimeout]);

  // Update settings
  const updateSettings = useCallback(async (settings: Partial<ChatSettings>) => {
    if (!session?.user?.id || !chatId) return;

    try {
      const response = await fetch(`/api/chat/${chatId}/session-state`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updateType: 'settings',
          data: settings
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to update settings: ${response.status}`);
      }

      // State will be updated via real-time events
      console.log(`[useChatSessionState] Settings updated`);

    } catch (err) {
      console.error('[useChatSessionState] Error updating settings:', err);
      setError(err instanceof Error ? err.message : 'Failed to update settings');
    }
  }, [session, chatId]);

  // Update typing status
  const updateTyping = useCallback(async (isTyping: boolean) => {
    if (!session?.user?.id || !chatId) return;

    try {
      await fetch(`/api/typing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, isTyping })
      });

    } catch (err) {
      console.error('[useChatSessionState] Error updating typing:', err);
    }
  }, [session, chatId]);

  // Mark completion
  const markComplete = useCallback(async (completionType = 'natural') => {
    if (!session?.user?.id || !chatId) return;

    try {
      const response = await fetch(`/api/chat/${chatId}/session-state`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updateType: 'completion',
          data: { completionType }
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to mark complete: ${response.status}`);
      }

      console.log(`[useChatSessionState] Marked complete: ${completionType}`);

    } catch (err) {
      console.error('[useChatSessionState] Error marking complete:', err);
      setError(err instanceof Error ? err.message : 'Failed to mark complete');
    }
  }, [session, chatId]);

  // Add message
  const addMessage = useCallback(async (content: string) => {
    if (!session?.user?.id || !chatId) return;

    try {
      const response = await fetch(`/api/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, content })
      });

      if (!response.ok) {
        throw new Error(`Failed to send message: ${response.status}`);
      }

      console.log(`[useChatSessionState] Message sent`);

    } catch (err) {
      console.error('[useChatSessionState] Error sending message:', err);
      setError(err instanceof Error ? err.message : 'Failed to send message');
    }
  }, [session, chatId]);

  // Real-time event handlers
  const handleNewMessage = useCallback((data: any) => {
    setState(prevState => {
      if (!prevState) return null;
      
      const newMessage: MessageInfo = {
        id: data.id,
        type: 'message',
        content: data.data.content,
        sender_id: data.data.senderId,
        created_at: data.created_at,
        seq: 0
      };

      return {
        ...prevState,
        messages: [...prevState.messages, newMessage],
        lastUpdated: new Date().toISOString()
      };
    });
  }, []);

  const handleTurnUpdate = useCallback((data: any) => {
    setState(prevState => {
      if (!prevState) return null;
      
      return {
        ...prevState,
        turnState: {
          ...prevState.turnState,
          next_user_id: data.next_user_id,
          next_role: data.next_role
        },
        userContext: prevState.userContext ? {
          ...prevState.userContext,
          canSendMessage: data.next_user_id === session?.user?.id || prevState.turnState.mode === 'flexible'
        } : undefined,
        lastUpdated: new Date().toISOString()
      };
    });
  }, [session]);

  const handleTypingUpdate = useCallback((data: any) => {
    setState(prevState => {
      if (!prevState) return null;
      
      const typingUsers = new Set(prevState.typingUsers);
      if (data.isTyping) {
        typingUsers.add(data.userId);
      } else {
        typingUsers.delete(data.userId);
      }

      return {
        ...prevState,
        typingUsers: Array.from(typingUsers),
        lastUpdated: new Date().toISOString()
      };
    });
  }, []);

  const handleCompletionUpdate = useCallback((data: any) => {
    setState(prevState => {
      if (!prevState) return null;
      
      const completed_users = new Set(prevState.completionStatus.completed_users);
      completed_users.add(data.userId);

      return {
        ...prevState,
        completionStatus: {
          ...prevState.completionStatus,
          completed_users: Array.from(completed_users),
          all_complete: data.allComplete
        },
        lastUpdated: new Date().toISOString()
      };
    });
  }, []);

  // Setup real-time connection
  useEffect(() => {
    if (!enableRealtime || !chatId || !session?.user?.id) return;

    const channelName = getChatChannelName(chatId);
    const channel = pusherClient.subscribe(channelName);
    channelRef.current = channel;

    // Event listeners
    channel.bind(PUSHER_EVENTS.NEW_MESSAGE, handleNewMessage);
    channel.bind(PUSHER_EVENTS.TURN_UPDATE, handleTurnUpdate);
    channel.bind(PUSHER_EVENTS.USER_TYPING, handleTypingUpdate);
    channel.bind(PUSHER_EVENTS.ASSISTANT_TYPING, handleTypingUpdate);
    channel.bind(PUSHER_EVENTS.COMPLETION_UPDATE, handleCompletionUpdate);

    // Connection state
    const handleConnectionChange = () => {
      setIsConnected(pusherClient.connection.state === 'connected');
    };

    pusherClient.connection.bind('connected', handleConnectionChange);
    pusherClient.connection.bind('disconnected', handleConnectionChange);
    pusherClient.connection.bind('failed', handleConnectionChange);

    // Initial connection state
    setIsConnected(pusherClient.connection.state === 'connected');

    console.log(`[useChatSessionState] Real-time connection setup for ${channelName}`);

    return () => {
      if (channelRef.current) {
        channelRef.current.unbind_all();
        pusherClient.unsubscribe(channelName);
      }
      pusherClient.connection.unbind('connected', handleConnectionChange);
      pusherClient.connection.unbind('disconnected', handleConnectionChange);
      pusherClient.connection.unbind('failed', handleConnectionChange);
    };
  }, [chatId, session, enableRealtime, handleNewMessage, handleTurnUpdate, handleTypingUpdate, handleCompletionUpdate]);

  // Initial state fetch
  useEffect(() => {
    fetchState();
  }, [fetchState]);

  // Retry mechanism for failed requests
  useEffect(() => {
    if (error && retryCount > 0) {
      retryTimeoutRef.current = setTimeout(() => {
        console.log(`[useChatSessionState] Retrying fetch after error`);
        fetchState(true);
      }, 2000);
    }

    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [error, retryCount, fetchState]);

  return {
    state,
    loading,
    error,
    refreshState: fetchState,
    updateSettings,
    updateTyping,
    markComplete,
    addMessage,
    canSendMessage: state?.userContext?.canSendMessage || false,
    isConnected
  };
}