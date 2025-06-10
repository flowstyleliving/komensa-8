/**
 * Enhanced Mediator Context Service
 * Builds rich, mediation-focused context for AI responses
 */

import { prisma } from '@/lib/prisma';

export interface MediationContext {
  conversationPhase: 'opening' | 'exploration' | 'understanding' | 'resolution' | 'closing';
  emotionalState: {
    participant1: 'calm' | 'frustrated' | 'defensive' | 'open' | 'withdrawn';
    participant2: 'calm' | 'frustrated' | 'defensive' | 'open' | 'withdrawn';
  };
  communicationPatterns: {
    turnBalance: number; // ratio of participation
    interruptionCount: number;
    questionAskedCount: number;
    validationGivenCount: number;
  };
  topicFocus: string[];
  breakthroughMoments: string[];
  tensionPoints: string[];
}

export class EnhancedMediatorContextService {
  
  /**
   * Analyze conversation dynamics and build mediator context
   */
  async buildMediatorContext(chatId: string): Promise<string> {
    const messages = await this.getRecentMessages(chatId);
    const participants = await this.getParticipants(chatId);
    const context = await this.analyzeDynamics(messages, participants);
    
    return this.formatMediatorPrompt(context, messages, participants);
  }

  private async getRecentMessages(chatId: string) {
    return await prisma.event.findMany({
      where: { 
        chat_id: chatId,
        type: 'message'
      },
      orderBy: { created_at: 'desc' },
      take: 15
    });
  }

  private async getParticipants(chatId: string) {
    return await prisma.chatParticipant.findMany({
      where: { chat_id: chatId },
      include: { user: true }
    });
  }

  private async analyzeDynamics(messages: any[], participants: any[]): Promise<MediationContext> {
    const humanParticipants = participants.filter(p => p.user_id !== 'assistant');
    
    // Analyze turn balance
    const messageCounts = humanParticipants.map(p => ({
      userId: p.user_id,
      count: messages.filter(m => m.data.senderId === p.user_id).length
    }));
    
    const turnBalance = messageCounts.length > 1 ? 
      messageCounts[0].count / (messageCounts[1].count || 1) : 1;

    // Detect emotional indicators in recent messages
    const emotionalState = this.detectEmotionalStates(messages, humanParticipants);
    
    // Identify conversation phase
    const conversationPhase = this.identifyConversationPhase(messages);
    
    // Track communication patterns
    const patterns = this.analyzeCommunicationPatterns(messages);

    return {
      conversationPhase,
      emotionalState,
      communicationPatterns: {
        turnBalance,
        ...patterns
      },
      topicFocus: this.extractTopics(messages),
      breakthroughMoments: this.identifyBreakthroughs(messages),
      tensionPoints: this.identifyTensionPoints(messages)
    };
  }

  private detectEmotionalStates(messages: any[], participants: any[]) {
    // Analyze language patterns for emotional indicators
    const emotionalIndicators = {
      frustrated: ['annoyed', 'tired of', 'always', 'never', 'ridiculous'],
      defensive: ['but', 'however', 'actually', 'you said', 'thats not'],
      open: ['i understand', 'i see', 'that makes sense', 'tell me more'],
      withdrawn: ['fine', 'whatever', 'i guess', 'maybe', 'i dont know']
    };

    const result: any = {};
    
    participants.forEach((p, index) => {
      const userMessages = messages
        .filter(m => m.data.senderId === p.user_id)
        .slice(0, 3) // Recent messages
        .map(m => m.data.content.toLowerCase());
      
      let dominantEmotion = 'calm';
      let maxScore = 0;
      
      Object.entries(emotionalIndicators).forEach(([emotion, indicators]) => {
        const score = indicators.reduce((sum, indicator) => {
          return sum + userMessages.reduce((msgSum, msg) => 
            msgSum + (msg.includes(indicator) ? 1 : 0), 0);
        }, 0);
        
        if (score > maxScore) {
          maxScore = score;
          dominantEmotion = emotion;
        }
      });
      
      result[`participant${index + 1}`] = dominantEmotion;
    });

    return result;
  }

  private identifyConversationPhase(messages: any[]): MediationContext['conversationPhase'] {
    const messageCount = messages.length;
    const recentContent = messages.slice(0, 5).map(m => m.data.content).join(' ').toLowerCase();
    
    if (messageCount < 5) return 'opening';
    if (recentContent.includes('understand') || recentContent.includes('agree')) return 'understanding';
    if (recentContent.includes('solution') || recentContent.includes('next step')) return 'resolution';
    if (messageCount > 20) return 'closing';
    
    return 'exploration';
  }

  private analyzeCommunicationPatterns(messages: any[]) {
    const recentMessages = messages.slice(0, 10);
    
    return {
      interruptionCount: 0, // Would need real-time analysis
      questionAskedCount: recentMessages.filter(m => 
        m.data.content.includes('?')).length,
      validationGivenCount: recentMessages.filter(m => 
        m.data.content.toLowerCase().includes('understand') ||
        m.data.content.toLowerCase().includes('see your point')).length
    };
  }

  private extractTopics(messages: any[]): string[] {
    // Simple keyword extraction - could be enhanced with NLP
    const commonWords = messages
      .slice(0, 10)
      .map(m => m.data.content)
      .join(' ')
      .toLowerCase()
      .split(' ')
      .filter(word => word.length > 4)
      .slice(0, 5);
    
    return [...new Set(commonWords)];
  }

  private identifyBreakthroughs(messages: any[]): string[] {
    const breakthroughWords = ['realize', 'understand now', 'i see', 'makes sense', 'good point'];
    
    return messages
      .filter(m => breakthroughWords.some(word => 
        m.data.content.toLowerCase().includes(word)))
      .map(m => m.data.content)
      .slice(0, 3);
  }

  private identifyTensionPoints(messages: any[]): string[] {
    const tensionWords = ['disagree', 'wrong', 'thats not true', 'ridiculous', 'frustrated'];
    
    return messages
      .filter(m => tensionWords.some(word => 
        m.data.content.toLowerCase().includes(word)))
      .map(m => m.data.content)
      .slice(0, 3);
  }

  private formatMediatorPrompt(context: MediationContext, messages: any[], participants: any[]): string {
    const participantNames = participants
      .filter(p => p.user_id !== 'assistant')
      .map(p => p.user?.display_name || 'Participant');

    return `You are Komensa, an experienced mediator facilitating this conversation.

CURRENT CONVERSATION DYNAMICS:
- Phase: ${context.conversationPhase}
- Emotional State: ${participantNames[0]} appears ${context.emotionalState.participant1}, ${participantNames[1]} appears ${context.emotionalState.participant2}
- Turn Balance: ${context.communicationPatterns.turnBalance.toFixed(1)} (1.0 = equal participation)
- Questions Asked Recently: ${context.communicationPatterns.questionAskedCount}
- Validation Given: ${context.communicationPatterns.validationGivenCount}

${context.breakthroughMoments.length > 0 ? `
BREAKTHROUGH MOMENTS OBSERVED:
${context.breakthroughMoments.map(moment => `- "${moment}"`).join('\n')}
` : ''}

${context.tensionPoints.length > 0 ? `
TENSION POINTS TO ADDRESS:
${context.tensionPoints.map(point => `- "${point}"`).join('\n')}
` : ''}

MEDIATION FOCUS AREAS:
${context.topicFocus.map(topic => `- ${topic}`).join('\n')}

RECENT CONVERSATION:
${messages.slice(0, 6).reverse().map(m => {
  const sender = m.data.senderId === 'assistant' ? 'You (Mediator)' : 
    participants.find(p => p.user_id === m.data.senderId)?.user?.display_name || 'Participant';
  return `${sender}: ${m.data.content}`;
}).join('\n')}

As Komensa, respond with your next mediation intervention. Consider:
1. The current emotional dynamics
2. The conversation phase
3. Any imbalances in participation
4. Opportunities to build understanding
5. Your role as a skilled mediator who helps people find common ground

Your response should feel like it comes from an experienced professional who deeply understands human dynamics.`;
  }
} 