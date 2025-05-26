// Demo-related constants and configuration

export const DEMO_CONSTANTS = {
  // Modal thresholds
  AI_RESPONSE_THRESHOLD: 5,        // Show first demo modal after 5 AI responses
  CALENDLY_THRESHOLD: 7,           // Show Calendly modal after 7 AI responses
  
  // User display names
  USER_A_DISPLAY_NAME: 'User A',
  PARTNER_DISPLAY_NAME: 'Jordan',
  MEDIATOR_DISPLAY_NAME: 'AI Mediator',
  
  // Calendly configuration
  CALENDLY_URL: 'https://calendly.com/msrkittty-proton/25min', // TODO: Replace with your actual Calendly link
  
  // Demo detection
  DEMO_URL_PARAM: 'demo=true',
  DEMO_COOKIE_NAME: 'demo_user'
} as const;

export type DemoConstants = typeof DEMO_CONSTANTS; 