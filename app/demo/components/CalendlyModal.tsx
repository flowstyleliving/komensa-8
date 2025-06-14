'use client';

import { Button } from '@/components/ui/button';
import { Calendar, X, Sparkles, Clock } from 'lucide-react';
import { InlineWidget } from 'react-calendly';
import { DEMO_CONSTANTS } from './constants';
import { memo } from 'react';

interface CalendlyModalProps {
  onClose: () => void;
  aiResponseCount: number;
}

export const CalendlyModal = memo(function CalendlyModal({ onClose, aiResponseCount }: CalendlyModalProps) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#F9F7F4] rounded-3xl w-full max-w-6xl h-[90vh] max-h-[800px] shadow-2xl border border-[#3C4858]/10 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#7BAFB0] to-[#D8A7B1] p-4 sm:p-6 text-white relative rounded-t-3xl">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-white/20 rounded-2xl flex items-center justify-center flex-shrink-0">
              <Calendar className="w-6 h-6 sm:w-8 sm:h-8" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold mb-1">
                Ready to Experience Komensa?
              </h2>
              <p className="text-white/90 text-sm">
                You've seen {aiResponseCount} AI responses in action. Let's discuss how Komensa can help your team.
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-col lg:flex-row h-[calc(90vh-120px)] max-h-[680px]">
          {/* Left side - Info */}
          <div className="w-full lg:w-1/3 p-4 sm:p-6 bg-[#F9F7F4] border-b lg:border-b-0 lg:border-r border-[#3C4858]/10 overflow-y-auto">
            <div className="space-y-4 sm:space-y-6">
              <div className="flex items-center gap-3">
                <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-[#7BAFB0] flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-[#3C4858] text-sm sm:text-base">What You've Experienced</h3>
                  <p className="text-xs sm:text-sm text-[#3C4858]/70">AI-powered mediation in action</p>
                </div>
              </div>

              <div className="space-y-2 sm:space-y-3">
                <div className="flex items-center gap-2 text-xs sm:text-sm text-[#3C4858]/80">
                  <div className="w-2 h-2 bg-[#7BAFB0] rounded-full flex-shrink-0"></div>
                  <span>Intelligent conversation facilitation</span>
                </div>
                <div className="flex items-center gap-2 text-xs sm:text-sm text-[#3C4858]/80">
                  <div className="w-2 h-2 bg-[#D8A7B1] rounded-full flex-shrink-0"></div>
                  <span>Turn-based communication management</span>
                </div>
                <div className="flex items-center gap-2 text-xs sm:text-sm text-[#3C4858]/80">
                  <div className="w-2 h-2 bg-[#D9C589] rounded-full flex-shrink-0"></div>
                  <span>Constructive language translation</span>
                </div>
              </div>

              <div className="bg-white p-3 sm:p-4 rounded-lg border border-[#3C4858]/10">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-[#7BAFB0] flex-shrink-0" />
                  <span className="text-xs sm:text-sm font-medium text-[#3C4858]">15-minute consultation</span>
                </div>
                <p className="text-xs text-[#3C4858]/70">
                  Discuss your team's communication challenges and see how Komensa can help.
                </p>
              </div>

              <div className="text-xs text-[#3C4858]/50 leading-relaxed">
                <p className="mb-2">
                  <strong>What we'll cover:</strong>
                </p>
                <ul className="space-y-1 ml-2">
                  <li>• Your current communication challenges</li>
                  <li>• How Komensa's AI mediation works</li>
                  <li>• Custom implementation for your team</li>
                  <li>• Pricing and next steps</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Right side - Calendly */}
          <div className="flex-1 bg-white min-h-[400px] lg:min-h-0">
            <InlineWidget 
              url={DEMO_CONSTANTS.CALENDLY_URL}
              styles={{
                height: '100%',
                minHeight: '400px',
                border: 'none'
              }}
              pageSettings={{
                backgroundColor: 'ffffff',
                hideEventTypeDetails: false,
                hideLandingPageDetails: false,
                primaryColor: '7BAFB0',
                textColor: '3C4858'
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}); 