'use client';

import { useState, useEffect } from 'react';

interface TypingIndicatorProps {
  onRecover?: () => void;
  chatId?: string;
}

export function TypingIndicator({ onRecover, chatId }: TypingIndicatorProps) {
  const [showRecovery, setShowRecovery] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);

  // Show recovery option after 60 seconds on mobile, 90 seconds on desktop
  useEffect(() => {
    const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const timeout = isMobile ? 60000 : 90000; // 1 min mobile, 1.5 min desktop

    const timer = setTimeout(() => {
      setShowRecovery(true);
    }, timeout);

    return () => clearTimeout(timer);
  }, []);

  const handleRecover = async () => {
    if (isRecovering) return;
    
    setIsRecovering(true);
    
    try {
      // Try manual recovery function first
      if (onRecover) {
        onRecover();
      }
      
      // Also call server-side recovery if chatId is available
      if (chatId) {
        await fetch(`/api/chat/${chatId}/recover-ai`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
      }
    } catch (error) {
      console.error('Recovery failed:', error);
    } finally {
      setIsRecovering(false);
    }
  };

  return (
    <div className="flex justify-center my-4 sm:my-6">
      <div className="bg-[#7BAFB0]/10 text-[#3C4858] text-sm max-w-[90%] sm:max-w-[85%] text-center p-4 sm:p-6 rounded-xl border border-[#7BAFB0]/20 shadow-sm">
        <div className="flex items-center justify-center gap-2 sm:gap-3">
          <div className="flex gap-1">
            <div className="w-2 h-2 bg-[#7BAFB0] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-2 h-2 bg-[#7BAFB0] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-2 h-2 bg-[#7BAFB0] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
          <span className="text-[#7BAFB0]/80 font-medium text-sm sm:text-base">AI Mediator is thinking...</span>
        </div>
        
        {showRecovery && (
          <div className="mt-3 pt-3 border-t border-[#7BAFB0]/20">
            <p className="text-xs text-[#7BAFB0]/60 mb-2">Taking longer than usual?</p>
            <button
              onClick={handleRecover}
              disabled={isRecovering}
              className="text-xs bg-[#7BAFB0]/20 hover:bg-[#7BAFB0]/30 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-1 rounded-md text-[#7BAFB0] font-medium transition-colors"
            >
              {isRecovering ? 'Recovering...' : 'Try Again'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

