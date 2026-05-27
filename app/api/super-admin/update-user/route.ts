import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'ต้อง login' }, { status: 401 });

    // เช็คว่าเป็น super admin
    const { data: profile } = await supabase
      .from('profiles').select('is_super_admin').eq('id', user.id).single();

    if (!profile?.is_super_admin) {
      return NextResponse.json({ error: 'ไม่มีสิทธิ์' }, { status: 403 });
    }

    const body = await request.json();
    const { userId, username, password, full_name, role } = body;

    if (!userId) {
      return NextResponse.json({ error: 'ต้องระบุ userId' }, { status: 400 });
    }

    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SERVICE_KEY) {
      return NextResponse.json({ error: 'SERVICE_ROLE_KEY ไม่ได้ตั้ง' }, { status: 500 });
    }

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      SERVICE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // เปลี่ยน Username
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (username !== undefined) {
      const cleanUsername = username.trim().toLowerCase();
      
      if (cleanUsername.length < 3) {
        return NextResponse.json({ error: 'Username สั้นเกินไป' }, { status: 400 });
      }
      if (!/^[a-z0-9_]+$/.test(cleanUsername)) {
        return NextResponse.json(
          { error: 'Username ใช้ได้แค่ a-z, 0-9, _' },
          { status: 400 }
        );
      }

      // เช็คซ้ำ
      const { data: existing } = await adminClient
        .from('profiles')
        .select('id')
        .eq('username', cleanUsername)
        .neq('id', userId)
        .limit(1);

      if (existing && existing.length > 0) {
        return NextResponse.json(
          { error: 'Username นี้มีคนใช้แล้ว' },
          { status: 400 }
        );
      }

      // Update profile
      const { error: profileError } = await adminClient
        .from('profiles')
        .update({ username: cleanUsername })
        .eq('id', userId);

      if (profileError) {
        return NextResponse.json({ error: profileError.message }, { status: 400 });
      }

      // Update auth email (เพราะระบบใช้ username@stock.local เป็น email)
      const newEmail = `${cleanUsername}@stock.local`;
      const { error: emailError } = await adminClient.auth.admin.updateUserById(userId, {
        email: newEmail,
      });

      if (emailError) {
        return NextResponse.json(
          { error: 'อัพเดท email ไม่สำเร็จ: ' + emailError.message },
          { status: 400 }
        );
      }
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // อัพเดทข้อมูลอื่นๆ
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const otherUpdates: any = {};
    if (full_name !== undefined) otherUpdates.full_name = full_name;
    if (role !== undefined) otherUpdates.role = role;

    if (Object.keys(otherUpdates).length > 0) {
      const { error } = await adminClient
        .from('profiles')
        .update(otherUpdates)
        .eq('id', userId);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }

    // เปลี่ยนรหัสผ่าน
    if (password) {
      if (password.length < 6) {
        return NextResponse.json({ error: 'รหัสสั้นเกินไป' }, { status: 400 });
      }
      const { error: pwError } = await adminClient.auth.admin.updateUserById(userId, {
        password,
      });
      if (pwError) {
        return NextResponse.json({ error: pwError.message }, { status: 400 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
