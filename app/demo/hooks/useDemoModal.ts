'use client';

import { useState, useCallback, useMemo } from 'react';
import { DEMO_CONSTANTS } from '@/app/demo/components/constants';

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
  const [modalDismissed, setModalDismissed] = useState(false);
  const [calendlyDismissed, setCalendlyDismissed] = useState(false);

  const dismissModal = useCallback(() => {
    setShowModal(false);
    setModalDismissed(true);
  }, []);

  const dismissCalendlyModal = useCallback(() => {
    setShowCalendlyModal(false);
    setCalendlyDismissed(true);
  }, []);

  // Optimized modal checking with memoization
  const checkShouldShowModal = useCallback((messages: any[]) => {
    // Early return if no messages
    if (!messages || messages.length === 0) return;
    
    // Count AI responses efficiently
    let aiCount = 0;
    
    for (const msg of messages) {
      if (msg.data?.senderId === 'assistant') {
        aiCount++;
        // Early exit optimization - no need to count beyond threshold
        if (aiCount >= DEMO_CONSTANTS.CALENDLY_THRESHOLD) break;
      }
    }
    
    console.log('[useDemoModal] AI response count:', aiCount, 'Thresholds:', {
      demo: DEMO_CONSTANTS.AI_RESPONSE_THRESHOLD,
      calendly: DEMO_CONSTANTS.CALENDLY_THRESHOLD,
      showModal,
      showCalendlyModal,
      modalDismissed,
      calendlyDismissed
    });
    
    setAiResponseCount(aiCount);
    
    // Show first modal after 3 AI responses (if not dismissed)
    if (aiCount >= DEMO_CONSTANTS.AI_RESPONSE_THRESHOLD && !showModal && !modalDismissed) {
      console.log('[useDemoModal] Triggering demo modal');
      setShowModal(true);
    }
    
    // Show Calendly modal after 5 AI responses (if not dismissed)
    if (aiCount >= DEMO_CONSTANTS.CALENDLY_THRESHOLD && !showCalendlyModal && !calendlyDismissed) {
      console.log('[useDemoModal] Triggering Calendly modal');
      setShowCalendlyModal(true);
    }
  }, [showModal, showCalendlyModal, modalDismissed, calendlyDismissed]);

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