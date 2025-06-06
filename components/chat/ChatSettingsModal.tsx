"use client";

import { useState, useEffect } from 'react';
import { X, Settings, CheckCircle, Clock, Users, FileText, Loader2, RefreshCw, AlertTriangle, RotateCcw, AlertCircle, Link2, Copy, Check } from 'lucide-react';
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
  participants?: Array<{
    id: string;
    display_name: string;
    role?: string;
  }>;
}

export function ChatSettingsModal({ 
  isOpen, 
  onClose, 
  chatId, 
  currentUserId, 
  onMarkComplete, 
  onGenerateSummary,
  onResetAI,
  onResetTurn,
  participants = []
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
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [isGeneratingInvite, setIsGeneratingInvite] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

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

  const handleGenerateInvite = async () => {
    setIsGeneratingInvite(true);
    try {
      const response = await fetch('/api/invite/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setInviteLink(data.inviteUrl);
      } else {
        console.error('Failed to generate invite link');
      }
    } catch (error) {
      console.error('Error generating invite:', error);
    } finally {
      setIsGeneratingInvite(false);
    }
  };

  const handleCopyInvite = async () => {
    if (!inviteLink) return;
    
    try {
      await navigator.clipboard.writeText(inviteLink);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy invite link:', error);
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
          {/* Participants Section */}
          <div className="space-y-4 mb-8">
            <div className="flex items-center gap-3 pb-3 border-b border-[#3C4858]/10">
              <div className="p-2 bg-gradient-to-r from-purple-100 to-pink-100 rounded-lg">
                <Users className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <h3 className="font-semibold text-[#3C4858]">Participants</h3>
                <p className="text-sm text-[#3C4858]/70">
                  Who's in this conversation
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {participants.length > 0 ? (
                participants.map((participant) => (
                  <div key={participant.id} className="flex items-center gap-3 p-3 bg-[#F9F7F4] rounded-lg">
                    <div className="w-8 h-8 bg-gradient-to-r from-[#D8A7B1] to-[#7BAFB0] rounded-full flex items-center justify-center text-white text-sm font-medium">
                      {participant.display_name?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-[#3C4858]">
                        {participant.display_name || 'Unknown User'}
                        {participant.id === currentUserId && (
                          <span className="text-xs text-[#7BAFB0] ml-2">(You)</span>
                        )}
                      </p>
                      <p className="text-xs text-[#3C4858]/60">
                        {participant.id === 'assistant' ? (
                          <span className="text-[#3C4858]/60 font-medium">AI Facilitator</span>
                        ) : participant.role === 'guest' || participant.id.startsWith('guest_') ? (
                          <span className="text-[#3C4858]/60 font-medium">Guest User</span>
                        ) : (
                          'Member'
                        )}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-4 text-[#3C4858]/60">
                  <p className="text-sm">No participants found</p>
                </div>
              )}
            </div>
          </div>

          {/* Invite Link Section */}
          <div className="space-y-4 mb-8">
            <div className="flex items-center gap-3 pb-3 border-b border-[#3C4858]/10">
              <div className="p-2 bg-gradient-to-r from-blue-100 to-cyan-100 rounded-lg">
                <Link2 className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-[#3C4858]">Invite More People</h3>
                <p className="text-sm text-[#3C4858]/70">
                  Share a link to invite others to join this conversation
                </p>
              </div>
            </div>

            <div className="bg-blue-50/50 rounded-lg p-4 border border-blue-200/50">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Users className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-blue-800 mb-1">
                      Need to invite someone who missed the original link?
                    </p>
                    <p className="text-xs text-blue-700 mb-3">
                      Generate a new invite link that others can use to join this conversation. 
                      New participants will join the rotation after the AI mediator.
                    </p>
                    
                    {!inviteLink ? (
                      <Button
                        onClick={handleGenerateInvite}
                        disabled={isGeneratingInvite}
                        className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white px-4 py-2 touch-manipulation"
                      >
                        {isGeneratingInvite ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Generating Link...
                          </>
                        ) : (
                          <>
                            <Link2 className="h-4 w-4 mr-2" />
                            Generate Invite Link
                          </>
                        )}
                      </Button>
                    ) : (
                      <div className="space-y-3">
                        <div className="bg-white rounded-lg p-3 border border-blue-200">
                          <p className="text-xs font-medium text-blue-800 mb-2">Share this link:</p>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={inviteLink}
                              readOnly
                              className="flex-1 text-xs bg-blue-50 border border-blue-200 rounded px-2 py-1 text-blue-900 font-mono"
                            />
                            <Button
                              onClick={handleCopyInvite}
                              size="sm"
                              variant="outline"
                              className="border-blue-300 text-blue-700 hover:bg-blue-100 px-3 touch-manipulation"
                            >
                              {isCopied ? (
                                <>
                                  <Check className="h-3 w-3 mr-1" />
                                  Copied!
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3 w-3 mr-1" />
                                  Copy
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                        <div className="text-xs text-blue-600">
                          <p>💡 <strong>Turn Order:</strong> New participants will be added to the rotation in the order they join.</p>
                          <p className="mt-1">⏰ <strong>Expires:</strong> This link is valid for 24 hours.</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Session Completion Section */}
          <div className="space-y-4 mb-8">
            <div className="flex items-center gap-3 pb-3 border-b border-[#3C4858]/10">
              <div className="p-2 bg-gradient-to-r from-green-100 to-emerald-100 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold text-[#3C4858]">Session Management</h3>
                <p className="text-sm text-[#3C4858]/70">
                  Complete the session or pause and return later
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
                {completionData.hasSummary && (
                  <Button
                    onClick={handleGenerateSummary}
                    size="sm"
                    variant="outline"
                    className="border-green-300 text-green-700 hover:bg-green-100 w-full sm:w-auto mt-3 touch-manipulation"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    View Summary & Feedback
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {/* Individual Completion Status */}
                <div className="bg-blue-50/50 rounded-lg p-4 border border-blue-200/50">
                  <div className="flex items-center gap-2 text-blue-700 mb-3">
                    <Users className="h-4 w-4" />
                    <span className="text-sm font-medium">Completion Progress</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-blue-600">Participants completed:</span>
                      <span className="font-medium text-blue-800">
                        {completionData?.completedCount || 0} of {completionData?.totalParticipants || 0}
                      </span>
                    </div>
                    <div className="w-full bg-blue-200/50 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                        style={{ 
                          width: `${Math.round(((completionData?.completedCount || 0) / Math.max(completionData?.totalParticipants || 1, 1)) * 100)}%` 
                        }}
                      ></div>
                    </div>
                  </div>
                  
                  {/* Show completion list */}
                  {completionData?.completionStatuses && completionData.completionStatuses.length > 0 && (
                    <div className="mt-3 space-y-1">
                      {completionData.completionStatuses.map(status => (
                        <div key={status.id} className="flex items-center gap-2 text-xs">
                          <CheckCircle className="h-3 w-3 text-green-600" />
                          <span className="text-blue-700">
                            {status.user.display_name || 'Unknown User'} completed
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Individual Mark Complete */}
                {!currentUserCompleted ? (
                  <div className="bg-green-50/50 rounded-lg p-4 border border-green-200/50">
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm font-medium text-green-800 mb-1">Ready to complete this session?</p>
                        <p className="text-xs text-green-700">
                          Mark when you feel ready to finish. All participants need to complete before summary generation. You can always pause and return to continue the conversation.
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Button
                          onClick={() => handleMarkComplete('complete')}
                          disabled={isMarking}
                          className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white w-full px-4 py-2 touch-manipulation"
                        >
                          {isMarking ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Completing...
                            </>
                          ) : (
                            <>
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Complete Session
                            </>
                          )}
                        </Button>
                        
                        <div className="text-center">
                          <p className="text-xs text-green-700 mb-2">Or take a break and come back later:</p>
                          <Button
                            onClick={onClose}
                            variant="outline"
                            size="sm"
                            className="border-green-300 text-green-700 hover:bg-green-50 px-4 py-1 text-xs touch-manipulation"
                          >
                            Pause & Return Later
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-green-50/50 rounded-lg p-4 border border-green-200/50">
                    <div className="flex items-center gap-2 text-green-700 mb-2">
                      <CheckCircle className="h-4 w-4" />
                      <span className="text-sm font-medium">You've marked this session complete</span>
                    </div>
                    <p className="text-xs text-green-600">
                      Waiting for other participants to complete before summary generation becomes available.
                    </p>
                  </div>
                )}

                {/* Generate Summary (only when all complete) */}
                {completionData?.allComplete && (
                  <div className="bg-emerald-50/50 rounded-lg p-4 border border-emerald-200/50">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-emerald-700 mb-2">
                        <FileText className="h-4 w-4" />
                        <span className="text-sm font-medium">Ready for Summary Generation</span>
                      </div>
                      <p className="text-xs text-emerald-600 mb-3">
                        All participants have completed the session. Either participant can now generate the conversation summary and proceed to feedback.
                      </p>
                      <Button
                        onClick={handleGenerateSummary}
                        disabled={isGenerating}
                        className="bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white w-full sm:w-auto px-6 py-2 touch-manipulation"
                      >
                        {isGenerating ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Generating Summary...
                          </>
                        ) : (
                          <>
                            <FileText className="h-4 w-4 mr-2" />
                            Generate Summary
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

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