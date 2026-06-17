import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  // ถ้าผู้ใช้ปฏิเสธ
  if (error) {
    return NextResponse.redirect(new URL('/v3/settings?line=cancelled', req.url));
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL('/v3/settings?line=error&reason=missing_code', req.url));
  }

  // ตรวจสอบ state จาก cookie
  const savedState = req.cookies.get('line_oauth_state')?.value;
  if (!savedState || savedState !== state) {
    return NextResponse.redirect(new URL('/v3/settings?line=error&reason=invalid_state', req.url));
  }

  // ดึง user_id จาก state
  const [, userIdFromState] = state.split('.');
  if (!userIdFromState) {
    return NextResponse.redirect(new URL('/v3/settings?line=error&reason=invalid_state_format', req.url));
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  // ตรวจสอบว่า user คนเดียวกับที่เริ่ม OAuth
  if (!user || user.id !== userIdFromState) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // ตรวจสอบ admin + shop
  const { data: profile } = await supabase
    .from('profiles').select('role, shop_id, full_name').eq('id', user.id).single();
  
  if (profile?.role !== 'admin' || !profile?.shop_id) {
    return NextResponse.redirect(new URL('/v3/home?error=not_admin', req.url));
  }

  const channelId = process.env.LINE_LOGIN_CHANNEL_ID;
  const channelSecret = process.env.LINE_LOGIN_CHANNEL_SECRET;
  
  if (!channelId || !channelSecret) {
    return NextResponse.redirect(new URL('/v3/settings?line=error&reason=not_configured', req.url));
  }

  // แลก code เป็น access token
  const origin = req.nextUrl.origin;
  const redirectUri = `${origin}/api/line/callback`;

  try {
    const tokenRes = await fetch('https://api.line.me/oauth2/v2.1/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri,
        client_id: channelId,
        client_secret: channelSecret,
      }).toString(),
    });

    if (!tokenRes.ok) {
      const errorText = await tokenRes.text();
      console.error('LINE token exchange failed:', errorText);
      return NextResponse.redirect(new URL('/v3/settings?line=error&reason=token_exchange', req.url));
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    // เอา profile จาก LINE
    const profileRes = await fetch('https://api.line.me/v2/profile', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!profileRes.ok) {
      return NextResponse.redirect(new URL('/v3/settings?line=error&reason=profile_fetch', req.url));
    }

    const lineProfile = await profileRes.json();
    // lineProfile = { userId, displayName, pictureUrl, statusMessage }

    // ⭐ บันทึก line_user_id ใน profile ของ admin คนนี้
    // (แต่ละ admin มี LINE ของตัวเองแยกกัน)
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        line_user_id: lineProfile.userId,
        line_display_name: lineProfile.displayName,
        line_picture_url: lineProfile.pictureUrl || null,
        line_connected_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Update profile failed:', updateError);
      return NextResponse.redirect(new URL('/v3/settings?line=error&reason=save_failed', req.url));
    }

    // เคลียร์ cookie
    const response = NextResponse.redirect(new URL('/v3/settings?line=connected', req.url));
    response.cookies.delete('line_oauth_state');
    return response;
  } catch (e: any) {
    console.error('LINE OAuth error:', e);
    return NextResponse.redirect(new URL('/v3/settings?line=error&reason=exception', req.url));
  }
}
