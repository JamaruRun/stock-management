import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'ต้อง login' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, shop_id')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'ไม่มีสิทธิ์' }, { status: 403 });
    }

    if (!profile.shop_id) {
      return NextResponse.json({ error: 'ไม่พบ shop_id' }, { status: 400 });
    }

    const body = await request.json();
    const { username, password, full_name, role, branch_id } = body;

    if (!username || !password || !full_name || !role || !branch_id) {
      return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 });
    }

    // normalize ให้ตรงกับตอน login (find-email lowercase เสมอ)
    const uname = String(username).trim().toLowerCase();

    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SERVICE_KEY) {
      return NextResponse.json(
        { error: 'ระบบยังไม่ได้ตั้งค่า SUPABASE_SERVICE_ROLE_KEY' },
        { status: 500 }
      );
    }

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      SERVICE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // เช็ค username ซ้ำ "ทั้งระบบ" (ไม่ใช่แค่ร้านนี้)
    // เพราะ login ค้น username แบบ global → ถ้าซ้ำข้ามร้านจะ login สับสน/ผิดร้านได้
    const { data: dupes } = await adminClient
      .from('profiles')
      .select('id, full_name, shop_id')
      .eq('username', uname)
      .limit(1);

    if (dupes && dupes.length > 0) {
      const sameShop = dupes[0].shop_id === profile.shop_id;
      return NextResponse.json(
        { error: sameShop
            ? `Username "${uname}" มีอยู่ในร้านนี้แล้ว (${dupes[0].full_name})`
            : `Username "${uname}" ถูกใช้ไปแล้ว — กรุณาตั้งชื่อผู้ใช้ใหม่` },
        { status: 400 }
      );
    }

    // ใช้ shop_id 8 ตัวแรกเป็นส่วนหนึ่งของ email เพื่อให้ unique
    const shopShortId = profile.shop_id.replace(/-/g, '').substring(0, 8);
    const email = `${uname}+${shopShortId}@example.com`;

    // สร้าง auth user
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 400 });
    }

    // สร้าง profile - username เก็บแบบไม่มี shop_id (สำหรับแสดงผล)
    const { error: profileError } = await adminClient.from('profiles').insert({
      id: newUser.user.id,
      username: uname,
      full_name,
      role,
      branch_id,
      shop_id: profile.shop_id,
      is_super_admin: false,
    });

    if (profileError) {
      await adminClient.auth.admin.deleteUser(newUser.user.id);
      return NextResponse.json({ error: profileError.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
