import { format, isValid } from 'date-fns';

interface ChatBubbleProps {
  content: string;
  senderId: string;
  timestamp: Date;
  userId: string;
  participantMap: Record<string, string>;
  participants: { id: string; display_name: string }[];
}

export function ChatBubble({ content, senderId, timestamp, userId, participantMap }: ChatBubbleProps) {
  const isAssistant = senderId === 'assistant';
  const isSystem = senderId === 'system';
  const isCurrentUser = senderId === userId;
  
  // Validate timestamp and provide fallback
  const validTimestamp = isValid(timestamp) ? timestamp : new Date();
  
  // Check if it's the current demo user (Alex)
  const isDemoUser = (() => {
    if (typeof document !== 'undefined') {
      const demoUser = document.cookie
        .split('; ')
        .find(row => row.startsWith('demo_user='))
        ?.split('=')[1];
      
      if (demoUser) {
        try {
          const parsed = JSON.parse(decodeURIComponent(demoUser));
          return senderId === parsed.id;
        } catch (e) {
          return false;
        }
      }
    }
    return false;
  })();

  const getBubbleStyle = () => {
    if (isSystem) {
      return 'bg-[#D9C589]/10 text-[#3C4858]/80 italic text-sm max-w-[90%] text-center p-4 rounded-lg border border-[#D9C589]/20';
    }
    if (isAssistant) {
      return 'bg-[#7BAFB0]/10 text-[#3C4858] text-sm max-w-[90%] text-center p-6 rounded-xl border border-[#7BAFB0]/20 shadow-sm';
    }
    if (isCurrentUser) {
      return 'bg-[#D8A7B1]/15 border-l-4 border-[#D8A7B1] text-[#3C4858] shadow-sm';
    }
    // Other user - left side, teal
    return 'bg-[#7BAFB0]/15 border-l-4 border-[#7BAFB0] text-[#3C4858] shadow-sm';
  };

  const getPosition = () => {
    if (isSystem || isAssistant) {
      return 'justify-center';
    }
    if (isCurrentUser) {
      return 'justify-end'; // Current user on right
    }
    return 'justify-start'; // Other user on left
  };

  const getUserLabel = () => {
    if (isAssistant) return 'AI Mediator';
    if (isCurrentUser) return 'You';
    return participantMap[senderId] || 'Unknown';
  };

  if (isSystem || isAssistant) {
    return (
      <div className="flex justify-center my-6">
        <div className={getBubbleStyle()}>
          <div className="prose prose-sm max-w-none">
            <p className="whitespace-pre-wrap leading-relaxed">{content}</p>
          </div>
          {isAssistant && (
            <p className="text-xs mt-3 text-[#7BAFB0]/70 font-medium">
              {getUserLabel()} • {format(validTimestamp, 'HH:mm')}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${getPosition()}`}>
      <div className={`max-w-[75%] rounded-xl p-4 ${getBubbleStyle()}`}>
        <div className="prose prose-sm max-w-none">
          <p className="whitespace-pre-wrap leading-relaxed">{content}</p>
        </div>
        <p className="text-xs mt-2 text-[#3C4858]/60 font-medium">
          {getUserLabel()} • {format(validTimestamp, 'HH:mm')}
        </p>
      </div>
    </div>
  );
}

