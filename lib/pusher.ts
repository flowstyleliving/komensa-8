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
  let reconnectAttempts = 0;
  const maxReconnectAttempts = 3;
  
  pusherClient.connection.bind('connected', () => {
    console.log('[Pusher] Connected successfully');
    reconnectAttempts = 0; // Reset on successful connection
  });
  
  pusherClient.connection.bind('disconnected', () => {
    console.log('[Pusher] Disconnected');
  });
  
  pusherClient.connection.bind('failed', () => {
    console.error('[Pusher] Connection failed');
    
    // Mobile-specific: Attempt manual reconnection
    if (reconnectAttempts < maxReconnectAttempts) {
      reconnectAttempts++;
      console.log(`[Pusher] Attempting manual reconnection ${reconnectAttempts}/${maxReconnectAttempts}`);
      
      setTimeout(() => {
        try {
          pusherClient.connect();
        } catch (error) {
          console.error('[Pusher] Manual reconnection failed:', error);
        }
      }, 3000 + (reconnectAttempts * 2000)); // Exponential backoff
    }
  });
  
  pusherClient.connection.bind('unavailable', () => {
    console.warn('[Pusher] Connection unavailable');
  });
  
  pusherClient.connection.bind('error', (error: any) => {
    console.error('[Pusher] Connection error:', error);
  });
  
  // Mobile-specific: Check connection state on visibility change and WebSocket suspension recovery
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      const state = pusherClient.connection.state;
      console.log(`[Pusher] App became visible, connection state: ${state}`);
      
      // Handle WebSocket suspension on mobile Safari
      if (state === 'disconnected' || state === 'failed' || state === 'unavailable') {
        console.log('[Pusher] Detected suspended/disconnected state, forcing reconnection...');
        setTimeout(() => {
          try {
            // Force disconnect first to clear any stuck state
            pusherClient.disconnect();
            setTimeout(() => {
              pusherClient.connect();
              console.log('[Pusher] Forced reconnection after visibility change');
            }, 500);
          } catch (error) {
            console.error('[Pusher] Error during forced reconnection:', error);
          }
        }, 1000);
      }
    }
  });
  
  // Mobile Safari WebSocket suspension handling
  document.addEventListener('resume', () => {
    console.log('[Pusher] App resumed from suspension, checking connection...');
    const state = pusherClient.connection.state;
    if (state !== 'connected') {
      console.log(`[Pusher] Not connected after resume (${state}), forcing reconnection...`);
      pusherClient.disconnect();
      setTimeout(() => pusherClient.connect(), 1000);
    }
  });
  
  // Handle page focus (additional mobile support)
  window.addEventListener('focus', () => {
    const state = pusherClient.connection.state;
    if (state !== 'connected') {
      console.log(`[Pusher] Focus event - not connected (${state}), attempting reconnection...`);
      pusherClient.disconnect();
      setTimeout(() => pusherClient.connect(), 500);
    }
  });
  
  // Mobile-specific: Periodic connection health check
  setInterval(() => {
    const state = pusherClient.connection.state;
    if (state === 'failed' || state === 'unavailable') {
      console.log(`[Pusher] Connection health check: ${state}, attempting recovery...`);
      if (reconnectAttempts < maxReconnectAttempts) {
        reconnectAttempts++;
        pusherClient.connect();
      }
    }
  }, 60000); // Check every minute
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
  PARTICIPANT_JOINED: 'participant-joined',
  USER_PRESENCE: 'user-presence',
} as const; 