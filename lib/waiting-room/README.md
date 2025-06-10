# Waiting Room System Documentation

## Overview
The waiting room system manages the pre-chat experience where participants answer questions and prepare for their conversation. This system has been completely reorganized for better maintainability and type safety.

## Architecture

### Previous Issues (Fixed)
- ❌ Mixed Redis + Database storage causing confusion
- ❌ Scattered functionality across multiple files
- ❌ Inconsistent function naming
- ❌ Type safety issues between storage layers
- ❌ Difficult to test and maintain

### New Architecture
- ✅ **Database-first**: All persistent data stored in PostgreSQL
- ✅ **Layered approach**: Clear separation of concerns
- ✅ **Type safety**: Consistent TypeScript interfaces
- ✅ **Testable**: Pure functions with dependency injection
- ✅ **Single responsibility**: Each module has a clear purpose

## File Structure

```
lib/waiting-room/
├── index.ts                 # Main exports
├── types.ts                 # TypeScript interfaces
├── database-service.ts      # Database operations
├── service.ts              # Business logic
├── prompt-generator.ts     # AI prompt generation
└── README.md               # This documentation
```

## Modules

### 1. Types (`types.ts`)
Centralized TypeScript interfaces for type safety:
- `WaitingRoomAnswers` - Participant response data
- `ChatReadinessState` - Overall chat readiness status
- `WaitingRoomStatus` - UI state for components
- `ParticipantStatus` - Individual participant state
- `UserType` - Host/Guest enum

### 2. Database Service (`database-service.ts`)
Pure database operations with no business logic:
- `storeAnswers()` - Persist participant answers
- `getAnswersByUserId()` - Retrieve by user ID
- `getAnswersByUserType()` - Retrieve by host/guest type
- `getChatParticipants()` - Get all chat participants
- `markChatInitiated()` - Mark chat as started
- `isChatInitiated()` - Check initiation status
- `getParticipantUserType()` - Determine user type

### 3. Business Service (`service.ts`)
High-level business operations:
- `submitAnswers()` - Handle answer submission
- `getReadinessState()` - Check if both participants ready
- `getWaitingRoomStatus()` - Get full UI state
- `initiateChatIfReady()` - Start chat when ready
- `isUserAuthorized()` - Verify access permissions

### 4. Prompt Generator (`prompt-generator.ts`)
AI prompt generation:
- `generateMediatorIntroPrompt()` - Create personalized welcome message

## Usage Examples

### Basic Usage
```typescript
import { WaitingRoomService, WaitingRoomAnswers } from '@/lib/waiting-room';

// Submit participant answers
const answers: WaitingRoomAnswers = {
  name: 'John',
  whatBroughtYouHere: 'Need to resolve conflict',
  // ... other fields
};
await WaitingRoomService.submitAnswers(chatId, userId, answers);

// Check readiness and initiate chat
const initiation = await WaitingRoomService.initiateChatIfReady(chatId);
if (initiation.initiated) {
  console.log('Chat started!', initiation.aiIntroduction);
}
```

### API Endpoint Usage
```typescript
// In API routes
import { WaitingRoomService } from '@/lib/waiting-room';

const status = await WaitingRoomService.getWaitingRoomStatus(chatId, userId);
return NextResponse.json(status);
```

## Database Schema

The system uses the `waiting_room_answers` table:

```sql
CREATE TABLE waiting_room_answers (
  id UUID PRIMARY KEY,
  chat_id UUID REFERENCES chats(id),
  user_id UUID REFERENCES users(id),
  name TEXT NOT NULL,
  what_brought_you_here TEXT NOT NULL,
  hope_to_accomplish TEXT NOT NULL,
  current_feeling TEXT NOT NULL,
  communication_style TEXT NOT NULL,
  topics_to_avoid TEXT,
  is_ready BOOLEAN DEFAULT false,
  submitted_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (chat_id, user_id)
);
```

## Migration from Old System

### Old Files (Deprecated)
- `lib/waiting-room-questions.ts` - Replaced by organized modules
- `lib/redis-waiting-room.ts` - Still used for real-time status (Redis cache)

### Breaking Changes
- Function names changed for consistency
- Return types standardized
- Error handling improved
- Database-first approach

### Migration Guide
1. Replace imports:
   ```typescript
   // Old
   import { storeParticipantAnswers } from '@/lib/waiting-room-questions';
   
   // New
   import { WaitingRoomService } from '@/lib/waiting-room';
   WaitingRoomService.submitAnswers();
   ```

2. Update function calls:
   ```typescript
   // Old
   await storeParticipantAnswers(chatId, userId, userType, answers);
   
   // New
   await WaitingRoomService.submitAnswers(chatId, userId, answers);
   ```

## Real-time Features

The system maintains real-time capabilities through:
- **Pusher**: Real-time notifications between participants
- **Polling fallback**: Ensures reliability if WebSocket fails
- **Database events**: Persistent event log for chat initiation

## Testing Strategy

### Unit Tests
- Database service functions (pure functions)
- Prompt generation (deterministic)
- Type validation

### Integration Tests
- Full workflow from answers to chat initiation
- API endpoint behavior
- Real-time notification flow

### E2E Tests
- Complete user journey
- Multiple participant scenarios
- Error handling and recovery

## Performance Considerations

### Database Optimizations
- Compound index on `(chat_id, user_id)`
- Efficient queries using proper relations
- Minimal data transfer with specific selects

### Caching Strategy
- Redis for temporary status (5-10 min TTL)
- Database for persistent data
- Optimistic UI updates

## Future Enhancements

### Planned Features
1. **Analytics**: Track completion rates and user feedback
2. **A/B Testing**: Different question sets and prompts
3. **Internationalization**: Multi-language support
4. **Advanced Matching**: AI-powered participant matching
5. **Custom Questions**: Host-defined question sets

### Technical Debt
- [ ] Remove legacy Redis dependencies
- [ ] Add comprehensive error boundaries
- [ ] Implement retry mechanisms
- [ ] Add monitoring and alerting

## Troubleshooting

### Common Issues
1. **Prisma Client Errors**: Run `npx prisma generate` after schema changes
2. **Type Errors**: Ensure imports are from the new module structure
3. **Database Connection**: Check DATABASE_URL environment variable
4. **Real-time Issues**: Verify Pusher configuration and fallback polling

### Debug Commands
```bash
# Regenerate Prisma client
npx prisma generate

# Check database connection
npx prisma db pull

# View waiting room data
npx prisma studio
``` 