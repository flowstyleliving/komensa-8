import { redis } from '@/lib/redis';
import { WaitingRoomService } from '@/lib/waiting-room';

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
  await redis.setex(key, 300, JSON.stringify(status)); // 5 minute expiry
}

/**
 * Get waiting room status for a user
 */
export async function getWaitingRoomStatus(userId: string): Promise<WaitingRoomStatus | null> {
  const key = `${WAITING_ROOM_PREFIX}${userId}`;
  const data = await redis.get(key);
  return data ? JSON.parse(data as string) : null;
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
  }) as string); // 10 minute expiry
}

/**
 * Check if both participants are ready for the chat - now using database
 */
export async function areBothParticipantsReady(chatId: string): Promise<{
  ready: boolean;
  hostReady: boolean;
  guestReady: boolean;
  participants?: string[];
}> {
  try {
    // Use the database-backed function to check readiness
    const readinessState = await WaitingRoomService.getReadinessState(chatId);
    
    const hostReady = !!readinessState.hostAnswers?.isReady;
    const guestReady = !!readinessState.guestAnswers?.isReady;
    const ready = readinessState.bothReady;

    // Get participant user IDs from the database
    const { prisma } = await import('@/lib/prisma');
    const participants = await prisma.chatParticipant.findMany({
      where: { chat_id: chatId },
      select: { user_id: true }
    });

    return {
      ready,
      hostReady,
      guestReady,
      participants: participants.map(p => p.user_id)
    };
  } catch (error) {
    console.error('Error checking participant readiness:', error);
    return { ready: false, hostReady: false, guestReady: false };
  }
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