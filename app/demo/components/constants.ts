// Demo-related constants and configuration

export const DEMO_CONSTANTS = {
  // Modal thresholds
  AI_RESPONSE_THRESHOLD: 3,        // Show first demo modal after 1 AI response (for testing)
  CALENDLY_THRESHOLD: 5,           // Show Calendly modal after 2 AI responses (for testing)
  
  // User display names
  USER_A_DISPLAY_NAME: 'Michael',
  PARTNER_DISPLAY_NAME: 'Jordan',
  MEDIATOR_DISPLAY_NAME: 'AI Mediator',
  
  // Calendly configuration
  CALENDLY_URL: 'https://calendly.com/msrkittty-proton/15min', // TODO: Replace with your actual Calendly link
  
  // Demo detection
  DEMO_URL_PARAM: 'demo=true',
  DEMO_COOKIE_NAME: 'demo_user'
} as const;

export type DemoConstants = typeof DEMO_CONSTANTS; 

//