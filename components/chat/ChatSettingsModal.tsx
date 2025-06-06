"use client";

import { useState, useEffect } from 'react';
import { X, Settings, CheckCircle, Clock, Users, FileText, Loader2, RefreshCw, AlertTriangle, RotateCcw, AlertCircle } from 'lucide-react';
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
    isCompleted: boolean;
    completedAt: string | null;
    isCompleting: boolean;
    hasSummary: boolean;
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-[#3C4858]/10">
          <h2 className="text-lg sm:text-xl font-semibold text-[#3C4858]">Chat Settings</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-[#3C4858]/70 hover:bg-[#F9F7F4] h-8 w-8 sm:h-10 sm:w-10 rounded-full touch-manipulation"
          >
            <X className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
        </div>

        <div className="p-4 sm:p-6 h-[calc(90vh-88px)] sm:h-[calc(100vh-88px)] overflow-y-auto">
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
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div className="space-y-3 flex-1">
                    <div>
                      <p className="text-sm font-medium text-amber-800 mb-1">AI appears stuck or unresponsive?</p>
                      <p className="text-xs text-amber-700">
                        This will clear the AI's current state and allow it to respond again.
                      </p>
                    </div>
                    <Button
                      onClick={handleResetAI}
                      variant="outline"
                      size="sm"
                      className="border-amber-300 text-amber-700 hover:bg-amber-100 w-full sm:w-auto px-4 py-2 touch-manipulation"
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Reset AI State
                    </Button>
                  </div>
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
                <div className="flex items-start gap-3">
                  <Users className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="space-y-3 flex-1">
                    <div>
                      <p className="text-sm font-medium text-blue-800 mb-1">Turn order mixed up?</p>
                      <p className="text-xs text-blue-700">
                        This will recalculate whose turn it is based on the conversation flow.
                      </p>
                    </div>
                    <Button
                      onClick={handleResetTurn}
                      variant="outline"
                      size="sm"
                      className="border-blue-300 text-blue-700 hover:bg-blue-100 w-full sm:w-auto px-4 py-2 touch-manipulation"
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Reset Turn Order
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Completion Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-[#3C4858]/10">
              <div className="p-2 bg-gradient-to-r from-green-100 to-emerald-100 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold text-[#3C4858]">Session Completion</h3>
                <p className="text-sm text-[#3C4858]/70">
                  Mark this conversation as complete and generate insights
                </p>
              </div>
            </div>

            {completionData?.isCompleted ? (
              <div className="bg-green-50/50 rounded-lg p-4 border border-green-200/50">
                <div className="flex items-center gap-2 text-green-700 mb-2">
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">Session Completed</span>
                </div>
                <p className="text-xs text-green-600">
                  Completed on {completionData.completedAt ? new Date(completionData.completedAt).toLocaleDateString() : 'Unknown date'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-[#3C4858]/80">
                  When you're ready to end this conversation, you can mark it as complete. 
                  This will generate a summary and insights about your session.
                </p>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Button
                    onClick={() => handleMarkComplete('natural')}
                    disabled={completionData?.isCompleting}
                    variant="outline"
                    className="border-green-300 text-green-700 hover:bg-green-50 p-3 touch-manipulation"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Natural Ending
                  </Button>
                  
                  <Button
                    onClick={() => handleMarkComplete('time')}
                    disabled={completionData?.isCompleting}
                    variant="outline"
                    className="border-blue-300 text-blue-700 hover:bg-blue-50 p-3 touch-manipulation"
                  >
                    <Clock className="h-4 w-4 mr-2" />
                    Time's Up
                  </Button>
                </div>
              </div>
            )}

            {completionData?.hasSummary && (
              <div className="bg-blue-50/50 rounded-lg p-4 border border-blue-200/50">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-blue-700">
                    <FileText className="h-4 w-4" />
                    <span className="text-sm font-medium">Summary Available</span>
                  </div>
                </div>
                <p className="text-xs text-blue-600 mb-3">
                  A summary of your conversation has been generated and is ready to view.
                </p>
                <Button
                  onClick={handleGenerateSummary}
                  size="sm"
                  variant="outline"
                  className="border-blue-300 text-blue-700 hover:bg-blue-100 w-full sm:w-auto touch-manipulation"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  View Summary
                </Button>
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
    </div>
  );
} 