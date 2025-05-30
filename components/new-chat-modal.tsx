'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { X, Heart, Shield, MessageCircle, Users, ArrowRight, ArrowLeft, CheckCircle } from 'lucide-react'

interface User {
  id: string;
  display_name: string;
  username?: string;
}

// Placeholder for actual API call
const fetchUsers = async (query: string): Promise<User[]> => {
  try {
    const response = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: "Failed to fetch users" }));
      console.error("Error fetching users:", response.status, errorData.message);
      return [];
    }
    const data = await response.json();
    return data.users;
  } catch (error) {
    console.error("Network error fetching users:", error);
    return [];
  }
};

interface ChatSetupModalProps {
  isOpen: boolean
  onClose: () => void
}

// Loading animation component
const LoadingSpinner = ({ size = 'md', color = 'primary' }: { size?: 'sm' | 'md' | 'lg', color?: 'primary' | 'white' }) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  };

  const colorClasses = {
    primary: 'border-t-[#D8A7B1] border-r-[#D8A7B1]',
    white: 'border-t-white border-r-white'
  };

  return (
    <div className={`${sizeClasses[size]} border-2 border-transparent ${colorClasses[color]} rounded-full animate-spin`} />
  );
};

// Pulsing dots animation
const PulsingDots = () => (
  <div className="flex space-x-1">
    <div className="w-2 h-2 bg-[#D8A7B1] rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
    <div className="w-2 h-2 bg-[#D8A7B1] rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
    <div className="w-2 h-2 bg-[#D8A7B1] rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
  </div>
);

// Define child components OUTSIDE the main ChatSetupModal component
// They will receive props from ChatSetupModal
const PreparationStep = ({ setCurrentStep }: { setCurrentStep: React.Dispatch<React.SetStateAction<'preparation' | 'participants' | 'creating'>> }) => (
  <div className="space-y-6">
    <div className="text-center">
      <div className="mx-auto w-16 h-16 bg-[#D8A7B1]/20 rounded-full flex items-center justify-center mb-4">
        <Heart className="w-8 h-8 text-[#D8A7B1]" />
      </div>
      <h3 className="text-lg font-semibold text-[#3C4858] mb-2">Preparing for Intimate Chat</h3>
      <p className="text-sm text-[#3C4858]/70">
        Creating a safe space for meaningful dialogue requires intention and care.
      </p>
    </div>

    <div className="space-y-4">
      <div className="flex items-start space-x-3 p-3 bg-[#D8A7B1]/10 rounded-lg">
        <Shield className="w-5 h-5 text-[#D8A7B1] mt-0.5 flex-shrink-0" />
        <div>
          <h4 className="font-medium text-[#3C4858] text-sm">Create Psychological Safety</h4>
          <p className="text-xs text-[#3C4858]/70 mt-1">
            Ensure all participants feel safe to express themselves without judgment. The AI mediator will help maintain this environment.
          </p>
        </div>
      </div>

      <div className="flex items-start space-x-3 p-3 bg-[#D8A7B1]/10 rounded-lg">
        <MessageCircle className="w-5 h-5 text-[#D8A7B1] mt-0.5 flex-shrink-0" />
        <div>
          <h4 className="font-medium text-[#3C4858] text-sm">Practice Active Listening</h4>
          <p className="text-xs text-[#3C4858]/70 mt-1">
            Focus on understanding rather than responding. The mediator will guide turn-taking and ensure everyone is heard.
          </p>
        </div>
      </div>

      <div className="flex items-start space-x-3 p-3 bg-[#D8A7B1]/10 rounded-lg">
        <Users className="w-5 h-5 text-[#D8A7B1] mt-0.5 flex-shrink-0" />
        <div>
          <h4 className="font-medium text-[#3C4858] text-sm">Embrace Vulnerability</h4>
          <p className="text-xs text-[#3C4858]/70 mt-1">
            Authentic connection requires openness. Share your truth while respecting others' boundaries.
          </p>
        </div>
      </div>
    </div>

    <div className="bg-[#FFFBF5] border border-[#D8A7B1]/30 rounded-lg p-4">
      <h4 className="font-medium text-[#3C4858] text-sm mb-2">💡 Pro Tip</h4>
      <p className="text-xs text-[#3C4858]/70">
        The AI mediator will help facilitate the Chat, suggest reflection questions, and ensure balanced participation. Trust the process and be present.
      </p>
    </div>

    <Button
      className="w-full bg-[#D8A7B1] hover:bg-[#C99BA4] text-white py-2.5"
      onClick={() => setCurrentStep('participants')}
    >
      I'm Ready to Begin
      <ArrowRight className="w-4 h-4 ml-2" />
    </Button>
  </div>
);

interface ParticipantsStepProps {
  setCurrentStep: React.Dispatch<React.SetStateAction<'preparation' | 'participants' | 'creating'>>;
  participantSearchQuery: string;
  setParticipantSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  searchedUsers: User[];
  selectedParticipants: User[];
  isSearching: boolean;
  isCreatingChat: boolean; // Added prop for loading state
  chatCreationError: string | null;
  handleSelectParticipant: (user: User) => void;
  handleRemoveParticipant: (userId: string) => void;
  clearSearch: () => void;
  handleStartChat: () => Promise<void>;
}

const ParticipantsStep = ({
  setCurrentStep,
  participantSearchQuery,
  setParticipantSearchQuery,
  searchedUsers,
  selectedParticipants,
  isSearching,
  isCreatingChat, // Destructure the new prop
  chatCreationError,
  handleSelectParticipant,
  handleRemoveParticipant,
  clearSearch,
  handleStartChat,
}: ParticipantsStepProps) => {
  console.log("ParticipantsStep rendering. searchedUsers:", searchedUsers, "Type:", typeof searchedUsers);
  const displayedUsers = searchedUsers.filter(u => !selectedParticipants.some(sp => sp.id === u.id));

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2 mb-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCurrentStep('preparation')}
          className="text-[#3C4858]/70 hover:bg-[#F9F7F4]"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h3 className="text-lg font-semibold text-[#3C4858]">Invite Participants</h3>
          <p className="text-sm text-[#3C4858]/70">Choose who will join this mediated Chat</p>
        </div>
      </div>

      <div>
        <Label htmlFor="chat-participants" className="text-sm font-medium text-[#3C4858]">Search for Participants</Label>
        <div className="relative">
          <Input
            id="chat-participants"
            placeholder="Search by name or username (min 3 chars)"
            className="mt-1 border-[#3C4858]/20 focus:border-[#D8A7B1] bg-white placeholder:text-[#3C4858]/50 pr-20"
            value={participantSearchQuery}
            onChange={(e) => setParticipantSearchQuery(e.target.value)}
            autoComplete="off"
            disabled={isCreatingChat} // Disable input while creating chat
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 mt-0.5 flex items-center space-x-1">
            {participantSearchQuery && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearSearch}
                className="h-6 w-6 p-0 text-[#3C4858]/50 hover:text-[#3C4858] hover:bg-[#D8A7B1]/10"
              >
                <X size={12} />
              </Button>
            )}
            {isSearching && <LoadingSpinner size="sm" color="primary" />}
          </div>
        </div>
        {displayedUsers.length > 0 && (
          <div className="mt-2 border border-[#3C4858]/20 rounded-md max-h-40 overflow-y-auto bg-white shadow-sm">
            {displayedUsers.map(user => (
              <div
                key={user.id}
                className="p-3 hover:bg-[#D8A7B1]/10 cursor-pointer text-sm text-[#3C4858] transition-colors border-b border-[#3C4858]/10 last:border-b-0"
                onClick={() => handleSelectParticipant(user)}
              >
                <div className="font-medium text-[#3C4858]">{user.display_name}</div>
                {user.username && (
                  <div className="text-xs text-[#3C4858]/80">@{user.username}</div>
                )}
              </div>
            ))}
          </div>
        )}
        {displayedUsers.length === 0 && participantSearchQuery.length >= 3 && !isSearching && (
          <div className="mt-2 text-sm text-center text-[#3C4858]/70 p-3 border border-dashed border-[#3C4858]/20 rounded-md bg-[#F9F7F4]">
            No users found matching "{participantSearchQuery}".
          </div>
        )}
      </div>

      {selectedParticipants.length > 0 && (
        <div>
          <Label className="text-xs font-medium text-[#3C4858]/80">Selected Participants ({selectedParticipants.length}):</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {selectedParticipants.map(user => (
              <div key={user.id} className="flex items-center bg-[#D8A7B1]/20 text-[#3C4858] text-sm px-3 py-1.5 rounded-full transition-all hover:bg-[#D8A7B1]/30 group">
                <span className="font-medium">{user.display_name}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveParticipant(user.id)}
                  className="h-4 w-4 ml-2 p-0 rounded-full hover:bg-[#D8A7B1]/40 opacity-60 group-hover:opacity-100 transition-opacity"
                >
                  <X size={12} />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {chatCreationError && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 p-3 rounded-md">
          <strong>Error:</strong> {chatCreationError}
        </div>
      )}

      <Button
        className="w-full bg-[#D8A7B1] hover:bg-[#C99BA4] text-white py-2.5 transition-all"
        onClick={handleStartChat}
        disabled={selectedParticipants.length === 0 || isSearching || isCreatingChat} // Disable button when creating
      >
        {isCreatingChat ? (
            <LoadingSpinner size="sm" color="white" />
        ) : (
            <>
                Start Mediated Chat
                <MessageCircle className="w-4 h-4 ml-2" />
            </>
        )}
      </Button>
    </div>
  );
};

const CreatingStep = ({ creationProgress }: { creationProgress: number }) => (
  <div className="space-y-6 text-center">
    <div className="mx-auto w-20 h-20 bg-[#D8A7B1]/20 rounded-full flex items-center justify-center">
      <LoadingSpinner size="lg" color="primary" />
    </div>

    <div>
      <h3 className="text-lg font-semibold text-[#3C4858] mb-2">Creating Your Sacred Space</h3>
      <p className="text-sm text-[#3C4858]/70 mb-4">
        Setting up the Chat environment and preparing the AI mediator
      </p>
      <PulsingDots />
    </div>

    <div className="w-full bg-[#3C4858]/10 rounded-full h-2">
      <div
        className="bg-[#D8A7B1] h-2 rounded-full transition-all duration-300 ease-out"
        style={{ width: `${creationProgress}%` }}
      />
    </div>

    <div className="space-y-2 text-xs text-[#3C4858]/60">
      <div className="flex items-center justify-center space-x-2">
        <CheckCircle className="w-4 h-4 text-[#D8A7B1]" />
        <span>Initializing secure Chat space</span>
      </div>
      {creationProgress > 20 && (
        <div className="flex items-center justify-center space-x-2">
          <CheckCircle className="w-4 h-4 text-[#D8A7B1]" />
          <span>Configuring AI mediator</span>
        </div>
      )}
      {creationProgress > 40 && (
        <div className="flex items-center justify-center space-x-2">
          <CheckCircle className="w-4 h-4 text-[#D8A7B1]" />
          <span>Inviting participants</span>
        </div>
      )}
      {creationProgress > 60 && (
        <div className="flex items-center justify-center space-x-2">
          <CheckCircle className="w-4 h-4 text-[#D8A7B1]" />
          <span>Generating AI welcome message</span>
        </div>
      )}
      {creationProgress > 85 && (
        <div className="flex items-center justify-center space-x-2">
          <CheckCircle className="w-4 h-4 text-[#D8A7B1]" />
          <span>Ready to begin!</span>
        </div>
      )}
    </div>
  </div>
);

export default function ChatSetupModal({ isOpen, onClose }: ChatSetupModalProps) {
  const [currentStep, setCurrentStep] = useState<'preparation' | 'participants' | 'creating'>('preparation');
  const [participantSearchQuery, setParticipantSearchQuery] = useState("");
  const [searchedUsers, setSearchedUsers] = useState<User[]>([]);
  const [selectedParticipants, setSelectedParticipants] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isCreatingChat, setIsCreatingChat] = useState(false); // New state for chat creation loading
  const [chatCreationError, setChatCreationError] = useState<string | null>(null);
  const [creationProgress, setCreationProgress] = useState(0); // New state for progress bar
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const router = useRouter();

  useEffect(() => {
    if (!isOpen) return;

    if (participantSearchQuery.length >= 3) {
      setIsSearching(true);

      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }

      searchTimeoutRef.current = setTimeout(async () => {
        try {
          const users = await fetchUsers(participantSearchQuery);
          setSearchedUsers(users);
        } catch (error) {
          console.error("Search error:", error);
          setSearchedUsers([]);
        } finally {
          setIsSearching(false);
        }
      }, 500);
    } else {
      setSearchedUsers([]);
      setIsSearching(false);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [isOpen, participantSearchQuery]);

  useEffect(() => {
    if (!isOpen) {
      setCurrentStep('preparation');
      setParticipantSearchQuery("");
      setSearchedUsers([]);
      setSelectedParticipants([]);
      setIsSearching(false);
      setIsCreatingChat(false); // Reset this state too
      setChatCreationError(null);
      setCreationProgress(0); // Reset progress
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
        searchTimeoutRef.current = null;
      }
    }
  }, [isOpen]);

  const handleSelectParticipant = useCallback((user: User) => {
    if (!selectedParticipants.find(p => p.id === user.id)) {
      setSelectedParticipants(prev => [...prev, user]);
    }
    setParticipantSearchQuery("");
    setSearchedUsers([]);
  }, [selectedParticipants]);

  const handleRemoveParticipant = useCallback((userId: string) => {
    setSelectedParticipants(prev => prev.filter(p => p.id !== userId));
  }, []);

  const clearSearch = useCallback(() => {
    setParticipantSearchQuery("");
    setSearchedUsers([]);
  }, []);

  const handleStartChat = async () => {
    // Basic validation
    if (selectedParticipants.length === 0) {
      setChatCreationError("Please select at least one participant.");
      return;
    }

    setCurrentStep('creating'); // Move to the creating step
    setIsCreatingChat(true);
    setChatCreationError(null); // Clear previous errors
    setCreationProgress(0); // Start progress from 0

    try {
      // Simulate progress for better UX - longer duration for AI message generation
      const progressInterval = setInterval(() => {
        setCreationProgress(prev => {
          if (prev >= 85) { // Stop at 85% to show final success after API response
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 5; // Slower progress (5% instead of 10%)
        });
      }, 300); // Update progress every 300ms (slower than before)

      const participantIds = selectedParticipants.map(p => p.id);
      const response = await fetch('/api/chats/create', { // Your backend API endpoint
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          title: "New Chat", // TODO: Allow users to set title
          description: "AI-mediated conversation", // TODO: Allow users to set description
          category: "general", // TODO: Allow users to set category
          participants: participantIds.map(id => ({ id }))
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // If response is not OK (e.g., 400, 500), throw an error
        throw new Error(data.error || 'Failed to create chat');
      }

      clearInterval(progressInterval); // Clear the progress interval
      setCreationProgress(100); // Set progress to 100% on success

      // Brief delay to allow users to see the completion before routing
      setTimeout(() => {
        onClose(); // Close the modal
        router.push(`/chat/${data.chatId}`); // Route to the new chat
      }, 500); // Wait for 500ms

    } catch (error) {
      console.error("Error starting Chat:", error);
      setChatCreationError(error instanceof Error ? error.message : 'An unknown error occurred');
      setCurrentStep('participants'); // Go back to participants step on error
    } finally {
      setIsCreatingChat(false); // End loading state
    }
  };

  return isOpen ? (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 transition-opacity duration-300 ease-in-out">
      <Card className="bg-[#FFFBF5] p-6 rounded-lg shadow-xl w-full max-w-md transform transition-all duration-300 ease-in-out scale-100 opacity-100">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-[#3C4858]">
            {currentStep === 'preparation' && 'Prepare for Connection'}
            {currentStep === 'participants' && 'Create Chat'}
            {currentStep === 'creating' && 'Almost Ready...'}
          </h2>
          {currentStep !== 'creating' && (
            <Button variant="ghost" size="icon" onClick={onClose} className="text-[#3C4858]/70 hover:bg-[#F9F7F4]">
              <span className="sr-only">Close modal</span>
              ✕
            </Button>
          )}
        </div>

        {/* Render child components based on currentStep */}
        {currentStep === 'preparation' && <PreparationStep setCurrentStep={setCurrentStep} />}
        {currentStep === 'participants' && (
          <ParticipantsStep
            setCurrentStep={setCurrentStep}
            participantSearchQuery={participantSearchQuery}
            setParticipantSearchQuery={setParticipantSearchQuery}
            searchedUsers={searchedUsers}
            selectedParticipants={selectedParticipants}
            isSearching={isSearching}
            isCreatingChat={isCreatingChat} // Pass the new prop
            chatCreationError={chatCreationError}
            handleSelectParticipant={handleSelectParticipant}
            handleRemoveParticipant={handleRemoveParticipant}
            clearSearch={clearSearch}
            handleStartChat={handleStartChat}
          />
        )}
        {currentStep === 'creating' && <CreatingStep creationProgress={creationProgress} />}

        {currentStep !== 'creating' && (
          <Button
            variant="outline"
            className="w-full border-[#3C4858]/30 text-[#3C4858]/80 hover:bg-[#F9F7F4] py-2.5 mt-4"
            onClick={onClose}
            disabled={isCreatingChat} // Disable cancel button too
          >
            Cancel
          </Button>
        )}
      </Card>
    </div>
  ) : null
}