import { redis } from '@/lib/redis';

export interface WaitingRoomStatus {
  chatId: string;
  guestName?: string;
  hostName?: string;
  status: 'setup_starting' | 'turn_management' | 'ai_welcome' | 'notifications' | 'ready' | 'failed';
  progress: number; // 0-100
  timestamp: string;
  error?: string;
}

const WAITING_ROOM_PREFIX = 'waiting_room:';
const CHAT_READY_PREFIX = 'chat_ready:';

/**
 * Set waiting room status for a user
 */
export async function setWaitingRoomStatus(userId: string, status: WaitingRoomStatus): Promise<void> {
  const key = `${WAITING_ROOM_PREFIX}${userId}`;
  await redis.setex(key, 300, JSON.stringify(status) as any); // 5 minute expiry
}

/**
 * Get waiting room status for a user
 */
export async function getWaitingRoomStatus(userId: string): Promise<WaitingRoomStatus | null> {
  const key = `${WAITING_ROOM_PREFIX}${userId}`;
  const data = await redis.get(key);
  return data ? JSON.parse(data) : null;
}

/**
 * Mark a participant as ready for the chat
 */
export async function markParticipantReady(chatId: string, userId: string, userType: 'host' | 'guest'): Promise<void> {
  const key = `${CHAT_READY_PREFIX}${chatId}:${userId}`;
  await redis.setex(key, 600, JSON.stringify({ 
    userId, 
    userType, 
    readyAt: new Date().toISOString() 
  })); // 10 minute expiry
}

/**
 * Check if both participants are ready for the chat
 */
export async function areBothParticipantsReady(chatId: string): Promise<{
  ready: boolean;
  hostReady: boolean;
  guestReady: boolean;
  participants?: string[];
}> {
  // Get all ready participants for this chat
  const pattern = `${CHAT_READY_PREFIX}${chatId}:*`;
  const keys = await redis.keys(pattern);
  
  if (keys.length === 0) {
    return { ready: false, hostReady: false, guestReady: false };
  }

  // Get each participant's data individually 
  const participantPromises = keys.map(key => redis.get(key));
  const participants = await Promise.all(participantPromises);
  const readyParticipants = participants
    .filter(p => p !== null)
    .map(p => JSON.parse(p as string));

  const hostReady = readyParticipants.some(p => p.userType === 'host');
  const guestReady = readyParticipants.some(p => p.userType === 'guest');
  const ready = hostReady && guestReady;

  return {
    ready,
    hostReady,
    guestReady,
    participants: readyParticipants.map(p => p.userId)
  };
}

/**
 * Clear waiting room status for a user
 */
export async function clearWaitingRoomStatus(userId: string): Promise<void> {
  const key = `${WAITING_ROOM_PREFIX}${userId}`;
  await redis.del(key);
}

/**
 * Update waiting room progress
 */
export async function updateWaitingRoomProgress(
  userId: string, 
  status: WaitingRoomStatus['status'], 
  progress: number,
  error?: string
): Promise<void> {
  const currentStatus = await getWaitingRoomStatus(userId);
  if (currentStatus) {
    await setWaitingRoomStatus(userId, {
      ...currentStatus,
      status,
      progress,
      error,
      timestamp: new Date().toISOString()
    });
  }
} 