import { useState, FormEvent, useEffect } from 'react';
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
}

export function DemoChatInput({ 
  onSend, 
  disabled = false, 
  placeholder = "Share your thoughts...", 
  topContent,
  currentTurn,
  participants = [],
  currentUserId 
}: ChatInputProps) {
  const [content, setContent] = useState('');
  const [hasPreFilled, setHasPreFilled] = useState(false);

  // Check if this is a demo and pre-fill the input
  useEffect(() => {
    const isDemoPage = window.location.pathname.startsWith('/demo/');
    if (isDemoPage && content === '' && !hasPreFilled) {
      setContent('Jordan and I have been together for three years, but lately I feel like we\'re growing apart. I love them deeply, but I\'m not sure if we want the same things anymore.');
      setHasPreFilled(true);
    }
  }, [content, hasPreFilled]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (content.trim() && !disabled) {
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
          onInput={(e) => setContent(e.currentTarget.textContent || '')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e as any);
            }
          }}
          data-placeholder={placeholder}
          className="flex-1 px-3 sm:px-4 py-3 border border-[#3C4858]/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D8A7B1]/50 focus:border-[#D8A7B1] disabled:bg-[#F9F7F4]/50 disabled:cursor-not-allowed text-[#3C4858] bg-white shadow-sm transition-all duration-200 min-h-[48px] max-h-[200px] overflow-y-auto whitespace-pre-wrap break-words empty:before:content-[attr(data-placeholder)] empty:before:text-[#3C4858]/50 text-sm sm:text-base"
          style={{
            opacity: disabled ? 0.5 : 1,
            pointerEvents: disabled ? 'none' : 'auto'
          }}
        />
        <button
          type="submit"
          disabled={disabled || !content.trim()}
          className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-r from-[#7BAFB0] to-[#D8A7B1] text-white rounded-xl hover:from-[#6D9E9F] hover:to-[#C99BA4] focus:outline-none focus:ring-2 focus:ring-[#7BAFB0]/30 focus:ring-offset-2 focus:ring-offset-white disabled:from-[#7BAFB0]/40 disabled:to-[#D8A7B1]/40 disabled:cursor-not-allowed flex items-center justify-center font-medium shadow-sm transition-all duration-300 transform hover:scale-[1.02] hover:shadow-md active:scale-[0.98] active:shadow-sm flex-shrink-0"
        >
          <Send className="h-4 w-4 sm:h-5 sm:w-5" />
        </button>
      </form>
    </div>
  );
} 