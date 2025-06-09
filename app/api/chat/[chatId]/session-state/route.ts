// Unified chat session state API endpoint
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { ChatSessionStateManager } from '@/features/chat/services/ChatSessionStateManager';

// GET: Fetch complete chat session state
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

    // Guest access validation
    if (session.user.isGuest && session.user.chatId !== chatId) {
      return NextResponse.json({ 
        error: 'Access denied - guests can only access their invited chat' 
      }, { status: 403 });
    }

    console.log(`[Session State API] Fetching state for chat ${chatId}, user ${session.user.id}`);

    // Get unified state through ChatSessionStateManager
    const stateManager = new ChatSessionStateManager(chatId);
    
    // Check if user has access to this chat (through participants)
    const participant = await stateManager.getParticipant(session.user.id);
    if (!participant) {
      return NextResponse.json({ 
        error: 'Chat not found or access denied' 
      }, { status: 404 });
    }

    // Force fresh state if requested
    const forceFresh = req.nextUrl.searchParams.get('forceFresh') === 'true';
    const state = await stateManager.getState(forceFresh);

    // Add user-specific context
    const responseData = {
      ...state,
      userContext: {
        userId: session.user.id,
        canSendMessage: await stateManager.canUserSendMessage(session.user.id),
        isGuest: session.user.isGuest || false,
        participant: participant
      },
      typingUsers: Array.from(state.typingUsers), // Convert Set to Array for JSON
      completionStatus: {
        ...state.completionStatus,
        completed_users: Array.from(state.completionStatus.completed_users),
        completion_types: Object.fromEntries(state.completionStatus.completion_types)
      }
    };

    console.log(`[Session State API] State fetched successfully for chat ${chatId}`);
    return NextResponse.json(responseData);

  } catch (error) {
    console.error('[Session State API] Error fetching session state:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

// PATCH: Update specific parts of session state
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

    // Guest access validation
    if (session.user.isGuest && session.user.chatId !== chatId) {
      return NextResponse.json({ 
        error: 'Access denied - guests can only access their invited chat' 
      }, { status: 403 });
    }

    const body = await req.json();
    const { updateType, data } = body;

    console.log(`[Session State API] Updating state for chat ${chatId}: ${updateType}`);

    const stateManager = new ChatSessionStateManager(chatId);

    // Check user access
    const participant = await stateManager.getParticipant(session.user.id);
    if (!participant) {
      return NextResponse.json({ 
        error: 'Chat not found or access denied' 
      }, { status: 404 });
    }

    let updatedData: any = {};

    switch (updateType) {
      case 'settings':
        await stateManager.updateSettings(data);
        updatedData = { settings: data };
        break;

      case 'completion':
        const completionStatus = await stateManager.updateCompletionStatus(
          session.user.id, 
          data.completionType || 'natural'
        );
        updatedData = { completionStatus };
        break;

      case 'typing':
        await stateManager.updateTypingState(
          session.user.id,
          data.isTyping
        );
        updatedData = { typing: { userId: session.user.id, isTyping: data.isTyping } };
        break;

      case 'turnState':
        // Only allow certain users to update turn state (could add role checking)
        await stateManager.updateTurnState(data);
        updatedData = { turnState: data };
        break;

      default:
        return NextResponse.json({ 
          error: `Unknown update type: ${updateType}` 
        }, { status: 400 });
    }

    console.log(`[Session State API] State updated successfully: ${updateType}`);
    return NextResponse.json({ 
      success: true, 
      updateType,
      data: updatedData,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[Session State API] Error updating session state:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

// POST: Perform state operations (like adding messages, participants)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  try {
    const { chatId } = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Guest access validation
    if (session.user.isGuest && session.user.chatId !== chatId) {
      return NextResponse.json({ 
        error: 'Access denied - guests can only access their invited chat' 
      }, { status: 403 });
    }

    const body = await req.json();
    const { operation, data } = body;

    console.log(`[Session State API] Performing operation for chat ${chatId}: ${operation}`);

    const stateManager = new ChatSessionStateManager(chatId);

    // Check user access
    const participant = await stateManager.getParticipant(session.user.id);
    if (!participant) {
      return NextResponse.json({ 
        error: 'Chat not found or access denied' 
      }, { status: 404 });
    }

    let result: any = {};

    switch (operation) {
      case 'addMessage':
        // Check if user can send message
        const canSend = await stateManager.canUserSendMessage(session.user.id);
        if (!canSend) {
          return NextResponse.json({ 
            error: 'Not your turn to speak' 
          }, { status: 403 });
        }

        const message = await stateManager.addMessage({
          content: data.content,
          senderId: session.user.id,
          type: data.type || 'message'
        });
        result = { message };
        break;

      case 'addParticipant':
        // Could add permission checking here
        await stateManager.addParticipant(data.userId, data.role || 'user');
        result = { participantAdded: data.userId };
        break;

      case 'refreshState':
        // Force refresh the state cache
        const refreshedState = await stateManager.getState(true);
        result = { state: refreshedState };
        break;

      default:
        return NextResponse.json({ 
          error: `Unknown operation: ${operation}` 
        }, { status: 400 });
    }

    console.log(`[Session State API] Operation completed successfully: ${operation}`);
    return NextResponse.json({ 
      success: true, 
      operation,
      result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[Session State API] Error performing operation:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}