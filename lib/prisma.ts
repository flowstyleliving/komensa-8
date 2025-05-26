// GPT CONTEXT:
// This file exports a Prisma client configured for use with the Neon database in a Vercel Edge-compatible way.
// Related modules: /app/api/messages/route.ts, /prisma/schema.prisma
// Do NOT modify this file once it is stable.

import { PrismaClient } from '@prisma/client'

export const prisma = new PrismaClient()
