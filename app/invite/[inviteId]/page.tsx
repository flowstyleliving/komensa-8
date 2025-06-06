'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { AlertCircle, Heart, MessageCircle, ArrowRight, Clock, Users } from 'lucide-react';

interface InviteValidation {
  valid: boolean;
  chatId?: string;
  expired?: boolean;
  used?: boolean;
  chatInactive?: boolean;
}

// Loading animation component
const LoadingSpinner = ({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  };

  return (
    <div className={`${sizeClasses[size]} border-2 border-transparent border-t-[#D8A7B1] border-r-[#D8A7B1] rounded-full animate-spin`} />
  );
};

// Progress bar component for join process
const JoinProgress = ({ step, totalSteps }: { step: number; totalSteps: number }) => {
  const progress = ((step + 1) / totalSteps) * 100;
  
  return (
    <div className="w-full space-y-2">
      <div className="flex justify-between text-xs text-[#3C4858]/60">
        <span>Step {step + 1} of {totalSteps}</span>
        <span>{Math.round(progress)}%</span>
      </div>
      <div className="w-full bg-[#3C4858]/10 rounded-full h-2">
        <div
          className="bg-[#D8A7B1] h-2 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};

export default function InvitePage({ params }: { params: Promise<{ inviteId: string }> }) {
  const { inviteId } = use(params);
  const router = useRouter();
  
  const [validation, setValidation] = useState<InviteValidation | null>(null);
  const [loading, setLoading] = useState(true);
  const [guestName, setGuestName] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinStep, setJoinStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Join steps for better UX
  const joinSteps = [
    'Creating your guest profile...',
    'Adding you to the conversation...',
    'Setting up AI mediator...',
    'Preparing welcome message...',
    'Almost ready!'
  ];

  // Tips to show during loading
  const loadingTips = [
    '💡 The AI mediator will help facilitate balanced conversation',
    '🎯 You\'ll take turns speaking to ensure everyone is heard',
    '🛡️ This is a safe space for authentic dialogue',
    '✨ Your voice matters in this conversation',
    '🚀 Get ready for meaningful connection!'
  ];

  // Auto-advance join steps for visual progress
  useEffect(() => {
    if (joining) {
      setJoinStep(0);
      const interval = setInterval(() => {
        setJoinStep(prev => {
          if (prev < joinSteps.length - 1) {
            return prev + 1;
          }
          return prev;
        });
      }, 1500); // Change step every 1.5 seconds

      return () => clearInterval(interval);
    }
  }, [joining]);

  // Validate invite on page load
  useEffect(() => {
    const validateInvite = async () => {
      try {
        const response = await fetch(`/api/invite/validate?inviteId=${encodeURIComponent(inviteId)}`);
        const data = await response.json();
        
        if (response.ok) {
          setValidation(data);
        } else {
          setError('Failed to validate invite');
        }
      } catch (err) {
        setError('Network error occurred');
      } finally {
        setLoading(false);
      }
    };

    validateInvite();
  }, [inviteId]);

  const handleJoinChat = async () => {
    if (!guestName.trim()) {
      setError('Please enter your name');
      return;
    }

    if (guestName.trim().length < 2) {
      setError('Name must be at least 2 characters');
      return;
    }

    setJoining(true);
    setError(null);

    try {
      const response = await fetch('/api/invite/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inviteId,
          guestName: guestName.trim()
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Redirect to the chat
        router.push(`/chat/${data.chatId}`);
      } else {
        setError(data.error || 'Failed to join chat');
      }
    } catch (err) {
      setError('Network error occurred');
    } finally {
      setJoining(false);
      setJoinStep(0); // Reset join step
    }
  };

  const handleSignUp = () => {
    router.push('/auth/signin');
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[#F9F7F4] flex items-center justify-center p-4">
        <Card className="bg-[#FFFBF5] p-8 rounded-lg shadow-xl w-full max-w-md">
          <div className="text-center space-y-4">
            <LoadingSpinner size="lg" />
            <p className="text-[#3C4858]/70">Validating your invite...</p>
          </div>
        </Card>
      </div>
    );
  }

  // Invalid invite states
  if (!validation?.valid) {
    const getErrorInfo = () => {
      if (validation?.expired) {
        return {
          icon: <Clock className="w-8 h-8 text-amber-500" />,
          title: 'Invite Expired',
          message: 'This invite link has expired. Invite links are valid for 24 hours.',
          action: 'Sign up to create your own chats'
        };
      }
      
      if (validation?.used) {
        return {
          icon: <Users className="w-8 h-8 text-blue-500" />,
          title: 'Invite Already Used',
          message: 'This invite has already been used. Each invite can only be used once.',
          action: 'Sign up to join more conversations'
        };
      }
      
      if (validation?.chatInactive) {
        return {
          icon: <MessageCircle className="w-8 h-8 text-gray-500" />,
          title: 'Chat Unavailable',
          message: 'The chat associated with this invite is no longer available.',
          action: 'Sign up to create your own chats'
        };
      }
      
      return {
        icon: <AlertCircle className="w-8 h-8 text-red-500" />,
        title: 'Invalid Invite',
        message: 'This invite link is not valid or may have been corrupted.',
        action: 'Sign up to create your own chats'
      };
    };

    const errorInfo = getErrorInfo();

    return (
      <div className="min-h-screen bg-[#F9F7F4] flex items-center justify-center p-4">
        <Card className="bg-[#FFFBF5] p-8 rounded-lg shadow-xl w-full max-w-md">
          <div className="text-center space-y-6">
            <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
              {errorInfo.icon}
            </div>
            
            <div>
              <h2 className="text-xl font-semibold text-[#3C4858] mb-2">{errorInfo.title}</h2>
              <p className="text-[#3C4858]/70 text-sm">{errorInfo.message}</p>
            </div>

            <div className="bg-[#FFFBF5] border border-[#D8A7B1]/30 rounded-lg p-4">
              <h3 className="font-medium text-[#3C4858] text-sm mb-2">About Komensa</h3>
              <p className="text-xs text-[#3C4858]/70">
                Komensa facilitates meaningful conversations with AI-mediated dialogue. 
                Create your account to start having deeper, more intentional conversations.
              </p>
            </div>

            <Button
              onClick={handleSignUp}
              className="w-full bg-[#D8A7B1] hover:bg-[#C99BA4] text-white py-2.5"
            >
              {errorInfo.action}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // Valid invite - show guest join form
  return (
    <div className="min-h-screen bg-[#F9F7F4] flex items-center justify-center p-4">
      <Card className="bg-[#FFFBF5] p-8 rounded-lg shadow-xl w-full max-w-md">
        <div className="space-y-6">
          {/* Header */}
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-[#D8A7B1]/20 rounded-full flex items-center justify-center mb-4">
              <Heart className="w-8 h-8 text-[#D8A7B1]" />
            </div>
            <h2 className="text-xl font-semibold text-[#3C4858] mb-2">You're Invited to a Conversation</h2>
            <p className="text-[#3C4858]/70 text-sm">
              Someone has invited you to join a meaningful, AI-mediated dialogue on Komensa.
            </p>
          </div>

          {/* About Komensa */}
          <div className="bg-[#F9F7F4] border border-[#D8A7B1]/30 rounded-lg p-4">
            <h3 className="font-medium text-[#3C4858] text-sm mb-2">What is Komensa?</h3>
            <p className="text-xs text-[#3C4858]/70 mb-3">
              Komensa creates safe spaces for intimate conversations. Our AI mediator helps facilitate 
              turn-taking, ensures everyone is heard, and guides meaningful dialogue.
            </p>
            <div className="space-y-1 text-xs text-[#3C4858]/60">
              <div className="flex items-center space-x-2">
                <div className="w-1.5 h-1.5 bg-[#D8A7B1] rounded-full"></div>
                <span>AI-guided conversation flow</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-1.5 h-1.5 bg-[#D8A7B1] rounded-full"></div>
                <span>Psychological safety first</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-1.5 h-1.5 bg-[#D8A7B1] rounded-full"></div>
                <span>Structured turn-taking</span>
              </div>
            </div>
          </div>

          {/* Guest Name Input */}
          <div>
            <Label htmlFor="guest-name" className="text-sm font-medium text-[#3C4858] mb-2 block">
              Enter your name to join
            </Label>
            <Input
              id="guest-name"
              placeholder="Your name"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              className="border-[#3C4858]/20 focus:border-[#D8A7B1] bg-white"
              disabled={joining}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !joining) {
                  handleJoinChat();
                }
              }}
            />
            <p className="text-xs text-[#3C4858]/60 mt-1">
              This is how other participants will see you in the conversation.
            </p>
          </div>

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-3">
            {joining ? (
              // Enhanced loading state during join process
              <div className="space-y-4">
                <div className="bg-[#F9F7F4] border border-[#D8A7B1]/30 rounded-lg p-4">
                  <div className="flex items-center justify-center mb-3">
                    <LoadingSpinner size="md" />
                    <span className="ml-3 text-[#3C4858] font-medium">{joinSteps[joinStep]}</span>
                  </div>
                  <JoinProgress step={joinStep} totalSteps={joinSteps.length} />
                  
                  {/* Loading tip */}
                  <div className="mt-4 p-3 bg-[#FFFBF5] border border-[#D8A7B1]/20 rounded-lg">
                    <p className="text-xs text-[#3C4858]/70 text-center">
                      {loadingTips[joinStep]}
                    </p>
                  </div>
                </div>
                
                <Button
                  disabled
                  className="w-full bg-[#D8A7B1]/60 text-white py-2.5 cursor-not-allowed"
                >
                  <LoadingSpinner size="sm" />
                  <span className="ml-2">Joining...</span>
                </Button>
              </div>
            ) : (
              <Button
                onClick={handleJoinChat}
                disabled={!guestName.trim()}
                className="w-full bg-[#D8A7B1] hover:bg-[#C99BA4] text-white py-2.5"
              >
                Join as Guest
                <MessageCircle className="w-4 h-4 ml-2" />
              </Button>
            )}

            {!joining && (
              <div className="text-center">
                <p className="text-xs text-[#3C4858]/60 mb-2">Already have an account?</p>
                <Button
                  onClick={handleSignUp}
                  variant="outline"
                  size="sm"
                  className="border-[#3C4858]/30 text-[#3C4858]/80 hover:bg-[#F9F7F4]"
                >
                  Sign In Instead
                </Button>
              </div>
            )}
          </div>

          {/* Footer Note */}
          <div className="text-center text-xs text-[#3C4858]/50 pt-4 border-t border-[#3C4858]/10">
            By joining, you agree to participate respectfully in this mediated conversation.
          </div>
        </div>
      </Card>
    </div>
  );
} 