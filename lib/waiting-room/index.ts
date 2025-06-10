/**
 * Waiting Room Module
 * Centralized exports for all waiting room functionality
 */

// Types
export * from './types';

// Constants
export * from './constants';

// Services
export { WaitingRoomService } from './service';
export { WaitingRoomDatabaseService } from './database-service';

// Utilities
export { generateMediatorIntroPrompt } from './prompt-generator';

// Legacy compatibility exports (deprecated - use WaitingRoomService instead)
export { WaitingRoomService as WaitingRoomQuestions } from './service'; 