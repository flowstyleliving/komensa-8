/**
 * Database Service Tests
 * Unit tests for waiting room database operations
 */

import { WaitingRoomDatabaseService } from '../database-service';
import { WaitingRoomAnswers } from '../types';

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    waitingRoomAnswers: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    chatParticipant: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    chat: {
      update: jest.fn(),
    },
    event: {
      create: jest.fn(),
      findFirst: jest.fn(),
    },
  },
}));

describe('WaitingRoomDatabaseService', () => {
  const mockChatId = 'test-chat-id';
  const mockUserId = 'test-user-id';
  
  const mockAnswers: WaitingRoomAnswers = {
    name: 'Test User',
    whatBroughtYouHere: 'Testing',
    hopeToAccomplish: 'Complete tests',
    currentFeeling: 'Confident',
    communicationStyle: 'direct',
    topicsToAvoid: 'None',
    isReady: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('storeAnswers', () => {
    it('should store participant answers successfully', async () => {
      const mockPrisma = require('@/lib/prisma').prisma;
      mockPrisma.waitingRoomAnswers.upsert.mockResolvedValue({});

      await WaitingRoomDatabaseService.storeAnswers(mockChatId, mockUserId, mockAnswers);

      expect(mockPrisma.waitingRoomAnswers.upsert).toHaveBeenCalledWith({
        where: {
          chat_id_user_id: {
            chat_id: mockChatId,
            user_id: mockUserId,
          },
        },
        update: expect.objectContaining({
          name: mockAnswers.name,
          what_brought_you_here: mockAnswers.whatBroughtYouHere,
          is_ready: mockAnswers.isReady,
        }),
        create: expect.objectContaining({
          chat_id: mockChatId,
          user_id: mockUserId,
          name: mockAnswers.name,
        }),
      });
    });
  });

  describe('getAnswersByUserId', () => {
    it('should retrieve answers by user ID', async () => {
      const mockPrisma = require('@/lib/prisma').prisma;
      const mockDbResult = {
        name: 'Test User',
        what_brought_you_here: 'Testing',
        hope_to_accomplish: 'Complete tests',
        current_feeling: 'Confident',
        communication_style: 'direct',
        topics_to_avoid: null,
        is_ready: true,
      };

      mockPrisma.waitingRoomAnswers.findUnique.mockResolvedValue(mockDbResult);

      const result = await WaitingRoomDatabaseService.getAnswersByUserId(mockChatId, mockUserId);

      expect(result).toEqual({
        name: 'Test User',
        whatBroughtYouHere: 'Testing',
        hopeToAccomplish: 'Complete tests',
        currentFeeling: 'Confident',
        communicationStyle: 'direct',
        topicsToAvoid: undefined,
        isReady: true,
      });
    });

    it('should return null when no answers found', async () => {
      const mockPrisma = require('@/lib/prisma').prisma;
      mockPrisma.waitingRoomAnswers.findUnique.mockResolvedValue(null);

      const result = await WaitingRoomDatabaseService.getAnswersByUserId(mockChatId, mockUserId);

      expect(result).toBeNull();
    });
  });

  describe('getParticipantUserType', () => {
    it('should identify guest user correctly', async () => {
      const mockPrisma = require('@/lib/prisma').prisma;
      mockPrisma.chatParticipant.findFirst.mockResolvedValue({
        user_id: mockUserId,
        user: { email: 'test@guest.komensa.ai' },
      });

      const result = await WaitingRoomDatabaseService.getParticipantUserType(mockChatId, mockUserId);

      expect(result).toBe('guest');
    });

    it('should identify host user correctly', async () => {
      const mockPrisma = require('@/lib/prisma').prisma;
      mockPrisma.chatParticipant.findFirst.mockResolvedValue({
        user_id: mockUserId,
        user: { email: 'host@example.com' },
      });

      const result = await WaitingRoomDatabaseService.getParticipantUserType(mockChatId, mockUserId);

      expect(result).toBe('host');
    });
  });

  describe('markChatInitiated', () => {
    it('should mark chat as initiated and create event', async () => {
      const mockPrisma = require('@/lib/prisma').prisma;
      mockPrisma.chat.update.mockResolvedValue({});
      mockPrisma.event.create.mockResolvedValue({});

      await WaitingRoomDatabaseService.markChatInitiated(mockChatId);

      expect(mockPrisma.chat.update).toHaveBeenCalledWith({
        where: { id: mockChatId },
        data: { status: 'active' },
      });

      expect(mockPrisma.event.create).toHaveBeenCalledWith({
        data: {
          chat_id: mockChatId,
          type: 'chat_initiated',
          data: expect.objectContaining({
            initiated_by: 'waiting_room',
          }),
        },
      });
    });
  });
}); 