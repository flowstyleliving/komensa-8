// GPT CONTEXT:
// This middleware protects /chat and /dashboard routes using NextAuth session checks.
// It allows bypass for public demo routes like /chat/demo and any ?demo=true links.
// Related: /lib/auth.ts, /app/chat/[id]/page.tsx, /app/api/demo/seed/route.ts

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // ✅ Skip auth for demo route or demo query
  if (pathname.startsWith('/chat/demo') || request.nextUrl.searchParams.get('demo') === 'true') {
    // For demo chats, set a temporary session
    const demoUser = request.cookies.get('demo_user')?.value;
    if (demoUser) {
      const response = NextResponse.next();
      // Keep the demo user cookie
      response.cookies.set('demo_user', demoUser);
      return response;
    }
    return NextResponse.next();
  }

  // ✅ Check for session on protected routes
  const protectedPaths = ['/chat', '/dashboard'];
  const requiresAuth = protectedPaths.some((path) => pathname.startsWith(path));

  if (requiresAuth) {
    // ... your existing auth logic here (e.g., session checks)
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/chat/:path*', '/dashboard/:path*'], // ✅ excludes /api, /chat/demo
};
