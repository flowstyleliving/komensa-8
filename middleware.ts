// GPT CONTEXT:
// This middleware protects /chat and /dashboard routes using NextAuth session checks.
// It allows bypass for public demo routes like /chat/demo and any ?demo=true links.
// Related: /lib/demoAuth.ts, /app/chat/[id]/page.tsx, /app/api/demo/seed/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  console.log('[Middleware] Processing request:', pathname);

  // Check if this is a demo request (either path-based or query parameter)
  const isDemo = pathname.startsWith('/demo/') || req.nextUrl.searchParams.get('demo') === 'true';

  // Allow requests for NextAuth.js session management, sign-in page, demo routes, and public files
  if (
    pathname === '/' || // Allow access to the splash page
    pathname.startsWith('/api/auth/') ||
    pathname.startsWith('/api/demo/') || // Allow demo API endpoints
    pathname === '/auth/signin' ||
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
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - auth/signin (signin page)
     * - images (public images)
     * - sounds (public sounds)
     * - demo (demo routes)
     *
     * This matcher is a broad-stroke. The logic inside the middleware function
     * provides more granular control.
     */
    '/((?!api/auth/|api/demo/|_next/static|_next/image|favicon.ico|auth/signin|images|sounds|demo).*)',
  ],
};
