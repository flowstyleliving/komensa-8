'use client';

import { useEffect, useMemo } from 'react';
import { useChat } from '@/features/chat/hooks/useChat';
import { useDemoModal } from './useDemoModal';
import { DEMO_CONSTANTS } from '@/app/demo/components/constants';

interface DemoChatReturn {
  messages: any[];
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
  const chat = useChat(chatId);
  const modal = useDemoModal();

  // Monitor messages for AI responses and trigger modal logic
  // Only run when isDemoChat is true and messages actually change
  useEffect(() => {
    if (isDemoChat && chat.messages.length > 0) {
      modal.checkShouldShowModal(chat.messages);
    }
  }, [chat.messages, isDemoChat, modal.checkShouldShowModal]);

  // Memoize the return object to prevent unnecessary re-renders
  return useMemo(() => ({
    ...chat,
    showModal: modal.showModal,
    showCalendlyModal: modal.showCalendlyModal,
    aiResponseCount: modal.aiResponseCount,
    dismissModal: modal.dismissModal,
    dismissCalendlyModal: modal.dismissCalendlyModal,
    isDemoChat
  }), [
    chat, 
    modal.showModal,
    modal.showCalendlyModal, 
    modal.aiResponseCount, 
    modal.dismissModal,
    modal.dismissCalendlyModal, 
    isDemoChat
  ]);
} 