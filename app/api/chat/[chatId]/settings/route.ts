import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { RealtimeEventService } from '@/features/chat/services/RealtimeEventService';
import { TurnManager } from '@/features/chat/services/turnManager';

// Helper function to create system message for turn style changes
async function createTurnStyleSystemMessage(
  chatId: string, 
  userId: string, 
  previousStyle: string, 
  newStyle: string
) {
  try {
    // Get user's display name
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { display_name: true, name: true }
    });

    const userName = user?.display_name || user?.name || 'Someone';

    // Turn style descriptions
    const styleDescriptions = {
      flexible: 'Flexible Turns - Anyone can speak anytime',
      strict: 'Strict Turns - Round-robin with AI facilitating each exchange', 
      moderated: 'AI Moderated - AI manages conversation flow',
      rounds: 'Round System - Turn-based with AI responding after complete rounds'
    };

    const systemMessage = `${userName} changed the conversation style from "${styleDescriptions[previousStyle as keyof typeof styleDescriptions] || previousStyle}" to "${styleDescriptions[newStyle as keyof typeof styleDescriptions] || newStyle}".`;

    // Create system message in database
    const newMessage = await prisma.event.create({
      data: {
        chat_id: chatId,
        type: 'system_message',
        data: { 
          content: systemMessage,
          senderId: 'system',
          messageType: 'turn_style_change',
          previousStyle,
          newStyle,
          changedBy: userId
        }
      }
    });

    // Broadcast via centralized service
    const realtimeService = new RealtimeEventService(chatId);
    await realtimeService.broadcastMessage({
      id: newMessage.id,
      created_at: newMessage.created_at.toISOString(),
      data: (newMessage.data ?? { content: '', senderId: '' }) as { content: string; senderId: string; }
    });

    console.log(`[System Message] Turn style change message sent for chat ${chatId}: ${previousStyle} → ${newStyle}`);
  } catch (error) {
    console.error('[System Message] Failed to create turn style system message:', error);
  }
}

// GET: Fetch chat settings
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  try {
    const { chatId } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user has access to this chat
    const chat = await prisma.chat.findFirst({
      where: {
        id: chatId,
        participants: {
          some: {
            user_id: session.user.id
          }
        }
      },
      select: { settings: true }
    });

    if (!chat) {
      return NextResponse.json({ error: 'Chat not found or access denied' }, { status: 404 });
    }

    // Default settings
    const defaultSettings = {
      turnStyle: 'flexible'
    };

    const settings = { ...defaultSettings, ...((chat.settings as any) || {}) };

    return NextResponse.json(settings);
  } catch (error) {
    console.error('[Chat Settings API] Error fetching settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH: Update chat settings
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  try {
    const { chatId } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const body = await req.json();

    // Verify user has access to this chat
    const chat = await prisma.chat.findFirst({
      where: {
        id: chatId,
        participants: {
          some: {
            user_id: session.user.id
          }
        }
      }
    });

    if (!chat) {
      return NextResponse.json({ error: 'Chat not found or access denied' }, { status: 404 });
    }

    // Validate turn style if provided
    if (body.turnStyle && !['flexible', 'strict', 'moderated', 'rounds'].includes(body.turnStyle)) {
      return NextResponse.json({ error: 'Invalid turn style' }, { status: 400 });
    }

    // Update settings
    const currentSettings = (chat.settings as any) || {};
    const newSettings = { ...currentSettings, ...body };
    const previousTurnStyle = currentSettings.turnStyle || 'flexible';

    // Update both the chat settings and the turn_taking field for consistency
    const updatedChat = await prisma.chat.update({
      where: { id: chatId },
      data: { 
        settings: newSettings,
        turn_taking: body.turnStyle || 'flexible'
      },
      select: { settings: true }
    });

    // Initialize turn state if switching to strict/rounds mode
    if (body.turnStyle && body.turnStyle !== previousTurnStyle) {
      if (body.turnStyle === 'strict' || body.turnStyle === 'rounds') {
        console.log(`[Chat Settings] Initializing ${body.turnStyle} turn mode for chat ${chatId}`);
        
        try {
          const turnManager = new TurnManager(chatId);
          
          // Get participants in order (sorted for consistency)
          const participants = await prisma.chatParticipant.findMany({
            where: { chat_id: chatId },
            select: { user_id: true },
            orderBy: { user_id: 'asc' } // Sort for consistent ordering
          });
          
          const participantIds = participants.map(p => p.user_id);
          
          if (participantIds.length > 0) {
            // Initialize turn state with first participant
            await prisma.chatTurnState.upsert({
              where: { chat_id: chatId },
              update: {
                next_user_id: participantIds[0],
                next_role: 'user',
                turn_queue: participantIds,
                current_turn_index: 0,
                updated_at: new Date()
              },
              create: {
                chat_id: chatId,
                next_user_id: participantIds[0],
                next_role: 'user',
                turn_queue: participantIds,
                current_turn_index: 0
              }
            });
            
            console.log(`[Chat Settings] Turn state initialized - first turn: ${participantIds[0]}`);
            
            // Broadcast turn update
            const realtimeService = new RealtimeEventService(chatId);
            await realtimeService.broadcastTurnUpdate({
              next_user_id: participantIds[0],
              next_role: 'user',
              timestamp: new Date().toISOString()
            });
          }
        } catch (turnError) {
          console.error(`[Chat Settings] Failed to initialize turn state:`, turnError);
        }
      }
      
      // Create system message for turn style change
      await createTurnStyleSystemMessage(chatId, session.user.id, previousTurnStyle, body.turnStyle);
    }

    console.log(`[Chat Settings API] Updated settings for chat ${chatId}:`, newSettings);

    return NextResponse.json(updatedChat.settings);
  } catch (error) {
    console.error('[Chat Settings API] Error updating settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}