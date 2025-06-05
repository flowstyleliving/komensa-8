'use client';

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Link2, Copy, Check, Clock, Users } from 'lucide-react';

interface InviteGeneratorProps {
  chatId: string;
  onClose?: () => void;
  className?: string;
}

export default function InviteGenerator({ chatId, onClose, className = '' }: InviteGeneratorProps) {
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateInvite = async () => {
    setGenerating(true);
    setError(null);

    try {
      const response = await fetch('/api/invite/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId }),
      });

      const data = await response.json();

      if (response.ok) {
        setInviteUrl(data.inviteUrl);
      } else {
        setError(data.error || 'Failed to generate invite');
      }
    } catch (err) {
      setError('Network error occurred');
    } finally {
      setGenerating(false);
    }
  };

  const copyToClipboard = async () => {
    if (!inviteUrl) return;

    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  if (!inviteUrl) {
    return (
      <Card className={`bg-[#FFFBF5] p-6 ${className}`}>
        <div className="space-y-4">
          <div className="text-center">
            <div className="mx-auto w-12 h-12 bg-[#D8A7B1]/20 rounded-full flex items-center justify-center mb-3">
              <Link2 className="w-6 h-6 text-[#D8A7B1]" />
            </div>
            <h3 className="text-lg font-semibold text-[#3C4858] mb-2">Invite Someone to This Chat</h3>
            <p className="text-sm text-[#3C4858]/70">
              Generate a guest invite link for this conversation.
            </p>
          </div>

          <div className="bg-[#F9F7F4] border border-[#D8A7B1]/30 rounded-lg p-4">
            <h4 className="font-medium text-[#3C4858] text-sm mb-2">Guest Invite Features:</h4>
            <ul className="text-xs text-[#3C4858]/70 space-y-1">
              <li className="flex items-center space-x-2">
                <Clock className="w-3 h-3 text-[#D8A7B1]" />
                <span>Link expires in 24 hours</span>
              </li>
              <li className="flex items-center space-x-2">
                <Users className="w-3 h-3 text-[#D8A7B1]" />
                <span>Can only be used once</span>
              </li>
              <li className="flex items-center space-x-2">
                <Link2 className="w-3 h-3 text-[#D8A7B1]" />
                <span>Guest joins without creating an account</span>
              </li>
            </ul>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="flex space-x-3">
            <Button
              onClick={generateInvite}
              disabled={generating}
              className="flex-1 bg-[#D8A7B1] hover:bg-[#C99BA4] text-white"
            >
              {generating ? 'Generating...' : 'Generate Invite Link'}
              <Link2 className="w-4 h-4 ml-2" />
            </Button>
            {onClose && (
              <Button
                onClick={onClose}
                variant="outline"
                className="border-[#3C4858]/30 text-[#3C4858]/80 hover:bg-[#F9F7F4]"
              >
                Cancel
              </Button>
            )}
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className={`bg-[#FFFBF5] p-6 ${className}`}>
      <div className="space-y-4">
        <div className="text-center">
          <div className="mx-auto w-12 h-12 bg-[#D8A7B1]/20 rounded-full flex items-center justify-center mb-3">
            <Check className="w-6 h-6 text-[#D8A7B1]" />
          </div>
          <h3 className="text-lg font-semibold text-[#3C4858] mb-2">Invite Link Generated!</h3>
          <p className="text-sm text-[#3C4858]/70">
            Share this link to invite someone to your conversation.
          </p>
        </div>

        <div className="bg-[#F9F7F4] border border-[#D8A7B1]/30 rounded-lg p-4">
          <Label className="text-xs font-medium text-[#3C4858]/80 mb-2 block">Invite Link</Label>
          <div className="flex items-center space-x-2">
            <Input
              value={inviteUrl}
              readOnly
              className="flex-1 bg-white border-[#3C4858]/20 text-sm"
            />
            <Button
              onClick={copyToClipboard}
              variant="outline"
              size="sm"
              className="border-[#D8A7B1] text-[#D8A7B1] hover:bg-[#D8A7B1]/10"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
          <p className="text-xs text-[#3C4858]/60 mt-2">
            This link expires in 24 hours and can only be used once.
          </p>
        </div>

        <div className="bg-[#FFFBF5] border border-[#D8A7B1]/30 rounded-lg p-4">
          <h4 className="font-medium text-[#3C4858] text-sm mb-2">💡 How to share</h4>
          <ul className="text-xs text-[#3C4858]/70 space-y-1">
            <li>• Send the link via text, email, or any messaging app</li>
            <li>• The recipient will enter their name and join as a guest</li>
            <li>• They'll immediately be part of your AI-mediated conversation</li>
          </ul>
        </div>

        {onClose && (
          <Button
            onClick={onClose}
            className="w-full bg-[#D8A7B1] hover:bg-[#C99BA4] text-white"
          >
            Done
          </Button>
        )}
      </div>
    </Card>
  );
} 