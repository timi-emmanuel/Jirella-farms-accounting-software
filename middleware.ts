
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
          })
          response = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // const isOnRoot = request.nextUrl.pathname === "/";
// 

  const pathname = request.nextUrl.pathname;

const isOnDashboard = pathname.startsWith("/dashboard");
const isOnLogin = pathname.startsWith("/login");
const isOnRoot = pathname === "/";

if (!user && (isOnDashboard || isOnRoot)) {
  return NextResponse.redirect(new URL("/login", request.url));
}

if (user) {
  const { data: profile } = await supabase
    .from('users')
    .select('isActive')
    .eq('id', user.id)
    .single();

  if (profile?.isActive === false) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/login", request.url));
  }
}

if (user && (isOnLogin || isOnRoot)) {
  return NextResponse.redirect(new URL("/dashboard", request.url));
}


  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - api (API routes, if needed to be excluded from auth refresh)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
