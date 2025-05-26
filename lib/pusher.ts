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

// Client-side Pusher instance
export const pusherClient = new PusherClient(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
});

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
} as const; 