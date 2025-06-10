"use client";

import { useSession } from 'next-auth/react';
import { useChat } from '@/features/chat/hooks/useChat';
import { useCompletion } from '@/features/chat/hooks/useCompletion';
import { useExtensions } from '@/hooks/useExtensions';
import { useNotificationSound } from '@/hooks/useNotificationSound';
import { ChatBubble } from '@/components/chat/ChatBubble';
import { TypingIndicator } from '@/components/chat/TypingIndicator';
import { ChatInput } from '@/components/chat/ChatInput';
import { ChatSettingsModal } from '@/components/chat/ChatSettingsModal';
import { SummaryDisplay } from '@/components/chat/SummaryDisplay';
import { MessageCircle, Users, ArrowLeft, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useEffect, useState, use } from 'react';

interface MessageData {
  content: string;
  senderId: string;
}

interface Participant {
  id: string;
  display_name: string;
  role?: string;
}

export default function ChatPage({ params }: { params: Promise<{ chatId: string }> }) {
  const { chatId } = use(params);
  const { data: session, status } = useSession();
  const router = useRouter();
  const [checkingInitiation, setCheckingInitiation] = useState(true);
  const chat = useChat(chatId);
  const {
    messages,
    isAssistantTyping,
    typingUsers,
    currentTurn,
    sendMessage,
    canSendMessage,
    recoverFromStuckAI
  } = chat;
  
  // Completion functionality
  const completion = useCompletion(chatId);
  const { summaryData, markComplete, generateSummary } = completion;
  const [showSummary, setShowSummary] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  const { getVizCueContent } = useExtensions({
    chatId: chatId,
    userId: session?.user?.id || '',
    isUserTyping: typingUsers.size > 0,
    isAiTyping: isAssistantTyping,
    currentTurn: currentTurn?.next_user_id === 'anyone' ? 'user' : (isAssistantTyping ? 'ai' : 'user'),
    messageCount: messages.length
  });
  const { playReceiveNotification, playSendNotification } = useNotificationSound();
  const previousMessageCount = useRef(messages.length);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [participantMap, setParticipantMap] = useState<Record<string, string>>({});
  const lastSentMessageRef = useRef<string | null>(null);
  
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isAssistantTyping, typingUsers]);
  
  useEffect(() => {
    if (messages.length > previousMessageCount.current) {
      const newMessages = messages.slice(previousMessageCount.current);
      newMessages.forEach(message => {
        const data = message.data as MessageData;
        if (data.senderId !== session?.user?.id) {
          playReceiveNotification();
        }
      });
      previousMessageCount.current = messages.length;
    }
  }, [messages, playReceiveNotification, session?.user?.id]);
  
  // Check if chat has been initiated, redirect to waiting room if not
  useEffect(() => {
    if (!chatId || status === 'loading') return;
    
    const checkChatInitiation = async () => {
      try {
        const response = await fetch(`/api/waiting-room/ready?chatId=${chatId}`);
        if (response.ok) {
          const data = await response.json();
          
          // If chat not initiated, redirect to waiting room
          if (!data.bothReady) {
            console.log('[ChatPage] Chat not initiated, redirecting to waiting room');
            router.push(`/waiting-room/${chatId}`);
            return;
          }
        }
      } catch (error) {
        console.error('[ChatPage] Error checking chat initiation:', error);
      } finally {
        setCheckingInitiation(false);
      }
    };
    
    checkChatInitiation();
  }, [chatId, status, router]);
  
  useEffect(() => {
    if (!chatId || checkingInitiation) return;
    const fetchInitialState = async () => {
      try {
        console.log('[ChatPage] Fetching initial state for chat:', chatId);
        const res = await fetch(`/api/chat/${chatId}/state`);
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        const state = await res.json();
        console.log('[ChatPage] Received state:', {
          participantsCount: state.participants?.length || 0,
          participants: state.participants,
          messages: state.messages?.length || 0
        });
        
        if (state.participants && Array.isArray(state.participants)) {
          // Add assistant to participants if not already present
          const participantsWithAssistant = [...state.participants];
          if (!participantsWithAssistant.find(p => p.id === 'assistant')) {
            participantsWithAssistant.push({
              id: 'assistant',
              display_name: 'AI Mediator',
              role: 'assistant'
            });
          }
          
          setParticipants(participantsWithAssistant);
          console.log('[ChatPage] Set participants with assistant:', participantsWithAssistant);
          
          const participantMap = participantsWithAssistant.reduce((acc: Record<string, string>, p: any) => {
            acc[p.id] = p.display_name;
            return acc;
          }, {});
          setParticipantMap(participantMap);
          console.log('[ChatPage] Set participant map:', participantMap);
        } else {
          console.warn('[ChatPage] No participants data received or invalid format');
        }
      } catch (error) {
        console.error('[ChatPage] Failed to fetch initial state:', error);
      }
    };
    fetchInitialState();

    // Subscribe to real-time participant updates
    const { pusherClient, getChatChannelName, PUSHER_EVENTS } = require('@/lib/pusher');
    const channelName = getChatChannelName(chatId);
    const channel = pusherClient.subscribe(channelName);
    
    // Handle participant joining
    channel.bind(PUSHER_EVENTS.PARTICIPANT_JOINED, (data: any) => {
      console.log('[ChatPage] Participant joined, refreshing participant list');
      fetchInitialState(); // Refresh participant data
    });

    return () => {
      channel.unbind(PUSHER_EVENTS.PARTICIPANT_JOINED);
      pusherClient.unsubscribe(channelName);
    };
  }, [chatId]);

  // Show summary when it becomes available
  useEffect(() => {
    if (summaryData?.hasSummary && !showSummary) {
      setShowSummary(true);
    }
  }, [summaryData, showSummary]);
  
  const userId = session?.user?.id || '';
  const humanParticipants = participants.filter((p) => p.id !== 'assistant');
  
  // More robust header names logic
  const getHeaderNames = () => {
    // Check if we're still loading participants
    if (status === 'loading' || !chatId) {
      return 'Loading... + AI Mediator';
    }
    
    if (humanParticipants.length === 0) {
      // Only show loading if we truly have no participants
      return 'Loading participants... + AI Mediator';
    }
    
    // Get participant names, falling back to better defaults
    const participantNames = humanParticipants.map((p) => {
      if (p.display_name) {
        return p.display_name;
      }
      // Better fallback for guests and users without display names
      if (p.id.startsWith('guest_')) {
        return 'Guest User';
      }
      return 'User';
    });
    
    return participantNames.join(' & ') + ' + AI Mediator';
  };
  
  const headerNames = getHeaderNames();
  
  console.log('[ChatPage] Render debug:', {
    participantsTotal: participants.length,
    humanParticipants: humanParticipants.length,
    headerNames,
    currentUserId: userId,
    isAssistantTyping: isAssistantTyping,
    shouldShowTypingIndicator: isAssistantTyping && true,
    status: status,
    chatId: chatId
  });
  
  // Check if current user is typing to conditionally show vizcue
  const isCurrentUserTyping = Array.from(typingUsers).includes(userId);

  // Show loading while checking if chat is initiated
  if (checkingInitiation) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F9F7F4]">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-[#D8A7B1] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[#3C4858]/70">Checking conversation status...</p>
        </div>
      </div>
    );
  }

  const handleSendMessage = async (content: string) => {
    // Play send sound when user sends a message
    playSendNotification();
    // Store the message content to track if it's our own message
    lastSentMessageRef.current = content;
    // Send the message
    await sendMessage(content);
  };

  const handleMarkComplete = async (completionType: string) => {
    try {
      await markComplete(completionType);
    } catch (error) {
      console.error('Failed to mark complete:', error);
    }
  };

  const handleGenerateSummary = async () => {
    try {
      await generateSummary();
    } catch (error) {
      console.error('Failed to generate summary:', error);
    }
  };

  const handleResetTurn = async () => {
    try {
      const response = await fetch(`/api/chat/${chatId}/reset-turn`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to reset turn');
      }

      console.log('Turn state reset successfully');
    } catch (error) {
      console.error('Failed to reset turn:', error);
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-[#F9F7F4] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#D8A7B1] mx-auto mb-4"></div>
          <p className="text-[#3C4858]/70">Loading...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-[#F9F7F4]">
      <nav className="bg-white/80 backdrop-blur-sm border-b border-[#3C4858]/10 sticky top-0 z-50">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 sm:space-x-4 min-w-0 flex-1">
              <Link href="/dashboard" className="flex items-center space-x-2 flex-shrink-0">
                <Image src="/images/komensa-logo.png" alt="Komensa" width={120} height={40} className="h-6 sm:h-8 w-auto" />
              </Link>
              <div className="hidden md:flex items-center space-x-2 text-[#3C4858]/60">
                <span>/</span>
                <span>AI Mediation Session</span>
              </div>
            </div>
            <div className="flex items-center space-x-2 sm:space-x-4 flex-shrink-0">
              {/* Mobile: Show participant count */}
              <div className="md:hidden flex items-center gap-1 text-[#3C4858]/60 text-xs">
                <Users className="h-3 w-3" />
                <span>{humanParticipants.length + 1}</span>
              </div>
              {/* Desktop: Show full participant names */}
              <div className="hidden md:flex items-center gap-2 text-[#3C4858]/60">
                <Users className="h-4 w-4" />
                <span className="text-sm">{headerNames}</span>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                className="border-[#7BAFB0] text-[#7BAFB0] rounded-full hover:bg-[#7BAFB0] hover:text-white transition-all duration-300 text-xs sm:text-sm px-2 sm:px-3"
                onClick={() => setShowSettings(true)}
              >
                <Settings className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                <span className="hidden sm:inline">Settings</span>
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                className="border-[#3C4858]/20 text-[#3C4858] rounded-full text-xs sm:text-sm px-2 sm:px-3"
                asChild
              >
                <Link href="/dashboard">
                  <ArrowLeft className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Dashboard</span>
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </nav>
      
      <div className="flex flex-col h-[calc(100vh-64px)] sm:h-[calc(100vh-80px)]">
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4 sm:space-y-6 bg-gradient-to-br from-[#F9F7F4] to-[#EAE8E5]">
          <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
            {messages.map((message) => {
              const data = message.data as MessageData;
              return (
                <ChatBubble
                  key={message.id}
                  content={data.content}
                  senderId={data.senderId}
                  timestamp={new Date(message.created_at)}
                  userId={userId}
                  participantMap={participantMap}
                  participants={participants}
                  messageData={data}
                />
              );
            })}
            {(() => {
              console.log('[ChatPage] Typing indicator check:', { isAssistantTyping });
              return isAssistantTyping && (
                <TypingIndicator 
                  onRecover={recoverFromStuckAI}
                  chatId={chatId}
                />
              );
            })()}
            {Array.from(typingUsers)
              .filter(typingUserId => typingUserId !== userId && typingUserId !== 'assistant')
              .map(typingUserId => {
                const displayName = participantMap[typingUserId] || 'Unknown User';
                return (
                  <div key={`typing-${typingUserId}`} className="flex justify-start">
                    <div className="bg-[#7BAFB0]/10 text-[#3C4858] text-sm p-3 rounded-xl border border-[#7BAFB0]/20 shadow-sm max-w-[85%] sm:max-w-none">
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          <div className="w-1.5 h-1.5 bg-[#7BAFB0] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                          <div className="w-1.5 h-1.5 bg-[#7BAFB0] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                          <div className="w-1.5 h-1.5 bg-[#7BAFB0] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                        </div>
                        <span className="text-[#7BAFB0]/80 font-medium text-xs">{displayName} is typing...</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            <div ref={messagesEndRef} />
          </div>
        </div>
        
        <div className="border-t border-[#3C4858]/5 bg-white/90 backdrop-blur-sm p-2 shadow-lg">
          <div className="max-w-4xl mx-auto">
            <ChatInput
              onSend={handleSendMessage}
              disabled={!canSendMessage()}
              placeholder={canSendMessage() ? "Share your thoughts..." : "Waiting for your turn..."}
              topContent={isCurrentUserTyping ? null : getVizCueContent()}
              currentTurn={currentTurn}
              participants={participants}
              currentUserId={userId}
              chatId={chatId}
            />
          </div>
        </div>
      </div>

      {/* Chat Settings Modal */}
      <ChatSettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        chatId={chatId}
        currentUserId={userId}
        onMarkComplete={handleMarkComplete}
        onGenerateSummary={handleGenerateSummary}
        onResetAI={recoverFromStuckAI}
        onResetTurn={handleResetTurn}
        onUpdateTurnStyle={async (newStyle: string) => {
          console.log(`[ChatPage] Turn style updated to: ${newStyle}`);
          // Pusher will handle the real-time turn state update,
          // but let's also refresh the session to be sure
          if (newStyle === 'strict') {
            // Small delay to let the API initialize turn state
            setTimeout(() => {
              window.location.reload();
            }, 500);
          }
        }}
        participants={participants}
      />

      {/* Summary Display */}
      {showSummary && summaryData && (
        <SummaryDisplay
          summary={summaryData.summary}
          generatedAt={summaryData.generatedAt}
          chatId={chatId}
          onClose={() => setShowSummary(false)}
        />
      )}
    </div>
  );
} 