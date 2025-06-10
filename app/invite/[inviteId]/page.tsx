'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
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
  const session = useSession();
  
  const [validation, setValidation] = useState<InviteValidation | null>(null);
  const [loading, setLoading] = useState(true);
  const [guestName, setGuestName] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinStep, setJoinStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [joinSuccessful, setJoinSuccessful] = useState(false);

  // Join steps for better UX
  const joinSteps = [
    'Creating your guest session...',
    'Adding you to the conversation...',
    'Setting up the waiting room...',
    'Preparing your experience...'
  ];

  // Tips to show during loading
  const loadingTips = [
    'Please wait while we create your temporary account',
    'Almost there! Getting the conversation ready...',
    'Setting up your personalized chat experience...',
    'Finalizing your entry to the conversation...'
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
    // Skip validation if join was successful to prevent "already used" message
    if (joinSuccessful) {
      return;
    }
    
    const validateInvite = async () => {
      try {
        console.log('[Invite] Validating invite:', {
          inviteId,
          sessionStatus: session.status,
          userId: session?.data?.user?.id,
          isGuest: session?.data?.user?.isGuest,
          sessionChatId: session?.data?.user?.chatId,
          joinSuccessful
        });
        
        const response = await fetch(`/api/invite/validate?inviteId=${encodeURIComponent(inviteId)}`);
        const data = await response.json();
        
        console.log('[Invite] Validation response:', data);
        
        if (response.ok) {
          setValidation(data);
          
          // If user is already authenticated and invite is valid, auto-route to chat
          if (session.status === 'authenticated' && data.valid && data.chatId) {
            // For guests, only auto-redirect if this is for the same chat they're already in
            if (session.data?.user?.isGuest) {
              if (session.data.user.chatId === data.chatId) {
                console.log('[Invite] Guest already in this chat, redirecting to chat:', data.chatId);
                router.push(`/chat/${data.chatId}`);
                return;
              } else {
                console.log('[Invite] Guest trying to access different chat:', {
                  currentChatId: session.data.user.chatId,
                  inviteChatId: data.chatId
                });
                // Allow guest to see the invite form for a different chat
                return;
              }
            } else {
              // Regular authenticated user - redirect to chat
              console.log('[Invite] User already authenticated, redirecting to chat:', data.chatId);
              router.push(`/chat/${data.chatId}`);
              return;
            }
          }
        } else {
          console.error('[Invite] Validation failed:', response.status, data);
          setError('Failed to validate invite');
        }
      } catch (err) {
        console.error('[Invite] Network error during validation:', err);
        setError('Network error occurred');
      } finally {
        setLoading(false);
      }
    };

    // Only validate once we know the session status
    if (session.status !== 'loading') {
      validateInvite();
    }
  }, [inviteId, session.status, router, joinSuccessful]);

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
        console.log('[Invite] Guest session created, forcing session refresh before redirect');
        
        // Mark join as successful to prevent re-validation
        setJoinSuccessful(true);
        
        // Force session refresh to load the new guest session data
        // This is critical to prevent the "guest user can't type" issue
        await session.update();
        
        console.log('[Invite] Session refreshed, redirecting to waiting room');
        
        // Small delay to ensure session update propagates
        setTimeout(() => {
          router.push(`/waiting-room/${data.chatId}`);
        }, 100);
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

  const getErrorInfo = () => {
    if (validation?.expired) {
      return 'This invite link has expired. Please request a new one.';
    }
    if (validation?.used) {
      return 'This invite link has already been used. Please request a new one.';
    }
    if (validation?.chatInactive) {
      return 'This conversation is no longer active.';
    }
    return 'Invalid or expired invite link. Please check the URL and try again.';
  };

  // Loading state (authentication + validation)
  if (loading || session.status === 'loading') {
    return (
      <div className="min-h-screen bg-[#F9F7F4] flex items-center justify-center p-4">
        <Card className="bg-[#FFFBF5] p-8 rounded-lg shadow-xl w-full max-w-md">
          <div className="text-center space-y-4 flex flex-col items-center justify-center">
            <LoadingSpinner size="lg" />
            <p className="text-[#3C4858]/70">
              {session.status === 'loading' ? 'Checking authentication...' : 'Validating your invite...'}
            </p>
          </div>
        </Card>
      </div>
    );
  }

  // Invalid invite states
  if (!validation?.valid) {
    return (
      <div className="min-h-screen bg-[#F9F7F4] flex items-center justify-center p-4">
        <Card className="bg-[#FFFBF5] p-8 rounded-lg shadow-xl w-full max-w-md">
          <div className="text-center space-y-6">
            <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            
            <div>
              <h2 className="text-xl font-semibold text-[#3C4858] mb-2">Invalid Invite</h2>
              <p className="text-[#3C4858]/70 text-sm">{getErrorInfo()}</p>
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
              Sign Up
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // Valid invite - show guest join form
  return (
    <div className="min-h-screen bg-[#F9F7F4] flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-6 space-y-6 rounded-xl shadow-lg">
        {loading ? (
          <div className="space-y-4">
            <div className="flex items-center justify-center space-x-2">
              <LoadingSpinner size="lg" />
              <span className="text-lg font-medium">Validating invite...</span>
            </div>
          </div>
        ) : validation?.valid ? (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h1 className="text-2xl font-bold">Join the Conversation</h1>
              <p className="text-[#3C4858]/60">You've been invited to join a meaningful dialogue</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="guestName">Your Name</Label>
                <Input
                  id="guestName"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="Enter your name"
                  className="rounded-lg"
                  disabled={joining}
                />
              </div>

              {error && (
                <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4" />
                  <span>{error}</span>
                </div>
              )}

              <Button
                onClick={handleJoinChat}
                disabled={joining || !guestName.trim()}
                className="w-full rounded-lg"
              >
                {joining ? (
                  <div className="flex items-center space-x-2">
                    <LoadingSpinner size="sm" />
                    <span>{joinSteps[joinStep]}</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <MessageCircle className="w-4 h-4" />
                    <span>Join as Guest</span>
                  </div>
                )}
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[#3C4858]/10"></div>
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-2 bg-white text-[#3C4858]/60">or</span>
                </div>
              </div>

              <Button
                onClick={handleSignUp}
                variant="outline"
                className="w-full rounded-lg"
              >
                <div className="flex items-center space-x-2">
                  <Heart className="w-4 h-4" />
                  <span>Create Account</span>
                </div>
              </Button>
            </div>

            {joining && (
              <div className="space-y-4">
                <JoinProgress step={joinStep} totalSteps={joinSteps.length} />
                <p className="text-sm text-center text-[#3C4858]/60">
                  {loadingTips[joinStep]}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4 text-center">
            <div className="p-3 bg-red-50 text-red-600 rounded-lg">
              {getErrorInfo()}
            </div>
            <Button
              onClick={() => router.push('/')}
              variant="outline"
              className="w-full rounded-lg"
            >
              Return Home
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
} 