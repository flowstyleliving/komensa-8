# Komensa Simplified Turn Management System

## Overview

Komensa implements a **dead-simple** turn management system that orchestrates conversations between participants and an AI assistant. The system prioritizes simplicity, reliability, and ease of extension over complex state management.

## Architecture Philosophy

**Core Principle**: Use participant arrays and basic rules instead of complex state machines.

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend Layer                           │
├─────────────────────────────────────────────────────────────┤
│ ChatInput.tsx → useChat.ts → API Routes → TurnManager.ts   │
└─────────────────────────────────────────────────────────────┘
                               ↓
┌─────────────────────────────────────────────────────────────┐
│                 Simplified Turn Logic                      │
├─────────────────────────────────────────────────────────────┤
│ Participant Array + Switch Statement (3 modes)            │
└─────────────────────────────────────────────────────────────┘
                               ↓
┌─────────────────────────────────────────────────────────────┐
│              Minimal Persistence                           │
├─────────────────────────────────────────────────────────────┤
│ Pusher (real-time) + ChatParticipant table + Events       │
└─────────────────────────────────────────────────────────────┘
```

## Turn Management Modes

### 1. Flexible (Default)
```typescript
// Anyone can speak anytime
async canUserSendMessage(userId: string): Promise<boolean> {
  return true;
}
```
- **Use Case**: Casual conversations, brainstorming, open discussion
- **AI Response**: After any human message
- **Database State**: None needed

### 2. Strict 
```typescript
// Round-robin through participant array
async canUserSendMessage(userId: string): Promise<boolean> {
  const participants = await this.getParticipants(); // [user1, user2, user3]
  const lastSender = await this.getLastMessageSender();
  const lastIndex = participants.indexOf(lastSender);
  const nextIndex = (lastIndex + 1) % participants.length;
  return participants[nextIndex] === userId;
}
```
- **Use Case**: Structured discussions with active AI facilitation
- **AI Response**: After each person speaks (facilitates exchanges)
- **Database State**: Optional ChatTurnState record

### 3. Moderated
```typescript
// Rate limiting to prevent spam
async canUserSendMessage(userId: string): Promise<boolean> {
  const recentMessages = await getRecentUserMessages(userId, 60000); // 1 minute
  return recentMessages.length < 2; // Max 2 messages per minute
}
```
- **Use Case**: Large groups, heated discussions, therapy sessions
- **AI Response**: To moderate and guide conversation
- **Database State**: None needed (checks recent message history)

### 4. Rounds
```typescript
// Round-robin through participant array (same as strict)
async canUserSendMessage(userId: string): Promise<boolean> {
  const participants = await this.getParticipants(); // [user1, user2, user3]
  const lastSender = await this.getLastMessageSender();
  const lastIndex = participants.indexOf(lastSender);
  const nextIndex = (lastIndex + 1) % participants.length;
  return participants[nextIndex] === userId;
}
```
- **Use Case**: Structured discussions with minimal AI involvement
- **AI Response**: Only after complete rounds (when last person speaks)
- **Database State**: Optional ChatTurnState record

## Core Implementation

### TurnManager.ts (Simplified)

```typescript
export class TurnManager {
  private chatId: string;

  // Get ordered participant array
  async getParticipants(): Promise<string[]> {
    const participants = await prisma.chatParticipant.findMany({
      where: { chat_id: this.chatId },
      orderBy: { user_id: 'asc' }, // Consistent ordering
      include: { user: { select: { id: true } } }
    });
    return participants.map(p => p.user.id);
  }

  // Dead simple permission check
  async canUserSendMessage(userId: string): Promise<boolean> {
    const mode = await this.getTurnMode();
    
    switch (mode) {
      case 'flexible': return true;
      case 'strict': return this.checkStrictTurn(userId);
      case 'rounds': return this.checkStrictTurn(userId); // Same as strict
      case 'moderated': return this.checkModeratedTurn(userId);
      default: return true;
    }
  }

  // Extensible AI trigger logic
  async shouldTriggerAIResponse(): Promise<boolean> {
    const mode = await this.getTurnMode();
    
    switch (mode) {
      case 'flexible': return true;
      case 'strict': return true; // AI facilitates each exchange
      case 'rounds': return this.isEndOfRound(); // AI only at round end
      case 'moderated': return true;
      default: return true;
    }
  }
}
```

## Adding New Participants

**The Key Insight**: When new users join, they're just added to the participant array.

```typescript
// When guest accepts invite
await prisma.chatParticipant.create({
  data: {
    chat_id: chatId,
    user_id: guestUserId,
    role: 'guest'
  }
});

// That's it! TurnManager.getParticipants() will now include them
// No complex state initialization needed
```

## Frontend State Management

### Simplified ChatInput Status

```typescript
const getTurnStatusContent = () => {
  if (!currentUserId) {
    return <SignInPrompt />;
  }

  // For flexible (default), show green "ready to chat"
  if (!currentTurn || currentTurn.next_user_id === 'anyone' || currentTurn.next_user_id === currentUserId) {
    return <ReadyToChat />;
  }

  // For strict, show whose turn it is
  const nextUserName = getParticipantName(currentTurn.next_user_id);
  return <WaitingForUser name={nextUserName} />;
};
```

### Elegant TopContent Display

```typescript
// Simple status indicator with emoji and clear messaging
const StatusIndicator = ({ canSend, status }) => (
  <div className={`flex items-center justify-center gap-2 text-sm p-3 rounded-lg border ${
    canSend ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'
  }`}>
    <div className={`w-4 h-4 rounded-full ${
      canSend ? 'bg-green-400' : 'bg-amber-400'
    }`} />
    <span className={canSend ? 'text-green-700' : 'text-amber-700'}>
      {canSend ? '💬 You can speak anytime' : `⏳ ${status}`}
    </span>
  </div>
);
```

## Database Schema (Minimal)

### Required Tables

```sql
-- Participants array (the core of the system)
ChatParticipant {
  chat_id: String
  user_id: String  
  role: String     -- 'user', 'guest', 'creator'
  -- ORDER BY user_id ASC gives consistent participant array
}

-- Message history (for turn calculation)
Event {
  chat_id: String
  type: String     -- 'message' 
  data: Json       -- { content, senderId }
  created_at: DateTime
}

-- Optional: Only for strict mode
ChatTurnState {
  chat_id: String @unique
  next_user_id: String?
  -- Minimal fields, most logic uses participant array
}

-- Settings
Chat {
  turn_taking: String   -- 'flexible' | 'strict' | 'moderated'
}
```

## Extension Points

### Adding New Turn Styles

```typescript
// In TurnManager.canUserSendMessage()
case 'therapy':
  // Therapist speaks after every 2 client messages
  const therapistId = await this.getTherapistId();
  const recentMessages = await this.getRecentMessages(2);
  const clientMessageCount = recentMessages.filter(m => m.senderId !== therapistId).length;
  return clientMessageCount >= 2 ? userId === therapistId : userId !== therapistId;

case 'debate':
  // Alternating sides with 2-minute time limits
  const side = await this.getUserSide(userId);
  const currentSide = await this.getCurrentSpeakingSide();
  const timeElapsed = await this.getTimeElapsedInTurn();
  return side === currentSide && timeElapsed < 120000;
```

### AI Response Triggers

```typescript
// In TurnManager.shouldTriggerAIResponse()
case 'therapy':
  // AI responds when client asks direct question or seems stuck
  const lastMessage = await this.getLastMessage();
  return lastMessage.content.includes('?') || this.detectStuckPattern(lastMessage);

case 'debate':
  // AI responds at end of each side's time or to moderate
  return this.isTimeExpired() || this.detectPersonalAttack();
```

## Performance Benefits

1. **O(1) Permission Checks**: No complex state traversal
2. **Minimal Database Queries**: Just participant array + last message
3. **No State Synchronization**: Participant array is source of truth
4. **Cache Friendly**: Settings and participants rarely change

## Error Recovery

```typescript
// Simple fallbacks
async canUserSendMessage(userId: string): Promise<boolean> {
  try {
    // Normal logic here
  } catch (error) {
    console.error('[TurnManager] Error:', error);
    return true; // Default to allowing messages
  }
}

// Auto-recovery for strict mode
if (strictModeParticipantNotFound) {
  return true; // Let anyone speak to unstick conversation
}
```

## Mobile Considerations

- **Network Resilient**: Simple participant array syncs quickly
- **Offline Friendly**: Can cache participant list and work offline
- **Fast Rendering**: Minimal UI state calculations
- **Battery Efficient**: Fewer database queries and real-time events

## Testing Strategy

### Unit Tests
```typescript
describe('TurnManager', () => {
  it('allows anyone in flexible mode', async () => {
    await setChatSettings({ turnStyle: 'flexible' });
    expect(await turnManager.canUserSendMessage('user1')).toBe(true);
    expect(await turnManager.canUserSendMessage('user2')).toBe(true);
  });

  it('enforces round-robin in strict mode', async () => {
    await setChatSettings({ turnStyle: 'strict' });
    await setParticipants(['user1', 'user2', 'user3']);
    await setLastSender('user1');
    
    expect(await turnManager.canUserSendMessage('user2')).toBe(true);
    expect(await turnManager.canUserSendMessage('user1')).toBe(false);
    expect(await turnManager.canUserSendMessage('user3')).toBe(false);
  });
});
```

### Integration Tests
- Guest user joins mid-conversation
- Turn style changes during active chat
- AI response triggering in different modes
- Network interruption recovery

## AI Integration

The turn management system seamlessly integrates with Komensa's AI reply generation system. See [AI Reply Generation System](./AI_REPLY_GENERATION.md) for detailed architecture.

### AI Response Triggering

```typescript
// Each turn mode has different AI trigger logic
async shouldTriggerAIResponse(): Promise<boolean> {
  const mode = await this.getTurnMode();
  
  switch (mode) {
    case 'flexible': 
      return true; // AI responds after any human message
    
    case 'strict': 
      return true; // AI responds after each person (facilitates exchanges)
    
    case 'moderated': 
      return true; // AI always available to moderate conversation
    
    case 'rounds': 
      return this.isEndOfRound(); // AI responds only after complete rounds
    
    default: 
      return true;
  }
}
```

### Integration Flow

1. **User sends message** → `useChat.ts` → API route
2. **Message stored** → Turn state updated
3. **AI trigger check** → `shouldTriggerAIResponse()`
4. **AI generates reply** → `generateAIReply()`
5. **Turn state synced** → Frontend updated

## Future Extensions

The 4-mode system easily supports:
- **Custom Turn Policies**: Add new cases to switch statement (5th mode, 6th mode, etc.)
- **Dynamic Participant Ordering**: Modify `getParticipants()` query
- **Complex AI Triggers**: Extend `shouldTriggerAIResponse()` with new logic
- **Multi-Chat Workflows**: Participants move between chats seamlessly
- **Time-Based Rules**: Add timestamp checks to permission logic
- **Hybrid Modes**: Combine features from existing modes

## Migration from Complex System

1. **Remove Policy Classes**: Consolidated into switch statements
2. **Eliminate EventDrivenTurnManager**: Logic moved to TurnManager
3. **Simplify Database**: Only create ChatTurnState for strict mode
4. **Update Frontend**: Simplified turn status display
5. **Maintain Compatibility**: Same API surface, simpler implementation

This simplified system maintains all functionality while being orders of magnitude easier to understand, debug, and extend.