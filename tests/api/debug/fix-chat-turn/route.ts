import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const { chatId } = await req.json();
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Update chat to flexible mode
    await prisma.chat.update({
      where: { id: chatId },
      data: { turn_taking: 'flexible' }
    });

    // Delete any existing turn state (not needed for flexible)
    await prisma.chatTurnState.deleteMany({
      where: { chat_id: chatId }
    });

    console.log(`[Fix Chat Turn] Switched chat ${chatId} to flexible mode`);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Chat switched to flexible mode - anyone can speak anytime' 
    });
  } catch (error) {
    console.error('[Fix Chat Turn] Error:', error);
    return NextResponse.json({ error: 'Failed to fix chat' }, { status: 500 });
  }
} 