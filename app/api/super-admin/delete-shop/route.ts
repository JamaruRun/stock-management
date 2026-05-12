import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'ต้อง login' }, { status: 401 });

    const { data: profile } = await supabase
      .from('profiles').select('is_super_admin, shop_id').eq('id', user.id).single();

    if (!profile?.is_super_admin) {
      return NextResponse.json({ error: 'ไม่มีสิทธิ์' }, { status: 403 });
    }

    const { shopId } = await request.json();
    if (!shopId) {
      return NextResponse.json({ error: 'ต้องระบุ shopId' }, { status: 400 });
    }

    if (profile.shop_id === shopId) {
      return NextResponse.json({ error: 'ลบร้านของตัวเองไม่ได้' }, { status: 400 });
    }

    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      SERVICE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // ดึง auth users ของร้านนี้ก่อนเพื่อจะลบทีหลัง
    const { data: profiles } = await adminClient
      .from('profiles').select('id').eq('shop_id', shopId);

    // ลบ shop → CASCADE ลบ branches, profiles อัตโนมัติ
    const { error } = await adminClient.from('shops').delete().eq('id', shopId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    // ลบ auth users
    for (const p of profiles || []) {
      try {
        await adminClient.auth.admin.deleteUser(p.id);
      } catch (e) {
        console.error('Failed to delete auth user:', p.id);
      }
    }

    return NextResponse.json({ success: true, deletedUsers: profiles?.length || 0 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
