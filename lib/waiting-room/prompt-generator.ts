/**
 * Waiting Room Prompt Generator
 * Generates AI prompts based on participant answers
 */

import { WaitingRoomAnswers } from './types';

export function generateMediatorIntroPrompt(
  hostAnswers: WaitingRoomAnswers,
  guestAnswers: WaitingRoomAnswers
): string {
  return `You are an AI mediator facilitating a conversation between ${hostAnswers.name} and ${guestAnswers.name}.

Host (${hostAnswers.name}):
- What brought them here: ${hostAnswers.whatBroughtYouHere}
- Hope to accomplish: ${hostAnswers.hopeToAccomplish}
- Current feeling: ${hostAnswers.currentFeeling}
- Communication style: ${hostAnswers.communicationStyle}
${hostAnswers.topicsToAvoid ? `- Topics to avoid: ${hostAnswers.topicsToAvoid}` : ''}

Guest (${guestAnswers.name}):
- What brought them here: ${guestAnswers.whatBroughtYouHere}
- Hope to accomplish: ${guestAnswers.hopeToAccomplish}
- Current feeling: ${guestAnswers.currentFeeling}
- Communication style: ${guestAnswers.communicationStyle}
${guestAnswers.topicsToAvoid ? `- Topics to avoid: ${guestAnswers.topicsToAvoid}` : ''}

Create a warm, personalized introduction that acknowledges both participants' goals and feelings. Set a supportive tone for productive dialogue. Keep it concise (2-3 sentences max).`;
} 