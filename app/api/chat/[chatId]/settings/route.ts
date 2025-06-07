import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { pusherServer, getChatChannelName, PUSHER_EVENTS } from '@/lib/pusher';

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
      strict: 'Strict Turns - One person speaks at a time', 
      moderated: 'AI Moderated - AI manages conversation flow'
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

    // Broadcast via Pusher
    const channelName = getChatChannelName(chatId);
    await pusherServer.trigger(channelName, PUSHER_EVENTS.NEW_MESSAGE, {
      id: newMessage.id,
      created_at: newMessage.created_at.toISOString(),
      data: newMessage.data
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
    if (body.turnStyle && !['flexible', 'strict', 'moderated'].includes(body.turnStyle)) {
      return NextResponse.json({ error: 'Invalid turn style' }, { status: 400 });
    }

    // Update settings
    const currentSettings = (chat.settings as any) || {};
    const newSettings = { ...currentSettings, ...body };
    const previousTurnStyle = currentSettings.turnStyle || 'flexible';

    const updatedChat = await prisma.chat.update({
      where: { id: chatId },
      data: { settings: newSettings },
      select: { settings: true }
    });

    // Create system message if turn style changed
    if (body.turnStyle && body.turnStyle !== previousTurnStyle) {
      await createTurnStyleSystemMessage(chatId, session.user.id, previousTurnStyle, body.turnStyle);
    }

    console.log(`[Chat Settings API] Updated settings for chat ${chatId}:`, newSettings);

    return NextResponse.json(updatedChat.settings);
  } catch (error) {
    console.error('[Chat Settings API] Error updating settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}