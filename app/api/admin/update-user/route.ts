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
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'ไม่มีสิทธิ์' }, { status: 403 });
    }

    const body = await request.json();
    const { userId, full_name, role, branch_id, password } = body;

    if (!userId) {
      return NextResponse.json({ error: 'ต้องระบุ userId' }, { status: 400 });
    }

    // ห้าม admin ลด role ตัวเองเป็น staff (ป้องกันล็อคตัวเอง)
    if (userId === user.id && role === 'staff') {
      return NextResponse.json(
        { error: 'ลดสิทธิ์ตัวเองไม่ได้ - ให้ admin คนอื่นทำให้' },
        { status: 400 }
      );
    }

    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SERVICE_KEY) {
      return NextResponse.json(
        { error: 'ยังไม่ได้ตั้งค่า SERVICE_ROLE_KEY' },
        { status: 500 }
      );
    }

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      SERVICE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // อัพเดท profile
    const updates: any = {};
    if (full_name !== undefined) updates.full_name = full_name;
    if (role !== undefined) updates.role = role;
    if (branch_id !== undefined) updates.branch_id = branch_id;

    if (Object.keys(updates).length > 0) {
      const { error: profileError } = await adminClient
        .from('profiles')
        .update(updates)
        .eq('id', userId);

      if (profileError) {
        return NextResponse.json({ error: profileError.message }, { status: 400 });
      }
    }

    // อัพเดท password (ถ้ามี)
    if (password && password.length >= 6) {
      const { error: pwError } = await adminClient.auth.admin.updateUserById(userId, {
        password,
      });

      if (pwError) {
        return NextResponse.json({ error: pwError.message }, { status: 400 });
      }
    } else if (password && password.length < 6) {
      return NextResponse.json(
        { error: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัว' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
