import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { RealtimeEventService } from '@/features/chat/services/RealtimeEventService';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { chatId, isTyping } = await req.json();

  if (!chatId || typeof isTyping !== 'boolean') {
    return NextResponse.json({ error: 'Missing chatId or isTyping' }, { status: 400 });
  }

  try {
    const userId = session.user.id;

    // Use centralized realtime service for typing indicators (non-blocking)
    const realtimeService = new RealtimeEventService(chatId);
    realtimeService.broadcastUserTyping({
      userId,
      isTyping
    }).catch(error => {
      console.error('Failed to broadcast typing indicator (non-blocking):', error);
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to process typing indicator:', error);
    return NextResponse.json({ error: 'Failed to process typing indicator' }, { status: 500 });
  }
} 