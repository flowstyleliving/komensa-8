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
  
  return `You are an AI mediator facilitating a meaningful conversation between two people who are meeting for the first time. You have access to their preparation answers and should weave them together to create a personalized, natural opening.

PARTICIPANT CONTEXT:

${hostAnswers.name} (Host):
- What brought them: "${hostAnswers.whatBroughtYouHere}"
- Hope to accomplish: "${hostAnswers.hopeToAccomplish}"
- Current feeling: "${hostAnswers.currentFeeling}"
- Communication style: ${hostStyle}${hostTopicsToAvoid}

${guestAnswers.name} (Guest):
- What brought them: "${guestAnswers.whatBroughtYouHere}"  
- Hope to accomplish: "${guestAnswers.hopeToAccomplish}"
- Current feeling: "${guestAnswers.currentFeeling}"
- Communication style: ${guestStyle}${guestTopicsToAvoid}

INSTRUCTIONS:
Write a personalized welcome message that:

1. **Welcome by name** - Address both ${hostAnswers.name} and ${guestAnswers.name} warmly
2. **Acknowledge their preparation** - Reference that they've both shared their intentions thoughtfully
3. **Weave their motivations** - Find connections between what brought each person here and what they hope to accomplish
4. **Honor their feelings** - Acknowledge their current emotional states with empathy
5. **Set communication tone** - Adapt your language to honor both their preferred styles (${hostStyle} and ${guestStyle})
6. **Suggest natural starting point** - Based on their shared or complementary intentions, offer a gentle way to begin
7. **Create psychological safety** - Make it clear this is a judgment-free space

STYLE GUIDELINES:
- Keep it under 200 words
- Use their exact names 
- Be conversational and warm, not formal
- Reference their specific motivations (don't be generic)
- Make it feel like the conversation naturally flows from their preparation
- End with an open, inviting question that connects to their shared intentions

Remember: This isn't just a generic welcome - it's a personalized bridge from their individual preparation to their shared conversation.`;
}

/**
 * Store participant answers in database
 */
export async function storeParticipantAnswers(
  chatId: string, 
  userId: string, 
  userType: 'host' | 'guest',
  answers: WaitingRoomQuestions
): Promise<void> {
  const { prisma } = await import('@/lib/prisma');
  
  await prisma.waitingRoomAnswers.upsert({
    where: {
      chat_id_user_id: {
        chat_id: chatId,
        user_id: userId
      }
    },
    update: {
      name: answers.name,
      what_brought_you_here: answers.whatBroughtYouHere,
      hope_to_accomplish: answers.hopeToAccomplish,
      current_feeling: answers.currentFeeling,
      communication_style: answers.communicationStyle,
      topics_to_avoid: answers.topicsToAvoid || null,
      is_ready: answers.isReady,
      submitted_at: new Date()
    },
    create: {
      chat_id: chatId,
      user_id: userId,
      name: answers.name,
      what_brought_you_here: answers.whatBroughtYouHere,
      hope_to_accomplish: answers.hopeToAccomplish,
      current_feeling: answers.currentFeeling,
      communication_style: answers.communicationStyle,
      topics_to_avoid: answers.topicsToAvoid || null,
      is_ready: answers.isReady,
      submitted_at: new Date()
    }
  });
}

/**
 * Get participant answers from database
 */
export async function getParticipantAnswers(
  chatId: string, 
  userType: 'host' | 'guest'
): Promise<WaitingRoomQuestions | null> {
  const { prisma } = await import('@/lib/prisma');
  
  // Get the participant record to find the user_id for this user type
  const participant = await prisma.chatParticipant.findFirst({
    where: {
      chat_id: chatId,
      user: {
        // Determine user type based on whether they're a guest user
        ...(userType === 'guest' 
          ? { email: { contains: '@guest' } }  // Guest users have special email format
          : { email: { not: { contains: '@guest' } } }) // Host users don't
      }
    },
    include: {
      user: true
    }
  });

  if (!participant) {
    return null;
  }

  const answers = await prisma.waitingRoomAnswers.findUnique({
    where: {
      chat_id_user_id: {
        chat_id: chatId,
        user_id: participant.user_id
      }
    }
  });

  if (!answers) {
    return null;
  }

  return {
    name: answers.name,
    whatBroughtYouHere: answers.what_brought_you_here,
    hopeToAccomplish: answers.hope_to_accomplish,
    currentFeeling: answers.current_feeling,
    communicationStyle: answers.communication_style as 'direct' | 'gentle' | 'curious' | 'supportive',
    topicsToAvoid: answers.topics_to_avoid || undefined,
    isReady: answers.is_ready
  };
}

/**
 * Get participant answers by user ID directly
 */
export async function getParticipantAnswersByUserId(
  chatId: string, 
  userId: string
): Promise<WaitingRoomQuestions | null> {
  const { prisma } = await import('@/lib/prisma');
  
  const answers = await prisma.waitingRoomAnswers.findUnique({
    where: {
      chat_id_user_id: {
        chat_id: chatId,
        user_id: userId
      }
    }
  });

  if (!answers) {
    return null;
  }

  return {
    name: answers.name,
    whatBroughtYouHere: answers.what_brought_you_here,
    hopeToAccomplish: answers.hope_to_accomplish,
    currentFeeling: answers.current_feeling,
    communicationStyle: answers.communication_style as 'direct' | 'gentle' | 'curious' | 'supportive',
    topicsToAvoid: answers.topics_to_avoid || undefined,
    isReady: answers.is_ready
  };
}

/**
 * Check if both participants have completed their answers and are ready
 */
export async function checkChatReadiness(chatId: string): Promise<ChatReadinessState> {
  const { prisma } = await import('@/lib/prisma');
  
  // Get all participants for this chat
  const participants = await prisma.chatParticipant.findMany({
    where: { chat_id: chatId },
    include: { user: true }
  });

  // Identify host and guest based on user properties
  const hostParticipant = participants.find(p => !p.user.email?.includes('@guest'));
  const guestParticipant = participants.find(p => p.user.email?.includes('@guest'));

  // Get answers for each participant
  const [hostAnswers, guestAnswers] = await Promise.all([
    hostParticipant ? getParticipantAnswersByUserId(chatId, hostParticipant.user_id) : Promise.resolve(null),
    guestParticipant ? getParticipantAnswersByUserId(chatId, guestParticipant.user_id) : Promise.resolve(null)
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
 * Mark chat as initiated in the database
 */
export async function markChatInitiated(chatId: string): Promise<void> {
  const { prisma } = await import('@/lib/prisma');
  
  // Update chat status to indicate it's been initiated
  await prisma.chat.update({
    where: { id: chatId },
    data: { 
      status: 'active'  // or add a specific field for initiated status
    }
  });
  
  // Optional: Add an event to track initiation
  await prisma.event.create({
    data: {
      chat_id: chatId,
      type: 'chat_initiated',
      data: {
        initiated_at: new Date().toISOString(),
        initiated_by: 'waiting_room'
      }
    }
  });
}

/**
 * Check if chat has been initiated
 */
export async function checkChatInitiated(chatId: string): Promise<boolean> {
  const { prisma } = await import('@/lib/prisma');
  
  // Check for chat initiation event
  const initiationEvent = await prisma.event.findFirst({
    where: {
      chat_id: chatId,
      type: 'chat_initiated'
    }
  });
  
  return !!initiationEvent;
} 