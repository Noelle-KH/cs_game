// Next.js Proxy — 路由保護與角色驗證（Next.js 16，函式必須命名為 proxy）
import { NextRequest, NextResponse } from 'next/server'

// 公開路由（不需登入）
const PUBLIC_ROUTES = ['/login']

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 取得 session cookie（登入後由 Firebase 設定）
  const sessionCookie = request.cookies.get('__session')?.value

  const isPublic = PUBLIC_ROUTES.some((r) => pathname.startsWith(r))

  // 未登入 → 導向登入頁
  if (!sessionCookie && !isPublic) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // 已登入訪問登入頁 → 導向首頁
  if (sessionCookie && pathname === '/login') {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)',
  ],
}
