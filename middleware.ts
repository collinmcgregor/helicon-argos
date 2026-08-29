import { NextRequest, NextResponse } from 'next/server';

// Demo gate per docs/PLAN.md: a passing user is the admin. Not an identity system.
const COOKIE = 'argos_auth';

function expected(): string {
  return process.env.APP_PASSWORD ?? '';
}

export function middleware(req: NextRequest) {
  const pass = expected();
  if (!pass) return NextResponse.next(); // unset gate never locks the app out

  if (req.nextUrl.pathname === '/login') {
    if (req.method === 'POST') return NextResponse.next();
    if (req.cookies.get(COOKIE)?.value === pass) {
      return NextResponse.redirect(new URL('/', req.url));
    }
    return NextResponse.next();
  }

  if (req.cookies.get(COOKIE)?.value === pass) return NextResponse.next();
  return NextResponse.redirect(new URL('/login', req.url));
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/login).*)'],
};
