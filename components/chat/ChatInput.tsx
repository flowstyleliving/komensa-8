import { useState, FormEvent, useEffect } from 'react';
import { Send, Heart } from 'lucide-react';

interface ChatInputProps {
  onSend: (content: string) => void;
  disabled?: boolean;
  placeholder?: string;
  topContent?: React.ReactNode;
}

export function ChatInput({ onSend, disabled = false, placeholder = "Share your thoughts...", topContent }: ChatInputProps) {
  const [content, setContent] = useState('');
  const [hasPreFilled, setHasPreFilled] = useState(false);

  // Check if this is a demo and pre-fill the input
  useEffect(() => {
    const isDemoPage = window.location.search.includes('demo=true');
    if (isDemoPage && content === '' && !hasPreFilled) {
      setContent('I\’m doing 80% of the work and getting 30% of the equity. That doesn\’t work for me anymore.');
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

  return (
    <div className="space-y-3">
      {topContent || (disabled && (
        <div className="flex items-center justify-center gap-2 text-[#3C4858]/60 text-sm">
          <Heart className="h-4 w-4 text-[#D8A7B1]" />
          <span>The AI is preparing a thoughtful response...</span>
        </div>
      ))}
      <form onSubmit={handleSubmit} className="flex gap-3">
        <input
          type="text"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          disabled={disabled}
          placeholder={placeholder}
          className="flex-1 px-4 py-3 border border-[#3C4858]/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D8A7B1]/50 focus:border-[#D8A7B1] disabled:bg-[#F9F7F4]/50 disabled:cursor-not-allowed text-[#3C4858] placeholder-[#3C4858]/50 bg-white shadow-sm transition-all duration-200"
        />
        <button
          type="submit"
          disabled={disabled || !content.trim()}
          className="px-6 py-3 bg-gradient-to-r from-[#7BAFB0] to-[#D8A7B1] text-white rounded-xl hover:from-[#6D9E9F] hover:to-[#C99BA4] focus:outline-none focus:ring-2 focus:ring-[#7BAFB0]/30 focus:ring-offset-2 focus:ring-offset-white disabled:from-[#7BAFB0]/40 disabled:to-[#D8A7B1]/40 disabled:cursor-not-allowed flex items-center gap-2 font-medium shadow-sm transition-all duration-300 transform hover:scale-[1.02] hover:shadow-md active:scale-[0.98] active:shadow-sm"
        >
          <Send className="h-4 w-4" />
          Send
        </button>
      </form>
    </div>
  );
} 