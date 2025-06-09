# AI Reply Generation System

## Overview

Komensa's AI reply generation system is the core engine that powers AI-mediated conversations. It integrates with the [Turn Management System](./TURN_FLOW_SYSTEM.md) to provide intelligent, context-aware responses through OpenAI's Assistant API.

## Architecture: Micro to Macro

```
┌─────────────────────────────────────────────────────────────┐
│                    User Interaction                        │
├─────────────────────────────────────────────────────────────┤
│ ChatInput.tsx → Message sent → API trigger                 │
└─────────────────────────────────────────────────────────────┘
                               ↓
┌─────────────────────────────────────────────────────────────┐
│                 Turn Management Gate                       │
├─────────────────────────────────────────────────────────────┤
│ TurnManager.shouldTriggerAIResponse() → Permission Check   │
└─────────────────────────────────────────────────────────────┘
                               ↓
┌─────────────────────────────────────────────────────────────┐
│                AI Generation Pipeline                      │
├─────────────────────────────────────────────────────────────┤
│ generateAIReply() → OpenAI Assistant API → Response        │
└─────────────────────────────────────────────────────────────┘
                               ↓
┌─────────────────────────────────────────────────────────────┐
│                Real-time Broadcasting                      │
├─────────────────────────────────────────────────────────────┤
│ Pusher Events → Database Storage → Turn State Update       │
└─────────────────────────────────────────────────────────────┘
```

## Core Function: generateAIReply

**Location**: `features/ai/services/generateAIReply.ts`

### Function Signature

```typescript
export async function generateAIReply({
  chatId: string,
  userId: string,
  userMessage: string,
  userAgent?: string
}): Promise<{ content: string; skipped?: boolean }>
```

### High-Level Flow

1. **Turn Management Check** (Lines 44-53)
2. **Environment Setup** (Lines 54-87)
3. **Typing Indicators** (Lines 129-155)
4. **Thread Management** (Lines 180-252)
5. **AI Generation** (Lines 284-384)
6. **Response Processing** (Lines 387-434)
7. **Turn State Sync** (Lines 436-477)

## Detailed Component Breakdown

### 1. Turn Management Integration

```typescript
// Check if AI should respond based on turn management
const turnManager = new TurnManager(chatId);
const shouldRespond = await turnManager.shouldTriggerAIResponse();

if (!shouldRespond) {
  return { content: '', skipped: true };
}
```

**Integration Points**:
- `features/chat/services/turnManager.ts:46` - Permission check
- Respects turn modes: `flexible`, `strict`, `moderated`
- Prevents unnecessary AI responses

### 2. Mobile Optimization

```typescript
const isMobile = userAgent ? /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent) : false;

// Mobile-specific timeouts
const globalTimeout = 90000; // 90 seconds
const runCreationTimeout = 30000; // 30 seconds
const pollingInterval = 1000; // 1 second
```

**Mobile Considerations**:
- Shorter timeouts for mobile devices
- Network-aware error handling
- Battery-efficient polling intervals

### 3. Real-time User Feedback

```typescript
// Set typing indicator immediately
await pusherServer.trigger(channelName, PUSHER_EVENTS.ASSISTANT_TYPING, { 
  isTyping: true,
  timestamp: Date.now(),
  source: 'ai_start',
  replyId
});

// Non-blocking Redis backup
setTypingIndicator(chatId, 'assistant', true).catch(err => 
  console.warn(`Redis failed, continuing:`, err)
);
```

**Real-time Components**:
- Pusher for immediate UI updates
- Redis for state persistence
- Graceful fallback on failures

### 4. OpenAI Assistant Integration

#### Thread Management
```typescript
// Get or create persistent conversation thread
let existingThread = await prisma.chatTurnState.findUnique({
  where: { chat_id: chatId },
  select: { thread_id: true }
});

if (!existingThread?.thread_id) {
  const thread = await openai.beta.threads.create();
  threadId = thread.id;
  
  // Store for conversation persistence
  await prisma.chatTurnState.upsert({
    where: { chat_id: chatId },
    update: { thread_id: threadId },
    create: { 
      chat_id: chatId,
      thread_id: threadId,
      next_user_id: 'assistant' 
    }
  });
}
```

#### Message Processing
```typescript
// Add user message to OpenAI thread
await openai.beta.threads.messages.create(threadId, {
  role: 'user',
  content: fullPrompt
});

// Create and monitor AI run
const run = await openai.beta.threads.runs.create(threadId, {
  assistant_id: OPENAI_ASSISTANT_ID
});

// Poll until completion
while (completedRun.status === 'in_progress' || completedRun.status === 'queued') {
  await new Promise(resolve => setTimeout(resolve, pollingInterval));
  completedRun = await openai.beta.threads.runs.retrieve(threadId, run.id);
}
```

### 5. Error Handling & Retry Logic

```typescript
// Retry wrapper for OpenAI operations
const retryOpenAIOperation = async (operation, operationType, isMobile) => {
  // Implements exponential backoff
  // Mobile-specific retry counts
  // Network quality detection
};

// Global timeout protection
const timeoutPromise = new Promise<never>((_, reject) => {
  timeoutId = setTimeout(async () => {
    await cleanup('global_timeout');
    reject(new Error(`AI reply generation timed out after ${globalTimeout}ms`));
  }, globalTimeout);
});

const result = await Promise.race([replyPromise, timeoutPromise]);
```

### 6. Database Integration

```typescript
// Store AI response in event log
const newMessage = await prisma.event.create({
  data: {
    chat_id: chatId,
    type: 'message',
    data: { content: cleanedMessage, senderId: 'assistant' }
  }
});
```

**Database Schema Dependencies**:
- `Event` table for message storage
- `ChatTurnState` for OpenAI thread persistence
- `ChatParticipant` for user management

### 7. Turn State Synchronization

```typescript
// Sync with turn management after AI response
const turnManager = new TurnManager(chatId);
const calculatedTurn = await turnManager.getCurrentTurn();

if (calculatedTurn?.next_user_id) {
  await prisma.chatTurnState.upsert({
    where: { chat_id: chatId },
    update: { 
      next_user_id: calculatedTurn.next_user_id,
      updated_at: new Date()
    },
    create: {
      chat_id: chatId,
      next_user_id: calculatedTurn.next_user_id
    }
  });
  
  // Broadcast turn update
  await pusherServer.trigger(channelName, PUSHER_EVENTS.TURN_UPDATE, { 
    next_user_id: calculatedTurn.next_user_id,
    next_role: calculatedTurn.next_role
  });
}
```

## Key Dependencies

### External Services
- **OpenAI Assistant API**: Core AI generation
- **Pusher**: Real-time event broadcasting
- **Redis**: State caching and typing indicators
- **Prisma**: Database ORM

### Internal Systems
- **Turn Manager**: Permission and flow control
- **Retry Utilities**: Network resilience
- **Event System**: Message persistence

### Configuration
```typescript
// Required environment variables
OPENAI_ASSISTANT_ID: string   // OpenAI Assistant ID
OPENAI_API_KEY: string        // OpenAI API key
PUSHER_APP_ID: string         // Pusher configuration
REDIS_URL: string             // Redis connection
DATABASE_URL: string          // Database connection
```

## Integration with Turn Management

### Turn Mode Behaviors

#### Flexible Mode
```typescript
// AI responds after every human message
async shouldTriggerAIResponse(): Promise<boolean> {
  const mode = await this.getTurnMode();
  if (mode === 'flexible') return true;
  // ...
}
```

#### Strict Mode
```typescript
// AI responds at end of participant round
case 'strict': 
  return this.isEndOfRound(); // Checks if all participants have spoken
```

#### Moderated Mode
```typescript
// AI responds to guide conversation
case 'moderated': 
  return true; // Always available to moderate
```

## Performance Characteristics

### Response Times
- **Fast Path**: 2-4 seconds (cached thread, simple prompt)
- **Slow Path**: 8-15 seconds (new thread, complex generation)
- **Mobile**: 10-20% longer due to conservative timeouts

### Scalability
- **Concurrent Chats**: Limited by OpenAI API rate limits
- **Database Load**: Minimal (few queries per generation)
- **Memory Usage**: Low (stateless function design)

### Error Recovery
- **Timeout Protection**: Global and operation-specific timeouts
- **Graceful Degradation**: Continues on non-critical failures
- **State Cleanup**: Automatic cleanup of typing indicators

## Monitoring & Debugging

### Logging Strategy
```typescript
const replyId = `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
console.log(`[AI Reply] ${replyId} - Starting AI reply generation`);
// All operations tagged with replyId for tracing
```

### Key Metrics to Monitor
- AI response generation time
- OpenAI API error rates
- Turn management permission failures
- Database query performance
- Pusher event delivery success

### Debug Endpoints
- `app/api/test-ai-trigger/route.ts` - Manual AI trigger testing
- `app/api/chat/[chatId]/debug/route.ts` - Chat state debugging

## Future Enhancements

### Planned Improvements
1. **Streaming Responses**: Real-time AI response streaming
2. **Context Awareness**: Better conversation history integration
3. **Multi-modal Support**: Image and file handling
4. **Custom Prompts**: Per-chat AI personality configuration

### Extension Points
```typescript
// Custom AI response processing
interface AIResponseProcessor {
  preProcess(message: string): Promise<string>;
  postProcess(response: string): Promise<string>;
}

// Custom turn triggers
interface TurnTrigger {
  shouldTriggerAI(context: ChatContext): Promise<boolean>;
}
```

## Testing Strategy

### Unit Tests
- Turn management integration
- Error handling scenarios
- Mobile optimization logic
- Timeout behavior

### Integration Tests
- End-to-end AI generation flow
- Real-time event broadcasting
- Database state consistency
- OpenAI API integration

### Load Tests
- Concurrent chat handling
- OpenAI rate limit behavior
- Database performance under load
- Mobile network conditions

## Troubleshooting

### Common Issues

#### AI Not Responding
1. Check turn management permissions
2. Verify OpenAI Assistant ID configuration
3. Check OpenAI API rate limits
4. Review chat participant setup

#### Slow Response Times
1. Monitor OpenAI API status
2. Check database query performance
3. Verify network connectivity
4. Review timeout configurations

#### State Inconsistencies
1. Check Pusher event delivery
2. Verify Redis connectivity
3. Review turn state synchronization
4. Monitor database transaction integrity

### Debug Commands
```bash
# Check OpenAI configuration
curl -X GET /api/test-ai-trigger

# Verify turn management state
curl -X GET /api/chat/[chatId]/state

# Test real-time connectivity
curl -X GET /api/test-pusher
```

This AI reply generation system provides the foundation for intelligent conversation mediation while maintaining simplicity, reliability, and extensibility for future enhancements.