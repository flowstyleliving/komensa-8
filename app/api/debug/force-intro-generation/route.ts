import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { chatId } = await request.json();
    
    if (!chatId) {
      return NextResponse.json({ error: 'Missing chatId' }, { status: 400 });
    }

    console.log(`[Debug] Force generating AI introduction for chat: ${chatId}`);
    
    // Trigger the AI introduction generation
    const introResponse = await fetch(`${process.env.NEXTAUTH_URL}/api/chat/${chatId}/generate-intro`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.NEXTAUTH_SECRET}` // Internal API call
      }
    });
    
    if (introResponse.ok) {
      const introData = await introResponse.json();
      console.log('[Debug] AI introduction generated successfully');
      
      return NextResponse.json({
        success: true,
        messageId: introData.messageId,
        content: introData.content,
        message: 'AI introduction generated successfully'
      });
    } else {
      const errorData = await introResponse.json().catch(() => ({}));
      console.error('[Debug] Failed to generate AI introduction:', introResponse.status, errorData);
      
      return NextResponse.json({
        success: false,
        error: `Failed to generate introduction: ${introResponse.status}`,
        details: errorData
      }, { status: introResponse.status });
    }
    
  } catch (error) {
    console.error('[Debug] Error in force intro generation:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 