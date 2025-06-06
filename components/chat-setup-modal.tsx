'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { X, Heart, Shield, MessageCircle, Users, ArrowRight, ArrowLeft, CheckCircle, Link2, Copy, Check } from 'lucide-react'

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
  onCreateChat?: (chatData: any) => Promise<void> | void
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

// Invite Link Component
const InviteLinkComponent = ({ inviteUrl, chatId, onClose }: { inviteUrl: string; chatId: string; onClose: () => void }) => {
  const [copied, setCopied] = useState(false);
  const router = useRouter();

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleContinueToChat = () => {
    onClose();
    router.push(`/chat/${chatId}`);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="text-center">
        <div className="mx-auto w-12 h-12 sm:w-16 sm:h-16 bg-[#D8A7B1]/20 rounded-full flex items-center justify-center mb-3 sm:mb-4">
          <Link2 className="w-6 h-6 sm:w-8 sm:h-8 text-[#D8A7B1]" />
        </div>
        <h3 className="text-base sm:text-lg font-semibold text-[#3C4858] mb-2">Chat Created Successfully!</h3>
        <p className="text-sm text-[#3C4858]/70">
          Share this invite link to let others join your conversation.
        </p>
      </div>

      <div className="bg-[#F9F7F4] border border-[#D8A7B1]/30 rounded-lg p-3 sm:p-4">
        <Label className="text-xs font-medium text-[#3C4858]/80 mb-2 block">Invite Link</Label>
        <div className="flex items-center space-x-2">
          <Input
            value={inviteUrl}
            readOnly
            className="flex-1 bg-white border-[#3C4858]/20 text-base sm:text-sm font-mono"
          />
          <Button
            onClick={copyToClipboard}
            variant="outline"
            size="sm"
            className="border-[#D8A7B1] text-[#D8A7B1] hover:bg-[#D8A7B1]/10 px-3 py-2 touch-manipulation flex-shrink-0"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            <span className="hidden sm:inline ml-1">{copied ? 'Copied' : 'Copy'}</span>
          </Button>
        </div>
        <p className="text-xs text-[#3C4858]/60 mt-2 leading-relaxed">
          This link expires in 24 hours and can only be used once.
        </p>
      </div>

      <div className="bg-[#FFFBF5] border border-[#D8A7B1]/30 rounded-lg p-3 sm:p-4">
        <h4 className="font-medium text-[#3C4858] text-sm mb-2">💡 How it works</h4>
        <ul className="text-xs text-[#3C4858]/70 space-y-1 leading-relaxed">
          <li>• Share the link with someone you'd like to have a conversation with</li>
          <li>• They'll enter their name and join as a guest</li>
          <li>• The AI mediator will facilitate your dialogue</li>
        </ul>
      </div>

      <Button
        className="w-full bg-[#D8A7B1] hover:bg-[#C99BA4] text-white py-3 sm:py-2.5 text-base sm:text-sm font-medium touch-manipulation"
        onClick={handleContinueToChat}
      >
        Continue to Chat
        <ArrowRight className="w-4 h-4 ml-2" />
      </Button>
    </div>
  );
};

// Define child components OUTSIDE the main ChatSetupModal component
// They will receive props from ChatSetupModal
const PreparationStep = ({ setCurrentStep }: { setCurrentStep: React.Dispatch<React.SetStateAction<'preparation' | 'participants' | 'creating' | 'invite-success'>> }) => (
  <div className="space-y-4 sm:space-y-6">
    <div className="text-center">
      <div className="mx-auto w-12 h-12 sm:w-16 sm:h-16 bg-[#D8A7B1]/20 rounded-full flex items-center justify-center mb-3 sm:mb-4">
        <Heart className="w-6 h-6 sm:w-8 sm:h-8 text-[#D8A7B1]" />
      </div>
      <h3 className="text-base sm:text-lg font-semibold text-[#3C4858] mb-2">Preparing for Intimate Chat</h3>
      <p className="text-sm text-[#3C4858]/70">
        Creating a safe space for meaningful dialogue requires intention and care.
      </p>
    </div>

    <div className="space-y-3 sm:space-y-4">
      <div className="flex items-start space-x-3 p-3 bg-[#D8A7B1]/10 rounded-lg">
        <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-[#D8A7B1] mt-0.5 flex-shrink-0" />
        <div>
          <h4 className="font-medium text-[#3C4858] text-sm">Create Psychological Safety</h4>
          <p className="text-xs sm:text-xs text-[#3C4858]/70 mt-1 leading-relaxed">
            Ensure all participants feel safe to express themselves without judgment. The AI mediator will help maintain this environment.
          </p>
        </div>
      </div>

      <div className="flex items-start space-x-3 p-3 bg-[#D8A7B1]/10 rounded-lg">
        <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5 text-[#D8A7B1] mt-0.5 flex-shrink-0" />
        <div>
          <h4 className="font-medium text-[#3C4858] text-sm">Practice Active Listening</h4>
          <p className="text-xs sm:text-xs text-[#3C4858]/70 mt-1 leading-relaxed">
            Focus on understanding rather than responding. The mediator will guide turn-taking and ensure everyone is heard.
          </p>
        </div>
      </div>

      <div className="flex items-start space-x-3 p-3 bg-[#D8A7B1]/10 rounded-lg">
        <Users className="w-4 h-4 sm:w-5 sm:h-5 text-[#D8A7B1] mt-0.5 flex-shrink-0" />
        <div>
          <h4 className="font-medium text-[#3C4858] text-sm">Embrace Vulnerability</h4>
          <p className="text-xs sm:text-xs text-[#3C4858]/70 mt-1 leading-relaxed">
            Authentic connection requires openness. Share your truth while respecting others' boundaries.
          </p>
        </div>
      </div>
    </div>

    <div className="bg-[#FFFBF5] border border-[#D8A7B1]/30 rounded-lg p-3 sm:p-4">
      <h4 className="font-medium text-[#3C4858] text-sm mb-2">💡 Pro Tip</h4>
      <p className="text-xs text-[#3C4858]/70 leading-relaxed">
        The AI mediator will help facilitate the Chat, suggest reflection questions, and ensure balanced participation. Trust the process and be present.
      </p>
    </div>

    <Button
      className="w-full bg-[#D8A7B1] hover:bg-[#C99BA4] text-white py-3 sm:py-2.5 text-base sm:text-sm font-medium"
      onClick={() => setCurrentStep('participants')}
    >
      I'm Ready to Begin
      <ArrowRight className="w-4 h-4 ml-2" />
    </Button>
  </div>
);

interface ParticipantsStepProps {
  setCurrentStep: React.Dispatch<React.SetStateAction<'preparation' | 'participants' | 'creating' | 'invite-success'>>;
  participantSearchQuery: string;
  setParticipantSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  searchedUsers: User[];
  selectedParticipants: User[];
  isSearching: boolean;
  isCreatingChat: boolean;
  chatCreationError: string | null;
  withInvite: boolean;
  setWithInvite: React.Dispatch<React.SetStateAction<boolean>>;
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
  isCreatingChat,
  chatCreationError,
  withInvite,
  setWithInvite,
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
          className="text-[#3C4858]/70 hover:bg-[#F9F7F4] h-8 w-8 sm:h-10 sm:w-10 flex-shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h3 className="text-base sm:text-lg font-semibold text-[#3C4858] truncate">Invite Participants</h3>
          <p className="text-xs sm:text-sm text-[#3C4858]/70 leading-tight">Choose how to invite people to this mediated Chat</p>
        </div>
      </div>

      {/* Invite Type Selection */}
      <div className="space-y-3">
        <Label className="text-sm font-medium text-[#3C4858]">How would you like to invite people?</Label>
        
        <div className="space-y-2">
          <div
            className={`p-3 border rounded-lg cursor-pointer transition-colors touch-manipulation ${
              !withInvite
                ? 'border-[#D8A7B1] bg-[#D8A7B1]/10'
                : 'border-[#3C4858]/20 hover:border-[#D8A7B1]/50'
            }`}
            onClick={() => setWithInvite(false)}
          >
            <div className="flex items-center space-x-3">
              <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${
                !withInvite ? 'border-[#D8A7B1] bg-[#D8A7B1]' : 'border-[#3C4858]/30'
              }`}>
                {!withInvite && <div className="w-2 h-2 bg-white rounded-full mx-auto mt-0.5" />}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-[#3C4858] text-sm">Search & Add Users</h4>
                <p className="text-xs text-[#3C4858]/70 leading-relaxed">Find registered users and add them directly</p>
              </div>
            </div>
          </div>

          <div
            className={`p-3 border rounded-lg cursor-pointer transition-colors touch-manipulation ${
              withInvite
                ? 'border-[#D8A7B1] bg-[#D8A7B1]/10'
                : 'border-[#3C4858]/20 hover:border-[#D8A7B1]/50'
            }`}
            onClick={() => setWithInvite(true)}
          >
            <div className="flex items-center space-x-3">
              <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${
                withInvite ? 'border-[#D8A7B1] bg-[#D8A7B1]' : 'border-[#3C4858]/30'
              }`}>
                {withInvite && <div className="w-2 h-2 bg-white rounded-full mx-auto mt-0.5" />}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-[#3C4858] text-sm">Create Guest Invite</h4>
                <p className="text-xs text-[#3C4858]/70 leading-relaxed">Generate a link for anyone to join as a guest</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Conditional content based on invite type */}
      {!withInvite && (
      <div>
        <Label htmlFor="chat-participants" className="text-sm font-medium text-[#3C4858]">Search for Participants</Label>
        <div className="relative">
          <Input
            id="chat-participants"
            placeholder="Search by name or username (min 3 chars)"
            className="mt-1 border-[#3C4858]/20 focus:border-[#D8A7B1] bg-white placeholder:text-[#3C4858]/50 pr-16 sm:pr-20 text-base"
            value={participantSearchQuery}
            onChange={(e) => setParticipantSearchQuery(e.target.value)}
            autoComplete="off"
              disabled={isCreatingChat}
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 mt-0.5 flex items-center space-x-1">
            {participantSearchQuery && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearSearch}
                className="h-7 w-7 sm:h-6 sm:w-6 p-0 text-[#3C4858]/50 hover:text-[#3C4858] hover:bg-[#D8A7B1]/10 touch-manipulation"
              >
                <X size={14} className="sm:hidden" />
                <X size={12} className="hidden sm:block" />
              </Button>
            )}
            {isSearching && <LoadingSpinner size="sm" color="primary" />}
          </div>
        </div>
        {displayedUsers.length > 0 && (
          <div className="mt-2 border border-[#3C4858]/20 rounded-md max-h-36 sm:max-h-40 overflow-y-auto bg-white shadow-sm">
            {displayedUsers.map(user => (
              <div
                key={user.id}
                className="p-3 hover:bg-[#D8A7B1]/10 cursor-pointer text-sm text-[#3C4858] transition-colors border-b border-[#3C4858]/10 last:border-b-0 touch-manipulation"
                onClick={() => handleSelectParticipant(user)}
              >
                <div className="font-medium text-[#3C4858] truncate">{user.display_name}</div>
                {user.username && (
                  <div className="text-xs text-[#3C4858]/80 truncate">@{user.username}</div>
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
      )}

      {withInvite && (
        <div className="bg-[#F9F7F4] border border-[#D8A7B1]/30 rounded-lg p-3 sm:p-4">
          <div className="flex items-center space-x-2 mb-2">
            <Link2 className="w-4 h-4 text-[#D8A7B1] flex-shrink-0" />
            <h4 className="font-medium text-[#3C4858] text-sm">Guest Invite</h4>
          </div>
          <p className="text-xs text-[#3C4858]/70 mb-3 leading-relaxed">
            A shareable link will be created that allows anyone to join your chat as a guest. Perfect for reaching out to people who don't have an account yet.
          </p>
          <ul className="text-xs text-[#3C4858]/60 space-y-1">
            <li>• Link expires in 24 hours</li>
            <li>• Can only be used once</li>
            <li>• Guest will enter their name to join</li>
          </ul>
        </div>
      )}

      {!withInvite && selectedParticipants.length > 0 && (
        <div>
          <Label className="text-xs font-medium text-[#3C4858]/80">Selected Participants ({selectedParticipants.length}):</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {selectedParticipants.map(user => (
              <div key={user.id} className="flex items-center bg-[#D8A7B1]/20 text-[#3C4858] text-sm px-3 py-1.5 rounded-full transition-all hover:bg-[#D8A7B1]/30 group touch-manipulation">
                <span className="font-medium truncate max-w-[120px] sm:max-w-none">{user.display_name}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveParticipant(user.id)}
                  className="h-5 w-5 sm:h-4 sm:w-4 ml-2 p-0 rounded-full hover:bg-[#D8A7B1]/40 opacity-60 group-hover:opacity-100 transition-opacity flex-shrink-0 touch-manipulation"
                >
                  <X size={14} className="sm:hidden" />
                  <X size={12} className="hidden sm:block" />
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
        className="w-full bg-[#D8A7B1] hover:bg-[#C99BA4] text-white py-3 sm:py-2.5 transition-all text-base sm:text-sm font-medium touch-manipulation"
        onClick={handleStartChat}
        disabled={(!withInvite && selectedParticipants.length === 0) || isSearching || isCreatingChat}
      >
        {isCreatingChat ? (
            <LoadingSpinner size="sm" color="white" />
        ) : (
            <>
                {withInvite ? 'Create Chat & Generate Invite' : 'Start Mediated Chat'}
                {withInvite ? <Link2 className="w-4 h-4 ml-2" /> : <MessageCircle className="w-4 h-4 ml-2" />}
            </>
        )}
      </Button>
    </div>
  );
};

const CreatingStep = ({ creationProgress }: { creationProgress: number }) => (
  <div className="space-y-4 sm:space-y-6 text-center">
    <div className="mx-auto w-16 h-16 sm:w-20 sm:h-20 bg-[#D8A7B1]/20 rounded-full flex items-center justify-center">
      <LoadingSpinner size="lg" color="primary" />
    </div>

    <div>
      <h3 className="text-base sm:text-lg font-semibold text-[#3C4858] mb-2">Creating Your Sacred Space</h3>
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
        <CheckCircle className="w-4 h-4 text-[#D8A7B1] flex-shrink-0" />
        <span>Initializing secure Chat space</span>
      </div>
      {creationProgress > 20 && (
        <div className="flex items-center justify-center space-x-2">
          <CheckCircle className="w-4 h-4 text-[#D8A7B1] flex-shrink-0" />
          <span>Configuring AI mediator</span>
        </div>
      )}
      {creationProgress > 40 && (
        <div className="flex items-center justify-center space-x-2">
          <CheckCircle className="w-4 h-4 text-[#D8A7B1] flex-shrink-0" />
          <span>Inviting participants</span>
        </div>
      )}
      {creationProgress > 60 && (
        <div className="flex items-center justify-center space-x-2">
          <CheckCircle className="w-4 h-4 text-[#D8A7B1] flex-shrink-0" />
          <span>Generating AI welcome message</span>
        </div>
      )}
      {creationProgress > 85 && (
        <div className="flex items-center justify-center space-x-2">
          <CheckCircle className="w-4 h-4 text-[#D8A7B1] flex-shrink-0" />
          <span>Ready to begin!</span>
        </div>
      )}
    </div>
  </div>
);

export default function ChatSetupModal({ isOpen, onClose, onCreateChat }: ChatSetupModalProps) {
  const [currentStep, setCurrentStep] = useState<'preparation' | 'participants' | 'creating' | 'invite-success'>('preparation');
  const [participantSearchQuery, setParticipantSearchQuery] = useState("");
  const [searchedUsers, setSearchedUsers] = useState<User[]>([]);
  const [selectedParticipants, setSelectedParticipants] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const [chatCreationError, setChatCreationError] = useState<string | null>(null);
  const [creationProgress, setCreationProgress] = useState(0);
  const [withInvite, setWithInvite] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [chatId, setChatId] = useState<string | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const router = useRouter();

  useEffect(() => {
    if (!isOpen) {
      setCurrentStep('preparation');
      setParticipantSearchQuery("");
      setSearchedUsers([]);
      setSelectedParticipants([]);
      setIsSearching(false);
      setIsCreatingChat(false);
      setChatCreationError(null);
      setCreationProgress(0);
      setWithInvite(false);
      setInviteUrl(null);
      setChatId(null);
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
        searchTimeoutRef.current = null;
      }
    }
  }, [isOpen]);

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
    // Basic validation for user-selected participants mode
    if (!withInvite && selectedParticipants.length === 0) {
      setChatCreationError("Please select at least one participant.");
      return;
    }

    setCurrentStep('creating');
    setIsCreatingChat(true);
    setChatCreationError(null);
    setCreationProgress(0);

    try {
      const progressInterval = setInterval(() => {
        setCreationProgress(prev => {
          if (prev >= 85) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 5;
        });
      }, 300);

      const participantIds = selectedParticipants.map(p => p.id);
      const chatData = {
        title: "New Chat",
        description: "AI-mediated conversation",
        category: "general",
        participants: participantIds.map(id => ({ id })),
        withInvite // Add the invite flag
      };
      
      const response = await fetch('/api/chats/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chatData),
      });
      const data = await response.json();
      if (!response.ok) {
        // Show more detailed error information
        const errorMessage = data.details ? `${data.error}: ${data.details}` : data.error || 'Failed to create chat';
        throw new Error(errorMessage);
      }
      
      clearInterval(progressInterval);
      setCreationProgress(100);
      
      if (onCreateChat) await onCreateChat(chatData);
      
      // Handle different outcomes based on invite creation
      if (withInvite && data.inviteUrl) {
        // Show invite success step
        setInviteUrl(data.inviteUrl);
        setChatId(data.chatId);
        setCurrentStep('invite-success');
      } else {
        // Regular chat creation - redirect to chat
      setTimeout(() => {
        onClose();
        router.push(`/chat/${data.chatId}`);
      }, 500);
      }
    } catch (error) {
      console.error("Error starting Chat:", error);
      setChatCreationError(error instanceof Error ? error.message : 'An unknown error occurred');
      setCurrentStep('participants');
    } finally {
      setIsCreatingChat(false);
    }
  };

  const handleInviteSuccessClose = () => {
    onClose();
    // Don't auto-redirect, let user decide when to go to chat
  };

  return isOpen ? (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-2 sm:p-4 transition-opacity duration-300 ease-in-out">
      <Card className="bg-[#FFFBF5] p-4 sm:p-6 rounded-lg shadow-xl w-full max-w-sm sm:max-w-md max-h-[90vh] sm:max-h-none overflow-y-auto transform transition-all duration-300 ease-in-out scale-100 opacity-100">
        <div className="flex justify-between items-start mb-4 sm:mb-6">
          <div className="flex-1 mr-3">
            <h2 className="text-lg sm:text-xl font-semibold text-[#3C4858] leading-tight">
              {currentStep === 'preparation' && 'Prepare for Connection'}
              {currentStep === 'participants' && 'Create Chat'}
              {currentStep === 'creating' && 'Almost Ready...'}
              {currentStep === 'invite-success' && 'Share Your Invite'}
            </h2>
          </div>
          {currentStep !== 'creating' && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onClose} 
              className="text-[#3C4858]/70 hover:bg-[#F9F7F4] h-8 w-8 sm:h-10 sm:w-10 flex-shrink-0"
            >
              <span className="sr-only">Close modal</span>
              <X className="h-4 w-4 sm:h-5 sm:w-5" />
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
            isCreatingChat={isCreatingChat}
            chatCreationError={chatCreationError}
            withInvite={withInvite}
            setWithInvite={setWithInvite}
            handleSelectParticipant={handleSelectParticipant}
            handleRemoveParticipant={handleRemoveParticipant}
            clearSearch={clearSearch}
            handleStartChat={handleStartChat}
          />
        )}
        {currentStep === 'creating' && <CreatingStep creationProgress={creationProgress} />}
        {currentStep === 'invite-success' && inviteUrl && chatId && (
          <InviteLinkComponent 
            inviteUrl={inviteUrl} 
            chatId={chatId}
            onClose={handleInviteSuccessClose}
          />
        )}

        {currentStep !== 'creating' && currentStep !== 'invite-success' && (
          <Button
            variant="outline"
            className="w-full border-[#3C4858]/30 text-[#3C4858]/80 hover:bg-[#F9F7F4] py-3 sm:py-2.5 mt-4 text-base sm:text-sm font-medium touch-manipulation"
            onClick={onClose}
            disabled={isCreatingChat}
          >
            Cancel
          </Button>
        )}
      </Card>
    </div>
  ) : null
}