import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { TurnManager } from '@/features/chat/services/turnManager';

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

    // Use unified turn manager for typing indicators
    const turnManager = new TurnManager(chatId);
    await turnManager.setTypingIndicator(userId, isTyping);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to set typing indicator:', error);
    return NextResponse.json({ error: 'Failed to set typing indicator' }, { status: 500 });
  }
} 