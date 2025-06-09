// Analytics extension demonstrating event-driven architecture
import { BaseExtension, ExtensionResult } from '@/features/extensions/EventDrivenExtensionSystem';
import { DomainEvent } from '@/features/events/EventBus';
import { DOMAIN_EVENTS, DomainEventType } from '@/features/events/DomainEvents';

interface AnalyticsConfig {
  trackMessages?: boolean;
  trackTurns?: boolean;
  trackCompletions?: boolean;
  trackAIInteractions?: boolean;
  exportFormat?: 'json' | 'csv';
  retentionDays?: number;
}

interface ChatMetrics {
  chatId: string;
  messageCount: number;
  participantCount: number;
  turnCount: number;
  aiResponseCount: number;
  averageResponseTime: number;
  completionRate: number;
  lastActivity: Date;
  events: AnalyticsEvent[];
}

interface AnalyticsEvent {
  timestamp: Date;
  type: string;
  userId?: string;
  data: any;
  duration?: number;
}

export class AnalyticsExtension extends BaseExtension {
  id = 'analytics';
  name = 'Chat Analytics';
  version = '1.0.0';
  description = 'Comprehensive analytics and metrics collection for chat sessions';
  author = 'Komensa Team';

  subscribedEvents: DomainEventType[] = [
    DOMAIN_EVENTS.MESSAGE_STORED,
    DOMAIN_EVENTS.TURN_CHANGED,
    DOMAIN_EVENTS.AI_RESPONSE_STARTED,
    DOMAIN_EVENTS.AI_RESPONSE_COMPLETED,
    DOMAIN_EVENTS.USER_JOINED,
    DOMAIN_EVENTS.USER_MARKED_COMPLETE,
    DOMAIN_EVENTS.ALL_USERS_COMPLETE,
    DOMAIN_EVENTS.SETTINGS_UPDATED
  ];

  private metrics: Map<string, ChatMetrics> = new Map();
  private aiResponseTimes: Map<string, number> = new Map(); // replyId -> startTime

  getDefaultConfig(): AnalyticsConfig {
    return {
      trackMessages: true,
      trackTurns: true,
      trackCompletions: true,
      trackAIInteractions: true,
      exportFormat: 'json',
      retentionDays: 30
    };
  }

  async initialize(chatId: string, config: AnalyticsConfig): Promise<void> {
    console.log(`[AnalyticsExtension] Initializing analytics for chat ${chatId}`);
    
    // Initialize metrics for this chat
    if (!this.metrics.has(chatId)) {
      this.metrics.set(chatId, {
        chatId,
        messageCount: 0,
        participantCount: 0,
        turnCount: 0,
        aiResponseCount: 0,
        averageResponseTime: 0,
        completionRate: 0,
        lastActivity: new Date(),
        events: []
      });
    }
  }

  async handleEvent(event: DomainEvent): Promise<ExtensionResult> {
    const config = this.extensionConfig as AnalyticsConfig;
    const metrics = this.metrics.get(event.chatId);
    
    if (!metrics) {
      return this.error('Metrics not initialized for chat');
    }

    try {
      const analyticsEvent: AnalyticsEvent = {
        timestamp: event.timestamp,
        type: event.type,
        userId: event.userId,
        data: event.data
      };

      switch (event.type) {
        case DOMAIN_EVENTS.MESSAGE_STORED:
          if (config.trackMessages) {
            await this.handleMessageStored(event, metrics, analyticsEvent);
          }
          break;

        case DOMAIN_EVENTS.TURN_CHANGED:
          if (config.trackTurns) {
            await this.handleTurnChanged(event, metrics, analyticsEvent);
          }
          break;

        case DOMAIN_EVENTS.AI_RESPONSE_STARTED:
          if (config.trackAIInteractions) {
            await this.handleAIResponseStarted(event, metrics, analyticsEvent);
          }
          break;

        case DOMAIN_EVENTS.AI_RESPONSE_COMPLETED:
          if (config.trackAIInteractions) {
            await this.handleAIResponseCompleted(event, metrics, analyticsEvent);
          }
          break;

        case DOMAIN_EVENTS.USER_JOINED:
          await this.handleUserJoined(event, metrics, analyticsEvent);
          break;

        case DOMAIN_EVENTS.USER_MARKED_COMPLETE:
        case DOMAIN_EVENTS.ALL_USERS_COMPLETE:
          if (config.trackCompletions) {
            await this.handleCompletionEvent(event, metrics, analyticsEvent);
          }
          break;

        case DOMAIN_EVENTS.SETTINGS_UPDATED:
          await this.handleSettingsUpdated(event, metrics, analyticsEvent);
          break;
      }

      // Update last activity
      metrics.lastActivity = event.timestamp;
      
      // Add event to history (with retention limit)
      metrics.events.push(analyticsEvent);
      this.enforceRetention(metrics, config.retentionDays || 30);

      return this.success({ metricsUpdated: true });

    } catch (error) {
      console.error('[AnalyticsExtension] Error processing event:', error);
      return this.error(`Failed to process ${event.type}: ${error}`);
    }
  }

  private async handleMessageStored(
    event: DomainEvent, 
    metrics: ChatMetrics, 
    analyticsEvent: AnalyticsEvent
  ): Promise<void> {
    metrics.messageCount++;
    
    // Track message length, sentiment, etc.
    analyticsEvent.data = {
      ...analyticsEvent.data,
      messageLength: event.data.content?.length || 0,
      sender: event.data.senderId,
      isAI: event.data.senderId === 'assistant'
    };

    console.log(`[AnalyticsExtension] Message tracked: ${metrics.messageCount} total messages`);
  }

  private async handleTurnChanged(
    event: DomainEvent, 
    metrics: ChatMetrics, 
    analyticsEvent: AnalyticsEvent
  ): Promise<void> {
    metrics.turnCount++;
    
    analyticsEvent.data = {
      ...analyticsEvent.data,
      fromUser: event.data.previousUserId,
      toUser: event.data.nextUserId,
      turnMode: event.data.turnMode
    };

    console.log(`[AnalyticsExtension] Turn tracked: ${metrics.turnCount} total turns`);
  }

  private async handleAIResponseStarted(
    event: DomainEvent, 
    metrics: ChatMetrics, 
    analyticsEvent: AnalyticsEvent
  ): Promise<void> {
    const replyId = event.data.replyId;
    if (replyId) {
      this.aiResponseTimes.set(replyId, Date.now());
    }

    console.log(`[AnalyticsExtension] AI response started: ${replyId}`);
  }

  private async handleAIResponseCompleted(
    event: DomainEvent, 
    metrics: ChatMetrics, 
    analyticsEvent: AnalyticsEvent
  ): Promise<void> {
    metrics.aiResponseCount++;
    
    const replyId = event.data.replyId;
    const startTime = this.aiResponseTimes.get(replyId);
    
    if (startTime) {
      const duration = Date.now() - startTime;
      analyticsEvent.duration = duration;
      
      // Update average response time
      const totalTime = metrics.averageResponseTime * (metrics.aiResponseCount - 1) + duration;
      metrics.averageResponseTime = totalTime / metrics.aiResponseCount;
      
      this.aiResponseTimes.delete(replyId);
    }

    analyticsEvent.data = {
      ...analyticsEvent.data,
      responseLength: event.data.content?.length || 0,
      duration: analyticsEvent.duration
    };

    console.log(`[AnalyticsExtension] AI response completed: ${metrics.aiResponseCount} total, avg time: ${metrics.averageResponseTime}ms`);
  }

  private async handleUserJoined(
    event: DomainEvent, 
    metrics: ChatMetrics, 
    analyticsEvent: AnalyticsEvent
  ): Promise<void> {
    metrics.participantCount++;
    
    analyticsEvent.data = {
      ...analyticsEvent.data,
      role: event.data.role,
      isGuest: event.data.isGuest
    };

    console.log(`[AnalyticsExtension] User joined: ${metrics.participantCount} total participants`);
  }

  private async handleCompletionEvent(
    event: DomainEvent, 
    metrics: ChatMetrics, 
    analyticsEvent: AnalyticsEvent
  ): Promise<void> {
    if (event.type === DOMAIN_EVENTS.ALL_USERS_COMPLETE) {
      metrics.completionRate = 1.0; // 100% completion
      
      analyticsEvent.data = {
        ...analyticsEvent.data,
        completedCount: event.data.completedCount,
        totalParticipants: event.data.totalParticipants,
        completionTime: event.timestamp
      };

      console.log(`[AnalyticsExtension] All users completed - 100% completion rate`);
    } else {
      // Calculate current completion rate
      const completedCount = (event.data.completedCount || 1);
      const totalParticipants = metrics.participantCount || 1;
      metrics.completionRate = completedCount / totalParticipants;

      console.log(`[AnalyticsExtension] User completion: ${Math.round(metrics.completionRate * 100)}% complete`);
    }
  }

  private async handleSettingsUpdated(
    event: DomainEvent, 
    metrics: ChatMetrics, 
    analyticsEvent: AnalyticsEvent
  ): Promise<void> {
    analyticsEvent.data = {
      ...analyticsEvent.data,
      changes: event.data.changes,
      newSettings: event.data.newSettings
    };

    console.log(`[AnalyticsExtension] Settings updated: ${event.data.changes?.join(', ')}`);
  }

  private enforceRetention(metrics: ChatMetrics, retentionDays: number): void {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    
    metrics.events = metrics.events.filter(event => event.timestamp >= cutoffDate);
  }

  /**
   * Get metrics for a specific chat
   */
  getChatMetrics(chatId: string): ChatMetrics | null {
    return this.metrics.get(chatId) || null;
  }

  /**
   * Export analytics data
   */
  exportData(chatId: string, format: 'json' | 'csv' = 'json'): string {
    const metrics = this.metrics.get(chatId);
    if (!metrics) {
      throw new Error(`No metrics found for chat ${chatId}`);
    }

    if (format === 'json') {
      return JSON.stringify(metrics, null, 2);
    } else {
      // Simple CSV export
      const headers = ['timestamp', 'type', 'userId', 'duration', 'data'];
      const rows = metrics.events.map(event => [
        event.timestamp.toISOString(),
        event.type,
        event.userId || '',
        event.duration || '',
        JSON.stringify(event.data)
      ]);

      return [headers, ...rows].map(row => row.join(',')).join('\n');
    }
  }

  /**
   * Generate analytics report
   */
  generateReport(chatId: string): any {
    const metrics = this.metrics.get(chatId);
    if (!metrics) {
      return null;
    }

    const sessionDuration = metrics.events.length > 0 
      ? metrics.lastActivity.getTime() - metrics.events[0].timestamp.getTime()
      : 0;

    return {
      chatId,
      summary: {
        totalMessages: metrics.messageCount,
        totalParticipants: metrics.participantCount,
        totalTurns: metrics.turnCount,
        aiResponses: metrics.aiResponseCount,
        completionRate: Math.round(metrics.completionRate * 100),
        sessionDuration: Math.round(sessionDuration / 1000), // seconds
        averageAIResponseTime: Math.round(metrics.averageResponseTime)
      },
      messageBreakdown: this.analyzeMessages(metrics),
      turnAnalysis: this.analyzeTurns(metrics),
      aiPerformance: this.analyzeAIPerformance(metrics),
      timeline: metrics.events.slice(-20) // Last 20 events
    };
  }

  private analyzeMessages(metrics: ChatMetrics): any {
    const messageEvents = metrics.events.filter(e => e.type === DOMAIN_EVENTS.MESSAGE_STORED);
    const humanMessages = messageEvents.filter(e => e.data.sender !== 'assistant');
    const aiMessages = messageEvents.filter(e => e.data.sender === 'assistant');

    return {
      total: messageEvents.length,
      humanMessages: humanMessages.length,
      aiMessages: aiMessages.length,
      averageLength: messageEvents.reduce((sum, e) => sum + (e.data.messageLength || 0), 0) / messageEvents.length || 0
    };
  }

  private analyzeTurns(metrics: ChatMetrics): any {
    const turnEvents = metrics.events.filter(e => e.type === DOMAIN_EVENTS.TURN_CHANGED);
    
    return {
      total: turnEvents.length,
      modes: this.groupBy(turnEvents, e => e.data.turnMode),
      averageTurnDuration: this.calculateAverageTurnDuration(turnEvents)
    };
  }

  private analyzeAIPerformance(metrics: ChatMetrics): any {
    const aiEvents = metrics.events.filter(e => e.type === DOMAIN_EVENTS.AI_RESPONSE_COMPLETED);
    
    return {
      totalResponses: aiEvents.length,
      averageResponseTime: metrics.averageResponseTime,
      fastestResponse: Math.min(...aiEvents.map(e => e.duration || Infinity)),
      slowestResponse: Math.max(...aiEvents.map(e => e.duration || 0)),
      averageResponseLength: aiEvents.reduce((sum, e) => sum + (e.data.responseLength || 0), 0) / aiEvents.length || 0
    };
  }

  private groupBy<T>(array: T[], keyFn: (item: T) => string): Record<string, number> {
    return array.reduce((groups, item) => {
      const key = keyFn(item);
      groups[key] = (groups[key] || 0) + 1;
      return groups;
    }, {} as Record<string, number>);
  }

  private calculateAverageTurnDuration(turnEvents: AnalyticsEvent[]): number {
    if (turnEvents.length < 2) return 0;

    let totalDuration = 0;
    for (let i = 1; i < turnEvents.length; i++) {
      const duration = turnEvents[i].timestamp.getTime() - turnEvents[i-1].timestamp.getTime();
      totalDuration += duration;
    }

    return totalDuration / (turnEvents.length - 1);
  }

  async cleanup(): Promise<void> {
    console.log('[AnalyticsExtension] Cleaning up analytics data');
    this.metrics.clear();
    this.aiResponseTimes.clear();
  }
}