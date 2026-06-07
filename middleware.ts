import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const PROTECTED = ['/dashboard', '/v3', '/super-admin', '/api/admin', '/api/super-admin'];

// แผนที่ redirect หน้า list ระดับบนของ dashboard → v3 (ฟอร์ม add/edit 3-segment ปล่อยผ่าน)
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
    return NextResponse.redirect(new URL('/v3/home', request.url));
  }

  // เปลี่ยนระบบมา v3: redirect หน้า list ระดับบนของ dashboard → v3
  // (ฟอร์ม add/edit แบบ 3-segment เช่น /dashboard/pawn/add ปล่อยผ่าน ยังใช้ของเดิม)
  // 🔓 ทางลัดเทียบของเก่า: เติม ?old=1 ท้าย URL = ไม่เด้ง (เช่น /dashboard/home?old=1)
  if (user && path.startsWith('/dashboard')) {
    const bypassOld = request.nextUrl.searchParams.get('old') === '1';
    if (!bypassOld) {
      const seg = path.split('/').filter(Boolean); // ['dashboard', 'pawn', 'add']
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
