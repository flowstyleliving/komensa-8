import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { WaitingRoomService } from '@/lib/waiting-room';
import { generateMediatorIntroPrompt } from '@/lib/waiting-room';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { chatId } = await params;
    console.log('[AI Intro] Generating introduction for chat:', chatId);

    // Check if user is participant in this chat
    const isAuthorized = await WaitingRoomService.isUserAuthorized(chatId, session.user.id);
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Not a participant' }, { status: 403 });
    }

    // Use Redis to coordinate thinking indicator globally - prevent race conditions
    let thinkingIndicatorOwner = false;
    try {
      const { redis } = await import('@/lib/redis');
      const thinkingKey = `ai-intro-thinking:${chatId}`;
      
      // Try to acquire thinking indicator ownership (expires in 90 seconds)
      const thinkingAcquired = await redis.set(thinkingKey, session.user.id, {
        px: 90000, // 90 second expiration
        nx: true   // Only set if not exists
      });
      
      if (thinkingAcquired) {
        thinkingIndicatorOwner = true;
        console.log('[AI Intro] Acquired thinking indicator ownership');
        
        // Send thinking indicator
        const { pusherServer, getChatChannelName, PUSHER_EVENTS } = await import('@/lib/pusher');
        const channelName = getChatChannelName(chatId);
        
        await pusherServer.trigger(channelName, PUSHER_EVENTS.ASSISTANT_TYPING, {
          isTyping: true,
          chatId
        });
        console.log('[AI Intro] AI thinking indicator sent');
      } else {
        console.log('[AI Intro] Another user is already handling thinking indicator');
      }
    } catch (error) {
      console.error('[AI Intro] Failed to coordinate thinking indicator:', error);
      // Fallback: send thinking indicator anyway
      try {
        const { pusherServer, getChatChannelName, PUSHER_EVENTS } = await import('@/lib/pusher');
        const channelName = getChatChannelName(chatId);
        
        await pusherServer.trigger(channelName, PUSHER_EVENTS.ASSISTANT_TYPING, {
          isTyping: true,
          chatId
        });
        console.log('[AI Intro] AI thinking indicator sent (fallback)');
        thinkingIndicatorOwner = true; // Assume ownership for cleanup
      } catch (fallbackError) {
        console.error('[AI Intro] Failed to send fallback thinking indicator:', fallbackError);
      }
    }

    // Check if introduction already exists or is being generated
    const existingIntro = await prisma.event.findFirst({
      where: {
        chat_id: chatId,
        type: 'message',
        data: {
          path: ['senderId'],
          equals: 'assistant'
        }
      }
    });

    if (existingIntro) {
      console.log('[AI Intro] Introduction already exists');
      
      // Only turn off thinking indicator if we own it
      if (thinkingIndicatorOwner) {
        try {
          const { pusherServer, getChatChannelName, PUSHER_EVENTS } = await import('@/lib/pusher');
          const channelName = getChatChannelName(chatId);
          
          await pusherServer.trigger(channelName, PUSHER_EVENTS.ASSISTANT_TYPING, {
            isTyping: false,
            chatId
          });
          console.log('[AI Intro] AI thinking indicator turned off (intro exists)');
          
          // Release thinking indicator ownership
          const { redis } = await import('@/lib/redis');
          const thinkingKey = `ai-intro-thinking:${chatId}`;
          await redis.del(thinkingKey);
          console.log('[AI Intro] Released thinking indicator ownership');
        } catch (error) {
          console.error('[AI Intro] Failed to turn off AI thinking indicator:', error);
        }
      }
      
      return NextResponse.json({ 
        success: true, 
        message: 'Introduction already exists',
        messageId: existingIntro.id 
      });
    }

    // Use Redis to prevent duplicate generation (race condition handling)
    try {
      const { redis } = await import('@/lib/redis');
      const lockKey = `ai-intro-lock:${chatId}`;
      const lockValue = `${session.user.id}-${Date.now()}`;
      
      // Try to acquire lock (expires in 60 seconds)
      const lockAcquired = await redis.set(lockKey, lockValue, {
        px: 60000, // 60 second expiration
        nx: true   // Only set if not exists
      });
      
      if (!lockAcquired) {
        console.log('[AI Intro] Another process is already generating introduction - waiting for completion');
        // Don't turn off thinking indicator - let the lock holder handle it
        // Just wait and check if intro was created
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const newIntro = await prisma.event.findFirst({
          where: {
            chat_id: chatId,
            type: 'message',
            data: {
              path: ['senderId'],
              equals: 'assistant'
            }
          }
        });
        
        if (newIntro) {
          return NextResponse.json({ 
            success: true, 
            message: 'Introduction created by concurrent request',
            messageId: newIntro.id 
          });
        }
        
        return NextResponse.json({ 
          error: 'Introduction generation in progress' 
        }, { status: 423 }); // 423 Locked
      }
      
      // We have the lock, proceed with generation
      console.log('[AI Intro] Acquired generation lock');
      
    } catch (redisError) {
      console.error('[AI Intro] Redis lock failed, proceeding anyway:', redisError);
      // Continue without lock if Redis fails
    }

    // Get waiting room answers for both participants
    const readinessState = await WaitingRoomService.getReadinessState(chatId);
    
    if (!readinessState.hostAnswers || !readinessState.guestAnswers) {
      console.log('[AI Intro] Missing waiting room answers');
      return NextResponse.json({ 
        error: 'Missing waiting room preparation data' 
      }, { status: 400 });
    }

    console.log('[AI Intro] Found waiting room answers, generating prompt...');

    // Generate AI introduction
    const prompt = generateMediatorIntroPrompt(
      readinessState.hostAnswers,
      readinessState.guestAnswers
    );

    let aiIntroduction = '';

    try {
      console.log('[AI Intro] Calling OpenAI API...');
      const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [{ role: 'system', content: prompt }],
          max_tokens: 250,
          temperature: 0.8,
        }),
      });

      if (aiResponse.ok) {
        const aiData = await aiResponse.json();
        aiIntroduction = aiData.choices?.[0]?.message?.content || '';
        console.log('[AI Intro] AI response received, length:', aiIntroduction.length);
      } else {
        console.error('[AI Intro] AI API returned error status:', aiResponse.status);
      }
    } catch (aiError) {
      console.error('[AI Intro] Failed to generate AI introduction:', aiError);
    }

    // If AI generation failed, create a personalized fallback message
    if (!aiIntroduction) {
      console.log('[AI Intro] Using fallback message');
      aiIntroduction = `Hello ${readinessState.hostAnswers.name} and ${readinessState.guestAnswers.name}! 

Welcome to your conversation space. I can see you've both taken time to thoughtfully prepare for this dialogue.

${readinessState.hostAnswers.name}, you shared that ${readinessState.hostAnswers.whatBroughtYouHere.toLowerCase()}, and you're hoping to ${readinessState.hostAnswers.hopeToAccomplish.toLowerCase()}.

${readinessState.guestAnswers.name}, you mentioned that ${readinessState.guestAnswers.whatBroughtYouHere.toLowerCase()}, with the goal to ${readinessState.guestAnswers.hopeToAccomplish.toLowerCase()}.

I'm here to help facilitate a meaningful exchange between you both. This is a safe space where you can share authentically and listen with curiosity.

To begin, perhaps you could each share a bit more about what brought you here today and what you're hoping our conversation might accomplish?`;
    }

    // Save AI introduction to database
    const messageEvent = await prisma.event.create({
      data: {
        chat_id: chatId,
        type: 'message',
        data: {
          content: aiIntroduction,
          senderId: 'assistant'
        }
      }
    });

    console.log('[AI Intro] Message saved to database:', messageEvent.id);

    // Send AI message via Pusher
    try {
      const { pusherServer, getChatChannelName, PUSHER_EVENTS } = await import('@/lib/pusher');
      const channelName = getChatChannelName(chatId);
      
      await pusherServer.trigger(channelName, PUSHER_EVENTS.NEW_MESSAGE, {
        id: messageEvent.id,
        created_at: messageEvent.created_at.toISOString(),
        data: {
          content: aiIntroduction,
          senderId: 'assistant'
        }
      });
      
      console.log('[AI Intro] Message sent via Pusher');
    } catch (pusherError) {
      console.error('[AI Intro] Failed to send message via Pusher:', pusherError);
    }

    // Turn off AI thinking indicator (only if we own it)
    if (thinkingIndicatorOwner) {
      try {
        const { pusherServer, getChatChannelName, PUSHER_EVENTS } = await import('@/lib/pusher');
        const channelName = getChatChannelName(chatId);
        
        await pusherServer.trigger(channelName, PUSHER_EVENTS.ASSISTANT_TYPING, {
          isTyping: false,
          chatId
        });
        console.log('[AI Intro] AI thinking indicator turned off');
      } catch (error) {
        console.error('[AI Intro] Failed to turn off AI thinking indicator:', error);
      }
    }

    // Release Redis locks
    try {
      const { redis } = await import('@/lib/redis');
      
      // Release generation lock
      const lockKey = `ai-intro-lock:${chatId}`;
      await redis.del(lockKey);
      console.log('[AI Intro] Released generation lock');
      
      // Release thinking indicator ownership (if we own it)
      if (thinkingIndicatorOwner) {
        const thinkingKey = `ai-intro-thinking:${chatId}`;
        await redis.del(thinkingKey);
        console.log('[AI Intro] Released thinking indicator ownership');
      }
    } catch (redisError) {
      console.error('[AI Intro] Failed to release Redis locks:', redisError);
    }

    return NextResponse.json({
      success: true,
      messageId: messageEvent.id,
      content: aiIntroduction
    });

  } catch (error) {
    console.error('[AI Intro] Error generating introduction:', error);
    
    const { chatId } = await params;
    
    // Turn off thinking indicator on error (only if we own it)
    // Note: We need to check if thinkingIndicatorOwner exists in this scope
    try {
      // For error cases, we'll always try to turn off thinking indicator as a safety measure
      const { pusherServer, getChatChannelName, PUSHER_EVENTS } = await import('@/lib/pusher');
      const channelName = getChatChannelName(chatId);
      
      await pusherServer.trigger(channelName, PUSHER_EVENTS.ASSISTANT_TYPING, {
        isTyping: false,
        chatId
      });
      console.log('[AI Intro] AI thinking indicator turned off on error');
    } catch (pusherError) {
      console.error('[AI Intro] Failed to turn off thinking indicator on error:', pusherError);
    }
    
    // Release all Redis locks on error
    try {
      const { redis } = await import('@/lib/redis');
      
      // Release generation lock
      const lockKey = `ai-intro-lock:${chatId}`;
      await redis.del(lockKey);
      console.log('[AI Intro] Released generation lock on error');
      
      // Release thinking indicator ownership
      const thinkingKey = `ai-intro-thinking:${chatId}`;
      await redis.del(thinkingKey);
      console.log('[AI Intro] Released thinking indicator ownership on error');
    } catch (redisError) {
      console.error('[AI Intro] Failed to release Redis locks on error:', redisError);
    }

    return NextResponse.json(
      { error: 'Failed to generate introduction' },
      { status: 500 }
    );
  }
} 