// Demo-related constants and utilities

export const DEMO_CONSTANTS = {
  AI_RESPONSE_THRESHOLD: 3,
  USER_A_DISPLAY_NAME: 'User A',
  PARTNER_DISPLAY_NAME: 'Jordan',
  MEDIATOR_DISPLAY_NAME: 'AI Mediator'
} as const;

/**
 * Detects if the current session is a demo chat
 */
export function isDemoChat(): boolean {
  if (typeof window === 'undefined') return false;
  
  return (
    window.location.search.includes('demo=true') ||
    document.cookie.includes('demo_user=')
  );
}

/**
 * Gets demo user information from cookie
 */
export function getDemoUser(): { id: string; name: string } | null {
  if (typeof document === 'undefined') return null;
  
  const demoUserCookie = document.cookie
    .split('; ')
    .find(row => row.startsWith('demo_user='))
    ?.split('=')[1];
  
  if (demoUserCookie) {
    try {
      return JSON.parse(decodeURIComponent(demoUserCookie));
    } catch (e) {
      console.error('Failed to parse demo user cookie:', e);
    }
  }
  
  return null;
}

/**
 * Counts AI responses in a list of messages
 */
export function countAIResponses(messages: any[]): number {
  return messages.filter(msg => msg.data?.senderId === 'assistant').length;
} 