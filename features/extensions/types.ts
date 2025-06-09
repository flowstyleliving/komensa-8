import React from 'react';

export interface Extension {
  id: string;
  name: string;
  description: string;
  version: string;
  type: 'viz-cue' | 'mediator-style' | 'turn-taking' | 'analytics' | 'send-button';
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

export interface SendButtonExtension extends Extension {
  type: 'send-button';
  config: {
    icon?: React.ComponentType<any>;
    label?: string;
    style?: 'default' | 'gentle' | 'urgent' | 'custom';
    customStyles?: string;
    behavior?: 'default' | 'confirm' | 'transform' | 'delay';
    transformMessage?: (message: string) => string;
    confirmationText?: string;
    delayMs?: number;
  };
}

export interface ExtensionContext {
  chatId: string;
  userId: string;
  isUserTyping: boolean;
  isAiTyping: boolean;
  currentTurn: 'user' | 'ai' | null;
  messageCount: number;
  messageContent?: string;
  canSend?: boolean;
}


