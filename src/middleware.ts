// Next.js Middleware — 路由保護與角色驗證
import { NextRequest, NextResponse } from 'next/server'

// 公開路由（不需登入）
const PUBLIC_ROUTES = ['/login']

// 需要主管以上角色的路由
const SUPERVISOR_ROUTES = ['/admin']

// 需要管理員角色的路由
const ADMIN_ROUTES = ['/super-admin']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 取得 session cookie（登入後由 Firebase 設定）
  const sessionCookie = request.cookies.get('__session')?.value

  const isPublic = PUBLIC_ROUTES.some((r) => pathname.startsWith(r))

  // 未登入 → 導向登入頁
  if (!sessionCookie && !isPublic) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // 已登入 → 不再顯示登入頁
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
