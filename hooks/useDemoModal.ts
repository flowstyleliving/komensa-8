'use client';

import { useState, useCallback, useMemo } from 'react';
import { DEMO_CONSTANTS } from '@/components/demo/constants';

interface DemoModalState {
  showModal: boolean;
  showCalendlyModal: boolean;
  userAResponseCount: number;
  dismissModal: () => void;
  dismissCalendlyModal: () => void;
  checkShouldShowModal: (messages: any[]) => void;
}

export function useDemoModal(): DemoModalState {
  const [showModal, setShowModal] = useState(false);
  const [showCalendlyModal, setShowCalendlyModal] = useState(false);
  const [userAResponseCount, setUserAResponseCount] = useState(0);
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
    
    // Count User A responses efficiently
    let userACount = 0;
    
    for (const msg of messages) {
      if (msg.data?.senderId === 'user_a') {
        userACount++;
        // Early exit optimization - no need to count beyond threshold
        if (userACount >= DEMO_CONSTANTS.CALENDLY_THRESHOLD) break;
      }
    }
    
    setUserAResponseCount(userACount);
    
    // Show first modal after 3 User A responses (if not dismissed)
    if (userACount >= DEMO_CONSTANTS.AI_RESPONSE_THRESHOLD && !showModal && !modalDismissed) {
      setShowModal(true);
    }
    
    // Show Calendly modal after 4 User A responses (if not dismissed)
    if (userACount >= DEMO_CONSTANTS.CALENDLY_THRESHOLD && !showCalendlyModal && !calendlyDismissed) {
      setShowCalendlyModal(true);
    }
  }, [showModal, showCalendlyModal, modalDismissed, calendlyDismissed]);

  // Memoize return object to prevent unnecessary re-renders
  return useMemo(() => ({
    showModal,
    showCalendlyModal,
    userAResponseCount,
    dismissModal,
    dismissCalendlyModal,
    checkShouldShowModal
  }), [showModal, showCalendlyModal, userAResponseCount, dismissModal, dismissCalendlyModal, checkShouldShowModal]);
} 