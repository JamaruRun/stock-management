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
      .from('profiles').select('is_super_admin').eq('id', user.id).single();

    if (!profile?.is_super_admin) {
      return NextResponse.json({ error: 'ไม่มีสิทธิ์ Super Admin' }, { status: 403 });
    }

    const body = await request.json();
    const {
      name, owner_name, phone, email, package: pkg, trialDays,
      adminUsername, adminPassword, adminFullName, branchName,
    } = body;

    if (!name || !adminUsername || !adminPassword || !adminFullName) {
      return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 });
    }

    if (adminPassword.length < 6) {
      return NextResponse.json({ error: 'รหัสผ่านอย่างน้อย 6 ตัว' }, { status: 400 });
    }

    // normalize ให้ตรงกับตอน login (find-email lowercase เสมอ)
    const adminUname = String(adminUsername).trim().toLowerCase();

    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SERVICE_KEY) {
      return NextResponse.json({ error: 'ยังไม่ได้ตั้งค่า SERVICE_ROLE_KEY' }, { status: 500 });
    }

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      SERVICE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // เช็ค username ซ้ำ "ทั้งระบบ" ก่อนสร้าง (login ค้น username แบบ global)
    const { data: dupAdmin } = await adminClient
      .from('profiles')
      .select('id')
      .eq('username', adminUname)
      .limit(1);

    if (dupAdmin && dupAdmin.length > 0) {
      return NextResponse.json(
        { error: `Username "${adminUname}" ถูกใช้ไปแล้ว — กรุณาตั้งชื่อผู้ใช้ใหม่` },
        { status: 400 }
      );
    }

    // 1. คำนวณวันหมดอายุ
    let expires_at = null;
    if (pkg !== 'lifetime') {
      const d = new Date();
      d.setDate(d.getDate() + (trialDays || 30));
      expires_at = d.toISOString();
    }

    // 2. สร้าง shop
    const { data: shop, error: shopError } = await adminClient
      .from('shops')
      .insert({
        name,
        owner_name: owner_name || null,
        phone: phone || null,
        email: email || null,
        package: pkg,
        expires_at,
        status: 'active',
      })
      .select()
      .single();

    if (shopError) {
      return NextResponse.json({ error: shopError.message }, { status: 400 });
    }

    // 3. สร้าง branch แรก
    const { data: branch, error: branchError } = await adminClient
      .from('branches')
      .insert({
        name: branchName || 'สาขาหลัก',
        shop_id: shop.id,
      })
      .select()
      .single();

    if (branchError) {
      await adminClient.from('shops').delete().eq('id', shop.id);
      return NextResponse.json({ error: branchError.message }, { status: 400 });
    }

    // 4. สร้าง auth user - ใช้ shop_id ใน email เพื่อให้ unique ข้ามร้าน
    const shopShortId = shop.id.replace(/-/g, '').substring(0, 8);
    const email_for_auth = `${adminUname}+${shopShortId}@example.com`;
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email: email_for_auth,
      password: adminPassword,
      email_confirm: true,
    });

    if (authError) {
      await adminClient.from('branches').delete().eq('id', branch.id);
      await adminClient.from('shops').delete().eq('id', shop.id);
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    // 5. สร้าง profile
    const { error: profileError } = await adminClient
      .from('profiles')
      .insert({
        id: authData.user.id,
        username: adminUname,
        full_name: adminFullName,
        role: 'admin',
        branch_id: branch.id,
        shop_id: shop.id,
        is_super_admin: false,
      });

    if (profileError) {
      await adminClient.auth.admin.deleteUser(authData.user.id);
      await adminClient.from('branches').delete().eq('id', branch.id);
      await adminClient.from('shops').delete().eq('id', shop.id);
      return NextResponse.json({ error: profileError.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      shop,
      branch,
      admin: { username: adminUname, id: authData.user.id },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
