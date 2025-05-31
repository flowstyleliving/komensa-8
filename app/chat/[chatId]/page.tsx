"use client";

import { useSession } from 'next-auth/react';
import { useChat } from '@/features/chat/hooks/useChat';
import { useExtensions } from '@/hooks/useExtensions';
import { useNotificationSound } from '@/hooks/useNotificationSound';
import { ChatBubble } from '@/components/chat/ChatBubble';
import { TypingIndicator } from '@/components/chat/TypingIndicator';
import { ChatInput } from '@/components/chat/ChatInput';
import { MessageCircle, Users, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import Link from 'next/link';
import { useRef, useEffect, useState, use } from 'react';

interface MessageData {
  content: string;
  senderId: string;
}

interface Participant {
  id: string;
  display_name: string;
}

export default function ChatPage({ params }: { params: Promise<{ chatId: string }> }) {
  const { chatId } = use(params);
  const { data: session, status } = useSession();
  const chat = useChat(chatId);
  const { messages, isAssistantTyping, typingUsers, sendMessage, canSendMessage, currentTurn } = chat;
  const { getVizCueContent } = useExtensions({
    chatId: chatId,
    userId: session?.user?.id || '',
    isUserTyping: typingUsers.size > 0,
    isAiTyping: isAssistantTyping,
    currentTurn: isAssistantTyping ? 'ai' : 'user',
    messageCount: messages.length
  });
  const { playReceiveNotification, playSendNotification } = useNotificationSound();
  const previousMessageCount = useRef(messages.length);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [participantMap, setParticipantMap] = useState<Record<string, string>>({});
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
  }, [messages, playReceiveNotification, playSendNotification, session?.user?.id]);
  useEffect(() => {
    if (!chatId) return;
    const fetchInitialState = async () => {
      try {
        const res = await fetch(`/api/chat/${chatId}/state`);
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        const state = await res.json();
        setParticipants(state.participants || []);
        setParticipantMap(
          (state.participants || []).reduce((acc: Record<string, string>, p: any) => {
            acc[p.id] = p.display_name;
            return acc;
          }, {})
        );
      } catch (error) {}
    };
    fetchInitialState();
  }, [chatId]);
  const userId = session?.user?.id || '';
  const humanParticipants = participants.filter((p) => p.id !== 'assistant');
  const headerNames = humanParticipants.map((p) => p.display_name).join(' & ') + ' + AI Mediator';
  
  // Check if current user is typing to conditionally show vizcue
  const isCurrentUserTyping = Array.from(typingUsers).includes(userId);

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
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/" className="flex items-center space-x-2">
                <Image src="/images/komensa-logo.png" alt="Komensa" width={120} height={40} className="h-8 w-auto" />
              </Link>
              <div className="hidden md:flex items-center space-x-2 text-[#3C4858]/60">
                <span>/</span>
                <span>AI Mediation Session</span>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="hidden md:flex items-center gap-2 text-[#3C4858]/60">
                <Users className="h-4 w-4" />
                <span className="text-sm">{headerNames}</span>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                className="border-[#3C4858]/20 text-[#3C4858] rounded-full"
                asChild
              >
                <Link href="/dashboard">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Dashboard
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </nav>
      <div className="flex flex-col h-[calc(100vh-80px)]">
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gradient-to-br from-[#F9F7F4] to-[#EAE8E5]">
          <div className="max-w-4xl mx-auto space-y-6">
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
                />
              );
            })}
            {isAssistantTyping && <TypingIndicator />}
            {Array.from(typingUsers)
              .filter(typingUserId => typingUserId !== userId)
              .map(typingUserId => {
                const displayName = participantMap[typingUserId] || 'Unknown User';
                return (
                  <div key={`typing-${typingUserId}`} className="flex justify-start">
                    <div className="bg-[#7BAFB0]/10 text-[#3C4858] text-sm p-3 rounded-xl border border-[#7BAFB0]/20 shadow-sm">
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
        <div className="border-t border-[#3C4858]/5 bg-white/90 backdrop-blur-sm p-6 shadow-lg">
          <div className="max-w-4xl mx-auto">
            <ChatInput
              onSend={sendMessage}
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
    </div>
  );
} 