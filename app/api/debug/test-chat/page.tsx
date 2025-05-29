'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChatSetupModal } from '@/components/new-chat-modal';

interface ChatData {
  title: string;
  description: string;
  category: string;
  participants: User[];
}

interface User {
  id: string;
  display_name: string;
  email: string;
  avatar?: string;
}

export default function TestChatPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleCreateChat = async (chatData: ChatData) => {
    try {
      console.log('Creating chat with data:', chatData);
      
      // Simulate API call
      const response = await fetch('/api/chats/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(chatData),
      });

      const result = await response.json();

      if (result.success) {
        console.log('Chat created successfully:', result);
        alert(`Chat created! Would redirect to: ${result.redirectUrl}`);
      } else {
        console.error('Failed to create chat:', result.error);
        alert(`Error: ${result.error}`);
      }
    } catch (error) {
      console.error('Error creating chat:', error);
      alert('Error creating chat');
    }
  };

  return (
    <div className="min-h-screen bg-[#F9F7F4] flex items-center justify-center p-4">
      <div className="text-center space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-[#3C4858] mb-2">
            Chat Setup Modal Test
          </h1>
          <p className="text-[#3C4858]/70 text-lg">
            Test the warm and welcoming chat setup modal
          </p>
        </div>

        <div className="space-y-4">
          <Button
            onClick={() => setIsModalOpen(true)}
            className="bg-gradient-to-r from-[#D8A7B1] to-[#7BAFB0] hover:opacity-90 text-white px-8 py-3 text-lg"
          >
            Open Chat Setup Modal
          </Button>
          
          <div className="text-sm text-[#3C4858]/60 max-w-md mx-auto">
            <p>
              This modal includes:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Warm, welcoming design</li>
              <li>Chat title input</li>
              <li>Category selection with descriptions</li>
              <li>Participant search by display name</li>
              <li>Optional description field</li>
              <li>Category preview with AI mediator info</li>
            </ul>
          </div>
        </div>
      </div>

      <ChatSetupModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreateChat={handleCreateChat}
      />
    </div>
  );
} 