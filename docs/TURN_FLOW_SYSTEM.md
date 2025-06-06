# Komensa Chat Turn Flow System Documentation

## Overview

Komensa implements a sophisticated event-driven turn management system that orchestrates mediated conversations between multiple participants and an AI assistant. The system ensures structured dialogue with proper turn-taking, real-time synchronization, and mobile-optimized performance.

## Architecture Overview

### Core Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend Layer                           │
├─────────────────────────────────────────────────────────────┤
│ ChatInput.tsx → useChat.ts → API Routes → TurnManager.ts   │
└─────────────────────────────────────────────────────────────┘
                               ↓
┌─────────────────────────────────────────────────────────────┐
│                 Turn Management Core                        │
├─────────────────────────────────────────────────────────────┤
│ EventDrivenTurnManager.ts ← TurnPolicies.ts               │
└─────────────────────────────────────────────────────────────┘
                               ↓
┌─────────────────────────────────────────────────────────────┐
│              Real-time & Persistence                       │
├─────────────────────────────────────────────────────────────┤
│ Pusher (real-time) + Prisma (database) + Redis (state)    │
└─────────────────────────────────────────────────────────────┘
```

## Complete Turn Flow

### 1. User Message Submission

```typescript
// User interaction flow
1. User types in ChatInput.tsx
2. canSendMessage() validates permission via useChat.ts
3. sendMessage() calls /api/messages endpoint
4. TurnManager.canUserSendMessage() validates turn permission
5. EventDrivenTurnManager analyzes chat history
6. TurnPolicy determines if user can speak now
```

### 2. Message Processing & Storage

```typescript
// Backend processing
1. Message validated and stored in Event table
2. NEW_MESSAGE event broadcast via Pusher
3. AI reply generation triggered asynchronously
4. Turn state recalculated and synchronized
5. TURN_UPDATE event broadcast to all participants
```

### 3. AI Response Generation

```typescript
// AI processing flow
1. generateAIReply.ts sets typing indicators
2. OpenAI Assistant API called with conversation context
3. Response processed and stored as Event
4. NEW_MESSAGE broadcast with AI response
5. Turn state updated to next participant
6. Typing indicators cleared
```

## Turn Management Components

### EventDrivenTurnManager

**Location**: `features/chat/services/EventDrivenTurnManager.ts`

**Responsibilities**:
- Analyzes chat events to determine current turn state
- Implements policy-based turn calculation
- Manages participant access control
- Provides turn display text for UI

**Key Methods**:
```typescript
calculateCurrentTurn(events: Event[], participants: ChatParticipant[]): ChatTurnState
canUserSendMessage(userId: string, currentTurn: ChatTurnState): boolean
getDisplayText(currentTurn: ChatTurnState, participants: ChatParticipant[]): string
```

### Turn Policies

**Location**: `features/chat/services/turnPolicies.ts`

**Available Policies**:

1. **Mediated Policy** (Default)
   - Strict alternation between users and AI mediator
   - Multi-participant: Round-robin rotation
   - First message: Any human participant can start

2. **Free-form Policy**
   - Anyone can speak at any time
   - Minimal AI intervention
   - Casual group conversations

3. **Round-robin Policy**
   - Strict sequential order between all participants
   - Rigid participant rotation
   - Structured group discussions

### TurnManager Facade

**Location**: `features/chat/services/turnManager.ts`

**Purpose**: High-level coordinator that:
- Delegates to EventDrivenTurnManager
- Handles typing indicator cleanup
- Manages database synchronization
- Provides backward compatibility

## Database Schema

### Core Tables

```sql
-- Current turn state for each chat
ChatTurnState {
  chat_id: String @unique
  next_user_id: String?
  thread_id: String?        // OpenAI thread reference
  current_turn_index: Int
  turn_queue: Json
  next_role: String?
  updated_at: DateTime
}

-- All chat events (messages, state changes)
Event {
  id: String @id
  chat_id: String
  type: String              // message, chat_created, state_update
  data: Json               // content, senderId, state updates
  created_at: DateTime
  seq: Int                 // Event sequence number
}

-- Chat participants and roles
ChatParticipant {
  chat_id: String
  user_id: String
  role: String             // user, assistant, creator
  added_at: DateTime
}

-- Individual participant state tracking
ParticipantState {
  chat_id: String
  user_id: String
  feelings: String?
  needs: String?
  viewpoint: String?
  updated_at: DateTime
}
```

## Real-time Synchronization

### Pusher Events

```typescript
// Core real-time events
NEW_MESSAGE: {
  chatId: string
  event: Event
  sender: User
}

TURN_UPDATE: {
  chatId: string
  nextUserId: string
  nextRole: string
  displayText: string
}

ASSISTANT_TYPING: {
  chatId: string
  isTyping: boolean
}

USER_TYPING: {
  chatId: string
  userId: string
  isTyping: boolean
}

STATE_UPDATE: {
  chatId: string
  participantState: ParticipantState
}
```

### Mobile-Optimized Connection

```typescript
// Pusher configuration for mobile reliability
const pusher = new Pusher(key, {
  cluster: 'us2',
  activityTimeout: 120000,    // 2 minutes for mobile networks
  pongTimeout: 30000,         // 30 seconds for mobile responses
  enableStats: false,         // Reduce mobile data usage
  forceTLS: true
});

// Connection health monitoring
pusher.connection.bind('state_change', handleConnectionStateChange);
pusher.connection.bind('error', handleConnectionError);
```

## State Management

### Frontend State (useChat.ts)

```typescript
interface ChatState {
  messages: Event[]
  currentTurn: {
    next_user_id: string | null
    next_role: string | null
    display_text: string
  }
  isAssistantTyping: boolean
  typingUsers: Set<string>
  participants: ChatParticipant[]
  connectionStatus: 'connected' | 'disconnected' | 'reconnecting'
}
```

### Redis State (Fast Access)

```typescript
// Typing indicators (expire automatically)
`typing:${chatId}:${userId}` → boolean (30s TTL)

// Connection presence
`presence:${chatId}:${userId}` → timestamp (60s TTL)

// Turn state cache
`turn:${chatId}` → ChatTurnState (10min TTL)
```

## Mobile Considerations

### Connection Reliability

```typescript
// Handle mobile browser lifecycle
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    // Refresh connection and sync state
    pusher.connection.connect();
    refreshChatState();
  }
});

// Network change detection
window.addEventListener('online', () => {
  // Reconnect and sync when network returns
  pusher.connection.connect();
  sendQueuedMessages();
});
```

### Performance Optimizations

- **Message Pagination**: Load recent messages first
- **Optimistic UI**: Show messages immediately, sync later
- **Debounced Typing**: Reduce typing indicator frequency
- **Memory Management**: Clean up event listeners and timers

### Background Processing

```typescript
// Handle AI processing during app backgrounding
const AI_PROCESSING_TIMEOUT = 120000; // 2 minutes

// Detect stuck AI and provide recovery
if (Date.now() - lastAIActivity > AI_PROCESSING_TIMEOUT) {
  await recoverFromStuckAI(chatId);
}
```

## Error Handling

### Turn Management Errors

```typescript
// Invalid turn attempts
if (!canUserSendMessage(userId, currentTurn)) {
  return Response.json(
    { error: 'Not your turn to speak' },
    { status: 403 }
  );
}

// Orphaned turn states
if (!currentTurn) {
  await initializeChatTurnState(chatId, participants);
}
```

### Real-time Communication Errors

```typescript
// Pusher connection failures
pusher.connection.bind('error', async (error) => {
  console.error('Pusher connection error:', error);
  
  // Implement exponential backoff retry
  setTimeout(() => {
    pusher.connection.connect();
  }, Math.min(1000 * Math.pow(2, retryCount), 30000));
});

// Message delivery confirmation
const sendMessageWithRetry = async (message, maxRetries = 3) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await apiClient.post('/api/messages', message);
      break;
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await sleep(1000 * Math.pow(2, i));
    }
  }
};
```

### AI Processing Errors

```typescript
// OpenAI API timeouts and retries
const generateAIReplyWithRetry = async (chatId: string) => {
  const maxRetries = 3;
  const timeouts = [30000, 60000, 90000]; // Increasing timeouts
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await openai.beta.threads.messages.create(
        threadId,
        { role: 'user', content: prompt },
        { timeout: timeouts[i] }
      );
    } catch (error) {
      if (i === maxRetries - 1) {
        // Fallback: Reset turn to user
        await resetTurnToUser(chatId);
        throw new Error('AI processing failed after retries');
      }
    }
  }
};
```

## Current Issues & Limitations

### Identified Problems

1. **Empty State Management File**: `features/chat/utils/state-management.ts` exists but is empty
2. **Legacy Architecture**: Dual manager system artifacts still present
3. **Mobile Typing Indicators**: Race conditions in typing cleanup during network switches
4. **Limited Offline Support**: No offline message queueing or background sync

### Extensibility Limitations

1. **Fixed Policies**: Only three predefined turn policies
2. **Participant Scaling**: No clear strategy for large group conversations
3. **Cross-Chat State**: Participants can't easily move between chats
4. **Custom Turn Logic**: No plugin system for domain-specific turn rules

### Mobile-Specific Issues

1. **Background AI Processing**: May timeout when app is backgrounded
2. **Network Switching**: Turn state may desync during WiFi/cellular transitions
3. **Memory Usage**: Long conversations may impact mobile performance
4. **Push Notifications**: Limited integration for turn change notifications

## Recommended Improvements

### 1. Architecture Consolidation
- Remove remaining dual manager artifacts
- Complete the empty state-management.ts file
- Standardize error handling patterns across components

### 2. Enhanced Mobile Support
```typescript
// Offline message queueing
interface QueuedMessage {
  id: string
  content: string
  timestamp: number
  retryCount: number
}

// Background sync when connection returns
const syncQueuedMessages = async () => {
  const queued = getQueuedMessages();
  for (const message of queued) {
    try {
      await sendMessage(message);
      removeFromQueue(message.id);
    } catch (error) {
      incrementRetryCount(message.id);
    }
  }
};
```

### 3. Monitoring & Observability
```typescript
// Turn state monitoring
const monitorTurnHealth = async (chatId: string) => {
  const lastActivity = await getLastChatActivity(chatId);
  const timeSinceLastActivity = Date.now() - lastActivity.timestamp;
  
  if (timeSinceLastActivity > STUCK_THRESHOLD) {
    await triggerTurnRecovery(chatId);
    logTurnHealthAlert(chatId, 'stuck_turn_detected');
  }
};
```

### 4. Plugin System for Policies
```typescript
interface TurnPolicy {
  name: string
  calculateNextTurn: (events: Event[], participants: ChatParticipant[]) => string | null
  canUserSend: (userId: string, currentTurn: ChatTurnState) => boolean
  getDisplayText: (currentTurn: ChatTurnState, participants: ChatParticipant[]) => string
}

// Registration system
TurnPolicyRegistry.register('custom-therapy', new TherapyTurnPolicy());
TurnPolicyRegistry.register('debate-style', new DebateTurnPolicy());
```

### 5. Performance Optimizations
```typescript
// Message pagination
const loadMessages = async (chatId: string, before?: string, limit = 50) => {
  return await prisma.event.findMany({
    where: { chat_id: chatId, created_at: before ? { lt: before } : undefined },
    orderBy: { created_at: 'desc' },
    take: limit
  });
};

// State compression for long conversations
const compressOldEvents = async (chatId: string) => {
  // Archive events older than 24 hours to separate table
  // Keep only essential events for turn calculation
};
```

## Testing Strategy

### Unit Tests
- Turn policy logic validation
- Event-driven turn calculation
- Permission checking edge cases

### Integration Tests
- Complete turn flow end-to-end
- Real-time synchronization
- Error recovery scenarios

### Mobile-Specific Tests
- Connection loss/recovery
- Background/foreground transitions
- Network switching scenarios

This system provides a robust foundation for mediated conversations with strong mobile support and real-time capabilities, but benefits from the identified improvements for long-term scalability and reliability.