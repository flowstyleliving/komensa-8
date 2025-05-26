'use client';

import { useState, useCallback, useMemo } from 'react';
import { DEMO_CONSTANTS } from '@/components/demo/constants';

interface DemoModalState {
  showModal: boolean;
  showCalendlyModal: boolean;
  aiResponseCount: number;
  dismissModal: () => void;
  dismissCalendlyModal: () => void;
  checkShouldShowModal: (messages: any[]) => void;
}

export function useDemoModal(): DemoModalState {
  const [showModal, setShowModal] = useState(false);
  const [showCalendlyModal, setShowCalendlyModal] = useState(false);
  const [aiResponseCount, setAiResponseCount] = useState(0);

  // Memoize dismiss functions to prevent unnecessary re-renders
  const dismissModal = useCallback(() => {
    setShowModal(false);
  }, []);

  const dismissCalendlyModal = useCallback(() => {
    setShowCalendlyModal(false);
  }, []);

  // Optimized modal checking with memoization
  const checkShouldShowModal = useCallback((messages: any[]) => {
    // Early return if no messages
    if (!messages || messages.length === 0) return;
    
    // Count AI responses more efficiently - stop counting once we hit the max threshold
    let aiResponseCount = 0;
    const maxThreshold = Math.max(DEMO_CONSTANTS.AI_RESPONSE_THRESHOLD, DEMO_CONSTANTS.CALENDLY_THRESHOLD);
    
    for (const msg of messages) {
      if (msg.data?.senderId === 'assistant') {
        aiResponseCount++;
        // Early exit optimization - no need to count beyond max threshold
        if (aiResponseCount >= maxThreshold) break;
      }
    }
    
    setAiResponseCount(aiResponseCount);
    
    // Show first modal after 3 AI responses
    if (aiResponseCount >= DEMO_CONSTANTS.AI_RESPONSE_THRESHOLD && !showModal) {
      setShowModal(true);
    }
    
    // Show Calendly modal after 7 AI responses
    if (aiResponseCount >= DEMO_CONSTANTS.CALENDLY_THRESHOLD && !showCalendlyModal) {
      setShowCalendlyModal(true);
    }
  }, [showModal, showCalendlyModal]);

  // Memoize return object to prevent unnecessary re-renders
  return useMemo(() => ({
    showModal,
    showCalendlyModal,
    aiResponseCount,
    dismissModal,
    dismissCalendlyModal,
    checkShouldShowModal
  }), [showModal, showCalendlyModal, aiResponseCount, dismissModal, dismissCalendlyModal, checkShouldShowModal]);
} 