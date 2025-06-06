import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { generateAIReply } from '@/features/ai/services/generateAIReply';

export async function POST(req: NextRequest) {
  const requestId = `ai_req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  console.log(`[AI Generate API] ${requestId} - Request started`);
  
  try {
    console.log(`[AI Generate API] ${requestId} - Checking authentication...`);
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      console.log(`[AI Generate API] ${requestId} - Unauthorized: no session`);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.log(`[AI Generate API] ${requestId} - Session found for user: ${session.user.id}`);

    console.log(`[AI Generate API] ${requestId} - Parsing request body...`);
    const body = await req.json();
    const { chatId, userMessage, userId } = body;

    if (!chatId || !userMessage) {
      console.log(`[AI Generate API] ${requestId} - Missing data: chatId=${!!chatId}, userMessage=${!!userMessage}`);
      return NextResponse.json({ error: 'Missing chatId or userMessage' }, { status: 400 });
    }

    console.log(`[AI Generate API] ${requestId} - Generating AI reply for chatId=${chatId}, messageLength=${userMessage.length}`);
    
    // Generate AI reply with extended timeout for dedicated endpoint
    const result = await generateAIReply({ 
      chatId, 
      userId: session.user.id, 
      userMessage,
      userAgent: req.headers.get('user-agent') || undefined
    });

    console.log(`[AI Generate API] ${requestId} - AI reply generated successfully`);
    return NextResponse.json({ success: true, content: result.content });
    
  } catch (error) {
    console.error(`[AI Generate API] ${requestId} - Error generating AI reply:`, error);
    return NextResponse.json({ error: 'AI generation failed' }, { status: 500 });
  }
}