/**
 *
 * This endpoint creates a new demo chat with fake users and initial messages,
 * optionally triggers an AI reply, and redirects to the new chat.
 * It's designed to provide a clean, pre-seeded demo experience for users.
 * GET /api/demo/seed
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { v4 as uuidv4 } from 'uuid';

const SYSTEM_PROMPT = `You are **Komensa's AI Mediator**.  
Participants (in order of turn-taking) are:
{{participants}}

Rules for your very first reply ONLY:

1. Greet each participant by display-name (comma-separated).  
2. State, in one calm sentence, that you will translate messages into constructive language and manage turn-taking.  
3. Politely invite **the first participant** ({{first_display_name}}) to share:  
   • a brief description of the current situation  
   • their hoped-for outcome from this chat  
4. End with a single open question to {{first_display_name}}.  
5. Use no more than 90 words total; adopt a warm, neutral tone.

Do **not** ask the second participant anything yet.  
Do **not** add commentary, emojis, or solution suggestions.`;

export async function GET(req: Request) {
  try {
    console.log('[Demo Seed] Starting demo chat creation...');
    console.log('[Demo Seed] Database URL configured:', !!process.env.DATABASE_URL);

    // 1. Create two real users for the demo chat
    console.log('[Demo Seed] Creating demo users...');
    let user1, user2;
    
    try {
      user1 = await prisma.user.create({
        data: {
          id: uuidv4(),
          display_name: 'Michael',
        },
      });
      console.log('[Demo Seed] Created user1 (Michael):', user1.id, user1.display_name);
    } catch (error) {
      console.error('[Demo Seed] Failed to create user1:', error);
      throw error;
    }

    try {
      user2 = await prisma.user.create({
        data: {
          id: uuidv4(),
          display_name: 'Jordan',
        },
      });
      console.log('[Demo Seed] Created user2 (Jordan):', user2.id, user2.display_name);
    } catch (error) {
      console.error('[Demo Seed] Failed to create user2:', error);
      throw error;
    }

    // 2. Create a new chat and connect both users as participants
    console.log('[Demo Seed] Creating chat with participants...');
    let newChat;
    
    try {
      newChat = await prisma.chat.create({
        data: {
          origin: 'demo',
          mediator_style: 'default',
          turn_taking: 'strict',
          status: 'active',
          participants: {
            create: [
              { user_id: user1.id, role: 'user' },
              { user_id: user2.id, role: 'user' },
            ],
          },
          turn_state: {
            create: {
              next_user_id: user1.id, // Start with Michael (the demo viewer)
              next_role: 'user_a',
              turn_queue: ['user_a', 'mediator', 'jordan', 'mediator'],
              current_turn_index: 0
            } as any
          }
        },
      });
      console.log('[Demo Seed] Created chat:', newChat.id);
    } catch (error) {
      console.error('[Demo Seed] Failed to create chat:', error);
      throw error;
    }

    // 3. Prepare system prompt for AI context (not stored as visible message)
    console.log('[Demo Seed] Preparing system prompt for AI context...');
    const filledPrompt = SYSTEM_PROMPT
      .replace("{{participants}}", `"${user1.display_name || 'Michael'}", "${user2.display_name || 'Jordan'}"`)
      .replace(/{{first_display_name}}/g, user1.display_name || 'Michael');
    
    console.log('[Demo Seed] System prompt prepared for AI context (not visible in chat)');

    // 4. Add the initial AI welcome message (this will be visible)
    console.log('[Demo Seed] Creating initial AI welcome message...');
    const initialMessages = [
      {
        chat_id: newChat.id,
        type: 'message',
        data: {
          content: `Hello Michael and Jordan! I'm here to help facilitate your conversation. I'll help translate messages into constructive language and manage turn-taking between you both. Michael, could you please share a brief description of the current situation and what you're hoping to achieve from this chat?`,
          senderId: 'assistant',
        },
      },
    ];

    try {
      await prisma.event.createMany({
        data: initialMessages,
      });
      console.log('[Demo Seed] Created initial AI welcome message');
    } catch (error) {
      console.error('[Demo Seed] Failed to create initial message:', error);
      throw error;
    }

    // 5. Configure AI assistants for this demo
    console.log('[Demo Seed] Configuring AI assistants...');
    // Keep the mediator assistant from .env
    if (process.env.OPENAI_ASSISTANT_ID) {
      console.log(`[Demo Seed] AI Mediator configured: ${process.env.OPENAI_ASSISTANT_ID}`);
    } else {
      console.warn("[Demo Seed] OPENAI_ASSISTANT_ID is not set. AI mediation will not work.");
    }
    
    // Set Jordan's assistant ID for user responses
    const jordanAssistantId = 'asst_NaNyg64IlU3rbkA9kdldzZJC';
    console.log(`[Demo Seed] Jordan (AI User) configured: ${jordanAssistantId}`);

    // 6. Redirect with the demo user ID (Alex) and session
    console.log('[Demo Seed] Setting up redirect...');
    const url = new URL(`/demo/${newChat.id}`, req.url);
    
    const response = NextResponse.redirect(url, 302);
    
    // Set a cookie with the demo user info (Alex)
    response.cookies.set('demo_user', JSON.stringify({
      id: user1.id,
      name: user1.display_name,
    }));
    console.log('[Demo Seed] Redirecting to:', url.toString());
    console.log('[Demo Seed] Demo user (Michael) will be able to chat with Jordan via AI mediation');

    return response;

  } catch (error: any) {
    console.error('[Demo Seed] Failed to seed demo chat:', error);
    console.error('[Demo Seed] Error details:', {
      message: error?.message,
      stack: error?.stack,
      cause: error?.cause,
      name: error?.name,
      code: error?.code
    });
    
    // Return a proper error response instead of hanging
    return NextResponse.json({ 
      error: 'Failed to seed demo chat',
      details: error?.message || 'Unknown error'
    }, { status: 500 });
  }
}