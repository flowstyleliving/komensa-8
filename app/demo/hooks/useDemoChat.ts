'use client';

import { useState, useEffect, useMemo } from 'react';
import { pusherClient, getChatChannelName, PUSHER_EVENTS } from '@/lib/pusher';
import { useDemoModal } from './useDemoModal';

interface TurnState {
  next_user_id: string;
  next_role?: string;
}

interface ChatMessage {
  id: string;
  created_at: string;
  data: {
    content: string;
    senderId: string;
  };
}

interface DemoChatReturn {
  messages: ChatMessage[];
  currentTurn: TurnState | null;
  isAssistantTyping: boolean;
  typingUsers: Set<string>;
  sendMessage: (content: string) => Promise<void>;
  canSendMessage: () => boolean;
  // Demo-specific additions
  showModal: boolean;
  showCalendlyModal: boolean;
  aiResponseCount: number;
  dismissModal: () => void;
  dismissCalendlyModal: () => void;
  isDemoChat: boolean;
}

export function useDemoChat(chatId: string, isDemoChat: boolean): DemoChatReturn {
  const [data, setData] = useState({
    messages: [] as ChatMessage[],
    currentTurn: null as TurnState | null,
    isAssistantTyping: false,
    typingUsers: new Set<string>()
  });
  
  const modal = useDemoModal();

  // Get demo user ID from cookie
  const getUserId = () => {
    if (typeof document !== 'undefined') {
      const demoUser = document.cookie
        .split('; ')
        .find(row => row.startsWith('demo_user='))
        ?.split('=')[1];
      
      if (demoUser) {
        try {
          const parsed = JSON.parse(decodeURIComponent(demoUser));
          return parsed.id;
        } catch (e) {
          console.error('Failed to parse demo user cookie:', e);
        }
      }
    }
    return null;
  };

  useEffect(() => {
    if (!chatId || !isDemoChat) {
      console.log('[useDemoChat] No chatId or not demo chat');
      return;
    }
    
    console.log('[useDemoChat] Setting up demo chat for chatId:', chatId);
    
    // Initial state fetch from demo API
    const fetchInitialState = async () => {
      try {
        console.log('[useDemoChat] Fetching demo chat state for chatId:', chatId);
        const res = await fetch(`/demo/api/state?chatId=${chatId}`);
        
        if (!res.ok) {
          console.warn(`[useDemoChat] Failed to fetch demo state: HTTP ${res.status}: ${res.statusText}`);
          // Don't throw error, just log and continue - the chat might not exist yet
          return;
        }
        
        const state = await res.json();
        console.log('[useDemoChat] Fetched demo state:', state);
        
        // Filter out any empty messages
        const filteredMessages = state.messages?.filter((msg: any) => 
          msg.data && msg.data.content && msg.data.content.trim().length > 0
        ) || [];
        
        setData(prev => ({
          ...prev,
          messages: filteredMessages,
          currentTurn: state.currentTurn || null
        }));
      } catch (error) {
        console.error('Failed to fetch demo chat state:', error);
        // Don't crash the component, just continue with empty state
      }
    };

    fetchInitialState();
    
    // Subscribe to Pusher channel
    const channelName = getChatChannelName(chatId);
    console.log('[useDemoChat] Subscribing to demo Pusher channel:', channelName);
    
    try {
      const channel = pusherClient.subscribe(channelName);
      
      // Handle new messages
      channel.bind(PUSHER_EVENTS.NEW_MESSAGE, (message: ChatMessage) => {
        try {
          console.log('[useDemoChat] Received new demo message:', message);
          if (message && message.data && message.data.content && message.data.content.trim().length > 0) {
            setData(prev => ({
              ...prev,
              messages: [...prev.messages, message]
            }));
          } else {
            console.warn('[useDemoChat] Received malformed demo message event:', message);
          }
        } catch (e) {
          console.error('[useDemoChat] Error processing demo NEW_MESSAGE event:', e);
        }
      });
      
      // Handle turn updates
      channel.bind(PUSHER_EVENTS.TURN_UPDATE, (turnState: any) => {
        try {
          console.log('[useDemoChat] Received demo turn update:', turnState);
          if (turnState && (turnState.next_user_id || turnState.next_role)) {
            setData(prev => ({
              ...prev,
              currentTurn: {
                next_user_id: turnState.next_user_id,
                next_role: turnState.next_role
              }
            }));
          }
        } catch (e) {
          console.error('[useDemoChat] Error processing demo TURN_UPDATE event:', e);
        }
      });
      
      // Handle assistant typing
      channel.bind(PUSHER_EVENTS.ASSISTANT_TYPING, (typingData: { isTyping: boolean }) => {
        try {
          console.log('[useDemoChat] Demo assistant typing:', typingData);
          if (typeof typingData?.isTyping === 'boolean') {
            setData(prev => ({
              ...prev,
              isAssistantTyping: typingData.isTyping
            }));
          }
        } catch (e) {
          console.error('[useDemoChat] Error processing demo ASSISTANT_TYPING event:', e);
        }
      });
      
      // Handle user typing
      channel.bind(PUSHER_EVENTS.USER_TYPING, (typingData: { userId: string; isTyping: boolean }) => {
        try {
          console.log('[useDemoChat] Demo user typing:', typingData);
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
          }
        } catch (e) {
          console.error('[useDemoChat] Error processing demo USER_TYPING event:', e);
        }
      });

      return () => {
        console.log('[useDemoChat] Cleaning up demo Pusher subscription for channel:', channelName);
        channel.unbind_all();
        pusherClient.unsubscribe(channelName);
      };

    } catch (error) {
      console.error('[useDemoChat] Failed to subscribe to demo Pusher channel:', channelName, error);
      return () => {};
    }
  }, [chatId, isDemoChat]);

  // Monitor messages for AI responses and trigger modal logic
  useEffect(() => {
    if (isDemoChat && data.messages.length > 0) {
      modal.checkShouldShowModal(data.messages);
    }
  }, [data.messages, isDemoChat, modal.checkShouldShowModal]);

  const canSendMessage = () => {
    const userId = getUserId();
    if (!userId) {
      console.log('[useDemoChat] No demo user ID found');
      return false;
    }
    
    if (!data.currentTurn) {
      console.log('[useDemoChat] No current turn state');
      return false;
    }
    
    // Check if it's directly our turn by user ID
    if (data.currentTurn.next_user_id === userId) {
      console.log('[useDemoChat] Demo can send message: true (user ID match)', { userId, nextUserId: data.currentTurn.next_user_id });
      return true;
    }
    
    // For demo chats, we also need to check role-based permissions
    // This is a simplified client-side check; the server will do the authoritative validation
    const isUserATurn = data.currentTurn.next_role === 'user_a' && userId !== 'assistant';
    const isJordanTurn = data.currentTurn.next_role === 'jordan' && userId !== 'assistant';
    
    const canSend = isUserATurn || isJordanTurn;
    console.log('[useDemoChat] Demo can send message:', canSend, {
      userId,
      nextUserId: data.currentTurn.next_user_id,
      nextRole: data.currentTurn.next_role,
      isUserATurn,
      isJordanTurn,
      currentTurn: data.currentTurn
    });
    return canSend;
  };

  const sendMessage = async (content: string) => {
    const userId = getUserId();
    if (!userId) {
      console.error('[useDemoChat] Cannot send demo message: no user ID');
      return;
    }

    try {
      console.log('[useDemoChat] Sending demo message:', { content, userId, chatId });
      const res = await fetch(`/demo/api/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, content }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        console.error('[useDemoChat] Failed to send demo message:', errorData);
        throw new Error(`Failed to send demo message: ${errorData.error}`);
      }
      
      console.log('[useDemoChat] Demo message sent successfully');
    } catch (error) {
      console.error('Failed to send demo message:', error);
    }
  };

  // Memoize the return object to prevent unnecessary re-renders
  return useMemo(() => ({
    messages: data.messages,
    currentTurn: data.currentTurn,
    isAssistantTyping: data.isAssistantTyping,
    typingUsers: data.typingUsers,
    sendMessage,
    canSendMessage,
    showModal: modal.showModal,
    showCalendlyModal: modal.showCalendlyModal,
    aiResponseCount: modal.aiResponseCount,
    dismissModal: modal.dismissModal,
    dismissCalendlyModal: modal.dismissCalendlyModal,
    isDemoChat
  }), [
    data.messages,
    data.currentTurn,
    data.isAssistantTyping,
    data.typingUsers,
    sendMessage,
    canSendMessage,
    modal.showModal,
    modal.showCalendlyModal, 
    modal.aiResponseCount, 
    modal.dismissModal,
    modal.dismissCalendlyModal, 
    isDemoChat
  ]);
} 