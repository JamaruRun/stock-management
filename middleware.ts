import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const PROTECTED = ['/dashboard', '/super-admin', '/api/admin', '/api/super-admin'];

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isProtected = PROTECTED.some(r => path.startsWith(r));
  const isAuthPage = path === '/login' || path === '/' || path === '/signup-beta';

  // 🚀 Fast path: ไม่ใช่ route ที่ต้อง auth → skip getUser ทั้งหมด
  if (!isProtected && !isAuthPage) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getUser() = network call → run เฉพาะที่จำเป็น
  const { data: { user } } = await supabase.auth.getUser();

  if (!user && isProtected) {
    if (path.startsWith('/api/')) {
      return NextResponse.json({ error: 'ต้อง login' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (user && isAuthPage) {
    return NextResponse.redirect(new URL('/dashboard/home', request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Exclude:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon, images, fonts, etc.
     * - API route ของ LINE OAuth (มี auth ในตัวแล้ว)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|otf)$|api/line/).*)',
  ],
};
