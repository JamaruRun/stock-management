import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const PROTECTED = ['/dashboard', '/v3', '/super-admin', '/api/admin', '/api/super-admin'];

const DASHBOARD_TO_V3: Record<string, string> = {
  home: '/v3/home',
  add: '/v3/stock',
  stock: '/v3/stock',
  sell: '/v3/sell',
  pawn: '/v3/pawn',
  installment: '/v3/installment',
  goods: '/v3/goods',
  parts: '/v3/parts',
  repair: '/v3/repair',
  history: '/v3/history',
  reports: '/v3/reports',
  users: '/v3/users',
  settings: '/v3/settings',
  suppliers: '/v3/suppliers',
  backup: '/v3/backup',
};

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isProtected = PROTECTED.some(r => path.startsWith(r));
  const isAuthPage = path === '/login' || path === '/' || path === '/signup-beta' || path === '/register';

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

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  // ล้าง session เก่าที่เน่าแล้ว แทนที่จะวนลูป redirect
  if (authError?.code === 'refresh_token_not_found' ||
      authError?.message?.includes('Refresh Token Not Found')) {
    const response = path.startsWith('/api/')
      ? NextResponse.json({ error: 'session หมดอายุ กรุณา login ใหม่' }, { status: 401 })
      : NextResponse.redirect(new URL('/login', request.url));

    request.cookies.getAll()
      .filter(c => c.name.startsWith('sb-'))
      .forEach(c => response.cookies.delete(c.name));

    return response;
  }

  if (!user && isProtected) {
    if (path.startsWith('/api/')) {
      return NextResponse.json({ error: 'ต้อง login' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (user && isAuthPage) {
    return NextResponse.redirect(new URL('/v3/home', request.url));
  }

  if (user && path.startsWith('/dashboard')) {
    const bypassOld = request.nextUrl.searchParams.get('old') === '1';
    if (!bypassOld) {
      const seg = path.split('/').filter(Boolean);
      if (seg.length <= 2) {
        const top = seg[1] || 'home';
        const target = DASHBOARD_TO_V3[top];
        if (target) {
          return NextResponse.redirect(new URL(target, request.url));
        }
      }
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|otf)$|api/line/).*)',
  ],
};