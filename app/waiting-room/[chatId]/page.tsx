'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Heart, Users, Clock, CheckCircle, Loader2 } from 'lucide-react';
import { DEFAULT_QUESTIONS, WaitingRoomQuestions } from '@/lib/waiting-room-questions';
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
  const [readinessStatus, setReadinessStatus] = useState({
    userReady: false,
    bothReady: false,
    waitingForOther: false
  });

  // Form state
  const [answers, setAnswers] = useState<Partial<WaitingRoomQuestions>>({
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
    
    if (!session?.user?.id) {
      router.push('/auth/signin');
      return;
    }

    loadWaitingRoomStatus();
  }, [chatId, session, status]);

  // Set up Pusher for real-time updates
  useEffect(() => {
    if (!chatId) return;

    const channel = pusherClient.subscribe(`chat-${chatId}`);
    
    channel.bind('new-message', (data: any) => {
      if (data.chatInitiated) {
        console.log('[Waiting Room] Chat initiated - redirecting...');
        router.push(`/chat/${chatId}`);
      }
    });

    return () => {
      pusherClient.unsubscribe(`chat-${chatId}`);
    };
  }, [chatId, router]);

  const loadWaitingRoomStatus = async () => {
    try {
      const response = await fetch(`/api/waiting-room/ready?chatId=${chatId}`);
      if (response.ok) {
        const data = await response.json();
        setReadinessStatus(data);
        
        // If both ready, redirect to chat
        if (data.bothReady) {
          router.push(`/chat/${chatId}`);
        }
      }
    } catch (error) {
      console.error('Failed to load waiting room status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof WaitingRoomQuestions, value: string) => {
    setAnswers(prev => ({ ...prev, [field]: value }));
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
          // Both ready - will be redirected via Pusher event
          console.log('[Waiting Room] Both ready - waiting for chat initiation...');
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

  // Waiting for other participant
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
            {DEFAULT_QUESTIONS.map((question) => (
              <div key={question.id}>
                <label className="block text-sm font-medium text-[#3C4858] mb-2">
                  {question.question}
                  {question.required && <span className="text-red-500 ml-1">*</span>}
                </label>
                
                {question.type === 'textarea' && (
                  <Textarea
                    value={answers[question.id] || ''}
                    onChange={(e) => handleInputChange(question.id, e.target.value)}
                    placeholder={question.placeholder}
                    className="bg-white border-[#D8A7B1]/30 min-h-[100px]"
                  />
                )}
                
                {question.type === 'text' && (
                  <Input
                    value={answers[question.id] || ''}
                    onChange={(e) => handleInputChange(question.id, e.target.value)}
                    placeholder={question.placeholder}
                    className="bg-white border-[#D8A7B1]/30"
                  />
                )}
                
                {question.type === 'select' && question.options && (
                  <Select
                    value={answers[question.id] || ''}
                    onValueChange={(value) => handleInputChange(question.id, value)}
                  >
                    <SelectTrigger className="bg-white border-[#D8A7B1]/30">
                      <SelectValue placeholder="Choose your preferred style..." />
                    </SelectTrigger>
                    <SelectContent>
                      {question.options.map((option) => (
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
              className="w-full bg-[#D8A7B1] hover:bg-[#C99BA4] text-white py-3 text-lg"
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
          </div>
        </Card>
      </div>
    </div>
  );
} 