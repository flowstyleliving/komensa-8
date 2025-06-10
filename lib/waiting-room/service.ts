/**
 * Waiting Room Service
 * Business logic layer for waiting room functionality
 */

import { WaitingRoomDatabaseService } from './database-service';
import { WaitingRoomAnswers, ChatReadinessState, WaitingRoomStatus, UserType } from './types';
import { generateMediatorIntroPrompt } from './prompt-generator';

export class WaitingRoomService {
  /**
   * Submit participant answers
   */
  static async submitAnswers(
    chatId: string,
    userId: string,
    answers: WaitingRoomAnswers
  ): Promise<void> {
    await WaitingRoomDatabaseService.storeAnswers(chatId, userId, answers);
  }

  /**
   * Get readiness state for a chat
   */
  static async getReadinessState(chatId: string): Promise<ChatReadinessState> {
    const [hostAnswers, guestAnswers] = await Promise.all([
      WaitingRoomDatabaseService.getAnswersByUserType(chatId, 'host'),
      WaitingRoomDatabaseService.getAnswersByUserType(chatId, 'guest')
    ]);

    const bothReady = !!(hostAnswers?.isReady && guestAnswers?.isReady);

    return {
      chatId,
      hostAnswers: hostAnswers || undefined,
      guestAnswers: guestAnswers || undefined,
      bothReady
    };
  }

  /**
   * Get waiting room status for a specific user
   */
  static async getWaitingRoomStatus(
    chatId: string,
    currentUserId: string
  ): Promise<WaitingRoomStatus> {
    const [participants, currentUserAnswers, chatInitiated] = await Promise.all([
      WaitingRoomDatabaseService.getChatParticipants(chatId),
      WaitingRoomDatabaseService.getAnswersByUserId(chatId, currentUserId),
      WaitingRoomDatabaseService.isChatInitiated(chatId)
    ]);

    const currentUserType = await WaitingRoomDatabaseService.getParticipantUserType(chatId, currentUserId);
    const otherParticipant = participants.find(p => p.user_id !== currentUserId);
    
    let otherUserAnswers = null;
    if (otherParticipant) {
      otherUserAnswers = await WaitingRoomDatabaseService.getAnswersByUserId(chatId, otherParticipant.user_id);
    }

    return {
      currentUser: {
        type: currentUserType || 'host',
        isReady: currentUserAnswers?.isReady || false,
        hasAnswers: !!currentUserAnswers,
        name: currentUserAnswers?.name || 'You',
        userId: currentUserId
      },
      otherUser: {
        type: currentUserType === 'host' ? 'guest' : 'host',
        isReady: otherUserAnswers?.isReady || false,
        hasAnswers: !!otherUserAnswers,
        name: otherUserAnswers?.name || otherParticipant?.user.name || 'Other participant',
        userId: otherParticipant?.user_id || ''
      },
      bothReady: !!(currentUserAnswers?.isReady && otherUserAnswers?.isReady),
      chatInitiated
    };
  }

  /**
   * Initiate chat when both participants are ready
   */
  static async initiateChatIfReady(chatId: string): Promise<{
    initiated: boolean;
    aiIntroduction?: string;
    error?: string;
  }> {
    try {
      const readinessState = await this.getReadinessState(chatId);
      
      if (!readinessState.bothReady) {
        return { initiated: false };
      }

      // Check if already initiated
      const alreadyInitiated = await WaitingRoomDatabaseService.isChatInitiated(chatId);
      if (alreadyInitiated) {
        return { initiated: true };
      }

      // Generate AI introduction
      let aiIntroduction = '';
      if (readinessState.hostAnswers && readinessState.guestAnswers) {
        const prompt = generateMediatorIntroPrompt(
          readinessState.hostAnswers,
          readinessState.guestAnswers
        );

        try {
          const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'gpt-4',
              messages: [{ role: 'system', content: prompt }],
              max_tokens: 250,
              temperature: 0.8,
            }),
          });

          if (aiResponse.ok) {
            const aiData = await aiResponse.json();
            aiIntroduction = aiData.choices?.[0]?.message?.content || '';
          }
        } catch (aiError) {
          console.error('Failed to generate AI introduction:', aiError);
          // Continue without AI introduction
        }
      }

      // Mark chat as initiated
      await WaitingRoomDatabaseService.markChatInitiated(chatId);

      return {
        initiated: true,
        aiIntroduction
      };

    } catch (error) {
      console.error('Error initiating chat:', error);
      return {
        initiated: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Check if user is authorized to access waiting room
   */
  static async isUserAuthorized(chatId: string, userId: string): Promise<boolean> {
    const participants = await WaitingRoomDatabaseService.getChatParticipants(chatId);
    return participants.some(p => p.user_id === userId);
  }
} 