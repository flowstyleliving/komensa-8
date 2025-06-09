# Turn Management System Standardization

## Overview

This document outlines the standardization effort completed for Komensa's turn management system to eliminate nomenclature inconsistencies and create a unified approach.

## Key Changes Made

### 1. Standardized Naming Convention

**Before:**
- Multiple field names: `settings.turnStyle`, `turn_taking`, `chatType`
- Inconsistent method names: `getTurnStyle()`, `getTurnMode()`
- Mixed terminology across codebase

**After:**
- **Database field**: `turn_taking` (String)
- **Method name**: `getTurnMode()`
- **Variable names**: `mode` (consistently used everywhere)

### 2. Unified Turn Modes

**Standardized to 4 modes:**

1. **`flexible`** (Default)
   - Anyone can speak anytime
   - Natural conversation flow
   - AI responds after any message
   - No database state needed

2. **`strict`**
   - Round-robin through participant array
   - One person speaks at a time in order
   - AI responds after each person (facilitates exchanges)
   - Optional ChatTurnState record for complex scenarios

3. **`moderated`**
   - AI manages conversation flow
   - Rate limiting (max 2 messages per minute)
   - AI responds after any message to moderate
   - Prevents spam and maintains quality

4. **`rounds`**
   - Round-robin through participant array (same as strict)
   - One person speaks at a time in order
   - AI responds only after complete rounds (minimal AI)
   - Optional ChatTurnState record for complex scenarios

### 3. Files Updated

#### Core Turn Management
- `features/chat/services/turnManager.ts`
  - Renamed `getTurnStyle()` → `getTurnMode()`
  - Updated all variable names from `style` → `mode`
  - Maintained existing logic with consistent naming

#### Settings Interface
- `app/chat/[chatId]/settings/page.tsx`
  - Changed from binary switch to radio buttons
  - Added `moderated` option
  - Improved UI descriptions

#### API Routes
- `app/api/chat/[chatId]/state/route.ts`
  - Updated method calls to use `getTurnMode()`
  - Consistent variable naming

#### Extensions
- `extensions/turn-taking/manifest.json`
  - Changed `turnStyle` → `turn_taking`
  - Updated option descriptions
  - Aligned with core system naming

#### Documentation
- `docs/TURN_FLOW_SYSTEM.md`
  - Updated code examples
  - Fixed schema references
  - Consistent method naming

### 4. Database Schema

**No changes needed** - the schema already used `turn_taking`:

```sql
model Chat {
  turn_taking String @default("strict")
  -- Other fields...
}
```

### 5. Extension Integration Points

Extensions can now consistently reference:
- **Database field**: `chat.turn_taking`
- **Values**: `"flexible"`, `"strict"`, `"moderated"`, `"rounds"`
- **API methods**: `getTurnMode()`, `canUserSendMessage()`, etc.

## Implementation Benefits

### 1. Consistency
- Single source of truth for turn mode configuration
- Consistent naming across all files and systems
- Clear extension integration points

### 2. Maintainability
- Reduced cognitive load for developers
- Easier to search and modify code
- Clear separation of concerns

### 3. Extensibility
- Well-defined interface for extensions
- Easy to add new turn modes
- Consistent API surface

### 4. User Experience
- Clearer settings interface
- Better option descriptions
- Intuitive mode selection

## Testing

Created test utilities:
- `tests/api/turn-state/test-turn-manager.ts` - Basic functionality verification
- Build verification ensures TypeScript consistency

## Migration Notes

### For Existing Chats
- Existing chats continue to work seamlessly
- `turn_taking` values are preserved
- No data migration required

### For Extensions
- Extensions should update to use `turn_taking` field
- Old `turnStyle` references will not work
- New manifest format provides clearer options

### For Developers
- Use `getTurnMode()` instead of `getTurnStyle()`
- Variable naming should use `mode` consistently
- Reference the `turn_taking` database field directly

## Future Improvements

1. **Enhanced Moderated Mode**
   - ML-based conversation analysis
   - Dynamic rate limiting based on context
   - Advanced spam detection

2. **Custom Turn Policies**
   - User-defined turn patterns
   - Time-based restrictions
   - Role-based permissions

3. **Real-time Mode Switching**
   - Mid-conversation mode changes
   - Participant voting on mode
   - Automatic mode suggestions

## Conclusion

The turn management system now uses consistent nomenclature throughout the codebase, making it easier to understand, maintain, and extend. The four-mode system (`flexible`, `strict`, `moderated`, `rounds`) provides clear options for different conversation styles and AI involvement levels while maintaining the simplicity promised in the original design. 