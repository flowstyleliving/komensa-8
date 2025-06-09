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
  onUpdateTurnStyle?: (style: string) => Promise<void>;
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
  onUpdateTurnStyle,
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
  const [turnStyle, setTurnStyle] = useState('flexible');
  const [isUpdatingTurnStyle, setIsUpdatingTurnStyle] = useState(false);

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

  // Fetch current turn style
  const fetchTurnStyle = async () => {
    try {
      const res = await fetch(`/api/chat/${chatId}/settings`);
      if (res.ok) {
        const data = await res.json();
        setTurnStyle(data.turnStyle || 'flexible');
      }
    } catch (error) {
      console.error('Failed to fetch turn style:', error);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchCompletionStatus();
      fetchTurnStyle();
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

  const handleTurnStyleChange = async (newStyle: string) => {
    setIsUpdatingTurnStyle(true);
    try {
      const res = await fetch(`/api/chat/${chatId}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ turnStyle: newStyle }),
      });
      
      if (res.ok) {
        setTurnStyle(newStyle);
        if (onUpdateTurnStyle) {
          await onUpdateTurnStyle(newStyle);
        }
      } else {
        console.error('Failed to update turn style');
      }
    } catch (error) {
      console.error('Error updating turn style:', error);
    } finally {
      setIsUpdatingTurnStyle(false);
    }
  };

  const currentUserCompleted = completionData?.completionStatuses.some(
    status => status.user_id === currentUserId
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-[#3C4858]/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#F9F7F4] rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-[#3C4858]/10 rounded-t-3xl">
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
              <div className="p-2 bg-gradient-to-r from-[#D8A7B1]/20 to-[#D8A7B1]/10 rounded-lg">
                <Users className="h-5 w-5 text-[#D8A7B1]" />
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

          {/* Turn-Taking Settings Section */}
          <div className="space-y-4 mb-8">
            <div className="flex items-center gap-3 pb-3 border-b border-[#3C4858]/10">
              <div className="p-2 bg-gradient-to-r from-[#7BAFB0]/20 to-[#7BAFB0]/10 rounded-lg">
                <Users className="h-5 w-5 text-[#7BAFB0]" />
              </div>
              <div>
                <h3 className="font-semibold text-[#3C4858]">Turn-Taking Style</h3>
                <p className="text-sm text-[#3C4858]/70">
                  Choose how conversation turns are managed
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {[
                {
                  value: 'flexible',
                  label: 'Flexible Turns',
                  description: 'Anyone can speak anytime - more natural conversation',
                  icon: '🗣️'
                },
                {
                  value: 'strict',
                  label: 'Strict Turns',
                  description: 'Round-robin turns with AI facilitating each exchange',
                  icon: '⏰'
                },
                {
                  value: 'moderated',
                  label: 'AI Moderated',
                  description: 'AI manages who speaks when based on context',
                  icon: '🤖'
                },
                {
                  value: 'rounds',
                  label: 'Round System',
                  description: 'Turn-based with AI responding only after complete rounds',
                  icon: '🔄'
                }
              ].map((option) => (
                <div
                  key={option.value}
                  className={`relative rounded-lg border-2 p-4 cursor-pointer transition-all ${
                    turnStyle === option.value
                      ? 'border-[#7BAFB0] bg-[#7BAFB0]/10'
                      : 'border-[#3C4858]/10 bg-white hover:border-[#7BAFB0]/30'
                  }`}
                  onClick={() => handleTurnStyleChange(option.value)}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{option.icon}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className={`font-medium ${
                          turnStyle === option.value ? 'text-[#7BAFB0]' : 'text-[#3C4858]'
                        }`}>
                          {option.label}
                        </h4>
                        {turnStyle === option.value && (
                          <CheckCircle className="h-5 w-5 text-[#7BAFB0]" />
                        )}
                      </div>
                      <p className={`text-sm mt-1 ${
                        turnStyle === option.value ? 'text-[#7BAFB0]/80' : 'text-[#3C4858]/70'
                      }`}>
                        {option.description}
                      </p>
                    </div>
                  </div>
                  {isUpdatingTurnStyle && turnStyle !== option.value && (
                    <div className="absolute inset-0 bg-white/50 rounded-lg flex items-center justify-center">
                      <Loader2 className="h-5 w-5 animate-spin text-[#7BAFB0]" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Invite Link Section */}
          <div className="space-y-4 mb-8">
            <div className="flex items-center gap-3 pb-3 border-b border-[#3C4858]/10">
              <div className="p-2 bg-gradient-to-r from-[#7BAFB0]/20 to-[#7BAFB0]/10 rounded-lg">
                <Link2 className="h-5 w-5 text-[#7BAFB0]" />
              </div>
              <div>
                <h3 className="font-semibold text-[#3C4858]">Invite More People</h3>
                <p className="text-sm text-[#3C4858]/70">
                  Share a link to invite others to join this conversation
                </p>
              </div>
            </div>

            <div className="bg-[#7BAFB0]/10 rounded-xl p-4 border border-[#7BAFB0]/30">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Users className="h-5 w-5 text-[#7BAFB0] mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-[#3C4858] mb-1">
                      Need to invite someone who missed the original link?
                    </p>
                    <p className="text-xs text-[#3C4858]/70 mb-3">
                      Generate a new invite link that others can use to join this conversation. 
                      New participants will join the rotation after the AI mediator.
                    </p>
                    
                    {!inviteLink ? (
                      <Button
                        onClick={handleGenerateInvite}
                        disabled={isGeneratingInvite}
                        className="bg-gradient-to-r from-[#7BAFB0] to-[#7BAFB0]/80 hover:from-[#6D9E9F] hover:to-[#6D9E9F]/80 text-white px-4 py-2 touch-manipulation rounded-xl"
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
                        <div className="bg-white rounded-xl p-3 border border-[#7BAFB0]/30">
                          <p className="text-xs font-medium text-[#3C4858] mb-2">Share this link:</p>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={inviteLink}
                              readOnly
                              className="flex-1 text-xs bg-[#7BAFB0]/10 border border-[#7BAFB0]/30 rounded-lg px-2 py-1 text-[#3C4858] font-mono"
                            />
                            <Button
                              onClick={handleCopyInvite}
                              size="sm"
                              variant="outline"
                              className="border-[#7BAFB0]/50 text-[#7BAFB0] hover:bg-[#7BAFB0]/10 px-3 touch-manipulation rounded-lg"
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
                        <div className="text-xs text-[#3C4858]/70">
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
              <div className="p-2 bg-gradient-to-r from-[#D8A7B1]/20 to-[#D8A7B1]/10 rounded-lg">
                <CheckCircle className="h-5 w-5 text-[#D8A7B1]" />
              </div>
              <div>
                <h3 className="font-semibold text-[#3C4858]">Session Management</h3>
                <p className="text-sm text-[#3C4858]/70">
                  Complete the session or pause and return later
                </p>
              </div>
            </div>

            {completionData?.isCompleted ? (
              <div className="bg-[#D8A7B1]/10 rounded-lg p-4 border border-[#D8A7B1]/30">
                <div className="flex items-center gap-2 text-[#D8A7B1] mb-2">
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">Session Completed</span>
                </div>
                <p className="text-xs text-[#D8A7B1]/80">
                  Completed on {completionData.completedAt ? new Date(completionData.completedAt).toLocaleDateString() : 'Unknown date'}
                </p>
                {completionData.hasSummary && (
                  <Button
                    onClick={handleGenerateSummary}
                    size="sm"
                    variant="outline"
                    className="border-[#D8A7B1]/50 text-[#D8A7B1] hover:bg-[#D8A7B1]/10 w-full sm:w-auto mt-3 touch-manipulation"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    View Summary & Feedback
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {/* Individual Completion Status */}
                <div className="bg-[#D8A7B1]/10 rounded-xl p-4 border border-[#D8A7B1]/30">
                  <div className="flex items-center gap-2 text-[#D8A7B1] mb-3">
                    <Users className="h-4 w-4" />
                    <span className="text-sm font-medium">Completion Progress</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-[#3C4858]/70">Participants completed:</span>
                      <span className="font-medium text-[#3C4858]">
                        {completionData?.completedCount || 0} of {completionData?.totalParticipants || 0}
                      </span>
                    </div>
                    <div className="w-full bg-[#D8A7B1]/20 rounded-full h-2">
                      <div 
                        className="bg-[#D8A7B1] h-2 rounded-full transition-all duration-300" 
                        style={{ 
                          width: `${Math.round(((completionData?.completedCount || 0) / Math.max(completionData?.totalParticipants || 1, 1)) * 100)}%` 
                        }}
                      ></div>
                    </div>
                  </div>
                  
                  {/* Show completion list */}
                  <div className="mt-4 space-y-2">
                    {completionData?.completionStatuses.map((status) => (
                      <div key={status.user_id} className="flex items-center gap-2 text-xs">
                        <div className={`w-2 h-2 rounded-full ${
                          status.completed ? 'bg-[#D8A7B1]' : 'bg-[#3C4858]/20'
                        }`} />
                        <span className="text-[#3C4858]/70">
                          {status.display_name || 'Unknown User'}
                          {status.user_id === currentUserId && ' (You)'}
                        </span>
                        {status.completed && (
                          <span className="text-[#D8A7B1] ml-auto">
                            {new Date(status.completed_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-[#D8A7B1]/10 rounded-lg p-4 border border-[#D8A7B1]/30">
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-medium text-[#3C4858] mb-1">Ready to complete this session?</p>
                      <p className="text-xs text-[#3C4858]/70">
                        Mark when you feel ready to finish. All participants need to complete before summary generation. You can always pause and return to continue the conversation.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Button
                        onClick={() => handleMarkComplete('complete')}
                        disabled={isMarking}
                        className="bg-gradient-to-r from-[#D8A7B1] to-[#D8A7B1]/80 hover:from-[#C99BA4] hover:to-[#C99BA4]/80 text-white w-full px-4 py-2 touch-manipulation"
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
                    </div>
                  </div>
                </div>

                {completionData?.allComplete && (
                  <div className="bg-[#D8A7B1]/10 rounded-lg p-4 border border-[#D8A7B1]/30">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-[#D8A7B1] mb-2">
                        <FileText className="h-4 w-4" />
                        <span className="text-sm font-medium">Ready for Summary Generation</span>
                      </div>
                      <p className="text-xs text-[#3C4858]/70 mb-3">
                        All participants have completed the session. Either participant can now generate the conversation summary and proceed to feedback.
                      </p>
                      <Button
                        onClick={handleGenerateSummary}
                        disabled={isGenerating}
                        className="bg-gradient-to-r from-[#D8A7B1] to-[#D8A7B1]/80 hover:from-[#C99BA4] hover:to-[#C99BA4]/80 text-white w-full sm:w-auto px-6 py-2 touch-manipulation"
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
                <div className="p-2 bg-gradient-to-r from-[#D9C589]/20 to-[#D9C589]/10 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-[#D9C589]" />
                </div>
                <div>
                  <h3 className="font-semibold text-[#3C4858]">AI Troubleshooting</h3>
                  <p className="text-sm text-[#3C4858]/70">
                    Reset the AI if it appears stuck or unresponsive
                  </p>
                </div>
              </div>

              <div className="bg-[#D9C589]/10 rounded-lg p-4 border border-[#D9C589]/30">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-[#D9C589] mt-0.5 flex-shrink-0" />
                  <div className="space-y-3 flex-1">
                    <div>
                      <p className="text-sm font-medium text-[#3C4858] mb-1">AI appears stuck or unresponsive?</p>
                      <p className="text-xs text-[#3C4858]/70">
                        This will clear the AI's current state and allow it to respond again.
                      </p>
                    </div>
                    <Button
                      onClick={handleResetAI}
                      variant="outline"
                      size="sm"
                      className="border-[#D9C589]/50 text-[#D9C589] hover:bg-[#D9C589]/10 w-full sm:w-auto px-4 py-2 touch-manipulation"
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
                <div className="p-2 bg-gradient-to-r from-[#D9C589]/20 to-[#D9C589]/10 rounded-lg">
                  <RotateCcw className="h-5 w-5 text-[#D9C589]" />
                </div>
                <div>
                  <h3 className="font-semibold text-[#3C4858]">Turn Management</h3>
                  <p className="text-sm text-[#3C4858]/70">
                    Reset the turn order if it gets confused or stuck
                  </p>
                </div>
              </div>

              <div className="bg-[#D9C589]/10 rounded-xl p-4 border border-[#D9C589]/30">
                <div className="flex items-start gap-3">
                  <Users className="h-5 w-5 text-[#D9C589] mt-0.5 flex-shrink-0" />
                  <div className="space-y-3 flex-1">
                    <div>
                      <p className="text-sm font-medium text-[#3C4858] mb-1">Turn order mixed up?</p>
                      <p className="text-xs text-[#3C4858]/70">
                        This will recalculate whose turn it is based on the conversation flow.
                      </p>
                    </div>
                    <Button
                      onClick={handleResetTurn}
                      variant="outline"
                      size="sm"
                      className="border-[#D9C589]/50 text-[#D9C589] hover:bg-[#D9C589]/10 w-full sm:w-auto px-4 py-2 touch-manipulation rounded-xl"
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