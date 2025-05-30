# Stytch Phone Verification Setup Guide

This guide will help you set up Stytch phone verification for your Komensa application.

## 1. Create a Stytch Account

1. Go to [Stytch Dashboard](https://stytch.com/dashboard)
2. Sign up for a free account
3. Create a new project

## 2. Get Your Stytch Credentials

From your Stytch Dashboard:

1. Navigate to **API Keys** in the left sidebar
2. Copy the following values:
   - **Project ID** (starts with `project-test-` or `project-live-`)
   - **Secret** (starts with `secret-test-` or `secret-live-`)
   - **Public Token** (starts with `public-token-test-` or `public-token-live-`)

## 3. Configure Environment Variables

Update your `.env` file with your Stytch credentials:

```env
# Stytch (for phone verification)
STYTCH_PROJECT_ID=your-project-id-here
STYTCH_SECRET=your-secret-here
NEXT_PUBLIC_STYTCH_PUBLIC_TOKEN=your-public-token-here
```

## 4. Configure Stytch Dashboard Settings

### Enable SMS OTP

1. In your Stytch Dashboard, go to **Configuration** → **Authentication products**
2. Enable **SMS passcodes (OTP)**
3. Configure your SMS settings:
   - Set expiration time (default: 10 minutes)
   - Configure rate limiting as needed

### Set Up Test Environment

For development, Stytch provides test phone numbers that don't send real SMS:

- **Test Phone Number**: `+15005550006`
- **Test OTP Code**: `000000` (six zeros)

### Configure Production Settings

For production:

1. Switch to **Live** environment in your Stytch Dashboard
2. Add a payment method (required for SMS in production)
3. Configure toll fraud protection
4. Set up proper rate limiting

## 5. Test the Integration

### Using the Test Page

1. Start your development server: `npm run dev`
2. Navigate to `http://localhost:3000/test-phone`
3. Use the test phone number `+15005550006`
4. Enter the test OTP code `000000`

### Using the Sign-In Flow

1. Go to `http://localhost:3000/auth/signin`
2. Enter a phone number
3. Choose "Continue with Phone Number"
4. Complete the phone verification process

## 6. Integration Details

### API Routes

The integration includes two API routes:

- **`/api/phone/send-otp`** - Sends SMS OTP using Stytch
- **`/api/phone/verify-otp`** - Verifies the OTP code

### Components

- **`PhoneVerification`** - React component for phone verification UI
- **Stytch Client** - Server-side client configuration in `lib/stytch.ts`

### Authentication Flow

1. User enters phone number
2. Stytch sends SMS OTP
3. User enters verification code
4. System verifies code with Stytch
5. User is authenticated/registered

## 7. Security Considerations

### Rate Limiting

Stytch provides built-in rate limiting, but you should also implement:

- Client-side rate limiting for send OTP requests
- Server-side validation of phone number formats
- Monitoring for suspicious activity

### Toll Fraud Protection

- Enable Stytch's Device Fingerprinting for additional security
- Monitor usage patterns for unusual activity
- Set up alerts for high SMS volumes

### Data Privacy

- Phone numbers are stored in Stytch's secure infrastructure
- Consider your data retention policies
- Ensure compliance with local privacy regulations

## 8. Troubleshooting

### Common Issues

1. **"Invalid credentials"** - Check your environment variables
2. **"SMS not sent"** - Verify phone number format (+1XXXXXXXXXX)
3. **"Invalid OTP"** - Check if code has expired (default: 10 minutes)

### Debug Mode

Enable debug logging by setting:

```env
NODE_ENV=development
```

### Support

- [Stytch Documentation](https://stytch.com/docs)
- [Stytch Community Slack](https://stytch.com/slack)
- [Support Email](mailto:support@stytch.com)

## 9. Next Steps

### Database Integration

To store phone verification status in your database:

1. Add phone fields to your User model in `prisma/schema.prisma`:

```prisma
model User {
  // ... existing fields
  phone_number     String?
  phone_verified   Boolean  @default(false)
  phone_verified_at DateTime?
}
```

2. Run migration: `npx prisma migrate dev`

3. Update the verify-otp API route to save phone data

### Multi-Factor Authentication

Consider implementing phone verification as a second factor:

- Require phone verification for sensitive actions
- Use as backup authentication method
- Implement step-up authentication

### Integration with NextAuth.js

The current setup works alongside NextAuth.js:

- Google OAuth for primary authentication
- Stytch for phone verification
- Combined user profiles in your database 