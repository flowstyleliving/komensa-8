import { useState, FormEvent, useEffect, useRef, useCallback } from 'react';
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
        sendTypingIndicator(false);
      }
    };
  }, [clearTypingTimeout, isTyping, sendTypingIndicator]);

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

  // Generate turn status content
  const getTurnStatusContent = () => {
    if (!currentTurn || !currentUserId) {
      return null;
    }

    const isMyTurn = currentTurn.next_user_id === currentUserId;
    
    if (isMyTurn) {
      return (
        <div className="flex items-center justify-center gap-2 text-[#7BAFB0] text-sm">
          <Users className="h-4 w-4" />
          <span className="font-medium">It's your turn...</span>
        </div>
      );
    }

    // Find who's turn it is
    let turnUserName = 'Unknown User';
    if (currentTurn.next_user_id === 'assistant') {
      turnUserName = 'AI Mediator';
    } else {
      const turnUser = participants.find(p => p.id === currentTurn.next_user_id);
      turnUserName = turnUser?.display_name || 'Unknown User';
    }

    return (
      <div className="flex items-center justify-center gap-2 text-[#3C4858]/60 text-sm">
        <Users className="h-4 w-4 text-[#D8A7B1]" />
        <span>Waiting for {turnUserName}...</span>
      </div>
    );
  };

  // Determine what to show at the top
  const topContentToShow = topContent || getTurnStatusContent() || (disabled && (
    <div className="flex items-center justify-center gap-2 text-[#3C4858]/60 text-sm">
      <Heart className="h-4 w-4 text-[#D8A7B1]" />
      <span>The AI is preparing a thoughtful response...</span>
    </div>
  ));

  return (
    <div className="space-y-3">
      {topContentToShow}
      <form onSubmit={handleSubmit} className="flex gap-3">
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
          className="flex-1 px-4 py-3 border border-[#3C4858]/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D8A7B1]/50 focus:border-[#D8A7B1] disabled:bg-[#F9F7F4]/50 disabled:cursor-not-allowed text-[#3C4858] bg-white shadow-sm transition-all duration-200 min-h-[48px] max-h-[200px] overflow-y-auto whitespace-pre-wrap break-words empty:before:content-[attr(data-placeholder)] empty:before:text-[#3C4858]/50"
          style={{
            opacity: disabled ? 0.5 : 1,
            pointerEvents: disabled ? 'none' : 'auto'
          }}
        />
        <button
          type="submit"
          disabled={disabled || !content.trim()}
          className="w-12 h-12 bg-gradient-to-r from-[#7BAFB0] to-[#D8A7B1] text-white rounded-xl hover:from-[#6D9E9F] hover:to-[#C99BA4] focus:outline-none focus:ring-2 focus:ring-[#7BAFB0]/30 focus:ring-offset-2 focus:ring-offset-white disabled:from-[#7BAFB0]/40 disabled:to-[#D8A7B1]/40 disabled:cursor-not-allowed flex items-center justify-center font-medium shadow-sm transition-all duration-300 transform hover:scale-[1.02] hover:shadow-md active:scale-[0.98] active:shadow-sm flex-shrink-0 self-start"
        >
          <Send className="h-5 w-5" />
        </button>
      </form>
    </div>
  );
} 