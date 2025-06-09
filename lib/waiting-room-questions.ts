export interface WaitingRoomQuestions {
  // Basic intro
  name: string;
  
  // Context questions
  whatBroughtYouHere: string;
  hopeToAccomplish: string;
  currentFeeling: string;
  
  // Communication preferences
  communicationStyle: 'direct' | 'gentle' | 'curious' | 'supportive';
  topicsToAvoid?: string;
  
  // Ready state
  isReady: boolean;
}

export interface ChatReadinessState {
  chatId: string;
  hostAnswers?: WaitingRoomQuestions;
  guestAnswers?: WaitingRoomQuestions;
  bothReady: boolean;
  initiatedAt?: string;
}

export const DEFAULT_QUESTIONS: Array<{
  id: keyof Omit<WaitingRoomQuestions, 'name' | 'isReady'>;
  question: string;
  type: 'text' | 'select' | 'textarea';
  options?: string[];
  placeholder?: string;
  required: boolean;
}> = [
  {
    id: 'whatBroughtYouHere',
    question: 'What brought you to this conversation today?',
    type: 'textarea',
    placeholder: 'Share what motivated you to join this dialogue...',
    required: true
  },
  {
    id: 'hopeToAccomplish',
    question: 'What do you hope to accomplish or discover in this conversation?',
    type: 'textarea', 
    placeholder: 'Describe your goals or intentions...',
    required: true
  },
  {
    id: 'currentFeeling',
    question: 'How are you feeling right now as we begin?',
    type: 'text',
    placeholder: 'e.g., curious, nervous, excited, open...',
    required: true
  },
  {
    id: 'communicationStyle',
    question: 'What communication style helps you feel most comfortable?',
    type: 'select',
    options: [
      'direct - I appreciate straightforward, honest communication',
      'gentle - I prefer a softer, more careful approach to sensitive topics', 
      'curious - I like exploring ideas through questions and wondering together',
      'supportive - I value encouragement and validation in difficult conversations'
    ],
    required: true
  },
  {
    id: 'topicsToAvoid',
    question: 'Are there any topics you\'d prefer to avoid or approach carefully?',
    type: 'text',
    placeholder: 'Optional - any sensitive areas to be mindful of...',
    required: false
  }
];

/**
 * Generate AI mediator opening message based on participant answers
 */
export function generateMediatorIntroPrompt(hostAnswers: WaitingRoomQuestions, guestAnswers: WaitingRoomQuestions): string {
  const hostStyle = hostAnswers.communicationStyle.split(' - ')[0];
  const guestStyle = guestAnswers.communicationStyle.split(' - ')[0];
  
  const hostTopicsToAvoid = hostAnswers.topicsToAvoid ? ` They've mentioned being mindful of: ${hostAnswers.topicsToAvoid}.` : '';
  const guestTopicsToAvoid = guestAnswers.topicsToAvoid ? ` They've mentioned being mindful of: ${guestAnswers.topicsToAvoid}.` : '';
  
  return `You are an AI mediator facilitating a meaningful conversation between two people who are meeting for the first time.

PARTICIPANT INFORMATION:

Host (${hostAnswers.name}):
- What brought them here: ${hostAnswers.whatBroughtYouHere}
- What they hope to accomplish: ${hostAnswers.hopeToAccomplish}
- Current feeling: ${hostAnswers.currentFeeling}
- Preferred communication style: ${hostStyle}${hostTopicsToAvoid}

Guest (${guestAnswers.name}):
- What brought them here: ${guestAnswers.whatBroughtYouHere}
- What they hope to accomplish: ${guestAnswers.hopeToAccomplish}
- Current feeling: ${guestAnswers.currentFeeling}
- Preferred communication style: ${guestStyle}${guestTopicsToAvoid}

YOUR TASK:
Create a warm, thoughtful opening message that:
1. Welcomes both participants by name
2. Acknowledges what brought each person here (weaving their motivations together)
3. Highlights any common ground or complementary intentions
4. Sets a tone that honors both their communication preferences
5. Gently suggests a starting point for their conversation that builds on their shared interests
6. Creates psychological safety by acknowledging their current feelings

Keep it conversational, warm, and under 200 words. Focus on connection over agenda.`;
}

/**
 * Store participant answers in Redis
 */
export async function storeParticipantAnswers(
  chatId: string, 
  userId: string, 
  userType: 'host' | 'guest',
  answers: WaitingRoomQuestions
): Promise<void> {
  const { redis } = await import('@/lib/redis');
  const key = `waiting_room_answers:${chatId}:${userType}`;
  await redis.setex(key, 1800, JSON.stringify(answers)); // 30 minute expiry
}

/**
 * Get participant answers from Redis
 */
export async function getParticipantAnswers(
  chatId: string, 
  userType: 'host' | 'guest'
): Promise<WaitingRoomQuestions | null> {
  const { redis } = await import('@/lib/redis');
  const key = `waiting_room_answers:${chatId}:${userType}`;
  const data = await redis.get(key);
  return data ? JSON.parse(data as string) : null;
}

/**
 * Check if both participants have completed their answers and are ready
 */
export async function checkChatReadiness(chatId: string): Promise<ChatReadinessState> {
  const [hostAnswers, guestAnswers] = await Promise.all([
    getParticipantAnswers(chatId, 'host'),
    getParticipantAnswers(chatId, 'guest')
  ]);
  
  const bothReady = !!(
    hostAnswers?.isReady && 
    guestAnswers?.isReady
  );
  
  return {
    chatId,
    hostAnswers: hostAnswers || undefined,
    guestAnswers: guestAnswers || undefined,
    bothReady
  };
}

/**
 * Mark chat as initiated and clear waiting room data
 */
export async function markChatInitiated(chatId: string): Promise<void> {
  const { redis } = await import('@/lib/redis');
  const hostKey = `waiting_room_answers:${chatId}:host`;
  const guestKey = `waiting_room_answers:${chatId}:guest`;
  
  // Mark as initiated
  await redis.setex(`chat_initiated:${chatId}`, 3600, new Date().toISOString());
  
  // Clear waiting room data (optional - could keep for analytics)
  // await redis.del(hostKey, guestKey);
} 