import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { pusherServer, getChatChannelName, PUSHER_EVENTS } from '@/lib/pusher';

// POST: Generate AI summary for completed conversation
export async function POST(request: NextRequest, { params }: { params: Promise<{ chatId: string }> }) {
  try {
    const { chatId } = await params;
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // For guest users, verify they have access to this specific chat
    if (session.user.isGuest && session.user.chatId !== chatId) {
      return NextResponse.json({ error: 'Access denied - guests can only access their invited chat' }, { status: 403 });
    }

    // Verify all participants have marked the conversation as complete
    const totalParticipants = await prisma.chatParticipant.count({
      where: { chat_id: chatId }
    });

    const completedCount = await prisma.chatCompletionStatus.count({
      where: { chat_id: chatId }
    });

    if (completedCount !== totalParticipants) {
      return NextResponse.json({ 
        error: 'All participants must mark the conversation as complete before generating a summary',
        completedCount,
        totalParticipants
      }, { status: 400 });
    }

    // Get all messages from the conversation
    const messages = await prisma.event.findMany({
      where: { 
        chat_id: chatId,
        type: 'message'
      },
      orderBy: { created_at: 'asc' }
    });

    // Get participant information for context
    const participants = await prisma.chatParticipant.findMany({
      where: { chat_id: chatId },
      include: {
        user: {
          select: {
            id: true,
            display_name: true,
            name: true
          }
        }
      }
    });

    // Build conversation context for AI
    const participantNames = participants
      .filter(p => p.user_id !== 'assistant')
      .map(p => p.user?.display_name || p.user?.name || 'Participant');

    const conversationText = messages
      .map(msg => {
        const data = msg.data as any;
        const senderName = data.senderId === 'assistant' ? 'AI Mediator' : 
          participants.find(p => p.user_id === data.senderId)?.user?.display_name || 'User';
        return `${senderName}: ${data.content}`;
      })
      .join('\n\n');

    // Generate AI summary
    console.log('[Summary] Generating AI summary for chat:', chatId);
    try {
      const systemPrompt = `You are creating a summary of a mediated conversation between ${participantNames.join(' and ')}. 

Analyze this conversation and create a comprehensive summary including:

1. **Main Topics Discussed**: Key themes and subjects covered
2. **Key Decisions or Agreements**: Any decisions made or agreements reached
3. **Action Items**: Next steps or commitments identified
4. **Unresolved Issues**: Questions or topics that remain open
5. **Overall Outcome**: How the conversation concluded

Please format the summary in a clear, professional manner that participants can reference later. Focus on concrete outcomes and actionable items.

Conversation:
${conversationText}`;

      const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: systemPrompt
            }
          ],
          max_tokens: 1000,
          temperature: 0.3,
        }),
      });

      if (!aiResponse.ok) {
        throw new Error(`OpenAI API error: ${aiResponse.status}`);
      }

      const aiData = await aiResponse.json();
      const summary = aiData.choices[0]?.message?.content;

      if (!summary) {
        throw new Error('No summary generated from AI');
      }

      // Save summary as an event
      const summaryEvent = await prisma.event.create({
        data: {
          chat_id: chatId,
          type: 'summary_generated',
          data: {
            summary,
            generatedBy: session.user.id,
            generatedAt: new Date().toISOString(),
            participantCount: totalParticipants,
            messageCount: messages.length
          },
          seq: 0
        }
      });

      // Update chat status to completed
      await prisma.chat.update({
        where: { id: chatId },
        data: { status: 'completed' }
      });

      // Emit summary via Pusher
      const channelName = getChatChannelName(chatId);
      await pusherServer.trigger(channelName, PUSHER_EVENTS.STATE_UPDATE, {
        summary,
        chatStatus: 'completed',
        summaryGenerated: true
      });

      console.log('[Summary] AI summary generated and saved for chat:', chatId);

      return NextResponse.json({
        success: true,
        summary,
        summaryId: summaryEvent.id,
        chatStatus: 'completed'
      });

    } catch (aiError) {
      console.error('[Summary] Error generating AI summary:', aiError);
      return NextResponse.json(
        { 
          error: 'Failed to generate summary',
          details: aiError instanceof Error ? aiError.message : 'Unknown error'
        },
        { status: 500 }
      );
    }

  } catch (error: any) {
    console.error('Error generating summary:', error);
    return NextResponse.json(
      { 
        error: 'Failed to generate summary',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

// GET: Retrieve existing summary for the chat
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  try {
    const { chatId } = await params;
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // For guest users, verify they have access to this specific chat
    if (session.user.isGuest && session.user.chatId !== chatId) {
      return NextResponse.json({ error: 'Access denied - guests can only access their invited chat' }, { status: 403 });
    }

    // Get existing summary
    const summaryEvent = await prisma.event.findFirst({
      where: { 
        chat_id: chatId,
        type: 'summary_generated'
      },
      orderBy: { created_at: 'desc' }
    });

    if (!summaryEvent) {
      return NextResponse.json({ 
        error: 'No summary found for this chat',
        hasSummary: false
      }, { status: 404 });
    }

    const summaryData = summaryEvent.data as any;

    return NextResponse.json({
      summary: summaryData.summary,
      generatedAt: summaryData.generatedAt,
      summaryId: summaryEvent.id,
      hasSummary: true
    });

  } catch (error: any) {
    console.error('Error retrieving summary:', error);
    return NextResponse.json(
      { 
        error: 'Failed to retrieve summary',
        details: error.message 
      },
      { status: 500 }
    );
  }
} 