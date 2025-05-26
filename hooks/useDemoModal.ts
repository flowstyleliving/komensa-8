'use client';

import { useState, useCallback, useMemo } from 'react';
import { DEMO_CONSTANTS } from '@/components/demo/constants';

interface DemoModalState {
  showCalendlyModal: boolean;
  aiResponseCount: number;
  dismissCalendlyModal: () => void;
  checkShouldShowModal: (messages: any[]) => void;
}

export function useDemoModal(): DemoModalState {
  const [showCalendlyModal, setShowCalendlyModal] = useState(false);
  const [aiResponseCount, setAiResponseCount] = useState(0);

  const dismissCalendlyModal = useCallback(() => {
    setShowCalendlyModal(false);
  }, []);

  // Optimized modal checking with memoization
  const checkShouldShowModal = useCallback((messages: any[]) => {
    // Early return if no messages
    if (!messages || messages.length === 0) return;
    
    // Count AI responses more efficiently - stop counting once we hit the threshold
    let aiResponseCount = 0;
    
    for (const msg of messages) {
      if (msg.data?.senderId === 'assistant') {
        aiResponseCount++;
        // Early exit optimization - no need to count beyond threshold
        if (aiResponseCount >= DEMO_CONSTANTS.CALENDLY_THRESHOLD) break;
      }
    }
    
    setAiResponseCount(aiResponseCount);
    
    // Show Calendly modal after 4 AI responses
    if (aiResponseCount >= DEMO_CONSTANTS.CALENDLY_THRESHOLD && !showCalendlyModal) {
      setShowCalendlyModal(true);
    }
  }, [showCalendlyModal]);

  // Memoize return object to prevent unnecessary re-renders
  return useMemo(() => ({
    showCalendlyModal,
    aiResponseCount,
    dismissCalendlyModal,
    checkShouldShowModal
  }), [showCalendlyModal, aiResponseCount, dismissCalendlyModal, checkShouldShowModal]);
} 