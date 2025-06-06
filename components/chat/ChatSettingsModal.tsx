"use client";

import { useState, useEffect } from 'react';
import { X, Settings, CheckCircle, Clock, Users, FileText, Loader2, RefreshCw, AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CompletionStatus {
  id: string;
  user_id: string;
  marked_complete_at: string;
  completion_type: string;
  user: {
    id: string;
    display_name: string | null;
    name: string | null;
  };
}

interface ChatSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  chatId: string;
  currentUserId: string;
  onMarkComplete: (completionType: string) => Promise<void>;
  onGenerateSummary: () => Promise<void>;
  onResetAI?: () => Promise<void>;
  onResetTurn?: () => Promise<void>;
}

export function ChatSettingsModal({ 
  isOpen, 
  onClose, 
  chatId, 
  currentUserId, 
  onMarkComplete, 
  onGenerateSummary,
  onResetAI,
  onResetTurn
}: ChatSettingsModalProps) {
  const [completionData, setCompletionData] = useState<{
    completionStatuses: CompletionStatus[];
    allComplete: boolean;
    completedCount: number;
    totalParticipants: number;
  } | null>(null);
  const [isMarking, setIsMarking] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isResettingTurn, setIsResettingTurn] = useState(false);

  // Fetch completion status
  const fetchCompletionStatus = async () => {
    try {
      const res = await fetch(`/api/chat/${chatId}/complete`);
      if (res.ok) {
        const data = await res.json();
        setCompletionData(data);
      }
    } catch (error) {
      console.error('Failed to fetch completion status:', error);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchCompletionStatus();
    }
  }, [isOpen, chatId]);

  const handleMarkComplete = async (type: string = 'natural') => {
    setIsMarking(true);
    try {
      await onMarkComplete(type);
      await fetchCompletionStatus();
    } catch (error) {
      console.error('Failed to mark complete:', error);
    } finally {
      setIsMarking(false);
    }
  };

  const handleGenerateSummary = async () => {
    setIsGenerating(true);
    try {
      await onGenerateSummary();
      onClose(); // Close modal after generating summary
    } catch (error) {
      console.error('Failed to generate summary:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleResetAI = async () => {
    if (!onResetAI) return;
    setIsResetting(true);
    try {
      await onResetAI();
    } catch (error) {
      console.error('Failed to reset AI:', error);
    } finally {
      setIsResetting(false);
    }
  };

  const handleResetTurn = async () => {
    if (!onResetTurn) return;
    setIsResettingTurn(true);
    try {
      await onResetTurn();
    } catch (error) {
      console.error('Failed to reset turn:', error);
    } finally {
      setIsResettingTurn(false);
    }
  };

  const currentUserCompleted = completionData?.completionStatuses.some(
    status => status.user_id === currentUserId
  );

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/20 z-40"
        onClick={onClose}
      />

      {/* Slide-out modal */}
      <div className="fixed right-0 top-0 h-full w-80 bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#7BAFB0] to-[#D8A7B1] text-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <Settings className="h-5 w-5" />
              </div>
              <h2 className="text-lg font-semibold">Chat Settings</h2>
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
        <div className="p-6 h-[calc(100vh-88px)] overflow-y-auto">
          {/* AI Troubleshooting Section */}
          {onResetAI && (
            <div className="space-y-4 mb-8">
              <div className="flex items-center gap-3 pb-3 border-b border-[#3C4858]/10">
                <div className="p-2 bg-gradient-to-r from-amber-100 to-orange-100 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-[#3C4858]">AI Troubleshooting</h3>
                  <p className="text-sm text-[#3C4858]/70">
                    Reset the AI if it appears stuck or unresponsive
                  </p>
                </div>
              </div>

              <div className="bg-amber-50/50 rounded-lg p-4 border border-amber-200/50">
                <div className="space-y-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-[#3C4858]/80">
                      <p className="font-medium mb-1">When to use Reset AI:</p>
                      <ul className="text-xs space-y-1 text-[#3C4858]/70">
                        <li>• AI has been "thinking" for more than 2 minutes</li>
                        <li>• AI stopped responding mid-conversation</li>
                        <li>• Messages aren't being processed properly</li>
                      </ul>
                    </div>
                  </div>
                  
                  <Button 
                    onClick={handleResetAI}
                    disabled={isResetting}
                    variant="outline"
                    className="w-full border-amber-300 text-amber-700 hover:bg-amber-50 hover:border-amber-400 transition-all duration-300"
                  >
                    {isResetting ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Reset AI Mediator
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Turn Management Section */}
          {onResetTurn && (
            <div className="space-y-4 mb-8">
              <div className="flex items-center gap-3 pb-3 border-b border-[#3C4858]/10">
                <div className="p-2 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-lg">
                  <RotateCcw className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-[#3C4858]">Turn Management</h3>
                  <p className="text-sm text-[#3C4858]/70">
                    Reset the turn order if it gets confused or stuck
                  </p>
                </div>
              </div>

              <div className="bg-blue-50/50 rounded-lg p-4 border border-blue-200/50">
                <div className="space-y-3">
                  <div className="flex items-start gap-2">
                    <RotateCcw className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-[#3C4858]/80">
                      <p className="font-medium mb-1">When to reset turns:</p>
                      <ul className="text-xs space-y-1 text-[#3C4858]/70">
                        <li>• Wrong person's turn is displayed</li>
                        <li>• Turn state appears stuck or frozen</li>
                        <li>• Want to restart from the beginning</li>
                        <li>• After someone joins or leaves</li>
                      </ul>
                    </div>
                  </div>
                  
                  <Button 
                    onClick={handleResetTurn}
                    disabled={isResettingTurn}
                    variant="outline"
                    className="w-full border-blue-300 text-blue-700 hover:bg-blue-50 hover:border-blue-400 transition-all duration-300"
                  >
                    {isResettingTurn ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RotateCcw className="h-4 w-4 mr-2" />
                    )}
                    Reset Turn Order
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Conversation Completion Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-[#3C4858]/10">
              <div className="p-2 bg-gradient-to-r from-[#7BAFB0]/10 to-[#D8A7B1]/10 rounded-lg">
                <CheckCircle className="h-5 w-5 text-[#7BAFB0]" />
              </div>
              <div>
                <h3 className="font-semibold text-[#3C4858]">Conversation Completion</h3>
                <p className="text-sm text-[#3C4858]/70">
                  Mark when you're ready to wrap up this conversation
                </p>
              </div>
            </div>

            {/* Completion Status */}
            {completionData && (
              <div className="space-y-3">
                <div className="bg-[#F9F7F4] rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Users className="h-4 w-4 text-[#7BAFB0]" />
                    <span className="text-sm font-medium text-[#3C4858]">
                      Status: {completionData.completedCount} of {completionData.totalParticipants} ready
                    </span>
                  </div>

                  {/* Completion Status List */}
                  <div className="space-y-2">
                    {completionData.completionStatuses.map((status) => (
                      <div key={status.id} className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span className="text-sm text-[#3C4858]">
                          {status.user?.display_name || status.user?.name || 'User'} marked complete
                        </span>
                      </div>
                    ))}

                    {/* Waiting for others */}
                    {!completionData.allComplete && currentUserCompleted && (
                      <div className="flex items-center gap-2 text-[#3C4858]/60">
                        <Clock className="h-4 w-4" />
                        <span className="text-sm">Waiting for others...</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-3">
                  {!currentUserCompleted && (
                    <Button 
                      onClick={() => handleMarkComplete('natural')}
                      disabled={isMarking}
                      className="w-full bg-gradient-to-r from-[#7BAFB0] to-[#D8A7B1] text-white hover:from-[#6D9E9F] hover:to-[#C99BA4] transition-all duration-300"
                    >
                      {isMarking ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <CheckCircle className="h-4 w-4 mr-2" />
                      )}
                      Mark as Complete
                    </Button>
                  )}

                  {completionData.allComplete && (
                    <Button 
                      onClick={handleGenerateSummary}
                      disabled={isGenerating}
                      className="w-full bg-gradient-to-r from-emerald-600 to-emerald-700 text-white hover:from-emerald-700 hover:to-emerald-800 transition-all duration-300"
                    >
                      {isGenerating ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <FileText className="h-4 w-4 mr-2" />
                      )}
                      Generate Summary
                    </Button>
                  )}
                </div>

                {/* Info Text */}
                <div className="text-xs text-[#3C4858]/60 bg-[#7BAFB0]/5 rounded-lg p-3">
                  <p>
                    When all participants mark the conversation as complete, you'll be able to generate 
                    an AI summary with key points, decisions, and action items.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Future Settings Sections */}
          <div className="mt-8 pt-6 border-t border-[#3C4858]/10">
            <div className="text-center text-[#3C4858]/50">
              <p className="text-sm">More settings coming soon...</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
} 