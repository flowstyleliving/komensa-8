// Demo-related constants and utilities

import { DEMO_CONSTANTS } from '@/components/demo/constants';

// Cache demo detection result to avoid repeated checks
let demoDetectionCache: boolean | null = null;

/**
 * Efficiently detect if the current session is a demo
 * Uses caching to avoid repeated URL/cookie parsing
 */
export function isDemoSession(): boolean {
  // Return cached result if available
  if (demoDetectionCache !== null) {
    return demoDetectionCache;
  }

  // Server-side rendering check
  if (typeof window === 'undefined') {
    demoDetectionCache = false;
    return false;
  }

  // Check URL parameters and cookies
  const urlHasDemo = window.location.search.includes(DEMO_CONSTANTS.DEMO_URL_PARAM);
  const cookieHasDemo = document.cookie.includes(DEMO_CONSTANTS.DEMO_COOKIE_NAME);
  
  demoDetectionCache = urlHasDemo || cookieHasDemo;
  return demoDetectionCache;
}

/**
 * Reset demo detection cache (useful for testing or when demo state changes)
 */
export function resetDemoDetection(): void {
  demoDetectionCache = null;
}

/**
 * Set demo mode programmatically
 */
export function setDemoMode(isDemo: boolean): void {
  demoDetectionCache = isDemo;
  
  if (isDemo && typeof window !== 'undefined') {
    // Set demo cookie for persistence
    document.cookie = `${DEMO_CONSTANTS.DEMO_COOKIE_NAME}=true; path=/; max-age=86400`; // 24 hours
  }
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