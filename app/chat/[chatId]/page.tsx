'use client';

import { useChat } from '@/features/chat/hooks/useChat';
import { useDemoChat } from '@/hooks/useDemoChat';
import { useExtensions } from '@/hooks/useExtensions';
import { useNotificationSound } from '@/hooks/useNotificationSound';
import { ChatBubble } from '@/components/chat/ChatBubble';
import { TypingIndicator } from '@/components/chat/TypingIndicator';
import { ChatInput } from '@/components/chat/ChatInput';
import { DemoModal } from '@/components/demo/DemoModal';
import { CalendlyModal } from '@/components/demo/CalendlyModal';
import type { Event } from '@prisma/client';
import { MessageCircle, Users, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import Link from 'next/link';
import { useRef, useEffect, useState, useMemo } from 'react';
import { isDemoSession } from '@/utils/demo';

interface MessageData {
  content: string;
  senderId: string;
}

export default function ChatPage({ params }: { params: { chatId: string } }) {
  // Efficiently detect demo mode once and memoize the result
  const isDemoDetected = useMemo(() => isDemoSession(), []);

  // Use appropriate hook based on demo detection
  const regularChat = useChat(params.chatId);
  const demoChat = useDemoChat(params.chatId, isDemoDetected);
  
  const chat = isDemoDetected ? demoChat : regularChat;
  const { messages, isAssistantTyping, typingUsers, sendMessage, canSendMessage } = chat;
  
  // Extension system for viz cues
  const { getVizCueContent } = useExtensions({
    chatId: params.chatId,
    userId: 'current-user', // TODO: Get from auth
    isUserTyping: typingUsers.size > 0,
    isAiTyping: isAssistantTyping,
    currentTurn: isAssistantTyping ? 'ai' : 'user',
    messageCount: messages.length
  });
  
  // Notification sounds for messages
  const { playReceiveNotification, playSendNotification } = useNotificationSound();
  const previousMessageCount = useRef(messages.length);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isAssistantTyping, typingUsers]);

  // Play notification sounds for new messages
  useEffect(() => {
    if (messages.length > previousMessageCount.current) {
      const newMessages = messages.slice(previousMessageCount.current);
      
      newMessages.forEach(message => {
        const data = message.data as MessageData;
        
        if (data.senderId !== 'current-user') {
          playReceiveNotification();
        }
      });
      
      previousMessageCount.current = messages.length;
    }
  }, [messages, playReceiveNotification, playSendNotification]);

  return (
    <div className="min-h-screen bg-[#F9F7F4]">
      {/* Navigation Header */}
      <nav className="bg-white/80 backdrop-blur-sm border-b border-[#3C4858]/10 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/" className="flex items-center space-x-2">
                <Image src="/images/komensa-logo.png" alt="Komensa" width={120} height={40} className="h-8 w-auto" />
              </Link>
              <div className="hidden md:flex items-center space-x-2 text-[#3C4858]/60">
                <span>/</span>
                <span>Mediation Session</span>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="hidden md:flex items-center gap-2 text-[#3C4858]/60">
                <Users className="h-4 w-4" />
                <span className="text-sm">User A & Jordan + AI Mediator</span>
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
        {/* Messages */}
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
                />
              );
            })}
            {isAssistantTyping && <TypingIndicator />}
            {/* Show typing indicators for other users */}
            {Array.from(typingUsers).map(userId => (
              <div key={`typing-${userId}`} className="flex justify-start">
                <div className="bg-[#7BAFB0]/10 text-[#3C4858] text-sm p-3 rounded-xl border border-[#7BAFB0]/20 shadow-sm">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <div className="w-1.5 h-1.5 bg-[#7BAFB0] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-1.5 h-1.5 bg-[#7BAFB0] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-1.5 h-1.5 bg-[#7BAFB0] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                    <span className="text-[#7BAFB0]/80 font-medium text-xs">Jordan is typing...</span>
                  </div>
                </div>
              </div>
            ))}
            {/* Invisible element to scroll to */}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input */}
        <div className="border-t border-[#3C4858]/5 bg-white/90 backdrop-blur-sm p-6 shadow-lg">
          <div className="max-w-4xl mx-auto">
            <ChatInput
              onSend={sendMessage}
              disabled={!canSendMessage()}
              placeholder={canSendMessage() ? "Share your thoughts..." : "Waiting for your turn..."}
              topContent={getVizCueContent()}
            />
          </div>
        </div>
      </div>

      {/* Demo Modal */}
      {isDemoDetected && 'showModal' in chat && chat.showModal && (
        <DemoModal 
          onClose={chat.dismissModal}
          aiResponseCount={chat.aiResponseCount}
        />
      )}

      {/* Calendly Modal */}
      {isDemoDetected && 'showCalendlyModal' in chat && chat.showCalendlyModal && (
        <CalendlyModal 
          onClose={chat.dismissCalendlyModal}
          aiResponseCount={chat.aiResponseCount}
        />
      )}
    </div>
  );
} 