import { prisma } from '@/lib/prisma';
import type { Event } from '@prisma/client';

interface ParticipantState {
  userId: string;
  feelings: string[];
  needs: string[];
  viewpoints: string[];
}

interface MessageData {
  content: string;
}

export async function parseStateUpdate(message: Event): Promise<void> {
  if (!message.data) return;

  const data = message.data as unknown as MessageData;
  if (!data.content) return;

  // Look for state updates in the message content
  const stateMatch = data.content.match(/\[STATE\]([\s\S]*?)\[\/STATE\]/);
  if (!stateMatch) return;

  try {
    const stateData = JSON.parse(stateMatch[1]) as ParticipantState[];
    
    // Update participant states in the database
    await Promise.all(
      stateData.map(async ({ userId, feelings, needs, viewpoints }) => {
        await prisma.participantState.upsert({
          where: {
            chat_id_user_id: {
              chat_id: message.chat_id,
              user_id: userId,
            },
          },
          create: {
            chat_id: message.chat_id,
            user_id: userId,
            feelings,
            needs,
            viewpoints,
          },
          update: {
            feelings,
            needs,
            viewpoints,
          },
        });
      })
    );
  } catch (error) {
    console.error('Error parsing state update:', error);
  }
} 