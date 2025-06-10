/**
 * Waiting Room Prompt Generator
 * Generates AI prompts based on participant answers
 */

import { WaitingRoomAnswers } from './types';

export function generateMediatorIntroPrompt(
  hostAnswers: WaitingRoomAnswers,
  guestAnswers: WaitingRoomAnswers
): string {
  const hostStyle = hostAnswers.communicationStyle.split(' - ')[0];
  const guestStyle = guestAnswers.communicationStyle.split(' - ')[0];
  
  const hostTopicsToAvoid = hostAnswers.topicsToAvoid ? ` They've mentioned being mindful of: ${hostAnswers.topicsToAvoid}.` : '';
  const guestTopicsToAvoid = guestAnswers.topicsToAvoid ? ` They've mentioned being mindful of: ${guestAnswers.topicsToAvoid}.` : '';
  
  return `You are an AI mediator facilitating a meaningful conversation between two people who are meeting to find understanding and connection. You have access to their preparation answers and should weave them together to create a personalized, natural opening.

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
6. **Create psychological safety** - Make it clear this is a judgment-free space

STYLE GUIDELINES:
- Keep it under 200 words
- Use their exact names 
- Be conversational and warm, not formal
- Reference their specific motivations (don't be generic)
- Make it feel like the conversation naturally flows from their preparation
- End with an open, inviting question that connects to their shared intentions

Remember: This isn't just a generic welcome - it's a personalized bridge from their individual preparation to their shared conversation.`;
} 