"use client";

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Star, Heart, MessageCircle, Users, Sparkles, ArrowRight, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import Image from 'next/image';
import Link from 'next/link';

interface FeedbackPageProps {
  params: Promise<{ chatId: string }>;
}

export default function FeedbackPage({ params }: FeedbackPageProps) {
  const { chatId } = React.use(params);
  const { data: session } = useSession();
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [guestEmail, setGuestEmail] = useState('');
  const [showRegistration, setShowRegistration] = useState(false);

  const isGuest = session?.user?.isGuest;

  useEffect(() => {
    // Redirect if not authenticated
    if (!session?.user?.id) {
      router.push('/auth/signin');
    }
  }, [session, router]);

  const handleSubmitFeedback = async () => {
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId,
          rating,
          feedback,
          userType: isGuest ? 'guest' : 'registered'
        })
      });

      if (response.ok) {
        setSubmitted(true);
        if (isGuest) {
          setTimeout(() => setShowRegistration(true), 1500);
        }
      }
    } catch (error) {
      console.error('Failed to submit feedback:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGuestRegistration = async () => {
    try {
      const response = await fetch('/api/auth/convert-guest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: guestEmail })
      });

      if (response.ok) {
        router.push('/dashboard');
      }
    } catch (error) {
      console.error('Failed to register:', error);
    }
  };

  if (!session?.user?.id) {
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
    <div className="min-h-screen bg-gradient-to-br from-[#F9F7F4] to-[#EAE8E5]">
      {/* Header */}
      <nav className="bg-white/80 backdrop-blur-sm border-b border-[#3C4858]/10 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center space-x-2">
              <Image src="/images/komensa-logo.png" alt="Komensa" width={120} height={40} className="h-8 w-auto" />
            </Link>
            <div className="text-sm text-[#3C4858]/60">
              Conversation Complete
            </div>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-12 max-w-2xl">
        {!submitted ? (
          <Card className="p-8 text-center">
            <div className="mb-6">
              <div className="mx-auto w-16 h-16 bg-gradient-to-r from-[#D8A7B1] to-[#7BAFB0] rounded-full flex items-center justify-center mb-4">
                <Heart className="h-8 w-8 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-[#3C4858] mb-2">
                {isGuest ? 'Thanks for trying Komensa!' : 'How was your conversation?'}
              </h1>
              <p className="text-[#3C4858]/70">
                {isGuest 
                  ? 'Your feedback helps us create better experiences for everyone.'
                  : 'Help us improve AI-mediated conversations for everyone.'
                }
              </p>
            </div>

            {/* Rating Stars */}
            <div className="mb-6">
              <p className="text-sm font-medium text-[#3C4858] mb-3">
                How would you rate this conversation experience?
              </p>
              <div className="flex justify-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setRating(star)}
                    className="transition-all duration-200 hover:scale-110"
                  >
                    <Star
                      className={`h-8 w-8 ${
                        star <= rating
                          ? 'fill-[#D9C589] text-[#D9C589]'
                          : 'text-[#3C4858]/20 hover:text-[#D9C589]/50'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Feedback Textarea */}
            <div className="mb-6 text-left">
              <label className="block text-sm font-medium text-[#3C4858] mb-2">
                What went well? What could be improved?
              </label>
              <Textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Share your thoughts about the AI mediator, conversation flow, ease of use, or anything else..."
                className="min-h-[120px] border-[#3C4858]/20 focus:border-[#7BAFB0]"
              />
            </div>

            {/* Quick feedback tags */}
            <div className="mb-6">
              <p className="text-sm font-medium text-[#3C4858] mb-3">Quick feedback</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { icon: MessageCircle, text: 'AI was helpful' },
                  { icon: Users, text: 'Easy to use' },
                  { icon: Sparkles, text: 'Great experience' },
                  { icon: CheckCircle, text: 'Reached resolution' }
                ].map((item, index) => (
                  <button
                    key={index}
                    onClick={() => setFeedback(prev => prev + (prev ? ', ' : '') + item.text)}
                    className="flex items-center gap-2 p-3 border border-[#3C4858]/20 rounded-lg hover:bg-[#7BAFB0]/10 hover:border-[#7BAFB0] transition-all text-sm"
                  >
                    <item.icon className="h-4 w-4 text-[#7BAFB0]" />
                    {item.text}
                  </button>
                ))}
              </div>
            </div>

            <Button
              onClick={handleSubmitFeedback}
              disabled={isSubmitting || rating === 0}
              className="w-full bg-gradient-to-r from-[#D8A7B1] to-[#7BAFB0] text-white hover:opacity-90"
            >
              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Submitting...
                </div>
              ) : (
                'Submit Feedback'
              )}
            </Button>
          </Card>
        ) : !showRegistration ? (
          <Card className="p-8 text-center">
            <div className="mx-auto w-16 h-16 bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-[#3C4858] mb-2">Thank you!</h2>
            <p className="text-[#3C4858]/70 mb-6">
              Your feedback helps us make Komensa better for everyone.
            </p>
            {!isGuest && (
              <Button
                onClick={() => router.push('/dashboard')}
                className="bg-[#7BAFB0] text-white hover:bg-[#6D9E9F]"
              >
                Back to Dashboard
              </Button>
            )}
          </Card>
        ) : (
          /* Guest Registration Card */
          <Card className="p-8 text-center">
            <div className="mb-6">
              <div className="mx-auto w-16 h-16 bg-gradient-to-r from-[#D8A7B1] to-[#7BAFB0] rounded-full flex items-center justify-center mb-4">
                <Sparkles className="h-8 w-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-[#3C4858] mb-2">Want to create your own conversations?</h2>
              <p className="text-[#3C4858]/70">
                Join Komensa to start unlimited AI-mediated conversations with anyone.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {[
                { icon: Users, title: 'Unlimited Chats', desc: 'Create conversations with anyone' },
                { icon: MessageCircle, title: 'Smart AI Mediator', desc: 'Get expert facilitation' },
                { icon: CheckCircle, title: 'Save Progress', desc: 'Keep your conversation history' }
              ].map((feature, index) => (
                <div key={index} className="p-4 bg-[#F9F7F4] rounded-lg">
                  <feature.icon className="h-6 w-6 text-[#7BAFB0] mx-auto mb-2" />
                  <h3 className="font-medium text-[#3C4858] text-sm">{feature.title}</h3>
                  <p className="text-xs text-[#3C4858]/70">{feature.desc}</p>
                </div>
              ))}
            </div>

            <div className="space-y-4">
              <input
                type="email"
                placeholder="Enter your email to get started"
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
                className="w-full p-3 border border-[#3C4858]/20 rounded-lg focus:border-[#7BAFB0] focus:outline-none"
              />
              <Button
                onClick={handleGuestRegistration}
                disabled={!guestEmail.includes('@')}
                className="w-full bg-gradient-to-r from-[#D8A7B1] to-[#7BAFB0] text-white hover:opacity-90"
              >
                Create Free Account
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <p className="text-xs text-[#3C4858]/60">
                Or{' '}
                <Link href="/" className="text-[#7BAFB0] hover:underline">
                  return to homepage
                </Link>
              </p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
} 