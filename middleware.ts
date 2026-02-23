import { NextResponse } from 'next/server';
import type { NextAuthRequest } from 'next-auth';
import { auth } from '@/auth';
import { FEATURE_SLUGS } from '@/lib/seo/routes';
import { REGION_KEYS } from '@/lib/seo/regions';

export default auth((request: NextAuthRequest) => {
  const session = request.auth;

  // Allow access to auth routes, static files, and public assets
  const { pathname } = request.nextUrl;

  // Public routes that don't require authentication
  // Keep /api/health public so DB connectivity can be checked without auth
  const publicRoutes = ['/login', '/api/auth', '/api/health'];
  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route));

  const isMarketingRoute =
    pathname === '/' ||
    pathname === '/pricing' ||
    pathname === '/demo' ||
    pathname === '/blog' ||
    pathname.startsWith('/blog/') ||
    pathname === '/sitemap.xml' ||
    pathname === '/robots.txt' ||
    pathname === '/opengraph-image' ||
    pathname === '/twitter-image' ||
    FEATURE_SLUGS.some((slug) => pathname === `/${slug}`) ||
    REGION_KEYS.some((region) => pathname === `/${region}/inventory-management-software`);

  if (
    isPublicRoute ||
    isMarketingRoute ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.match(/\.(svg|png|jpg|jpeg|gif|webp)$/) ||
    pathname === '/'
  ) {
    return NextResponse.next();
  }

  // Check if user is authenticated
  if (!session) {
    // Redirect to login if not authenticated
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Role-based route protection
  if (pathname.startsWith('/admin')) {
    const roles = session.user?.roles || [];
    if (!roles.includes('admin')) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (NextAuth routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    '/((?!api/auth|api/health|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
