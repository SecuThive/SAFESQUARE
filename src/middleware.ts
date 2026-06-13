import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value;
  const { pathname } = request.nextUrl;

  // 공개 페이지 (인증 불필요)
  if (
    pathname.startsWith('/clip') ||
    pathname.startsWith('/download') ||
    pathname.startsWith('/dl/') ||
    pathname.startsWith('/work-methods/share/')
  ) {
    return NextResponse.next();
  }

  // 로그인 페이지는 토큰 없이 접근 가능
  if (pathname.startsWith('/login')) {
    // 이미 로그인된 상태면 대시보드로 바로 리다이렉트 (/ → /dashboard 이중 리다이렉션 방지)
    if (token) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return NextResponse.next();
  }

  // 그 외 모든 페이지는 인증 필요
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/).*)',
  ],
};
