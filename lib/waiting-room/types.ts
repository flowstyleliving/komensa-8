/**
 * Waiting Room Types and Interfaces
 * Centralized type definitions for the waiting room system
 */

export interface WaitingRoomAnswers {
  // Basic intro
  name: string;
  
  // Context questions
  whatBroughtYouHere: string;
  hopeToAccomplish: string;
  currentFeeling: string;
  
  // Communication preferences
  communicationStyle: 'direct' | 'gentle' | 'curious' | 'supportive';
  topicsToAvoid?: string;
  
  // Ready state
  isReady: boolean;
}

export interface ChatReadinessState {
  chatId: string;
  hostAnswers?: WaitingRoomAnswers;
  guestAnswers?: WaitingRoomAnswers;
  bothReady: boolean;
  initiatedAt?: string;
}

export interface ParticipantStatus {
  type: 'host' | 'guest';
  isReady: boolean;
  hasAnswers: boolean;
  name: string;
  userId: string;
}

export interface WaitingRoomStatus {
  currentUser: ParticipantStatus;
  otherUser: ParticipantStatus;
  bothReady: boolean;
  chatInitiated: boolean;
}

export interface WaitingRoomProgressStatus {
  chatId: string;
  guestName?: string;
  hostName?: string;
  status: 'setup_starting' | 'turn_management' | 'ai_welcome' | 'notifications' | 'ready' | 'failed';
  progress: number; // 0-100
  timestamp: string;
  error?: string;
}

export type UserType = 'host' | 'guest'; 