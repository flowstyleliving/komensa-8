'use client';

import { Button } from '@/components/ui/button';
import { MessageCircle, Sparkles, ArrowRight } from 'lucide-react';

interface DemoModalProps {
  onClose: () => void;
  aiResponseCount: number;
}

export function DemoModal({ onClose, aiResponseCount }: DemoModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-8 max-w-md w-full shadow-2xl border border-[#3C4858]/10">
        <div className="text-center mb-6">
          <div className="mx-auto w-16 h-16 bg-[#7BAFB0]/10 rounded-full flex items-center justify-center mb-4">
            <Sparkles className="w-8 h-8 text-[#7BAFB0]" />
          </div>
          <h2 className="text-2xl font-semibold text-[#3C4858] mb-2">
            Demo Experience
          </h2>
          <p className="text-[#3C4858]/70 text-sm">
            You're experiencing Komensa's AI-powered mediation
          </p>
        </div>

        <div className="space-y-4 mb-6">
          <div className="flex items-center gap-3 p-3 bg-[#7BAFB0]/5 rounded-lg">
            <MessageCircle className="w-5 h-5 text-[#7BAFB0]" />
            <div>
              <p className="text-sm font-medium text-[#3C4858]">
                {aiResponseCount} AI responses received
              </p>
              <p className="text-xs text-[#3C4858]/60">
                Our AI mediator is facilitating your conversation
              </p>
            </div>
          </div>

          <div className="text-sm text-[#3C4858]/70 leading-relaxed">
            <p className="mb-2">
              This demo shows how Komensa's AI mediator helps:
            </p>
            <ul className="space-y-1 ml-4">
              <li>• Translate messages into constructive language</li>
              <li>• Manage turn-taking between participants</li>
              <li>• Guide conversations toward resolution</li>
            </ul>
          </div>
        </div>

        <div className="flex gap-3">
          <Button 
            onClick={onClose}
            className="flex-1 bg-[#7BAFB0] hover:bg-[#6D9E9F] text-white"
          >
            Continue Demo
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>

        <p className="text-xs text-[#3C4858]/50 text-center mt-4">
          Ready to try Komensa for real? Contact us to get started.
        </p>
      </div>
    </div>
  );
} 