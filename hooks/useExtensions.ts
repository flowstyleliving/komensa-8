import { useState, useEffect } from 'react';
import { extensionRegistry } from '../features/extensions/registry';
import { ExtensionContext } from '../features/extensions/types';

interface UseExtensionsProps {
  chatId: string;
  userId: string;
  isUserTyping?: boolean;
  isAiTyping?: boolean;
  currentTurn?: 'user' | 'ai' | null;
  messageCount?: number;
}

export function useExtensions({
  chatId,
  userId,
  isUserTyping = false,
  isAiTyping = false,
  currentTurn = null,
  messageCount = 0
}: UseExtensionsProps) {
  const [context, setContext] = useState<ExtensionContext>({
    chatId,
    userId,
    isUserTyping,
    isAiTyping,
    currentTurn,
    messageCount
  });

  useEffect(() => {
    setContext({
      chatId,
      userId,
      isUserTyping,
      isAiTyping,
      currentTurn,
      messageCount
    });
  }, [chatId, userId, isUserTyping, isAiTyping, currentTurn, messageCount]);

  const getVizCueContent = () => {
    const vizCueComponents = extensionRegistry.getVizCueExtensions(context);
    return vizCueComponents.length > 0 ? vizCueComponents[0] : null;
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
    enableExtension,
    disableExtension,
    getEnabledExtensions
  };
} 