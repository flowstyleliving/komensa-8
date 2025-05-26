import React from 'react';

export interface Extension {
  id: string;
  name: string;
  description: string;
  version: string;
  type: 'viz-cue' | 'mediator-style' | 'turn-taking' | 'analytics';
  enabled: boolean;
  config?: Record<string, any>;
}

export interface VizCueExtension extends Extension {
  type: 'viz-cue';
  config: {
    phrases: string[];
    triggerCondition: 'user-typing' | 'ai-typing' | 'both';
  };
}

export interface ExtensionContext {
  chatId: string;
  userId: string;
  isUserTyping: boolean;
  isAiTyping: boolean;
  currentTurn: 'user' | 'ai' | null;
  messageCount: number;
}


