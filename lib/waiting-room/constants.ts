/**
 * Waiting Room Constants
 * Form questions and options for the waiting room interface
 */

export interface WaitingRoomQuestion {
  id: keyof import('./types').WaitingRoomAnswers;
  question: string;
  type: 'text' | 'textarea' | 'select';
  placeholder?: string;
  required: boolean;
  options?: string[];
}

export const DEFAULT_QUESTIONS: WaitingRoomQuestion[] = [
  {
    id: 'whatBroughtYouHere',
    question: 'What brought you to this conversation today?',
    type: 'textarea',
    placeholder: 'Share what led to this moment...',
    required: true
  },
  {
    id: 'hopeToAccomplish',
    question: 'What do you hope to accomplish?',
    type: 'textarea',
    placeholder: 'Describe your goals for this conversation...',
    required: true
  },
  {
    id: 'currentFeeling',
    question: 'How are you feeling right now?',
    type: 'text',
    placeholder: 'Describe your current emotional state...',
    required: true
  },
  {
    id: 'communicationStyle',
    question: 'What communication style works best for you?',
    type: 'select',
    required: true,
    options: [
      'direct - I prefer clear, straightforward communication',
      'gentle - I appreciate softer, more considerate approaches',
      'curious - I like exploring ideas through questions',
      'supportive - I value encouragement and validation'
    ]
  },
  {
    id: 'topicsToAvoid',
    question: 'Are there any topics or approaches you\'d prefer to avoid?',
    type: 'textarea',
    placeholder: 'Optional: Let us know if there are sensitive areas...',
    required: false
  }
]; 