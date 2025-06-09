import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/app/demo/utils/demoAuth';
import { DemoTurnManager } from '@/app/demo/features/demoTurnManager';
import { getTypingUsers } from '@/lib/redis';

// Helper function to get user ID from session or demo cookie
function getUserId(req: NextRequest, session: any) {
  // First try session
  if (session?.user?.id) {
    return session.user.id;
  }
  
  // Then try demo cookie
  const demoUserCookie = req.cookies.get('demo_user')?.value;
  if (demoUserCookie) {
    try {
      const demoUser = JSON.parse(demoUserCookie);
      return demoUser.id;
    } catch (e) {
      console.error('Failed to parse demo user cookie:', e);
    }
  }
  
  return null;
}

// GET: Fetch demo chat state
export async function GET(request: NextRequest) {
  const chatId = request.nextUrl.searchParams.get('chatId');
  
  if (!chatId) {
    return NextResponse.json({ error: 'Missing chatId' }, { status: 400 });
  }

  const session = await auth();
  const userId = getUserId(request, session);
  
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify this is a demo chat
  const chat = await prisma.chat.findUnique({
    where: { id: chatId },
    include: { 
      participants: {
        include: { user: true }
      }
    }
  });

  if (!chat || chat.origin !== 'demo') {
    return NextResponse.json({ error: 'Demo chat not found' }, { status: 404 });
  }

  // Fetch messages from Prisma
  const messages = await prisma.event.findMany({
    where: { chat_id: chatId },
    orderBy: { created_at: 'asc' },
  });

  // Fetch demo turn state
  const demoTurnManager = new DemoTurnManager(chatId);
  const turnState = await demoTurnManager.getCurrentTurn();

  // Get typing users from Redis
  let typingUsers: string[] = [];
  let isAssistantTyping = false;
  try {
    typingUsers = await getTypingUsers(chatId);
    isAssistantTyping = typingUsers.includes('assistant');
  } catch {
    // ignore redis errors for now
  }

  // Get participant information for the response
  const participants = chat.participants.map(p => ({
    id: p.user_id,
    display_name: p.user?.display_name || 'Unknown User'
  }));

  return NextResponse.json({
    messages,
    currentTurn: turnState,
    isAssistantTyping,
    typingUsers,
    participants,
  });
} 