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
    const { id, name, owner_name, phone, email, package: pkg, status, expires_at, note } = body;

    if (!id) {
      return NextResponse.json({ error: 'ต้องระบุ id' }, { status: 400 });
    }

    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      SERVICE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (owner_name !== undefined) updates.owner_name = owner_name;
    if (phone !== undefined) updates.phone = phone;
    if (email !== undefined) updates.email = email;
    if (pkg !== undefined) updates.package = pkg;
    if (status !== undefined) updates.status = status;
    if (note !== undefined) updates.note = note;
    
    // lifetime = null expires
    if (pkg === 'lifetime') {
      updates.expires_at = null;
    } else if (expires_at !== undefined) {
      updates.expires_at = expires_at;
    }

    const { error } = await adminClient.from('shops').update(updates).eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
