'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { AlertCircle, Heart, MessageCircle, ArrowRight, Clock, Users, CheckCircle, User } from 'lucide-react';

interface InviteValidation {
  valid: boolean;
  chatId?: string;
  expired?: boolean;
  used?: boolean;
  chatInactive?: boolean;
  alreadyParticipant?: boolean;
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
  const searchParams = useSearchParams();
  
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
        
        console.log('[Invite] Validation response:', {
          status: response.status,
          ok: response.ok,
          data
        });
        
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

  // Auto-redirect if already authenticated (but only for specific cases)
  useEffect(() => {
    // Only redirect if we have a valid session AND validation is complete
    if (session.status === 'authenticated' && session.data?.user && validation && !loading) {
      // For guest users, only redirect if they're already in this specific chat
      if ((session.data.user as any)?.isGuest && (session.data.user as any)?.chatId) {
        // Check if the guest is already in the chat that this invite is for
        if ((session.data.user as any).chatId === validation.chatId) {
          console.log('[Invite] Guest user already in this chat, redirecting to waiting room');
          router.push(`/waiting-room/${(session.data.user as any).chatId}`);
          return;
        } else {
          // Guest is in a different chat, let them see the invite page
          console.log('[Invite] Guest user is in different chat, showing invite page');
          return;
        }
      } 
      
      // For signed-in non-guest users, check if they're already a participant
      if (validation.alreadyParticipant) {
        console.log('[Invite] User already participant, redirecting to waiting room');
        router.push(`/waiting-room/${validation.chatId}`);
        return;
      }
      
      // For signed-in non-guest users who aren't participants yet, auto-join
      if (validation.valid) {
        console.log('[Invite] Signed-in user detected, automatically joining chat');
        const autoJoinChat = async () => {
          try {
            const response = await fetch('/api/invite/join', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ inviteId }),
            });

            const data = await response.json();

            if (response.ok) {
              console.log('[Invite] Successfully joined chat, redirecting to waiting room');
              router.push(`/waiting-room/${data.chatId}`);
            } else {
              console.error('[Invite] Failed to join chat:', data.error);
              // Stay on invite page to show error
            }
          } catch (error) {
            console.error('[Invite] Error joining chat:', error);
            // Stay on invite page to show error
          }
        };

        autoJoinChat();
      }
    }
  }, [session.status, session.data?.user, router, searchParams, validation, loading, inviteId]);

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
        try {
          await session.update();
          console.log('[Invite] Session update successful');
        } catch (sessionError) {
          console.warn('[Invite] Session update failed, proceeding anyway:', sessionError);
        }
        
        console.log('[Invite] Session refreshed, redirecting to waiting room');
        
        // Navigate with replace to avoid back button issues and ensure clean session state
        router.replace(`/waiting-room/${data.chatId}`);
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
    router.push('/auth/signin?from=invite');
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

  // Check if user is already a participant and show appropriate message
  if (validation?.alreadyParticipant) {
    return (
      <div className="min-h-screen bg-[#F9F7F4] flex items-center justify-center p-4">
        <Card className="bg-[#FFFBF5] p-8 rounded-lg shadow-xl w-full max-w-md">
          <div className="text-center space-y-6">
            <div className="mx-auto w-16 h-16 bg-[#7BAFB0]/20 rounded-full flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-[#7BAFB0]" />
            </div>
            
            <div>
              <h2 className="text-xl font-semibold text-[#3C4858] mb-2">You're Already In!</h2>
              <p className="text-[#3C4858]/70 text-sm">
                You're already a participant in this conversation.
              </p>
            </div>

            <Button
              onClick={() => router.push(`/waiting-room/${validation.chatId}`)}
              className="w-full bg-gradient-to-r from-[#D8A7B1] to-[#7BAFB0] text-white hover:from-[#C99BA4] hover:to-[#6D9E9F] transition-all duration-300"
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              Go to Waiting Room
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // Valid invite - show enhanced guest join form with psychological preparation
  return (
    <div className="min-h-screen bg-[#F9F7F4] flex items-center justify-center p-4">
      <Card className="bg-[#FFFBF5] p-8 rounded-lg shadow-xl w-full max-w-md">
        <div className="text-center space-y-6">
          <div className="mx-auto w-16 h-16 bg-[#D8A7B1]/20 rounded-full flex items-center justify-center">
            <Users className="w-8 h-8 text-[#D8A7B1]" />
          </div>
          
          <div>
            <h2 className="text-xl font-semibold text-[#3C4858] mb-2">Join the Conversation</h2>
            <p className="text-[#3C4858]/70 text-sm mb-4">
              You've been invited to a mediated conversation. Before diving in, we'll prepare you in our Waiting Room.
            </p>
            
            {/* Waiting Room Preview */}
            <div className="bg-[#7BAFB0]/10 border border-[#7BAFB0]/20 rounded-lg p-4 text-left space-y-2">
              <div className="flex items-center space-x-2 text-sm text-[#3C4858]">
                <Clock className="w-4 h-4 text-[#7BAFB0]" />
                <span className="font-medium">What happens next:</span>
              </div>
              <ul className="text-xs text-[#3C4858]/80 space-y-1 ml-6">
                <li>• Share your intentions and communication style</li>
                <li>• Wait for the other participant to get ready</li>
                <li>• Begin your mediated conversation together</li>
              </ul>
            </div>
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
              className="w-full rounded-lg bg-gradient-to-r from-[#D8A7B1] to-[#7BAFB0] text-white hover:from-[#C99BA4] hover:to-[#6D9E9F] transition-all duration-300"
            >
              {joining ? (
                <div className="flex items-center space-x-2">
                  <LoadingSpinner size="sm" />
                  <span>{joinSteps[joinStep]}</span>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <MessageCircle className="w-4 h-4" />
                  <span>Enter Waiting Room</span>
                </div>
              )}
            </Button>

            {joining && (
              <div className="space-y-4">
                <JoinProgress step={joinStep} totalSteps={joinSteps.length} />
                <p className="text-sm text-center text-[#3C4858]/60">
                  {loadingTips[joinStep]}
                </p>
              </div>
            )}
            
            <div className="text-center">
              <p className="text-xs text-[#3C4858]/60 leading-relaxed">
                By joining, you'll enter our Waiting Room where both participants prepare together for a more meaningful conversation.
              </p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
} 