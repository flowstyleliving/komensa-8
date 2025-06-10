# Guest Registration Fix

## Issue Description
Guest users were getting "Access denied - guests can only access their invited chat" error when trying to access `/dashboard` after completing feedback and entering their email for registration. This happened because:

1. Guest users are restricted by middleware to only access their specific chat
2. The guest conversion API didn't update their session immediately
3. They remained "guests" in their JWT token until a new sign-in

## Root Cause
The `middleware.ts` blocks guest users from accessing `/dashboard` (lines 140-144). Even after converting their account via `/api/auth/convert-guest`, they remained in a guest session state until manually signing in again.

## Solution: Registration Page Bypass
Created a dedicated registration page that bypasses middleware restrictions and handles both new accounts and existing email sign-ins.

## Files Modified

### 1. `/middleware.ts`
```diff
+ pathname === '/auth/register' || // Allow guest registration page
```

Updated matcher regex:
```diff
- '/((?!...|auth/signin|test-phone|...).*)'
+ '/((?!...|auth/signin|auth/register|test-phone|...).*)'
```

### 2. `/app/auth/register/page.tsx` (NEW)
- **Public Access**: Bypasses middleware authentication
- **Smart Registration**: Checks if email exists first
  - If exists: Signs them in automatically
  - If new: Creates account then signs them in
- **Pre-filled Forms**: Accepts `?email=` and `?name=` URL parameters
- **Beautiful UI**: Matches Komensa design system

### 3. `/app/feedback/[chatId]/page.tsx`
```diff
- router.push('/dashboard'); // Would fail for guests
+ router.push(`/auth/register?email=${email}&name=${name}`); // Works for everyone
```

## Flow Comparison

### Before (Broken):
1. Guest completes feedback
2. Guest enters email → calls `/api/auth/convert-guest`
3. Guest still has guest JWT token
4. Redirect to `/dashboard` → **Middleware blocks access**
5. Error: "Access denied - guests can only access their invited chat"

### After (Fixed):
1. Guest completes feedback  
2. Guest enters email → redirect to `/auth/register?email=...&name=...`
3. Registration page auto-fills email and name
4. Smart registration flow:
   - Checks if email exists in database
   - Creates account OR signs in existing user
   - Issues new non-guest JWT token
5. Redirect to `/dashboard` → **Success!**

## Key Benefits

1. **No Middleware Conflicts**: Registration page bypasses guest restrictions
2. **Smart Handling**: Works for both new and existing emails
3. **Seamless UX**: Pre-filled forms, automatic sign-in
4. **Proper Session**: Creates clean non-guest session
5. **Future-Proof**: Can be used for any guest-to-user conversion

## Technical Details

- **Pre-fill Data**: URL parameters automatically populate form
- **Email Check**: Uses existing `/api/auth/check-email` endpoint
- **Account Creation**: Uses existing `/api/auth/signup-email` endpoint  
- **Authentication**: Uses NextAuth `signIn()` for proper session management
- **Error Handling**: User-friendly error messages for all failure cases

## Testing
- Build passes successfully
- TypeScript compilation clean
- All routes properly configured in middleware
- Registration page accessible without authentication 