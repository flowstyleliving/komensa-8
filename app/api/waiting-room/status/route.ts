import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { WaitingRoomService } from '@/lib/waiting-room';

// GET endpoint to get detailed waiting room status for both participants
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const chatId = searchParams.get('chatId');

    if (!chatId) {
      return NextResponse.json({ error: 'Chat ID required' }, { status: 400 });
    }

    // Check if user is authorized
    const isAuthorized = await WaitingRoomService.isUserAuthorized(chatId, session.user.id);
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Not a participant in this chat' }, { status: 403 });
    }

    const status = await WaitingRoomService.getWaitingRoomStatus(chatId, session.user.id);

    return NextResponse.json({
      currentUser: status.currentUser,
      otherUser: status.otherUser
    });

  } catch (error) {
    console.error('Error in waiting room status endpoint:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}