// GPT CONTEXT:
// This middleware protects /chat and /dashboard routes using NextAuth session checks.
// It allows bypass for public demo routes like /chat/demo and any ?demo=true links.
// It also handles guest sessions for invite-based chat access.
// Related: /lib/demoAuth.ts, /app/chat/[id]/page.tsx, /app/api/demo/seed/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  console.log('[Middleware] Processing request:', pathname);

  // Check if this is a demo request (either path-based or query parameter)
  const isDemo = pathname === '/demo' || pathname.startsWith('/demo/') || req.nextUrl.searchParams.get('demo') === 'true';

  // Allow requests for NextAuth.js session management, sign-in page, demo routes, invite routes, and public files
  if (
    pathname === '/' || // Allow access to the splash page
    pathname.startsWith('/api/auth/') ||
    pathname.startsWith('/api/demo/') || // Allow demo API endpoints
    pathname.startsWith('/api/debug/') || // Allow debug API endpoints
    pathname.startsWith('/api/phone/') || // Allow phone verification API endpoints
    pathname.startsWith('/api/users/') || // Allow user search API endpoints
    pathname.startsWith('/api/chat/') || // Allow individual chat API endpoints
    pathname.startsWith('/api/chats/') || // Allow chat creation API endpoints
    pathname.startsWith('/api/messages') || // Allow messages API endpoints
    pathname.startsWith('/api/typing') || // Allow typing indicator API endpoints
    pathname.startsWith('/api/invite/') || // Allow invite API endpoints
    pathname.startsWith('/api/feedback') || // Allow feedback API endpoints
    pathname.startsWith('/tests/api/') || // Allow test/debug API endpoints
    pathname.startsWith('/invite/') || // Allow invite pages
    pathname === '/auth/signin' ||
    pathname === '/test-phone' || // Allow phone verification test page
    pathname === '/test-chat' || // Allow chat modal test page
    pathname === '/test-signin' || // Allow signin test page
    pathname === '/manifest.json' || // Allow PWA manifest
    pathname === '/favicon.ico' || // Allow favicon
    pathname === '/icon.svg' || // Allow icon
    pathname === '/apple-touch-icon.png' || // Allow Apple touch icon
    pathname.startsWith('/icon-') || // Allow PWA icons
    isDemo || // Allow demo requests (both /demo/ paths and ?demo=true)
    pathname.startsWith('/_next/') || // Next.js internal assets
    pathname.startsWith('/images/') || // Your public images
    pathname.startsWith('/sounds/') || // Your public sounds (if any)
    pathname.includes('.') // Generally allows files with extensions (e.g., .png, .css)
  ) {
    console.log('[Middleware] Allowing request:', pathname);
    return NextResponse.next();
  }

  console.log('[Middleware] Blocking request, checking auth:', pathname);
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  if (!token) {
    console.log('[Middleware] No token, redirecting to signin:', pathname);
    const signInUrl = new URL('/auth/signin', req.url);
    // Optionally, add a callbackUrl to redirect back to the original page after sign-in
    // signInUrl.searchParams.set('callbackUrl', req.nextUrl.pathname);
    return NextResponse.redirect(signInUrl);
  }

  // For guest users, only allow access to their specific chat
  if (token.isGuest && pathname.startsWith('/chat/')) {
    const chatIdFromPath = pathname.split('/chat/')[1]?.split('/')[0];
    if (chatIdFromPath && chatIdFromPath !== token.chatId) {
      console.log('[Middleware] Guest trying to access unauthorized chat:', pathname);
      return NextResponse.json({ error: 'Access denied - guests can only access their invited chat' }, { status: 403 });
    }
  }

  // For guest users, allow access to feedback pages for their specific chat
  if (token.isGuest && pathname.startsWith('/feedback/')) {
    const chatIdFromPath = pathname.split('/feedback/')[1]?.split('/')[0];
    if (chatIdFromPath && chatIdFromPath !== token.chatId) {
      console.log('[Middleware] Guest trying to access unauthorized feedback:', pathname);
      return NextResponse.json({ error: 'Access denied - guests can only access feedback for their invited chat' }, { status: 403 });
    }
    // Allow access to feedback for their chat
    console.log('[Middleware] Allowing guest feedback access for their chat:', pathname);
    return NextResponse.next();
  }

  // Guests cannot access dashboard or other protected routes (except chat and feedback)
  if (token.isGuest && !pathname.startsWith('/chat/') && !pathname.startsWith('/feedback/')) {
    console.log('[Middleware] Guest trying to access unauthorized route:', pathname);
    return NextResponse.json({ error: 'Access denied - guests can only access their invited chat' }, { status: 403 });
  }

  console.log('[Middleware] Token found, allowing request:', pathname);
  return NextResponse.next();
}

// See "Matching Paths" below to learn more
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth/ (NextAuth.js routes)
     * - api/demo/ (Demo API routes)
     * - demo/api/ (Demo API routes under demo path)
     * - api/phone/ (Phone verification API routes)
     * - api/users/ (User search API routes)
     * - api/chat/ (Individual chat API routes)
     * - api/chats/ (Chat creation API routes)
     * - api/messages (Messages API routes)
     * - api/typing (Typing indicator API routes)
     * - api/invite/ (Invite API routes)
     * - api/feedback (Feedback API routes)
     * - invite/ (Invite pages)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - auth/signin (signin page)
     * - test-phone (phone verification test page)
     * - images (public images)
     * - sounds (public sounds)
     * - demo (demo routes)
     *
     * This matcher is a broad-stroke. The logic inside the middleware function
     * provides more granular control.
     */
    '/((?!api/auth/|api/demo/|demo/api/|api/phone/|api/users/|api/chat/|api/chats/|api/messages|api/typing|api/invite/|api/feedback|invite/|_next/static|_next/image|favicon.ico|auth/signin|test-phone|images|sounds|demo).*)',
  ],
};

