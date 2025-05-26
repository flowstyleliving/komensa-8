'use client';

import { useState, useEffect } from 'react';
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

  const dismissModal = () => {
    setShowModal(false);
  };

  const dismissCalendlyModal = () => {
    setShowCalendlyModal(false);
  };

  const checkShouldShowModal = (messages: any[]) => {
    // Count AI responses (messages from 'assistant')
    const aiResponses = messages.filter(
      msg => msg.data?.senderId === 'assistant'
    );
    
    const newCount = aiResponses.length;
    setAiResponseCount(newCount);
    
    // Show first modal after 3 AI responses
    if (newCount >= DEMO_CONSTANTS.AI_RESPONSE_THRESHOLD && !showModal) {
      setShowModal(true);
    }
    
    // Show Calendly modal after 7 AI responses
    if (newCount >= DEMO_CONSTANTS.CALENDLY_THRESHOLD && !showCalendlyModal) {
      setShowCalendlyModal(true);
    }
  };

  return {
    showModal,
    showCalendlyModal,
    aiResponseCount,
    dismissModal,
    dismissCalendlyModal,
    checkShouldShowModal
  };
} 