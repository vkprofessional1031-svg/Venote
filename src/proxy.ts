import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { isDesktopRequest } from '@/lib/isDesktopApp';

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === '/' && isDesktopRequest(request.headers)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/',
};

