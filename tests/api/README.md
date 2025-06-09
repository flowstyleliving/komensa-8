# API Tests Organization

This directory contains all API-related tests, development utilities, and debugging tools organized by purpose and type.

## Directory Structure

```
tests/api/
├── endpoints/          # Individual API endpoint tests
├── integration/        # Third-party service integration tests  
├── debug/             # Debugging and troubleshooting utilities
├── development/       # Development and configuration utilities
└── README.md          # This file
```

## Test Categories

### 📡 **Endpoints** (`/endpoints/`)
Tests for individual API endpoints and core functionality:

- **`ai-trigger/`** - AI response triggering tests
- **`chat/`** - Chat functionality tests  
- **`phone/`** - Phone verification tests
- **`signin/`** - Authentication flow tests
- **`trigger-mediator/`** - Mediator triggering tests
- **`turn-modes/`** - Turn-taking mode tests
- **`turn-state/`** - Turn state management tests
- **`typing-indicator/`** - Real-time typing tests
- **`users/`** - User management tests
- **`search-user/`** - User search functionality tests

### 🔗 **Integration** (`/integration/`)
Tests for external service integrations:

- **`mediator/`** - AI mediator integration tests
- **`mobile-realtime/`** - Mobile real-time functionality tests
- **`openai-assistant/`** - OpenAI API integration tests
- **`production/`** - Production environment tests
- **`pusher/`** - Pusher real-time service tests
- **`redis/`** - Redis caching and session tests
- **`stytch/`** - Stytch authentication service tests

### 🐛 **Debug** (`/debug/`)
Debugging and troubleshooting utilities:

- **`chat-debug/`** - Chat debugging utilities
- **`fix-chat-turn/`** - Chat turn fixing utilities
- **`fix-turn-queue/`** - Turn queue repair utilities
- **`turn/`** - Turn system debugging

### 🛠️ **Development** (`/development/`)
Development utilities and configuration tests:

- **`ai-status/`** - AI service status checks
- **`create-test-chat/`** - Test chat creation utilities
- **`env/`** - Environment variable tests
- **`env-check/`** - Environment validation utilities
- **`google-config/`** - Google OAuth configuration tests
- **`oauth/`** - OAuth flow tests
- **`oauth-scopes/`** - OAuth scope validation tests

## Usage Guidelines

### Running Tests

```bash
# Run all API tests
npm test tests/api

# Run specific category
npm test tests/api/endpoints
npm test tests/api/integration

# Run specific test
npm test tests/api/endpoints/chat
```

### Development Workflow

1. **Endpoint Development**: Use `/endpoints/` tests for new API routes
2. **Integration Testing**: Use `/integration/` for third-party service tests
3. **Debugging Issues**: Use `/debug/` utilities for troubleshooting
4. **Environment Setup**: Use `/development/` for configuration validation

### Test Environment

Most tests require environment variables to be set:

```bash
# Copy example environment
cp .env.example .env.test

# Set test-specific variables
NEXT_PUBLIC_ENVIRONMENT=test
DATABASE_URL=your_test_database_url
REDIS_URL=your_test_redis_url
```

### Adding New Tests

1. **Choose the right category** based on test purpose
2. **Follow naming conventions**: `test-[feature-name]` or `[feature-name]`
3. **Include proper documentation** in test files
4. **Add environment requirements** if needed

## Production API Structure

The main production API is organized in `app/api/`:

```
app/api/
├── auth/              # Authentication endpoints
├── chat/              # Chat management
├── chats/             # Chat operations  
├── dashboard/         # Dashboard data
├── feedback/          # User feedback
├── invite/            # Invitation system
├── messages/          # Message handling
├── notifications/     # Push notifications
├── phone/             # Phone verification
├── search/            # Search functionality
├── stripe/            # Payment processing
├── system/            # System utilities
├── turn/              # Turn management
├── typing/            # Typing indicators
├── upload/            # File uploads
├── users/             # User management
└── webhooks/          # External webhooks
```

## Security Considerations

- **Test data isolation**: Use separate test databases
- **API key management**: Use test-specific API keys
- **Rate limiting**: Be aware of rate limits in integration tests
- **Data cleanup**: Clean up test data after runs

## Debugging Tips

### Common Issues

1. **Environment Variables**: Check `.env.test` configuration
2. **Database State**: Ensure clean test database state
3. **External Services**: Verify third-party service availability
4. **Rate Limits**: Check for API rate limiting

### Debug Utilities

Use the `/debug/` utilities for common issues:

```bash
# Check turn system state
curl http://localhost:3000/tests/api/debug/turn

# Fix chat turn issues  
curl http://localhost:3000/tests/api/debug/fix-chat-turn

# Repair turn queue
curl http://localhost:3000/tests/api/debug/fix-turn-queue
```

## Contributing

When adding new tests:

1. **Follow the organization structure**
2. **Add proper documentation**
3. **Include error handling**
4. **Test both success and failure cases**
5. **Update this README if needed**

---

*This organization separates production APIs from test utilities, making the codebase cleaner and easier to navigate.* 