import { useState, useEffect } from 'react';
import { extensionRegistry } from '../features/extensions/registry';
import { ExtensionContext, SendButtonExtension } from '../features/extensions/types';

interface UseExtensionsProps {
  chatId: string;
  userId: string;
  isUserTyping?: boolean;
  isAiTyping?: boolean;
  currentTurn?: 'user' | 'ai' | null;
  messageCount?: number;
  messageContent?: string;
  canSend?: boolean;
}

export function useExtensions({
  chatId,
  userId,
  isUserTyping = false,
  isAiTyping = false,
  currentTurn = null,
  messageCount = 0,
  messageContent = '',
  canSend = true
}: UseExtensionsProps) {
  const [context, setContext] = useState<ExtensionContext>({
    chatId,
    userId,
    isUserTyping,
    isAiTyping,
    currentTurn,
    messageCount,
    messageContent,
    canSend
  });

  useEffect(() => {
    setContext({
      chatId,
      userId,
      isUserTyping,
      isAiTyping,
      currentTurn,
      messageCount,
      messageContent,
      canSend
    });
  }, [chatId, userId, isUserTyping, isAiTyping, currentTurn, messageCount, messageContent, canSend]);

  const getVizCueContent = () => {
    const vizCueComponents = extensionRegistry.getVizCueExtensions(context);
    return vizCueComponents.length > 0 ? vizCueComponents[0] : null;
  };

  const getSendButtonExtension = (): SendButtonExtension | null => {
    return extensionRegistry.getSendButtonExtension(context);
  };

  const renderSendButton = (onSend: (message: string) => void, disabled: boolean) => {
    const extension = getSendButtonExtension();
    return extensionRegistry.renderSendButton(extension, context, onSend, disabled);
  };

  const enableExtension = (id: string) => {
    extensionRegistry.enableExtension(id);
  };

  const disableExtension = (id: string) => {
    extensionRegistry.disableExtension(id);
  };

  const getEnabledExtensions = () => {
    return extensionRegistry.getEnabledExtensions();
  };

  return {
    context,
    getVizCueContent,
    getSendButtonExtension,
    renderSendButton,
    enableExtension,
    disableExtension,
    getEnabledExtensions
  };
} 