/**
 * Enhanced Mediator Context Service
 * Leverages existing Prisma schema to build rich conversation context for AI mediator
 */

import { prisma } from "@/lib/prisma";

export interface MediatorContext {
  chatId: string;
  conversationPhase: "opening" | "building" | "exploring" | "resolving" | "closing";
  messagesSinceLastMediator: number;
  
  participants: ParticipantContext[];
  currentSpeaker: string;
  participantBalance: {
    [userId: string]: {
      messageCount: number;
      lastSpokeAt: Date;
      emotionalState: string;
    };
  };
  
  conversationFlow: {
    topics: string[];
    engagementLevel: "low" | "medium" | "high";
    conflictLevel: "low" | "medium" | "high";
  };
  
  waitingRoomContext: {
    [userId: string]: {
      motivation: string;
      hopes: string;
      currentFeeling: string;
      communicationStyle: string;
      topicsToAvoid?: string;
    };
  };
  
  suggestedActions: string[];
  conversationGoals: string[];
}

interface ParticipantContext {
  id: string;
  name: string;
  role: string;
  currentState?: {
    feelings: string[];
    needs: string[];
    viewpoints: string[];
  };
}

export class EnhancedMediatorContextService {
  
  async buildMediatorContext(chatId: string): Promise<MediatorContext> {
    const [
      chat,
      participants,
      recentEvents,
      participantStates,
      waitingRoomAnswers,
      turnState
    ] = await Promise.all([
      prisma.chat.findUnique({
        where: { id: chatId },
        select: { mediator_style: true, status: true, created_at: true }
      }),
      prisma.chatParticipant.findMany({
        where: { chat_id: chatId },
        include: { 
          user: { 
            select: { id: true, display_name: true, name: true } 
          } 
        }
      }),
      prisma.event.findMany({
        where: { chat_id: chatId, type: "message" },
        orderBy: { created_at: "desc" },
        take: 20
      }),
      prisma.participantState.findMany({
        where: { chat_id: chatId }
      }),
      prisma.waitingRoomAnswers.findMany({
        where: { chat_id: chatId }
      }),
      prisma.chatTurnState.findUnique({
        where: { chat_id: chatId }
      })
    ]);

    if (!chat) throw new Error("Chat not found");

    const humanParticipants = participants.filter(p => p.user_id !== "assistant");
    
    const totalMessages = recentEvents.length;
    const conversationAge = Date.now() - chat.created_at.getTime();
    const conversationPhase = this.determineConversationPhase(totalMessages, conversationAge);
    
    const participantBalance = this.analyzeParticipantBalance(recentEvents, humanParticipants);
    const conversationFlow = this.analyzeConversationFlow(recentEvents, participantStates);
    const waitingRoomContext = this.buildWaitingRoomContext(waitingRoomAnswers);
    
    const suggestedActions = this.generateMediationSuggestions(
      conversationPhase,
      participantBalance,
      conversationFlow,
      waitingRoomContext
    );

    return {
      chatId,
      conversationPhase,
      messagesSinceLastMediator: this.countMessagesSinceLastMediator(recentEvents),
      participants: humanParticipants.map(p => ({
        id: p.user_id,
        name: p.user?.display_name || p.user?.name || "Participant",
        role: p.role,
        currentState: participantStates.find(ps => ps.user_id === p.user_id) ? {
          feelings: participantStates.find(ps => ps.user_id === p.user_id)?.feelings as string[] || [],
          needs: participantStates.find(ps => ps.user_id === p.user_id)?.needs as string[] || [],
          viewpoints: participantStates.find(ps => ps.user_id === p.user_id)?.viewpoints as string[] || []
        } : undefined
      })),
      currentSpeaker: turnState?.next_user_id || "",
      participantBalance,
      conversationFlow,
      waitingRoomContext,
      suggestedActions,
      conversationGoals: this.extractConversationGoals(waitingRoomAnswers)
    };
  }

  private determineConversationPhase(messageCount: number, ageMs: number): MediatorContext["conversationPhase"] {
    const ageMinutes = ageMs / (1000 * 60);
    
    if (messageCount <= 3 || ageMinutes < 5) return "opening";
    if (messageCount <= 10 || ageMinutes < 15) return "building";
    if (messageCount <= 20 || ageMinutes < 30) return "exploring";
    if (messageCount <= 40 || ageMinutes < 60) return "resolving";
    return "closing";
  }

  private analyzeParticipantBalance(events: any[], participants: any[]) {
    const balance: MediatorContext["participantBalance"] = {};
    
    participants.forEach(p => {
      const userMessages = events.filter(e => e.data.senderId === p.user_id);
      const lastMessage = userMessages[0];
      
      balance[p.user_id] = {
        messageCount: userMessages.length,
        lastSpokeAt: lastMessage ? new Date(lastMessage.created_at) : new Date(0),
        emotionalState: this.inferEmotionalState(userMessages)
      };
    });
    
    return balance;
  }

  private analyzeConversationFlow(events: any[], participantStates: any[]) {
    const topics = this.extractTopics(events);
    const engagementLevel = this.assessEngagementLevel(events);
    const conflictLevel = this.assessConflictLevel(events);
    
    return {
      topics,
      engagementLevel,
      conflictLevel
    };
  }

  private buildWaitingRoomContext(answers: any[]) {
    const context: MediatorContext["waitingRoomContext"] = {};
    
    answers.forEach(answer => {
      context[answer.user_id] = {
        motivation: answer.what_brought_you_here,
        hopes: answer.hope_to_accomplish,
        currentFeeling: answer.current_feeling,
        communicationStyle: answer.communication_style,
        topicsToAvoid: answer.topics_to_avoid
      };
    });
    
    return context;
  }

  private generateMediationSuggestions(
    phase: MediatorContext["conversationPhase"],
    balance: MediatorContext["participantBalance"],
    flow: MediatorContext["conversationFlow"],
    waitingRoom: MediatorContext["waitingRoomContext"]
  ): string[] {
    const suggestions: string[] = [];
    
    switch (phase) {
      case "opening":
        suggestions.push("Focus on building psychological safety and rapport");
        break;
      case "building":
        suggestions.push("Encourage deeper sharing and active listening");
        break;
      case "exploring":
        suggestions.push("Help participants explore different perspectives");
        break;
      case "resolving":
        suggestions.push("Guide toward mutual understanding and agreements");
        break;
      case "closing":
        suggestions.push("Summarize insights and next steps");
        suggestions.push("COMPLETION GUIDANCE: Gently guide participants toward session completion when conversation feels complete");
        break;
    }
    
    const participantIds = Object.keys(balance);
    const messageCounts = participantIds.map(id => balance[id].messageCount);
    const imbalance = Math.max(...messageCounts) - Math.min(...messageCounts);
    
    if (imbalance > 3) {
      const quietParticipant = participantIds.find(id => 
        balance[id].messageCount === Math.min(...messageCounts)
      );
      if (quietParticipant) {
        suggestions.push(`Invite ${quietParticipant} to share their perspective`);
      }
    }
    
    if (flow.conflictLevel === "high") {
      suggestions.push("Acknowledge different viewpoints and find common ground");
    }
    
    // Check for natural completion signals
    const completionSignals = this.detectCompletionSignals(balance, waitingRoom);
    if (completionSignals.shouldGuideToCompletion) {
      suggestions.push("COMPLETION GUIDANCE: Conversation shows signs of natural conclusion - guide toward caring completion");
    }
    
    return suggestions;
  }

  private detectCompletionSignals(
    balance: MediatorContext["participantBalance"], 
    waitingRoom: MediatorContext["waitingRoomContext"]
  ): { shouldGuideToCompletion: boolean; signals: string[] } {
    const signals: string[] = [];
    
    // Check if both participants have had good engagement (at least 5 messages each)
    const participantIds = Object.keys(balance);
    const allHaveEngaged = participantIds.every(id => 
      balance[id].messageCount >= 5
    );
    
    // Check for completion language patterns would need recent messages
    // For now, use message count and phase as primary indicators
    const totalMessages = participantIds.reduce((sum, id) => 
      sum + balance[id].messageCount, 0);
    
    if (allHaveEngaged && totalMessages >= 20) {
      signals.push("Both participants have engaged meaningfully");
    }
    
    const shouldGuideToCompletion = signals.length > 0;
    
    return { shouldGuideToCompletion, signals };
  }

  private countMessagesSinceLastMediator(events: any[]): number {
    let count = 0;
    for (const event of events) {
      if (event.data.senderId === "assistant") break;
      count++;
    }
    return count;
  }

  private inferEmotionalState(messages: any[]): string {
    if (messages.length === 0) return "neutral";
    if (messages.length === 1) return "cautious";
    if (messages.length > 5) return "engaged";
    return "warming_up";
  }

  private extractTopics(events: any[]): string[] {
    const commonWords = events
      .map(e => e.data.content)
      .join(" ")
      .toLowerCase()
      .split(" ")
      .filter(word => word.length > 4)
      .slice(0, 5);
    
    return [...new Set(commonWords)];
  }

  private assessEngagementLevel(events: any[]): "low" | "medium" | "high" {
    const avgMessageLength = events.reduce((sum, e) => sum + e.data.content.length, 0) / events.length;
    if (avgMessageLength > 100) return "high";
    if (avgMessageLength > 50) return "medium";
    return "low";
  }

  private assessConflictLevel(events: any[]): "low" | "medium" | "high" {
    const conflictWords = ["disagree", "wrong", "no", "but", "however", "unfortunately"];
    const conflictCount = events.reduce((count, e) => {
      const content = e.data.content.toLowerCase();
      return count + conflictWords.filter(word => content.includes(word)).length;
    }, 0);
    
    if (conflictCount > 5) return "high";
    if (conflictCount > 2) return "medium";
    return "low";
  }

  private extractConversationGoals(answers: any[]): string[] {
    return answers.map(a => a.hope_to_accomplish);
  }

  async generateContextualPrompt(chatId: string): Promise<string> {
    const context = await this.buildMediatorContext(chatId);
    
    return `You are Komensa, an experienced AI mediator with deep expertise in facilitating meaningful conversations.

CURRENT CONVERSATION CONTEXT:
Phase: ${context.conversationPhase.toUpperCase()}
Messages since your last response: ${context.messagesSinceLastMediator}
Engagement Level: ${context.conversationFlow.engagementLevel}
Conflict Level: ${context.conversationFlow.conflictLevel}

PARTICIPANTS:
${context.participants.map(p => `
- ${p.name}: 
  * Messages sent: ${context.participantBalance[p.id]?.messageCount || 0}
  * Emotional state: ${context.participantBalance[p.id]?.emotionalState || "Unknown"}
  * Original motivation: "${context.waitingRoomContext[p.id]?.motivation || "Not provided"}"
  * Hopes to accomplish: "${context.waitingRoomContext[p.id]?.hopes || "Not provided"}"
  * Communication style: ${context.waitingRoomContext[p.id]?.communicationStyle || "Not specified"}
  ${context.waitingRoomContext[p.id]?.topicsToAvoid ? `* Topics to avoid: ${context.waitingRoomContext[p.id].topicsToAvoid}` : ""}
`).join("")}

CURRENT MEDIATION PRIORITIES:
${context.suggestedActions.map(action => `• ${action}`).join("\n")}

CONVERSATION GOALS:
${context.conversationGoals.map(goal => `• ${goal}`).join("\n")}

MEDIATION GUIDELINES:
1. Maintain your professional yet warm presence as Komensa
2. Reference specific participant motivations and communication styles
3. Address the current conversation phase appropriately
4. Monitor participant balance - encourage quieter voices when needed  
5. Acknowledge emotional undercurrents and validate feelings
6. Guide toward the shared goals identified in preparation
7. Use "I notice..." statements to address conversation dynamics
8. Keep responses focused and actionable (under 150 words)

${context.suggestedActions.some(action => action.includes("COMPLETION GUIDANCE")) ? `
CARING COMPLETION GUIDANCE:
When the conversation feels naturally complete or you sense participants are ready to close:
- Warmly acknowledge the meaningful work they've done together
- Highlight key insights, progress, or connections made
- Gently suggest: "When you both feel ready to close our session, you can click the Settings button (⚙️) at the top of the chat and select 'Complete Session.' Both of you will need to do this to officially end our time together."
- Reassure them there's no rush - they can continue talking as long as they need
- Express gratitude for their openness and the privilege of witnessing their dialogue
` : ""}

Your response should feel natural and contextually aware, demonstrating that you have been actively listening and understanding the conversation's evolution.`;
  }
}

export const enhancedMediatorContext = new EnhancedMediatorContextService();
