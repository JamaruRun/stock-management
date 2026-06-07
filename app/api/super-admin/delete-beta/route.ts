import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';

// ลบ beta signup + ร้านที่ผูกอยู่ (ถ้าอนุมัติแล้ว) ออกจากระบบทั้งหมด
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'ต้อง login' }, { status: 401 });

    const { data: me } = await supabase
      .from('profiles').select('is_super_admin, shop_id').eq('id', user.id).single();
    if (!me?.is_super_admin) {
      return NextResponse.json({ error: 'ไม่มีสิทธิ์ Super Admin' }, { status: 403 });
    }

    const { betaId } = await request.json();
    if (!betaId) return NextResponse.json({ error: 'ต้องระบุ betaId' }, { status: 400 });

    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SERVICE_KEY) return NextResponse.json({ error: 'ยังไม่ได้ตั้งค่า SERVICE_ROLE_KEY' }, { status: 500 });
    const adminClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1. อ่าน beta row
    const { data: beta } = await adminClient
      .from('beta_signups').select('id, username').eq('id', betaId).single();
    if (!beta) return NextResponse.json({ error: 'ไม่พบรายการสมัคร' }, { status: 404 });

    let deletedShop = false;

    // 2. หา profile จาก username → ได้ shop_id (กรณีอนุมัติแล้ว)
    if (beta.username) {
      const { data: profiles } = await adminClient
        .from('profiles').select('id, shop_id').eq('username', beta.username);

      const shopIds = Array.from(new Set((profiles || []).map(p => p.shop_id).filter(Boolean)));
      for (const shopId of shopIds) {
        if (me.shop_id === shopId) continue; // กันลบร้านตัวเอง
        // ลบ auth users ของร้านนั้นก่อน
        const { data: shopProfiles } = await adminClient
          .from('profiles').select('id').eq('shop_id', shopId);
        // ลบ shop (DB cascade จะลบ branches/stock/ฯลฯ ตาม FK)
        await adminClient.from('shops').delete().eq('id', shopId);
        for (const p of shopProfiles || []) {
          try { await adminClient.auth.admin.deleteUser(p.id); } catch {}
        }
        deletedShop = true;
      }
    }

    // 3. ลบ beta row
    await adminClient.from('beta_signups').delete().eq('id', betaId);

    return NextResponse.json({ success: true, deletedShop });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
