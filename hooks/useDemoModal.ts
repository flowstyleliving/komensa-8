'use client';

import { useState, useEffect } from 'react';

interface DemoModalState {
  showCalendlyModal: boolean;
  userAResponseCount: number;
  dismissCalendlyModal: () => void;
  checkShouldShowModal: (messages: any[]) => void;
}

export function useDemoModal(): DemoModalState {
  const [showCalendlyModal, setShowCalendlyModal] = useState(false);
  const [userAResponseCount, setUserAResponseCount] = useState(0);

  const dismissCalendlyModal = () => {
    setShowCalendlyModal(false);
  };

  const checkShouldShowModal = (messages: any[]) => {
    // Count User A responses (messages from 'user_a')
    const userAResponses = messages.filter(
      msg => msg.data?.senderId === 'user_a'
    );
    
    const newCount = userAResponses.length;
    setUserAResponseCount(newCount);
    
    // Show Calendly modal after 3rd User A response
    if (newCount >= 3 && !showCalendlyModal) {
      setShowCalendlyModal(true);
    }
  };

  return {
    showCalendlyModal,
    userAResponseCount,
    dismissCalendlyModal,
    checkShouldShowModal
  };
} 