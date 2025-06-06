'use client';
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { pusherClient, getChatChannelName, PUSHER_EVENTS } from '@/lib/pusher';

interface TurnState {
  next_user_id: string;
  next_role?: string;
}

interface SessionUser {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

interface ChatMessage {
  id: string;
  created_at: string;
  data: {
    content: string;
    senderId: string;
  };
}

export function useChat(chatId: string) {
  const { data: session } = useSession();
  const [data, setData] = useState({
    messages: [] as ChatMessage[],
    currentTurn: null as TurnState | null,
    isAssistantTyping: false,
    typingUsers: new Set<string>()
  });
  const [lastActivity, setLastActivity] = useState(Date.now());
  const [typingTimeout, setTypingTimeout] = useState<NodeJS.Timeout | null>(null);

  // Get user ID from session
  const getUserId = () => {
    const user = session?.user as SessionUser | undefined;
    if (user?.id) return user.id;
    
    return null;
  };

  // Recovery function for stuck AI
  const recoverFromStuckAI = async () => {
    console.log('[useChat] Manual recovery triggered - clearing AI typing state');
    
    // Force clear the typing indicator
    setData(prev => ({
      ...prev,
      isAssistantTyping: false
    }));
    
    // Clear any existing timeout
    if (typingTimeout) {
      clearTimeout(typingTimeout);
      setTypingTimeout(null);
    }
    
    // Refresh chat state to get any missing messages
    try {
      console.log('[useChat] Refreshing chat state for recovery');
      const res = await fetch(`/api/chat/${chatId}/state`);
      if (res.ok) {
        const state = await res.json();
        const filteredMessages = state.messages.filter((msg: any) => 
          msg.data && msg.data.content && msg.data.content.trim().length > 0
        );
        
        setData(prev => ({
          ...prev,
          messages: filteredMessages,
          currentTurn: state.currentTurn || prev.currentTurn,
          isAssistantTyping: false // Ensure it's definitely off
        }));
        console.log('[useChat] Chat state refreshed for recovery');
      }
    } catch (error) {
      console.error('[useChat] Failed to refresh chat state during recovery:', error);
    }
  };

  // Aggressive timeout - force clear AI typing after 45 seconds
  useEffect(() => {
    if (data.isAssistantTyping) {
      console.log('[useChat] AI typing started, setting 45s timeout');
      // Clear any existing timeout
      if (typingTimeout) {
        clearTimeout(typingTimeout);
      }
      
      // Mobile production gets faster timeout due to network conditions
      const isProduction = process.env.NODE_ENV === 'production';
      const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const timeout = isMobile && isProduction ? 30000 : 45000; // 30s mobile prod, 45s otherwise
      
      const newTimeout = setTimeout(() => {
        console.warn(`[useChat] TIMEOUT: Force clearing AI typing after ${timeout}ms (mobile prod: ${isMobile && isProduction})`);
        setData(prev => ({
          ...prev,
          isAssistantTyping: false
        }));
      }, timeout);
      
      setTypingTimeout(newTimeout);
    } else {
      console.log('[useChat] AI typing stopped, clearing timeout');
      // Clear timeout when typing stops
      if (typingTimeout) {
        clearTimeout(typingTimeout);
        setTypingTimeout(null);
      }
    }
    
    return () => {
      if (typingTimeout) {
        clearTimeout(typingTimeout);
      }
    };
  }, [data.isAssistantTyping]);

  useEffect(() => {
    if (!chatId) {
      console.log('[useChat] No chatId provided');
      return;
    }
    
    console.log('[useChat] Setting up Pusher subscription for chatId:', chatId);
    
    // Initial state fetch
    const fetchInitialState = async () => {
      try {
        console.log('[useChat] Fetching initial state for chatId:', chatId);
        const res = await fetch(`/api/chat/${chatId}/state`);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        const state = await res.json();
        console.log('[useChat] Fetched initial state:', state);
        
        // Filter out any empty messages
        const filteredMessages = state.messages.filter((msg: any) => 
          msg.data && msg.data.content && msg.data.content.trim().length > 0
        );
        
        setData(prev => ({
          ...prev,
          ...state,
          messages: filteredMessages
        }));
      } catch (error) {
        console.error('Failed to fetch initial chat state:', error);
      }
    };

    fetchInitialState();
    
    // Subscribe to Pusher channel
    const channelName = getChatChannelName(chatId);
    console.log('[useChat] Subscribing to Pusher channel:', channelName);
    try {
      const channel = pusherClient.subscribe(channelName);
      
      // Handle new messages
      channel.bind(PUSHER_EVENTS.NEW_MESSAGE, (message: ChatMessage) => {
        try {
          console.log('[useChat] Received new message:', message);
          if (message && message.data && message.data.content && message.data.content.trim().length > 0) {
            setData(prev => {
              // Auto-recovery: If this is an AI message, ensure typing indicator is off
              const newState = {
                ...prev,
                messages: [...prev.messages, message]
              };
              
              // If the new message is from the assistant, clear the typing indicator
              if (message.data.senderId === 'assistant') {
                console.log('[useChat] AI message received, clearing typing indicator');
                newState.isAssistantTyping = false;
              }
              
              return newState;
            });
          } else {
            console.warn('[useChat] Received malformed or empty new message event:', message);
          }
        } catch (e) {
          console.error('[useChat] Error processing NEW_MESSAGE event:', e, { receivedData: message });
        }
      });
      
      // Handle turn updates
      channel.bind(PUSHER_EVENTS.TURN_UPDATE, (turnState: any) => {
        try {
          console.log('[useChat] Received turn update:', turnState);
          
          // NEW: For EventDrivenTurnManager, we need to refetch the current turn state
          // instead of relying on the event payload
          if (turnState && (turnState.next_user_id || turnState.timestamp)) {
            if (turnState.next_user_id) {
              // Legacy turn update with specific user ID
              setData(prev => ({
                ...prev,
                currentTurn: {
                  next_user_id: turnState.next_user_id,
                  next_role: turnState.next_role
                }
              }));
            } else {
              // NEW: Generic refresh event - refetch current turn state
              console.log('[useChat] Generic turn refresh, fetching current turn state...');
              fetch(`/api/chat/${chatId}/state`)
                .then(res => res.json())
                .then(state => {
                  console.log('[useChat] Refreshed turn state:', state.currentTurn);
                  setData(prev => ({
                    ...prev,
                    currentTurn: state.currentTurn
                  }));
                })
                .catch(err => {
                  console.error('[useChat] Failed to refresh turn state:', err);
                });
            }
          } else {
            console.warn('[useChat] Received malformed turn update event:', turnState);
          }
        } catch (e) {
          console.error('[useChat] Error processing TURN_UPDATE event:', e, { receivedData: turnState });
        }
      });
      
      // Handle assistant typing
      channel.bind(PUSHER_EVENTS.ASSISTANT_TYPING, (typingData: { isTyping: boolean }) => {
        try {
          console.log('[useChat] Assistant typing status:', typingData);
          console.log('[useChat] Current isAssistantTyping state:', data.isAssistantTyping);
          if (typeof typingData?.isTyping === 'boolean') {
            console.log('[useChat] Setting isAssistantTyping to:', typingData.isTyping);
            setData(prev => {
              console.log('[useChat] Previous isAssistantTyping:', prev.isAssistantTyping);
              console.log('[useChat] New isAssistantTyping:', typingData.isTyping);
              return {
                ...prev,
                isAssistantTyping: typingData.isTyping
              };
            });
          } else {
            console.warn('[useChat] Received malformed assistant typing event:', typingData);
          }
        } catch (e) {
          console.error('[useChat] Error processing ASSISTANT_TYPING event:', e, { receivedData: typingData });
        }
      });
      
      // Handle user typing
      channel.bind(PUSHER_EVENTS.USER_TYPING, (typingData: { userId: string; isTyping: boolean }) => {
        try {
          console.log('[useChat] User typing status:', typingData);
          if (typingData && typeof typingData.userId === 'string' && typeof typingData.isTyping === 'boolean') {
            setData(prev => {
              const newTypingUsers = new Set(prev.typingUsers);
              if (typingData.isTyping) {
                newTypingUsers.add(typingData.userId);
              } else {
                newTypingUsers.delete(typingData.userId);
              }
              return {
                ...prev,
                typingUsers: newTypingUsers
              };
            });
          } else {
            console.warn('[useChat] Received malformed user typing event:', typingData);
          }
        } catch (e) {
          console.error('[useChat] Error processing USER_TYPING event:', e, { receivedData: typingData });
        }
      });
      
      // Handle full state updates
      channel.bind(PUSHER_EVENTS.STATE_UPDATE, (state: any) => {
        try {
          console.log('[useChat] Received state update:', state);
          if (state && state.messages) { // Basic check, can be more thorough
            const filteredMessages = state.messages.filter((msg: any) => 
              msg.data && msg.data.content && msg.data.content.trim().length > 0
            );
            setData(prev => ({
              ...prev,
              ...state,
              messages: filteredMessages
            }));
          } else {
            console.warn('[useChat] Received malformed state update event:', state);
          }
        } catch (e) {
          console.error('[useChat] Error processing STATE_UPDATE event:', e, { receivedData: state });
        }
      });

      // Handle participant joining (e.g., guest users)
      channel.bind(PUSHER_EVENTS.PARTICIPANT_JOINED, (data: any) => {
        try {
          console.log('[useChat] Participant joined:', data);
          if (data && data.participant) {
            // Refresh the chat state to get updated participant list
            fetchInitialState();
          } else {
            console.warn('[useChat] Received malformed participant joined event:', data);
          }
        } catch (e) {
          console.error('[useChat] Error processing PARTICIPANT_JOINED event:', e, { receivedData: data });
        }
      });

      return () => {
        console.log('[useChat] Cleaning up Pusher subscription for channel:', channelName);
        channel.unbind_all();
        pusherClient.unsubscribe(channelName);
      };

    } catch (error) {
      console.error('[useChat] FATAL: Failed to subscribe to Pusher channel or bind events:', channelName, error);
      // Optionally, set an error state here to inform the user
      return () => {}; // Return an empty cleanup function
    }
  }, [chatId]);

  const canSendMessage = () => {
    const userId = getUserId();
    if (!userId) {
      console.log('[useChat] No user ID found');
      return false;
    }
    
    // Check both user ID and role-based permissions
    const canSend = data.currentTurn?.next_user_id === userId;
    console.log('[useChat] Can send message:', canSend, {
      userId,
      nextUserId: data.currentTurn?.next_user_id,
      nextRole: data.currentTurn?.next_role,
      currentTurn: data.currentTurn
    });
    return canSend;
  };

  const sendMessage = async (content: string) => {
    const userId = getUserId();
    if (!userId) {
      console.error('[useChat] Cannot send message: no user ID');
      return;
    }

    try {
      console.log('[useChat] Sending message:', { content, userId, chatId });
      const res = await fetch(`/api/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, content }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        console.error('[useChat] Failed to send message:', errorData);
        throw new Error(`Failed to send message: ${errorData.error}`);
      }
      
      // No need to manually refresh state - Pusher will handle real-time updates
      console.log('[useChat] Message sent successfully, waiting for Pusher updates');
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  return {
    messages: data.messages, 
    isAssistantTyping: data.isAssistantTyping,
    typingUsers: data.typingUsers,
    currentTurn: data.currentTurn,
    sendMessage,
    canSendMessage,
    recoverFromStuckAI
  };
}
