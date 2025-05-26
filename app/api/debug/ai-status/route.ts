import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { openai } from '@/lib/openai';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const chatId = searchParams.get('chatId');
    
    if (!chatId) {
      return NextResponse.json({ error: 'chatId is required' }, { status: 400 });
    }

    // Get chat turn state
    const turnState = await prisma.chatTurnState.findUnique({
      where: { chat_id: chatId },
    });

    // Get recent events
    const recentEvents = await prisma.event.findMany({
      where: { chat_id: chatId },
      orderBy: { created_at: 'desc' },
      take: 5
    });

    // Check if there's an active thread
    let threadStatus = null;
    if (turnState?.thread_id) {
      try {
        const runs = await openai.beta.threads.runs.list(turnState.thread_id, {
          limit: 5
        });
        threadStatus = {
          threadId: turnState.thread_id,
          recentRuns: runs.data.map(run => ({
            id: run.id,
            status: run.status,
            created_at: run.created_at,
            completed_at: run.completed_at,
            failed_at: run.failed_at,
            last_error: run.last_error
          }))
        };
      } catch (error) {
        threadStatus = { error: 'Failed to fetch thread status', details: error };
      }
    }

    return NextResponse.json({
      chatId,
      turnState,
      recentEvents: recentEvents.map((e: any) => ({
        id: e.id,
        type: e.type,
        created_at: e.created_at,
        data: e.data
      })),
      threadStatus,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Debug AI status error:', error);
    return NextResponse.json({ 
      error: 'Failed to get AI status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { chatId, action } = await req.json();
    
    if (!chatId) {
      return NextResponse.json({ error: 'chatId is required' }, { status: 400 });
    }

    if (action === 'reset_typing') {
      // Reset typing indicator via Pusher
      const { pusherServer, getChatChannelName, PUSHER_EVENTS } = await import('@/lib/pusher');
      const channelName = getChatChannelName(chatId);
      await pusherServer.trigger(channelName, PUSHER_EVENTS.ASSISTANT_TYPING, { isTyping: false });
      
      return NextResponse.json({ 
        success: true, 
        message: 'Typing indicator reset' 
      });
    }

    if (action === 'cancel_runs') {
      const turnState = await prisma.chatTurnState.findUnique({
        where: { chat_id: chatId },
      });

      if (turnState?.thread_id) {
        try {
          const runs = await openai.beta.threads.runs.list(turnState.thread_id);
          const activeRuns = runs.data.filter(run => 
            run.status === 'in_progress' || run.status === 'queued'
          );

          const cancelResults = [];
          for (const run of activeRuns) {
            try {
              const cancelled = await openai.beta.threads.runs.cancel(turnState.thread_id, run.id);
              cancelResults.push({ runId: run.id, status: cancelled.status });
            } catch (error) {
              cancelResults.push({ runId: run.id, error: error });
            }
          }

          return NextResponse.json({
            success: true,
            message: `Cancelled ${activeRuns.length} active runs`,
            results: cancelResults
          });
        } catch (error) {
          return NextResponse.json({ 
            error: 'Failed to cancel runs',
            details: error instanceof Error ? error.message : 'Unknown error'
          }, { status: 500 });
        }
      }

      return NextResponse.json({ 
        success: true, 
        message: 'No thread found to cancel runs for' 
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Debug AI status POST error:', error);
    return NextResponse.json({ 
      error: 'Failed to execute action',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 