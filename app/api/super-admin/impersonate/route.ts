import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'ต้อง login' }, { status: 401 });

    const { data: profile } = await supabase
      .from('profiles').select('is_super_admin').eq('id', user.id).single();

    if (!profile?.is_super_admin) {
      return NextResponse.json({ error: 'ไม่มีสิทธิ์' }, { status: 403 });
    }

    const body = await request.json();
    const { targetUserId } = body;

    if (!targetUserId) {
      return NextResponse.json({ error: 'ต้องระบุ targetUserId' }, { status: 400 });
    }

    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SERVICE_KEY) {
      return NextResponse.json({ error: 'SERVICE_KEY missing' }, { status: 500 });
    }

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      SERVICE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: targetUser, error: targetErr } = await adminClient.auth.admin.getUserById(targetUserId);
    if (targetErr || !targetUser.user) {
      return NextResponse.json({ error: 'ไม่พบ user' }, { status: 404 });
    }

    const email = targetUser.user.email;
    if (!email) {
      return NextResponse.json({ error: 'user ไม่มี email' }, { status: 400 });
    }

    const { data: linkData, error: linkErr } = await adminClient.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: {
        redirectTo: `${request.nextUrl.origin}/dashboard/home`,
      },
    });

    if (linkErr || !linkData.properties?.action_link) {
      return NextResponse.json(
        { error: 'สร้างลิงก์ไม่สำเร็จ: ' + (linkErr?.message || 'unknown') },
        { status: 500 }
      );
    }

    console.log(`[Impersonate] ${user.id} → ${targetUserId} (${email})`);

    return NextResponse.json({
      success: true,
      action_link: linkData.properties.action_link,
      email,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
