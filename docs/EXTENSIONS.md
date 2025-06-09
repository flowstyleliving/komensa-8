# Komensa Extensions System

## Overview

Komensa features a powerful, modular extension system that allows customization of chat behavior, visual elements, and user interactions. Extensions enable therapeutic customization, organizational branding, and adaptive user experiences without modifying core application code.

## Architecture

### Extension Types

The extension system supports multiple types of customizations:

- **`viz-cue`**: Visual cues displayed in the chat input area
- **`send-button`**: Custom send button appearance and behavior  
- **`message-transform`**: Real-time message transformation and translation
- **`mediator-style`**: AI mediator behavior customization
- **`turn-taking`**: Custom turn management logic
- **`analytics`**: Data collection and insights

### Core Components

```
features/extensions/
├── types.ts         # Extension interfaces and types
├── registry.ts      # Extension registration and management
└── built-ins/       # Built-in extensions
hooks/
└── useExtensions.ts # React hook for extension integration
```

## Current Implementation

### VizCue Extensions (Live)

Visual cues appear in the `topContent` area of the chat input, providing contextual information and encouragement.

**Extension Definition:**
```typescript
interface VizCueExtension extends Extension {
  type: 'viz-cue';
  config: {
    phrases: string[];
    triggerCondition: 'user-typing' | 'ai-typing' | 'both';
  };
}
```

**Built-in Example:**
```typescript
{
  id: 'think-good-thoughts',
  name: 'Think Good Thoughts',
  description: 'Displays encouraging phrases when the other person is typing',
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
}
```

**Usage:**
```tsx
const { getVizCueContent } = useExtensions({
  chatId, userId, isUserTyping, isAiTyping, currentTurn, messageCount
});

// Displays in topContent area
<ChatInput topContent={getVizCueContent()} />
```

### Extension Context

Extensions receive rich context about the current chat state:

```typescript
interface ExtensionContext {
  chatId: string;
  userId: string;
  isUserTyping: boolean;
  isAiTyping: boolean;
  currentTurn: 'user' | 'ai' | null;
  messageCount: number;
  messageContent?: string;     // For send-button extensions
  canSend?: boolean;          // Send permission state
}
```

## Future Implementations

### Send Button Extensions (Planned)

Customize the send button appearance and behavior for different therapeutic approaches.

**Extension Definition:**
```typescript
interface SendButtonExtension extends Extension {
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
```

**Examples:**

**Gentle Send Button:**
```typescript
{
  id: 'gentle-send',
  name: 'Gentle Send',
  description: 'Heart icon with mindful delay',
  type: 'send-button',
  config: {
    icon: Heart,
    style: 'gentle',
    behavior: 'delay',
    delayMs: 500,
    customStyles: 'bg-gradient-to-r from-[#D8A7B1] to-[#D9C589]'
  }
}
```

**Mindful Confirmation:**
```typescript
{
  id: 'mindful-send',
  name: 'Mindful Send',
  description: 'Confirmation prompt for thoughtful communication',
  type: 'send-button',
  config: {
    icon: MessageCircle,
    behavior: 'confirm',
    confirmationText: 'Are you sure this message reflects your best intentions?'
  }
}
```

**Usage:**
```tsx
const { renderSendButton } = useExtensions({
  chatId, userId, messageContent: content, canSend: !disabled
});

// Replaces hardcoded send button
{renderSendButton(onSend, disabled)}
```

### Message Transform Extensions (Planned)

Real-time message transformation for differential user experiences and communication style adaptation.

**Extension Definition:**
```typescript
interface MessageTransformExtension extends Extension {
  type: 'message-transform';
  config: {
    transformType: 'nvc' | 'gentle' | 'assertive' | 'summary';
    targetUserId?: string;      // Transform for specific user
    bidirectional?: boolean;    // Both users get transformed versions
    showToggle?: boolean;       // Allow viewing original
    transformFunction: (message: string, context: MessageContext) => Promise<string>;
  };
}
```

**Use Cases:**

1. **NVC Translation**: Transform harsh language to Nonviolent Communication
2. **Gentle Filtering**: Soften direct communication for sensitive users
3. **Professional Mode**: Convert emotional language to business-appropriate tone
4. **Cultural Adaptation**: Adjust directness based on cultural preferences

**Message Schema:**
```typescript
interface Message {
  id: string;
  originalContent: string;
  transformedVersions: {
    [userId: string]: {
      content: string;
      transformType: string;
      transformedBy: string;    // extension id
    }
  };
}
```

**User Experience:**
```tsx
// User A sends: "You never listen to me!"
// User B sees: "When I don't feel heard, I feel frustrated and need acknowledgment"

<MessageBubble>
  <MessageContent>
    {showOriginal ? message.originalContent : message.transformedVersions[userId]?.content}
  </MessageContent>
  
  {message.transformedVersions[userId] && (
    <ToggleButton onClick={() => setShowOriginal(!showOriginal)}>
      {showOriginal ? <Eye /> : <Sparkles />}
    </ToggleButton>
  )}
</MessageBubble>
```

**Examples:**

**NVC Translator:**
```typescript
{
  id: 'nvc-translator',
  name: 'Nonviolent Communication Translator',
  type: 'message-transform',
  config: {
    transformType: 'nvc',
    showToggle: true,
    transformFunction: async (message, context) => {
      return await aiTransformToNVC(message, context.relationshipDynamic);
    }
  }
}
```

**Gentle Communication Filter:**
```typescript
{
  id: 'gentle-filter',
  name: 'Gentle Communication Filter',
  type: 'message-transform',
  config: {
    transformType: 'gentle',
    transformFunction: async (message) => {
      return await softenLanguage(message);
    }
  }
}
```

### Mediator Style Extensions (Planned)

Customize AI mediator behavior for different therapeutic approaches and organizational needs.

```typescript
interface MediatorStyleExtension extends Extension {
  type: 'mediator-style';
  config: {
    approach: 'rogerian' | 'cbt' | 'solution-focused' | 'narrative';
    interventionFrequency: 'minimal' | 'moderate' | 'active';
    languageStyle: 'formal' | 'casual' | 'therapeutic';
    customPrompts?: {
      welcome?: string;
      turnTransition?: string;
      conflictDetected?: string;
      sessionEnd?: string;
    };
  };
}
```

**Examples:**

**Rogerian Approach:**
```typescript
{
  id: 'rogerian-mediator',
  name: 'Rogerian Counseling Style',
  config: {
    approach: 'rogerian',
    interventionFrequency: 'minimal',
    languageStyle: 'therapeutic',
    customPrompts: {
      welcome: "I'm here to create a safe space for both of you to be heard."
    }
  }
}
```

**Solution-Focused Therapy:**
```typescript
{
  id: 'solution-focused',
  name: 'Solution-Focused Brief Therapy',
  config: {
    approach: 'solution-focused',
    interventionFrequency: 'active',
    customPrompts: {
      conflictDetected: "What would need to happen for this to feel resolved for both of you?"
    }
  }
}
```

### Turn-Taking Extensions (Planned)

Custom turn management for specialized conversation formats.

```typescript
interface TurnTakingExtension extends Extension {
  type: 'turn-taking';
  config: {
    style: 'strict' | 'flexible' | 'timed' | 'structured';
    timeLimit?: number;         // For timed turns
    structure?: string[];       // For structured conversations
    customLogic?: (context: TurnContext) => TurnDecision;
  };
}
```

**Examples:**

**Structured Dialogue:**
```typescript
{
  id: 'structured-dialogue',
  name: 'Structured Dialogue Process',
  config: {
    style: 'structured',
    structure: [
      'express_feeling',
      'state_need', 
      'make_request',
      'partner_reflection',
      'partner_response'
    ]
  }
}
```

**Timed Turns:**
```typescript
{
  id: 'timed-turns',
  name: 'Equal Time Speaking',
  config: {
    style: 'timed',
    timeLimit: 120000, // 2 minutes
  }
}
```

### Analytics Extensions (Planned)

Data collection and insights for therapeutic and organizational purposes.

```typescript
interface AnalyticsExtension extends Extension {
  type: 'analytics';
  config: {
    metrics: string[];          // 'sentiment', 'word_count', 'turn_balance', etc.
    aggregationLevel: 'session' | 'user' | 'organization';
    privacyMode: 'anonymous' | 'aggregated' | 'full';
    exportFormat?: 'json' | 'csv' | 'pdf';
  };
}
```

## Creating Custom Extensions

### 1. Define Extension Interface

```typescript
// In features/extensions/types.ts
interface CustomExtension extends Extension {
  type: 'custom-type';
  config: {
    // Custom configuration properties
  };
}
```

### 2. Implement Extension Logic

```typescript
// In features/extensions/registry.ts
private loadCustomExtension() {
  const customExtension: CustomExtension = {
    id: 'my-custom-extension',
    name: 'My Custom Extension',
    description: 'Custom functionality',
    version: '1.0.0',
    type: 'custom-type',
    enabled: true,
    config: {
      // Configuration
    }
  };
  
  this.extensions.set(customExtension.id, customExtension);
}
```

### 3. Add Rendering/Logic Methods

```typescript
getCustomExtensions(context: ExtensionContext): CustomExtension[] {
  return this.getEnabledExtensions()
    .filter(ext => ext.type === 'custom-type') as CustomExtension[];
}

renderCustomComponent(extension: CustomExtension, context: ExtensionContext): React.ReactNode {
  // Custom rendering logic
}
```

### 4. Integrate with UI Components

```tsx
const { getCustomExtensions } = useExtensions({
  // Context parameters
});

// Use in components
const customExtensions = getCustomExtensions();
```

## Extension Management

### Runtime Control

```typescript
const { enableExtension, disableExtension, getEnabledExtensions } = useExtensions();

// Enable/disable extensions dynamically
enableExtension('gentle-send');
disableExtension('think-good-thoughts');

// Get current state
const enabled = getEnabledExtensions();
```

### Configuration Storage

Extensions can be configured per:
- **User**: Personal preferences
- **Chat**: Session-specific settings  
- **Organization**: Company-wide defaults
- **Global**: System-wide configurations

### Extension Marketplace (Future)

```typescript
// Load external extensions
const externalExtension = await loadExtensionFromURL('https://extensions.komensa.com/empathy-booster');
extensionRegistry.register(externalExtension);
```

## Use Cases by Context

### Couples Therapy
- **VizCue**: "Remember what you love about them"
- **SendButton**: Gentle delay with heart icon
- **Transform**: NVC translation for harsh language
- **Mediator**: Rogerian approach, minimal intervention

### Workplace Mediation  
- **VizCue**: "Focus on the shared goal"
- **SendButton**: Professional confirmation prompts
- **Transform**: Convert emotional to business language
- **Mediator**: Solution-focused, structured dialogue

### Family Conflicts
- **VizCue**: "Everyone wants to feel heard"
- **SendButton**: Cool-down timer for heated discussions
- **Transform**: Age-appropriate language adaptation
- **Mediator**: Family systems approach

### Cross-Cultural Communication
- **Transform**: Directness adaptation based on cultural norms
- **Mediator**: Cultural context awareness
- **Analytics**: Communication pattern insights

## Security and Privacy

### Extension Sandboxing
- Extensions run in isolated contexts
- Limited access to sensitive data
- Secure message transformation pipelines

### Data Handling
- Anonymized analytics collection
- Configurable privacy levels
- GDPR compliance for EU users

### Audit Trail
- Extension usage logging
- Transform operation tracking
- User consent management

## Performance Considerations

### Lazy Loading
- Extensions loaded only when needed
- Asynchronous transformation processing
- Caching for frequently used transforms

### Resource Management
- Memory usage monitoring
- Transform timeout handling
- Graceful degradation on failures

---

*The extension system makes Komensa infinitely customizable while maintaining therapeutic safety and user privacy. Extensions can be combined and configured to create tailored experiences for any mediation context.*

