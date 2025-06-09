import React, { useState, FormEvent, useEffect, useRef, useCallback } from 'react';
import { Send } from 'lucide-react';

interface TurnState {
  next_user_id: string;
  next_role?: string;
}

interface Participant {
  id: string;
  display_name: string;
}

interface ChatInputProps {
  onSend: (content: string) => void;
  disabled?: boolean;
  placeholder?: string;
  topContent?: React.ReactNode;
  currentTurn?: TurnState | null;
  participants?: Participant[];
  currentUserId?: string;
  chatId?: string;
}

export function ChatInput({ 
  onSend, 
  disabled = false, 
  placeholder = "Share your thoughts...", 
  topContent,
  currentTurn,
  participants = [],
  currentUserId,
  chatId
}: ChatInputProps) {
  const [content, setContent] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Send typing indicator to server
  const sendTypingIndicator = useCallback(async (typing: boolean) => {
    if (!chatId || !currentUserId) return;
    
    try {
      await fetch('/api/typing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, isTyping: typing }),
      });
    } catch (error) {
      console.error('Failed to send typing indicator:', error);
    }
  }, [chatId, currentUserId]);

  // Handle typing events
  const handleTypingStart = useCallback(() => {
    if (!isTyping && !disabled) {
      setIsTyping(true);
      sendTypingIndicator(true);
    }
  }, [isTyping, disabled, sendTypingIndicator]);

  const handleTypingStop = useCallback(() => {
    if (isTyping) {
      setIsTyping(false);
      sendTypingIndicator(false);
    }
  }, [isTyping, sendTypingIndicator]);

  // Clear typing timeout and stop typing
  const clearTypingTimeout = useCallback(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  }, []);

  // Set typing timeout
  const setTypingTimeout = useCallback(() => {
    clearTypingTimeout();
    typingTimeoutRef.current = setTimeout(() => {
      handleTypingStop();
    }, 2000); // Stop typing after 2 seconds of inactivity
  }, [clearTypingTimeout, handleTypingStop]);

  // Cleanup typing timeout on unmount
  useEffect(() => {
    return () => {
      clearTypingTimeout();
      if (isTyping) {
        console.log('[ChatInput] Component unmounting - clearing typing indicator');
        sendTypingIndicator(false);
      }
    };
  }, [clearTypingTimeout, isTyping, sendTypingIndicator]);

  // Additional safety: Force clear typing indicator on page visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && isTyping) {
        console.log('[ChatInput] Page hidden - clearing typing indicator');
        handleTypingStop();
        clearTypingTimeout();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isTyping, handleTypingStop, clearTypingTimeout]);

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    const newContent = e.currentTarget.textContent || '';
    setContent(newContent);
    
    // Handle typing indicators
    if (newContent.length > 0 && !disabled) {
      handleTypingStart();
      setTypingTimeout();
    } else if (newContent.length === 0) {
      handleTypingStop();
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (content.trim() && !disabled) {
      // Stop typing indicator before sending
      handleTypingStop();
      clearTypingTimeout();
      
      onSend(content.trim());
      setContent('');
    }
  };

  // Simple and classic status indicator
  const getTurnStatusContent = () => {
    // GUEST USER FIX: Check for flexible mode before requiring sign in
    const isFlexibleMode = currentTurn?.next_user_id === 'anyone';
    
    // Sign in required (but not in flexible mode for guest users)
    if (!currentUserId && !isFlexibleMode) {
      return (
        <span className="text-[#3C4858]/70 text-sm">Please sign in to participate</span>
      );
    }

    // Determine if user can send message
    // For flexible mode, always allow sending (race condition safety)
    const isUserTurn = currentTurn?.next_user_id === currentUserId;
    const noTurnRestriction = !currentTurn;
    
    const canSend = !disabled && (isFlexibleMode || isUserTurn || noTurnRestriction);
    
    // For flexible mode or when it's user's turn
    if (canSend) {
      // Special message for guest users in flexible mode without userId
      if (!currentUserId && isFlexibleMode) {
        return (
          <span className="text-[#7BAFB0] text-sm">Welcome! Ready to chat</span>
        );
      }
      
      return (
        <span className="text-[#7BAFB0] text-sm">Ready to chat</span>
      );
    }

    // For strict mode - show whose turn it is
    const nextUserName = participants.find(p => p.id === currentTurn?.next_user_id)?.display_name || 'next participant';
    
    return (
      <span className="text-[#3C4858]/70 text-sm">Waiting for {nextUserName}</span>
    );
  };

  // Determine what to show at the top - priority: extensions > turn status > fallback
  const topContentToShow = topContent || getTurnStatusContent() || (disabled && (
    <span className="text-[#3C4858]/60 text-sm">Preparing a thoughtful response...</span>
  ));

  return (
    <div className="space-y-1">
      {topContentToShow && (
        <div className="min-h-[18px] flex items-center justify-center">
          {topContentToShow}
        </div>
      )}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div
          contentEditable
          ref={(el) => {
            if (el && el.textContent !== content) {
              el.textContent = content;
            }
          }}
          onInput={handleInput}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e as any);
            }
          }}
          data-placeholder={placeholder}
          className="flex-1 px-3 py-2 border border-[#3C4858]/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D8A7B1]/50 focus:border-[#D8A7B1] disabled:bg-[#F9F7F4]/50 disabled:cursor-not-allowed text-[#3C4858] bg-white shadow-sm transition-all duration-200 min-h-[40px] max-h-[200px] overflow-y-auto whitespace-pre-wrap break-words empty:before:content-[attr(data-placeholder)] empty:before:text-[#3C4858]/50 text-base resize-none"
          style={{
            opacity: disabled ? 0.5 : 1,
            pointerEvents: disabled ? 'none' : 'auto',
            WebkitTapHighlightColor: 'transparent'
          }}
        />
        <button
          type="submit"
          disabled={disabled || !content.trim()}
          className="w-10 h-10 bg-gradient-to-r from-[#7BAFB0] to-[#D8A7B1] text-white rounded-xl hover:from-[#6D9E9F] hover:to-[#C99BA4] focus:outline-none focus:ring-2 focus:ring-[#7BAFB0]/30 focus:ring-offset-2 focus:ring-offset-white disabled:from-[#7BAFB0]/40 disabled:to-[#D8A7B1]/40 disabled:cursor-not-allowed flex items-center justify-center font-medium shadow-sm transition-all duration-300 transform hover:scale-[1.02] hover:shadow-md active:scale-[0.98] active:shadow-sm flex-shrink-0 touch-manipulation"
          style={{ WebkitTapHighlightColor: 'transparent' }}
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
} 