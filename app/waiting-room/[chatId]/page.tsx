'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Heart, Users, Clock, CheckCircle, Loader2, Copy, Check } from 'lucide-react';
import { WaitingRoomAnswers, DEFAULT_QUESTIONS, WaitingRoomQuestion } from '@/lib/waiting-room';
import { pusherClient } from '@/lib/pusher';

interface WaitingRoomPageProps {
  params: Promise<{ chatId: string }>;
}

export default function WaitingRoomPage({ params }: WaitingRoomPageProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [chatId, setChatId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showFormDespiteOtherReady, setShowFormDespiteOtherReady] = useState(false);
  const [copied, setCopied] = useState(false);
  const [readinessStatus, setReadinessStatus] = useState({
    userReady: false,
    bothReady: false,
    waitingForOther: false
  });
  
  const [participantStatus, setParticipantStatus] = useState({
    currentUser: { type: '', isReady: false, hasAnswers: false, name: '' },
    otherUser: { type: '', isReady: false, hasAnswers: false, name: 'Other participant' }
  });

  // Form state
  const [answers, setAnswers] = useState<Partial<WaitingRoomAnswers>>({
    name: session?.user?.name || '',
    whatBroughtYouHere: '',
    hopeToAccomplish: '',
    currentFeeling: '',
    communicationStyle: 'curious',
    topicsToAvoid: '',
    isReady: false
  });

  // Resolve params
  useEffect(() => {
    params.then(resolvedParams => {
      setChatId(resolvedParams.chatId);
    });
  }, [params]);

  // Load initial data
  useEffect(() => {
    if (!chatId || status === 'loading') return;
    
    // Let middleware handle authentication - only redirect if explicitly unauthenticated
    if (status === 'unauthenticated') {
      console.log('[Waiting Room] No valid session, redirecting to signin:', { 
        status, 
        hasSession: !!session
      });
      router.push('/auth/signin');
      return;
    }

    loadWaitingRoomStatus();
  }, [chatId, session, status]);

  // Set up Pusher for real-time updates
  useEffect(() => {
    if (!chatId) return;

    const channel = pusherClient.subscribe(`chat-${chatId}`);
    
    // Listen for chat initiation (when both participants are ready)
    channel.bind('chat-initiated', (data: any) => {
      console.log('[Waiting Room] Chat initiated via Pusher - redirecting...');
      router.push(`/chat/${chatId}`);
    });

    // Listen for other participant readiness updates
    channel.bind('participant-ready', (data: any) => {
      console.log('[Waiting Room] Participant ready update:', data);
      
      // Update status if it's the other participant
      if (data.userId !== session?.user?.id) {
        setParticipantStatus(prev => ({
          ...prev,
          otherUser: {
            ...prev.otherUser,
            isReady: data.isReady,
            name: data.userName || 'Other participant'
          }
        }));
        
        // Refresh status to check if both are ready
        loadWaitingRoomStatus();
      }
    });

    return () => {
      pusherClient.unsubscribe(`chat-${chatId}`);
    };
  }, [chatId, router, session?.user?.id]);

  // Polling fallback for chat initiation (in case Pusher fails)
  useEffect(() => {
    if (!chatId || !readinessStatus.waitingForOther) return;

    console.log('[Waiting Room] Setting up polling fallback...');
    const pollInterval = setInterval(async () => {
      try {
        console.log('[Waiting Room] Polling for chat initiation...');
        const response = await fetch(`/api/waiting-room/ready?chatId=${chatId}`);
        if (response.ok) {
          const data = await response.json();
          if (data.bothReady) {
            console.log('[Waiting Room] Both ready detected via polling - redirecting...');
            clearInterval(pollInterval);
            router.push(`/chat/${chatId}`);
          }
        }
      } catch (error) {
        console.error('[Waiting Room] Polling error:', error);
      }
    }, 3000); // Poll every 3 seconds

    return () => {
      console.log('[Waiting Room] Clearing polling interval');
      clearInterval(pollInterval);
    };
  }, [chatId, readinessStatus.waitingForOther, router]);

  const loadWaitingRoomStatus = async () => {
    try {
      // Get basic readiness status
      const readinessResponse = await fetch(`/api/waiting-room/ready?chatId=${chatId}`);
      if (readinessResponse.ok) {
        const readinessData = await readinessResponse.json();
        setReadinessStatus(readinessData);
        
        // If both ready, redirect to chat
        if (readinessData.bothReady) {
          console.log('[Waiting Room] Both ready detected, redirecting to chat...');
          router.push(`/chat/${chatId}`);
          return;
        }
      }

      // Get detailed participant status
      const statusResponse = await fetch(`/api/waiting-room/status?chatId=${chatId}`);
      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        setParticipantStatus({
          currentUser: statusData.currentUser,
          otherUser: statusData.otherUser
        });
      }
    } catch (error) {
      console.error('Failed to load waiting room status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof WaitingRoomAnswers, value: string) => {
    setAnswers(prev => ({ ...prev, [field]: value }));
  };

  const copyInviteLink = async () => {
    const inviteLink = `${window.location.origin}/invite/${chatId}`;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  const handleSubmit = async () => {
    if (!isFormValid()) return;

    setSubmitting(true);
    try {
      const response = await fetch('/api/waiting-room/ready', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId,
          answers: { ...answers, isReady: true }
        })
      });

      if (response.ok) {
        const data = await response.json();
        setReadinessStatus(data);
        
        if (data.bothReady) {
          console.log('[Waiting Room] Both ready after submit - starting chat initiation...');
          // Show a processing state to prevent user confusion
          setReadinessStatus(prev => ({ ...prev, bothReady: true }));
          // Give a moment for the backend to process, then redirect
          setTimeout(() => {
            router.push(`/chat/${chatId}`);
          }, 2000);
        }
      } else {
        console.error('Failed to submit answers');
      }
    } catch (error) {
      console.error('Error submitting answers:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const isFormValid = () => {
    return answers.name && 
           answers.whatBroughtYouHere && 
           answers.hopeToAccomplish && 
           answers.currentFeeling && 
           answers.communicationStyle;
  };

  if (loading || status === 'loading') {
    return (
      <div className="min-h-screen bg-[#F9F7F4] flex items-center justify-center p-4">
        <Card className="bg-[#FFFBF5] p-8 rounded-lg shadow-xl w-full max-w-md">
          <div className="text-center space-y-4">
            <Loader2 className="w-8 h-8 text-[#D8A7B1] animate-spin mx-auto" />
            <p className="text-[#3C4858]/70">Loading waiting room...</p>
          </div>
        </Card>
      </div>
    );
  }

  // Both participants ready - initiating chat
  if (readinessStatus.bothReady) {
    return (
      <div className="min-h-screen bg-[#F9F7F4] flex items-center justify-center p-4">
        <Card className="bg-[#FFFBF5] p-8 rounded-lg shadow-xl w-full max-w-md">
          <div className="text-center space-y-6">
            <div className="mx-auto w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
            
            <div>
              <h2 className="text-xl font-semibold text-[#3C4858] mb-2">Both Participants Ready!</h2>
              <p className="text-[#3C4858]/70 text-sm">
                Initiating your conversation...
              </p>
            </div>

            <div className="bg-[#FFFBF5] border border-green-500/30 rounded-lg p-4">
              <div className="flex items-center space-x-3 mb-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span className="text-sm text-[#3C4858]">You: Ready</span>
              </div>
              <div className="flex items-center space-x-3">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span className="text-sm text-[#3C4858]">Other participant: Ready</span>
              </div>
            </div>

            <div className="flex items-center justify-center space-x-2">
              <Loader2 className="w-5 h-5 text-[#7BAFB0] animate-spin" />
              <span className="text-sm text-[#3C4858]/70">Starting conversation...</span>
            </div>

            <p className="text-xs text-[#3C4858]/60">
              Please wait while we prepare your chat environment.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  // Show waiting state when other participant is ready (to prevent confusion)
  if (participantStatus.otherUser.isReady && !participantStatus.currentUser.isReady && !showFormDespiteOtherReady) {
    return (
      <div className="min-h-screen bg-[#F9F7F4] flex items-center justify-center p-4">
        <Card className="bg-[#FFFBF5] p-8 rounded-lg shadow-xl w-full max-w-md">
          <div className="text-center space-y-6">
            <div className="mx-auto w-16 h-16 bg-[#7BAFB0]/20 rounded-full flex items-center justify-center">
              <Users className="w-8 h-8 text-[#7BAFB0]" />
            </div>
            
            <div>
              <h2 className="text-xl font-semibold text-[#3C4858] mb-2">Other Participant is Ready!</h2>
              <p className="text-[#3C4858]/70 text-sm">
                {participantStatus.otherUser.name} has completed their preparation and is waiting for you.
              </p>
            </div>

            <div className="bg-[#FFFBF5] border border-[#7BAFB0]/30 rounded-lg p-4">
              <div className="flex items-center space-x-3">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span className="text-sm text-[#3C4858]">{participantStatus.otherUser.name}: Ready</span>
              </div>
              <div className="flex items-center space-x-3 mt-2">
                <Clock className="w-5 h-5 text-[#7BAFB0]" />
                <span className="text-sm text-[#3C4858]/70">You: Complete your preparation to begin</span>
              </div>
            </div>

            <Button
              onClick={() => setShowFormDespiteOtherReady(true)}
              variant="outline"
              className="border-[#7BAFB0]/30 text-[#7BAFB0] hover:bg-[#7BAFB0]/10"
            >
              Continue with My Preparation
            </Button>

            <p className="text-xs text-[#3C4858]/60">
              Your conversation will begin automatically when both participants are ready.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  // Waiting for other participant (user is ready, waiting for other)
  if (readinessStatus.waitingForOther) {
    return (
      <div className="min-h-screen bg-[#F9F7F4] flex items-center justify-center p-4">
        <Card className="bg-[#FFFBF5] p-8 rounded-lg shadow-xl w-full max-w-md">
          <div className="text-center space-y-6">
            <div className="mx-auto w-16 h-16 bg-[#D8A7B1]/20 rounded-full flex items-center justify-center">
              <Clock className="w-8 h-8 text-[#D8A7B1]" />
            </div>
            
            <div>
              <h2 className="text-xl font-semibold text-[#3C4858] mb-2">You're Ready!</h2>
              <p className="text-[#3C4858]/70 text-sm">
                Waiting for the other participant to complete their preparation...
              </p>
            </div>

            <div className="bg-[#FFFBF5] border border-[#D8A7B1]/30 rounded-lg p-4">
              <div className="flex items-center space-x-3">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span className="text-sm text-[#3C4858]">You: Ready</span>
              </div>
              <div className="flex items-center space-x-3 mt-2">
                <Loader2 className="w-5 h-5 text-[#D8A7B1] animate-spin" />
                <span className="text-sm text-[#3C4858]/70">Other participant: Preparing...</span>
              </div>

            </div>

            <p className="text-xs text-[#3C4858]/60">
              Your conversation will begin automatically when both participants are ready.
            </p>

            {/* Discrete invite link */}
            <div className="mt-4 pt-4 border-t border-[#D8A7B1]/10">
              <div className="flex items-center justify-between text-xs text-[#3C4858]/50">
                <span>Share invite link</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={copyInviteLink}
                  className="h-6 px-2 text-xs text-[#3C4858]/50 hover:text-[#3C4858]/70"
                >
                  {copied ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // Main waiting room form
  return (
    <div className="min-h-screen bg-[#F9F7F4] py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <Card className="bg-[#FFFBF5] p-8 rounded-lg shadow-xl">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="mx-auto w-16 h-16 bg-[#D8A7B1]/20 rounded-full flex items-center justify-center mb-4">
              <Heart className="w-8 h-8 text-[#D8A7B1]" />
            </div>
            <h1 className="text-2xl font-semibold text-[#3C4858] mb-2">
              Prepare for Your Conversation
            </h1>
            <p className="text-[#3C4858]/70 text-sm">
              Help us create the perfect environment for meaningful dialogue by sharing a bit about yourself.
            </p>
          </div>

          {/* Questions Form */}
          <div className="space-y-6">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-[#3C4858] mb-2">
                Your Name
              </label>
              <Input
                value={answers.name || ''}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="How would you like to be addressed?"
                className="bg-white border-[#D8A7B1]/30"
              />
            </div>

            {/* Dynamic Questions */}
            {DEFAULT_QUESTIONS.map((question: WaitingRoomQuestion) => (
              <div key={question.id}>
                <label className="block text-sm font-medium text-[#3C4858] mb-2">
                  {question.question}
                  {question.required && <span className="text-red-500 ml-1">*</span>}
                </label>
                
                {question.type === 'textarea' && (
                  <Textarea
                    value={(answers[question.id] as string) || ''}
                    onChange={(e) => handleInputChange(question.id, e.target.value)}
                    placeholder={question.placeholder}
                    className="bg-white border-[#D8A7B1]/30 min-h-[100px]"
                  />
                )}
                
                {question.type === 'text' && (
                  <Input
                    value={(answers[question.id] as string) || ''}
                    onChange={(e) => handleInputChange(question.id, e.target.value)}
                    placeholder={question.placeholder}
                    className="bg-white border-[#D8A7B1]/30"
                  />
                )}
                
                {question.type === 'select' && question.options && (
                  <Select
                    value={(answers[question.id] as string) || ''}
                    onValueChange={(value) => handleInputChange(question.id, value)}
                  >
                    <SelectTrigger className="bg-white border-[#D8A7B1]/30">
                      <SelectValue placeholder="Choose your preferred style..." />
                    </SelectTrigger>
                    <SelectContent>
                      {question.options.map((option: string) => (
                        <SelectItem key={option} value={option.split(' - ')[0]}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            ))}
          </div>

          {/* Ready Button */}
          <div className="mt-8 pt-6 border-t border-[#D8A7B1]/20">
            <Button
              onClick={handleSubmit}
              disabled={!isFormValid() || submitting}
              className="w-full bg-gradient-to-r from-[#D8A7B1] to-[#7BAFB0] text-white hover:from-[#C99BA4] hover:to-[#6D9E9F] transition-all duration-300 px-8 py-3 text-lg font-medium"
            >
              {submitting ? (
                <div className="flex items-center space-x-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Getting Ready...</span>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <Users className="w-5 h-5" />
                  <span>I'm Ready to Begin</span>
                </div>
              )}
            </Button>
            
            {!isFormValid() && (
              <p className="text-sm text-[#3C4858]/60 text-center mt-2">
                Please complete all required fields to continue
              </p>
            )}

            {/* Discrete invite link */}
            <div className="mt-6 pt-4 border-t border-[#D8A7B1]/10">
              <div className="flex items-center justify-between text-xs text-[#3C4858]/50">
                <span>Need to share the invite link?</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={copyInviteLink}
                  className="h-6 px-2 text-xs text-[#3C4858]/50 hover:text-[#3C4858]/70"
                >
                  {copied ? (
                    <>
                      <Check className="h-3 w-3 mr-1" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3 mr-1" />
                      <span>Copy link</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
} 