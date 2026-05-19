import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { randomBytes } from 'crypto';

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // ตรวจสอบว่าเป็น admin
  const { data: profile } = await supabase
    .from('profiles').select('role, shop_id').eq('id', user.id).single();
  
  if (profile?.role !== 'admin') {
    return NextResponse.redirect(new URL('/dashboard/home?error=not_admin', req.url));
  }

  const channelId = process.env.LINE_LOGIN_CHANNEL_ID;
  if (!channelId) {
    return NextResponse.redirect(new URL('/dashboard/settings?error=line_not_configured', req.url));
  }

  // สร้าง state เพื่อป้องกัน CSRF + เก็บ shop_id
  // state รวม: random + user_id (เพื่อเช็คตอน callback)
  const stateRandom = randomBytes(16).toString('hex');
  const state = `${stateRandom}.${user.id}`;

  // Redirect URL หลัง LINE login เสร็จ
  const origin = req.nextUrl.origin;
  const redirectUri = `${origin}/api/line/callback`;

  // เก็บ state ใน cookie เพื่อ verify ตอน callback
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: channelId,
    redirect_uri: redirectUri,
    state: state,
    scope: 'profile openid',
  });

  const lineAuthUrl = `https://access.line.me/oauth2/v2.1/authorize?${params.toString()}`;
  
  const response = NextResponse.redirect(lineAuthUrl);
  response.cookies.set('line_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600, // 10 นาที
  });
  
  return response;
}
