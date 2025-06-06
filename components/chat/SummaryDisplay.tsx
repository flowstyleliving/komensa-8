"use client";

import { useState } from 'react';
import { FileText, Download, Copy, Check, X, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

interface SummaryDisplayProps {
  summary: string;
  generatedAt: string;
  onClose: () => void;
  chatId: string;
}

export function SummaryDisplay({ 
  summary, 
  generatedAt, 
  onClose, 
  chatId 
}: SummaryDisplayProps) {
  const [copied, setCopied] = useState(false);
  const router = useRouter();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy summary:', error);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([summary], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `conversation-summary-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleFeedback = () => {
    router.push(`/feedback/${chatId}`);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#7BAFB0] to-[#D8A7B1] text-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <FileText className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Conversation Summary</h2>
                <p className="text-white/80 text-sm">
                  Generated on {formatDate(generatedAt)}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-white hover:bg-white/20"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-280px)]">
          <div className="prose prose-slate max-w-none">
            <div 
              className="text-[#3C4858] leading-relaxed whitespace-pre-wrap"
              style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
            >
              {summary}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="border-t border-[#3C4858]/10 p-6 bg-[#F9F7F4] space-y-4">
          {/* Primary Action - Feedback */}
          <div className="text-center">
            <Button
              onClick={handleFeedback}
              className="bg-gradient-to-r from-[#D8A7B1] to-[#7BAFB0] text-white hover:from-[#C99BA4] hover:to-[#6D9E9F] transition-all duration-300 px-8 py-3 text-lg font-medium"
            >
              <MessageSquare className="h-5 w-5 mr-2" />
              Continue Completion
            </Button>
            <p className="text-sm text-[#3C4858]/70 mt-2">
              Help us improve your conversation experience
            </p>
          </div>

          {/* Secondary Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-[#3C4858]/10">
            <p className="text-sm text-[#3C4858]/70">
              Save this summary for your records
            </p>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={handleCopy}
                className="border-[#7BAFB0] text-[#7BAFB0] hover:bg-[#7BAFB0] hover:text-white transition-all duration-300"
              >
                {copied ? (
                  <Check className="h-4 w-4 mr-2" />
                ) : (
                  <Copy className="h-4 w-4 mr-2" />
                )}
                {copied ? 'Copied!' : 'Copy'}
              </Button>
              <Button
                onClick={handleDownload}
                className="bg-gradient-to-r from-[#7BAFB0] to-[#D8A7B1] text-white hover:from-[#6D9E9F] hover:to-[#C99BA4] transition-all duration-300"
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 