import { signOut } from 'next-auth/react';

/**
 * Utility to clean up guest sessions and redirect to signin
 * This ensures guests don't remain in a session state when trying to access unauthorized areas
 */
export async function cleanGuestSessionAndRedirect() {
  console.log('[GuestUtils] Cleaning guest session and redirecting to signin');
  
  try {
    // Clear NextAuth session
    await signOut({ 
      redirect: false, // Don't auto-redirect, we'll handle it manually
      callbackUrl: '/auth/signin'
    });
    
    // Clear any remaining session cookies manually
    document.cookie = 'next-auth.session-token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    document.cookie = '__Secure-next-auth.session-token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; secure;';
    
    // Clear any cached session data
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('nextauth.message');
      window.sessionStorage.clear();
    }
    
    console.log('[GuestUtils] Session cleaned, redirecting to signin');
    
    // Force redirect to signin page
    window.location.href = '/auth/signin';
    
  } catch (error) {
    console.error('[GuestUtils] Error cleaning session:', error);
    // Fallback: force redirect even if signOut fails
    window.location.href = '/auth/signin';
  }
}

/**
 * Check if user is a guest and clean session if trying to access unauthorized areas
 */
export function checkAndCleanGuestAccess(session: any, allowedPaths: string[] = []) {
  if (!session?.user?.isGuest) {
    return false; // Not a guest, no action needed
  }
  
  const currentPath = window.location.pathname;
  const isAllowedPath = allowedPaths.some(path => currentPath.startsWith(path));
  
  if (!isAllowedPath) {
    console.log('[GuestUtils] Guest trying to access unauthorized path:', currentPath);
    cleanGuestSessionAndRedirect();
    return true; // Cleaned and redirecting
  }
  
  return false; // Guest accessing allowed path
} 