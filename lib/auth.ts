// GPT CONTEXT:
// This file provides NextAuth configuration and session helpers.
// Related modules: /app/api/messages/route.ts, /lib/prisma.ts

import { getServerSession } from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from '@/lib/prisma'
import { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google';

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    })
  ],
  session: {
    strategy: 'jwt'
  },
  pages: {
    signIn: '/login'
  }
}

export async function auth() {
  return await getServerSession(authOptions);
}
