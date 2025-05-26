// GPT CONTEXT:
// This file provides a helper for retrieving the current authenticated session using NextAuth.
// Related modules: /app/api/messages/route.ts, /lib/prisma.ts
// Do NOT modify NextAuth config directly here.

import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/[...nextauth]/route';

export async function auth() {
  return await getServerSession(authOptions);
}
