// Demo-related constants and configuration

export const DEMO_CONSTANTS = {
  // Modal thresholds
  USER_A_RESPONSE_THRESHOLD: 3,    // Show Calendly modal after 3 User A responses
  
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