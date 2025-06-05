import Pusher from 'pusher';
import PusherClient from 'pusher-js';

// Server-side Pusher instance
export const pusherServer = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.PUSHER_CLUSTER!,
  useTLS: true,
});

// Client-side Pusher instance with mobile-optimized settings
export const pusherClient = new PusherClient(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
  forceTLS: true,
  // Mobile-optimized settings
  activityTimeout: 120000, // 2 minutes before considering connection inactive
  pongTimeout: 30000, // 30 seconds timeout for pong
  unavailableTimeout: 10000, // 10 seconds before considering unavailable
  // Enable automatic reconnection for mobile
  enabledTransports: ['ws', 'wss'],
  disabledTransports: [], // Allow all transports for better mobile compatibility
});

// Add connection state monitoring for mobile debugging
if (typeof window !== 'undefined') {
  pusherClient.connection.bind('connected', () => {
    console.log('[Pusher] Connected successfully');
  });
  
  pusherClient.connection.bind('disconnected', () => {
    console.log('[Pusher] Disconnected');
  });
  
  pusherClient.connection.bind('failed', () => {
    console.error('[Pusher] Connection failed');
  });
  
  pusherClient.connection.bind('unavailable', () => {
    console.warn('[Pusher] Connection unavailable');
  });
  
  pusherClient.connection.bind('error', (error: any) => {
    console.error('[Pusher] Connection error:', error);
  });
}

// Helper function to get channel name for a chat
export const getChatChannelName = (chatId: string) => `chat-${chatId}`;

// Event types
export const PUSHER_EVENTS = {
  ASSISTANT_TYPING: 'assistant-typing',
  ASSISTANT_TOKEN: 'assistant-token', 
  USER_TYPING: 'user-typing',
  NEW_MESSAGE: 'new-message',
  TURN_UPDATE: 'turn-update',
  STATE_UPDATE: 'state-update',
  COMPLETION_UPDATE: 'completion-update',
  COMPLETION_READY: 'completion-ready',
} as const; 