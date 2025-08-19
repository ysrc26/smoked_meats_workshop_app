import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import crypto from 'crypto'

const COOKIE = process.env.ADMIN_COOKIE_NAME || 'workshops_admin'
const SECRET = process.env.ADMIN_COOKIE_SECRET!

function verify(valueSig: string | undefined) {
  if (!valueSig) return false
  const parts = valueSig.split('.')
  if (parts.length !== 2) return false
  const [value, sig] = parts
  if (!value || !sig) return false
  
  try {
    const check = crypto.createHmac('sha256', SECRET).update(value).digest('hex')
    return sig === check && value === '1'
  } catch {
    return false
  }
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  
  // רק עבור דפי admin (למעט login)
  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    const cookie = request.cookies.get(COOKIE)?.value
    const isAuthenticated = verify(cookie)
    
    console.log('Middleware check:', { pathname, cookie: !!cookie, isAuthenticated })
    
    if (!isAuthenticated) {
      const loginUrl = new URL('/admin/login', request.url)
      return NextResponse.redirect(loginUrl)
    }
  }
  
  // אם מאומת ובדף login - העבר לדף ראשי
  if (pathname === '/admin/login') {
    const cookie = request.cookies.get(COOKIE)?.value
    const isAuthenticated = verify(cookie)
    
    if (isAuthenticated) {
      const adminUrl = new URL('/admin', request.url)
      return NextResponse.redirect(adminUrl)
    }
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/admin/:path*'
  ]
}