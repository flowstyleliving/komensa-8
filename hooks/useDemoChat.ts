'use client';

import { useEffect } from 'react';
import { useChat } from '@/features/chat/hooks/useChat';
import { useDemoModal } from './useDemoModal';

interface DemoChatReturn {
  messages: any[];
  isAssistantTyping: boolean;
  typingUsers: Set<string>;
  sendMessage: (content: string) => Promise<void>;
  canSendMessage: () => boolean;
  // Demo-specific additions
  showCalendlyModal: boolean;
  userAResponseCount: number;
  dismissCalendlyModal: () => void;
  isDemoChat: boolean;
}

export function useDemoChat(chatId: string): DemoChatReturn {
  const chat = useChat(chatId);
  const modal = useDemoModal();

  // Check if this is a demo chat
  const isDemoChat = (() => {
    if (typeof window === 'undefined') return false;
    
    return (
      window.location.search.includes('demo=true') ||
      document.cookie.includes('demo_user=')
    );
  })();

  // Monitor messages for AI responses and trigger modal logic
  useEffect(() => {
    if (isDemoChat && chat.messages.length > 0) {
      modal.checkShouldShowModal(chat.messages);
    }
  }, [chat.messages, isDemoChat]);

  return {
    ...chat,
    showCalendlyModal: modal.showCalendlyModal,
    userAResponseCount: modal.userAResponseCount,
    dismissCalendlyModal: modal.dismissCalendlyModal,
    isDemoChat
  };
} 