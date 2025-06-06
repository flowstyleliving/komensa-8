import React, { useState, FormEvent, useEffect, useRef, useCallback } from 'react';
import { Send, Heart, Users } from 'lucide-react';

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

  // Enhanced turn status content with empathy and clarity
  const getTurnStatusContent = () => {
    if (!currentTurn || !currentUserId) {
      return (
        <div className="flex items-center justify-center gap-2 text-[#3C4858]/60 text-sm">
          <div className="w-4 h-4 bg-[#7BAFB0]/50 rounded-full"></div>
          <span>Loading conversation state...</span>
        </div>
      );
    }

    const isMyTurn = currentTurn.next_user_id === currentUserId;
    const humanParticipants = participants.filter(p => p.id !== currentUserId && p.id !== 'assistant');
    const totalParticipants = humanParticipants.length + 1; // +1 for current user
    
    if (isMyTurn) {
      // Check conversation stage for contextual messaging
      if (humanParticipants.length === 0) {
        // User is alone - encourage them to start thoughtfully
        return (
          <div className="bg-gradient-to-r from-[#7BAFB0]/5 to-[#D8A7B1]/5 rounded-lg p-3 border border-[#7BAFB0]/20">
            <div className="flex items-center justify-center gap-2 text-[#7BAFB0] text-sm font-medium mb-1">
              <Users className="h-4 w-4" />
              <span>Ready to begin your mediation session</span>
            </div>
            <div className="text-center text-xs text-[#3C4858]/60">
              Share what's on your mind - your partner will join the conversation
            </div>
          </div>
        );
      } else {
        // Multi-participant conversation
        return (
          <div className="bg-gradient-to-r from-[#7BAFB0]/5 to-[#D8A7B1]/5 rounded-lg p-3 border border-[#7BAFB0]/20">
            <div className="flex items-center justify-center gap-2 text-[#7BAFB0] text-sm font-medium mb-1">
              <Users className="h-4 w-4" />
              <span>Your turn to share</span>
            </div>
            <div className="text-center text-xs text-[#3C4858]/60">
              Take your time - {totalParticipants} participants are listening
            </div>
          </div>
        );
      }
    }

    // Not my turn - show empathetic waiting state
    let turnUserName = 'Unknown User';
    let primaryMessage = '';
    let secondaryMessage = '';
    let icon = Users;
    let iconColor = 'text-[#D8A7B1]';
    
    if (currentTurn.next_user_id === 'assistant') {
      turnUserName = 'AI Mediator';
      primaryMessage = `${turnUserName} is processing and preparing a thoughtful response`;
      secondaryMessage = 'The AI considers multiple perspectives before responding';
      icon = Heart;
      iconColor = 'text-[#D8A7B1]';
    } else {
      const turnUser = participants.find(p => p.id === currentTurn.next_user_id);
      turnUserName = turnUser?.display_name || 'Unknown User';
      
      // Check if the person has joined and customize message accordingly
      const hasJoined = turnUser?.display_name && !turnUser.display_name.startsWith('guest_');
      
      if (hasJoined) {
        primaryMessage = `Waiting for ${turnUserName} to respond`;
        secondaryMessage = totalParticipants > 2 
          ? `Everyone gets equal time to express themselves (${totalParticipants} total participants)`
          : 'Each person deserves space to share their perspective';
      } else {
        primaryMessage = `Waiting for ${turnUserName} to join the conversation`;
        secondaryMessage = 'They\'ll receive an invitation to participate when ready';
      }
    }

    return (
      <div className="bg-gradient-to-r from-[#F9F7F4] to-[#EAE8E5] rounded-lg p-3 border border-[#3C4858]/10">
        <div className="flex items-center justify-center gap-2 text-[#3C4858]/70 text-sm font-medium mb-1">
          {React.createElement(icon, { className: `h-4 w-4 ${iconColor}` })}
          <span>{primaryMessage}</span>
        </div>
        <div className="text-center text-xs text-[#3C4858]/50 italic">
          {secondaryMessage}
        </div>
      </div>
    );
  };

  // Determine what to show at the top - priority: extensions > turn status > fallback
  const topContentToShow = topContent || getTurnStatusContent() || (disabled && (
    <div className="flex items-center justify-center gap-2 text-[#3C4858]/60 text-sm p-3">
      <Heart className="h-4 w-4 text-[#D8A7B1]" />
      <span>Preparing a thoughtful response...</span>
    </div>
  ));

  return (
    <div className="space-y-3">
      {topContentToShow && (
        <div className="min-h-[24px] flex items-center justify-center">
          {topContentToShow}
        </div>
      )}
      <form onSubmit={handleSubmit} className="flex gap-2 sm:gap-3">
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
          className="flex-1 px-3 sm:px-4 py-3 border border-[#3C4858]/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D8A7B1]/50 focus:border-[#D8A7B1] disabled:bg-[#F9F7F4]/50 disabled:cursor-not-allowed text-[#3C4858] bg-white shadow-sm transition-all duration-200 min-h-[48px] max-h-[200px] overflow-y-auto whitespace-pre-wrap break-words empty:before:content-[attr(data-placeholder)] empty:before:text-[#3C4858]/50 text-base resize-none"
          style={{
            opacity: disabled ? 0.5 : 1,
            pointerEvents: disabled ? 'none' : 'auto',
            WebkitTapHighlightColor: 'transparent'
          }}
        />
        <button
          type="submit"
          disabled={disabled || !content.trim()}
          className="w-12 h-12 sm:w-14 sm:h-12 bg-gradient-to-r from-[#7BAFB0] to-[#D8A7B1] text-white rounded-xl hover:from-[#6D9E9F] hover:to-[#C99BA4] focus:outline-none focus:ring-2 focus:ring-[#7BAFB0]/30 focus:ring-offset-2 focus:ring-offset-white disabled:from-[#7BAFB0]/40 disabled:to-[#D8A7B1]/40 disabled:cursor-not-allowed flex items-center justify-center font-medium shadow-sm transition-all duration-300 transform hover:scale-[1.02] hover:shadow-md active:scale-[0.98] active:shadow-sm flex-shrink-0 touch-manipulation"
          style={{ WebkitTapHighlightColor: 'transparent' }}
        >
          <Send className="h-4 w-4 sm:h-5 sm:w-5" />
        </button>
      </form>
    </div>
  );
} 