import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PUBLIC_PATHS = ['/login', '/registro', '/t/', '/campeonatos']
const AUTH_REDIRECT_PATHS = ['/login', '/registro']
const AUTH_ONLY_PATHS = ['/onboarding']
const PUBLIC_HOSTS = ['futbol.moverix.co']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? ''
  const isPublicHost = PUBLIC_HOSTS.some((h) => host.startsWith(h))

  // futbol.moverix.co/ → rewrite to /campeonatos (public landing)
  if (isPublicHost && pathname === '/') {
    return NextResponse.rewrite(new URL('/campeonatos', request.url))
  }

  const isAuthenticated = request.cookies.has('moverix-auth')
  const isPublicPath = PUBLIC_PATHS.some((p) => pathname.startsWith(p))
  const isAuthOnlyPath = AUTH_ONLY_PATHS.some((p) => pathname.startsWith(p))
  const isAuthRedirectPath = AUTH_REDIRECT_PATHS.some((p) => pathname.startsWith(p))

  // No autenticado intentando acceder a ruta protegida
  if (!isAuthenticated && !isPublicPath) {
    // En el host publico, redirigir a login en el mismo dominio
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Autenticado intentando acceder a login/registro → ir al dashboard
  // En el host publico, ir a /campeonatos en vez de /
  if (isAuthenticated && isAuthRedirectPath && !isAuthOnlyPath) {
    const redirectTo = isPublicHost ? '/campeonatos' : '/'
    return NextResponse.redirect(new URL(redirectTo, request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)'],
}
