// GPT CONTEXT:
// This file converts chat state (feelings, needs, recent messages) into a structured prompt for the AI.
// Related modules: /features/ai/generateAIReply.ts, /lib/prisma.ts
// Do NOT handle AI streaming or Redis here.

import { prisma } from '@/lib/prisma';
import type { Event } from '@prisma/client';

export async function formatStateForPrompt({
  chatId,
  userId,
  userMessage
}: {
  chatId: string;
  userId: string;
  userMessage: string;
}): Promise<string> {
  const [participantStates, recentEvents, participants] = await Promise.all([
    prisma.event.findMany({
      where: {
        chat_id: chatId,
        type: 'participant_state'
      },
      orderBy: { created_at: 'desc' },
      take: 10
    }),
    prisma.event.findMany({
      where: { chat_id: chatId },
      orderBy: { created_at: 'desc' },
      take: 10
    }),
    prisma.chatParticipant.findMany({
      where: { chat_id: chatId },
      include: { user: true }
    })
  ]);

  const aliasMap: Record<string, string> = {};
  for (const p of participants) {
    const initial = p.user?.display_name?.charAt(0) ?? 'U';
    const role = p.role ?? 'user';
    aliasMap[p.user_id] = `${initial}. (${role})`;
  }

  const views = participantStates.map((ps) => {
    const data = ps.data as any;
    const userId = data.userId || data.user_id;
    const alias = aliasMap[userId] || `User ${userId?.slice(0, 5) || 'Unknown'}`;
    return `${alias}:
- Feels: ${(data.feelings || []).join(', ')}
- Needs: ${(data.needs || []).join(', ')}
- Views: ${(Object.entries(data.viewpoints || {}).map(([k, v]) => `${k}: ${v}`)).join('; ')}`;
  }).join('\n\n');

  const recentText = recentEvents
    .filter(e => e.type === 'message')
    .map(e => {
      const data = e.data as any;
      const senderId = data.senderId;
      const sender = aliasMap[senderId] || 'User';
      return `${sender}: ${data.content || ''}`;
    }).reverse().join('\n');

  const currentUserAlias = aliasMap[userId] || `User ${userId?.slice(0, 5) || 'Unknown'}`;

  return `<Current State>
Participants:
${views}

Recent Messages:
${recentText}

Latest Message:
${currentUserAlias}: ${userMessage}

Instruction:
Respond thoughtfully as a mediator, drawing from the current emotional and conversational state.
</Current State>`;
}