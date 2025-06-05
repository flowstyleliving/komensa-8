import { useState, useEffect } from 'react';
import { pusherClient, getChatChannelName, PUSHER_EVENTS } from '@/lib/pusher';

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

interface CompletionData {
  completionStatuses: CompletionStatus[];
  allComplete: boolean;
  completedCount: number;
  totalParticipants: number;
}

interface SummaryData {
  summary: string;
  generatedAt: string;
  summaryId: string;
  hasSummary: boolean;
}

export function useCompletion(chatId: string) {
  const [completionData, setCompletionData] = useState<CompletionData | null>(null);
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  // Fetch existing summary
  const fetchSummary = async () => {
    try {
      const res = await fetch(`/api/chat/${chatId}/summary`);
      if (res.ok) {
        const data = await res.json();
        setSummaryData(data);
      } else if (res.status === 404) {
        setSummaryData(null); // No summary exists yet
      }
    } catch (error) {
      console.error('Failed to fetch summary:', error);
    }
  };

  // Mark conversation as complete
  const markComplete = async (completionType: string = 'natural') => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/chat/${chatId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completionType }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to mark complete');
      }

      const data = await res.json();
      setCompletionData(data);
      
      return data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to mark complete';
      setError(errorMessage);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Generate AI summary
  const generateSummary = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/chat/${chatId}/summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to generate summary');
      }

      const data = await res.json();
      setSummaryData({
        summary: data.summary,
        generatedAt: new Date().toISOString(),
        summaryId: data.summaryId,
        hasSummary: true
      });
      
      return data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate summary';
      setError(errorMessage);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Set up real-time updates
  useEffect(() => {
    if (!chatId) return;

    // Initial fetch
    fetchCompletionStatus();
    fetchSummary();

    // Subscribe to Pusher updates
    const channelName = getChatChannelName(chatId);
    const channel = pusherClient.subscribe(channelName);

    // Handle completion updates
    channel.bind(PUSHER_EVENTS.COMPLETION_UPDATE, (data: any) => {
      console.log('[useCompletion] Received completion update:', data);
      fetchCompletionStatus(); // Refresh completion status
    });

    // Handle completion ready (all participants complete)
    channel.bind(PUSHER_EVENTS.COMPLETION_READY, (data: any) => {
      console.log('[useCompletion] All participants marked complete:', data);
      fetchCompletionStatus(); // Refresh completion status
    });

    // Handle state updates that might include summary
    channel.bind(PUSHER_EVENTS.STATE_UPDATE, (data: any) => {
      if (data.summaryGenerated) {
        console.log('[useCompletion] Summary generated:', data);
        fetchSummary(); // Refresh summary data
      }
    });

    // Cleanup
    return () => {
      channel.unbind_all();
      pusherClient.unsubscribe(channelName);
    };
  }, [chatId]);

  return {
    completionData,
    summaryData,
    isLoading,
    error,
    markComplete,
    generateSummary,
    refreshStatus: fetchCompletionStatus,
    refreshSummary: fetchSummary
  };
} 