'use client';

import { useState, useEffect } from 'react';
import { DEMO_CONSTANTS } from '@/components/demo/constants';

interface DemoModalState {
  showModal: boolean;
  showCalendlyModal: boolean;
  aiResponseCount: number;
  userAResponseCount: number;
  dismissModal: () => void;
  dismissCalendlyModal: () => void;
  checkShouldShowModal: (messages: any[]) => void;
}

export function useDemoModal(): DemoModalState {
  const [showModal, setShowModal] = useState(false);
  const [showCalendlyModal, setShowCalendlyModal] = useState(false);
  const [aiResponseCount, setAiResponseCount] = useState(0);
  const [userAResponseCount, setUserAResponseCount] = useState(0);

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
    
    // Count User A responses (messages from 'user_a')
    const userAResponses = messages.filter(
      msg => msg.data?.senderId === 'user_a'
    );
    
    const aiCount = aiResponses.length;
    const userACount = userAResponses.length;
    
    setAiResponseCount(aiCount);
    setUserAResponseCount(userACount);
    
    // Show first modal after 3 AI responses
    if (aiCount >= DEMO_CONSTANTS.AI_RESPONSE_THRESHOLD && !showModal) {
      setShowModal(true);
    }
    
    // Show Calendly modal after 3 User A responses
    if (userACount >= DEMO_CONSTANTS.USER_A_CALENDLY_THRESHOLD && !showCalendlyModal) {
      setShowCalendlyModal(true);
    }
  };

  return {
    showModal,
    showCalendlyModal,
    aiResponseCount,
    userAResponseCount,
    dismissModal,
    dismissCalendlyModal,
    checkShouldShowModal
  };
} 