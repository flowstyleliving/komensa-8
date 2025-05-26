import { Extension, VizCueExtension, ExtensionContext } from './types';
import React from 'react';
import { Sparkles } from 'lucide-react';

class ExtensionRegistry {
  private extensions: Map<string, Extension> = new Map();
  private usedPhrasesPerTurn: Map<string, Set<number>> = new Map();

  constructor() {
    this.loadBuiltInExtensions();
  }

  private loadBuiltInExtensions() {
    // Think Good Thoughts extension
    const thinkGoodThoughts: VizCueExtension = {
      id: 'think-good-thoughts',
      name: 'Think Good Thoughts',
      description: 'Displays encouraging phrases when the other person is typing',
      version: '1.0.0',
      type: 'viz-cue',
      enabled: true,
      config: {
        phrases: [
          "Imagine how awesome this person can be!",
          "Inhale, 1, 2, 3...",
          "What can you appreciate about them right now?"
        ],
        triggerCondition: 'user-typing'
      }
    };

    this.extensions.set(thinkGoodThoughts.id, thinkGoodThoughts);
  }

  getExtension(id: string): Extension | undefined {
    return this.extensions.get(id);
  }

  getEnabledExtensions(): Extension[] {
    return Array.from(this.extensions.values()).filter(ext => ext.enabled);
  }

  getVizCueExtensions(context: ExtensionContext): React.ReactNode[] {
    const vizCueExtensions = this.getEnabledExtensions()
      .filter(ext => ext.type === 'viz-cue') as VizCueExtension[];

    return vizCueExtensions
      .map(ext => {
        // Check if extension should trigger based on context
        const shouldTrigger = this.shouldTriggerVizCue(ext, context);
        if (!shouldTrigger) return null;

        // Built-in Think Good Thoughts component
        if (ext.id === 'think-good-thoughts') {
          return this.renderThinkGoodThoughts(ext, context);
        }

        return null;
      })
      .filter(Boolean);
  }

  private renderThinkGoodThoughts(extension: VizCueExtension, context: ExtensionContext): React.ReactNode {
    const turnKey = `${context.chatId}-${context.messageCount}`;
    const usedPhrases = this.usedPhrasesPerTurn.get(turnKey) || new Set();
    
    // Find an unused phrase for this turn
    const availablePhrases = extension.config.phrases
      .map((phrase, index) => ({ phrase, index }))
      .filter(({ index }) => !usedPhrases.has(index));
    
    // If all phrases used this turn, reset and use first phrase
    if (availablePhrases.length === 0) {
      this.usedPhrasesPerTurn.set(turnKey, new Set([0]));
      return React.createElement('div', {
        key: 'think-good-thoughts',
        className: 'flex items-center justify-center gap-2 text-[#3C4858]/60 text-sm animate-fade-in'
      }, [
        React.createElement(Sparkles, { 
          key: 'sparkle1',
          className: 'h-4 w-4 text-[#D8A7B1]' 
        }),
        React.createElement('span', { 
          key: 'text',
          className: 'italic' 
        }, extension.config.phrases[0])
      ]);
    }
    
    // Use next available phrase
    const selectedPhrase = availablePhrases[0];
    usedPhrases.add(selectedPhrase.index);
    this.usedPhrasesPerTurn.set(turnKey, usedPhrases);
    
    return React.createElement('div', {
      key: 'think-good-thoughts',
      className: 'flex items-center justify-center gap-2 text-[#3C4858]/60 text-sm animate-fade-in'
    }, [
      React.createElement(Sparkles, { 
        key: 'sparkle1',
        className: 'h-4 w-4 text-[#D8A7B1]' 
      }),
      React.createElement('span', { 
        key: 'text',
        className: 'italic' 
      }, selectedPhrase.phrase)
    ]);
  }

  private shouldTriggerVizCue(extension: VizCueExtension, context: ExtensionContext): boolean {
    const { triggerCondition } = extension.config;
    
    switch (triggerCondition) {
      case 'user-typing':
        return context.isUserTyping && !context.isAiTyping;
      case 'ai-typing':
        return context.isAiTyping && !context.isUserTyping;
      case 'both':
        return context.isUserTyping || context.isAiTyping;
      default:
        return false;
    }
  }

  enableExtension(id: string) {
    const extension = this.extensions.get(id);
    if (extension) {
      extension.enabled = true;
    }
  }

  disableExtension(id: string) {
    const extension = this.extensions.get(id);
    if (extension) {
      extension.enabled = false;
    }
  }
}

export const extensionRegistry = new ExtensionRegistry(); 