import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
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

  // สำคัญ: เรียก getUser() เพื่อ refresh session cookies
  const { data: { user } } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  // routes ที่ต้อง login
  const protectedRoutes = ['/dashboard', '/super-admin', '/api/admin', '/api/super-admin'];
  const isProtected = protectedRoutes.some(r => path.startsWith(r));

  // ยังไม่ login + เข้า route ที่ป้องกัน → ไป login
  if (!user && isProtected) {
    // ถ้าเป็น API → return JSON error
    if (path.startsWith('/api/')) {
      return NextResponse.json({ error: 'ต้อง login' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // login แล้ว + พยายามเข้า login → ไป dashboard
  if (user && (path === '/login' || path === '/')) {
    return NextResponse.redirect(new URL('/dashboard/stock', request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
