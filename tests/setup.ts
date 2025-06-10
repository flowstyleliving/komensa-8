// Jest setup file
import '@testing-library/jest-dom'

// Mock environment variables for testing
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'
process.env.NEXTAUTH_SECRET = 'test-secret'
process.env.OPENAI_API_KEY = 'test-openai-key'

// Mock Prisma client globally
jest.mock('@/lib/prisma', () => ({
  prisma: {
    waitingRoomAnswers: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    chatParticipant: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    chat: {
      update: jest.fn(),
    },
    event: {
      create: jest.fn(),
      findFirst: jest.fn(),
    },
  },
}))

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
  useSearchParams: () => ({
    get: jest.fn(),
  }),
}))

// Mock Next Auth
jest.mock('next-auth/react', () => ({
  useSession: () => ({
    data: {
      user: {
        id: 'test-user-id',
        name: 'Test User',
        email: 'test@example.com',
      },
    },
    status: 'authenticated',
  }),
}))

// Suppress console warnings in tests
global.console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn(),
}

