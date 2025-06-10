/**
 * Waiting Room Database Service
 * Pure database operations for waiting room functionality
 */

import { prisma } from '@/lib/prisma';
import { WaitingRoomAnswers, UserType } from './types';

export class WaitingRoomDatabaseService {
  /**
   * Store participant answers in database
   */
  static async storeAnswers(
    chatId: string,
    userId: string,
    answers: WaitingRoomAnswers
  ): Promise<void> {
    await prisma.waitingRoomAnswers.upsert({
      where: {
        chat_id_user_id: {
          chat_id: chatId,
          user_id: userId
        }
      },
      update: {
        name: answers.name,
        what_brought_you_here: answers.whatBroughtYouHere,
        hope_to_accomplish: answers.hopeToAccomplish,
        current_feeling: answers.currentFeeling,
        communication_style: answers.communicationStyle,
        topics_to_avoid: answers.topicsToAvoid || null,
        is_ready: answers.isReady,
        submitted_at: new Date()
      },
      create: {
        chat_id: chatId,
        user_id: userId,
        name: answers.name,
        what_brought_you_here: answers.whatBroughtYouHere,
        hope_to_accomplish: answers.hopeToAccomplish,
        current_feeling: answers.currentFeeling,
        communication_style: answers.communicationStyle,
        topics_to_avoid: answers.topicsToAvoid || null,
        is_ready: answers.isReady,
        submitted_at: new Date()
      }
    });
  }

  /**
   * Get participant answers by user ID
   */
  static async getAnswersByUserId(
    chatId: string,
    userId: string
  ): Promise<WaitingRoomAnswers | null> {
    const answers = await prisma.waitingRoomAnswers.findUnique({
      where: {
        chat_id_user_id: {
          chat_id: chatId,
          user_id: userId
        }
      }
    });

    if (!answers) return null;

    return {
      name: answers.name,
      whatBroughtYouHere: answers.what_brought_you_here,
      hopeToAccomplish: answers.hope_to_accomplish,
      currentFeeling: answers.current_feeling,
      communicationStyle: answers.communication_style as WaitingRoomAnswers['communicationStyle'],
      topicsToAvoid: answers.topics_to_avoid || undefined,
      isReady: answers.is_ready
    };
  }

  /**
   * Get participant answers by user type (host/guest)
   */
  static async getAnswersByUserType(
    chatId: string,
    userType: UserType
  ): Promise<WaitingRoomAnswers | null> {
    // Get the participant record to find the user_id for this user type
    const participant = await prisma.chatParticipant.findFirst({
      where: {
        chat_id: chatId,
        user: {
          // Determine user type based on whether they're a guest user
          ...(userType === 'guest' 
            ? { email: { contains: '@guest' } }
            : { email: { not: { contains: '@guest' } } })
        }
      },
      include: {
        user: true
      }
    });

    if (!participant) return null;

    return this.getAnswersByUserId(chatId, participant.user_id);
  }

  /**
   * Get all participants for a chat
   */
  static async getChatParticipants(chatId: string) {
    return prisma.chatParticipant.findMany({
      where: { chat_id: chatId },
      include: { user: true }
    });
  }

  /**
   * Mark chat as initiated
   */
  static async markChatInitiated(chatId: string): Promise<void> {
    await Promise.all([
      // Update chat status
      prisma.chat.update({
        where: { id: chatId },
        data: { status: 'active' }
      }),
      // Add initiation event
      prisma.event.create({
        data: {
          chat_id: chatId,
          type: 'chat_initiated',
          data: {
            initiated_at: new Date().toISOString(),
            initiated_by: 'waiting_room'
          }
        }
      })
    ]);
  }

  /**
   * Check if chat has been initiated
   */
  static async isChatInitiated(chatId: string): Promise<boolean> {
    const initiationEvent = await prisma.event.findFirst({
      where: {
        chat_id: chatId,
        type: 'chat_initiated'
      }
    });
    
    return !!initiationEvent;
  }

  /**
   * Get participant user type
   */
  static async getParticipantUserType(chatId: string, userId: string): Promise<UserType | null> {
    const participant = await prisma.chatParticipant.findFirst({
      where: {
        chat_id: chatId,
        user_id: userId
      },
      include: { user: true }
    });

    if (!participant) return null;

    return participant.user.email?.includes('@guest') ? 'guest' : 'host';
  }
} 