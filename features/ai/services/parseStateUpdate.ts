import { prisma } from '@/lib/prisma';

interface StateUpdate {
  feelings: string[];
  needs: string[];
  viewpoints: string[];
}

export async function parseStateUpdate(
  chatId: string,
  userId: string,
  message: string
): Promise<void> {
  // Look for STATE_UPDATE_JSON block at the end of the message
  const stateUpdateMatch = message.match(/STATE_UPDATE_JSON:\s*(\{[\s\S]*\})/);
  if (!stateUpdateMatch) {
    return;
  }

  try {
    const stateUpdate = JSON.parse(stateUpdateMatch[1]) as StateUpdate;

    // Update participant state in database
    await prisma.participantState.upsert({
      where: {
        chat_id_user_id: {
          chat_id: chatId,
          user_id: userId,
        },
      },
      create: {
        chat_id: chatId,
        user_id: userId,
        feelings: stateUpdate.feelings,
        needs: stateUpdate.needs,
        viewpoints: stateUpdate.viewpoints,
      },
      update: {
        feelings: stateUpdate.feelings,
        needs: stateUpdate.needs,
        viewpoints: stateUpdate.viewpoints,
      },
    });

    // Create an event to track the state update
    await prisma.event.create({
      data: {
        chat_id: chatId,
        type: 'participant_state',
        data: {
          userId,
          ...stateUpdate,
        },
      },
    });
  } catch (error) {
    console.error('Failed to parse state update:', error);
  }
}

export async function parseStateUpdateAndCleanMessage(
  chatId: string,
  userId: string,
  message: string
): Promise<string> {
  // First, parse and save the state update
  await parseStateUpdate(chatId, userId, message);

  // Then, remove the STATE_UPDATE_JSON from the message for display
  const cleanedMessage = message.replace(/\s*STATE_UPDATE_JSON:\s*\{[\s\S]*\}\s*$/, '').trim();
  
  console.log('[parseStateUpdate] Original message length:', message.length);
  console.log('[parseStateUpdate] Cleaned message length:', cleanedMessage.length);
  
  return cleanedMessage;
}
