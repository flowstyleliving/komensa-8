import { Extension, VizCueExtension, SendButtonExtension, ExtensionContext } from './types';
import React from 'react';
import { Sparkles, Send, Heart, MessageCircle } from 'lucide-react';

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

    // Gentle Send Button extension
    const gentleSend: SendButtonExtension = {
      id: 'gentle-send',
      name: 'Gentle Send',
      description: 'A softer, more mindful send button with heart icon',
      version: '1.0.0',
      type: 'send-button',
      enabled: false, // Disabled by default
      config: {
        icon: Heart,
        style: 'gentle',
        behavior: 'delay',
        delayMs: 500,
        customStyles: 'bg-gradient-to-r from-[#D8A7B1] to-[#D9C589] hover:from-[#C99BA4] hover:to-[#E6C869]'
      }
    };

    // Mindful Send Button extension  
    const mindfulSend: SendButtonExtension = {
      id: 'mindful-send',
      name: 'Mindful Send',
      description: 'Asks for confirmation before sending to encourage thoughtful communication',
      version: '1.0.0',
      type: 'send-button',
      enabled: false,
      config: {
        icon: MessageCircle,
        style: 'custom',
        behavior: 'confirm',
        confirmationText: 'Are you sure this message reflects your best intentions?',
        customStyles: 'bg-gradient-to-r from-[#7BAFB0] to-[#D9C589] hover:from-[#6D9E9F] hover:to-[#E6C869]'
      }
    };

    this.extensions.set(thinkGoodThoughts.id, thinkGoodThoughts);
    this.extensions.set(gentleSend.id, gentleSend);
    this.extensions.set(mindfulSend.id, mindfulSend);
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

  getSendButtonExtension(context: ExtensionContext): SendButtonExtension | null {
    const sendButtonExtensions = this.getEnabledExtensions()
      .filter(ext => ext.type === 'send-button') as SendButtonExtension[];

    // Return the first enabled send button extension, or null for default
    return sendButtonExtensions.length > 0 ? sendButtonExtensions[0] : null;
  }

  renderSendButton(
    extension: SendButtonExtension | null, 
    context: ExtensionContext,
    onSend: (message: string) => void,
    disabled: boolean
  ): React.ReactNode {
    // Default send button if no extension
    if (!extension) {
      return React.createElement('button', {
        type: 'submit',
        disabled: disabled || !context.messageContent?.trim(),
        className: 'w-12 h-12 sm:w-14 sm:h-12 bg-gradient-to-r from-[#7BAFB0] to-[#D8A7B1] text-white rounded-xl hover:from-[#6D9E9F] hover:to-[#C99BA4] focus:outline-none focus:ring-2 focus:ring-[#7BAFB0]/30 focus:ring-offset-2 focus:ring-offset-white disabled:from-[#7BAFB0]/40 disabled:to-[#D8A7B1]/40 disabled:cursor-not-allowed flex items-center justify-center font-medium shadow-sm transition-all duration-300 transform hover:scale-[1.02] hover:shadow-md active:scale-[0.98] active:shadow-sm flex-shrink-0 touch-manipulation',
        style: { WebkitTapHighlightColor: 'transparent' }
      }, React.createElement(Send, { className: 'h-4 w-4 sm:h-5 sm:w-5' }));
    }

    // Custom send button from extension
    const IconComponent = extension.config.icon || Send;
    const styles = extension.config.customStyles || 'w-12 h-12 sm:w-14 sm:h-12 bg-gradient-to-r from-[#7BAFB0] to-[#D8A7B1] text-white rounded-xl hover:from-[#6D9E9F] hover:to-[#C99BA4] focus:outline-none focus:ring-2 focus:ring-[#7BAFB0]/30 focus:ring-offset-2 focus:ring-offset-white disabled:from-[#7BAFB0]/40 disabled:to-[#D8A7B1]/40 disabled:cursor-not-allowed flex items-center justify-center font-medium shadow-sm transition-all duration-300 transform hover:scale-[1.02] hover:shadow-md active:scale-[0.98] active:shadow-sm flex-shrink-0 touch-manipulation';

    const handleClick = (e: React.MouseEvent) => {
      e.preventDefault();
      this.handleSendButtonAction(extension, context, onSend);
    };

    return React.createElement('button', {
      type: 'button',
      disabled: disabled || !context.messageContent?.trim(),
      className: styles,
      onClick: handleClick,
      style: { WebkitTapHighlightColor: 'transparent' },
      title: extension.config.label || 'Send message'
    }, React.createElement(IconComponent, { className: 'h-4 w-4 sm:h-5 sm:w-5' }));
  }

  private async handleSendButtonAction(
    extension: SendButtonExtension,
    context: ExtensionContext,
    onSend: (message: string) => void
  ) {
    if (!context.messageContent?.trim()) return;

    let messageToSend = context.messageContent;
    const behavior = extension.config.behavior || 'default';

    try {
      switch (behavior) {
        case 'confirm':
          const confirmed = confirm(extension.config.confirmationText || 'Send this message?');
          if (!confirmed) return;
          break;

        case 'transform':
          if (extension.config.transformMessage) {
            messageToSend = extension.config.transformMessage(messageToSend);
          }
          break;

        case 'delay':
          await new Promise(resolve => setTimeout(resolve, extension.config.delayMs || 300));
          break;

        default:
          // 'default' behavior - send immediately
          break;
      }

      onSend(messageToSend);
    } catch (error) {
      console.error('Send button extension error:', error);
      // Fallback to original message
      onSend(context.messageContent);
    }
  }
}

export const extensionRegistry = new ExtensionRegistry(); 