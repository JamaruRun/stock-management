import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  try {
    const { signup_id, action, admin_note } = await req.json();
    // action: 'approve' or 'reject'

    if (!signup_id || !action) {
      return NextResponse.json({ error: 'Missing params' }, { status: 400 });
    }

    // Auth check - ต้องเป็น super admin
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { data: profile } = await supabase
      .from('profiles').select('is_super_admin').eq('id', user.id).single();
    
    if (!profile?.is_super_admin) {
      return NextResponse.json({ error: 'Not super admin' }, { status: 403 });
    }

    // Load signup
    const { data: signup, error: loadError } = await supabase
      .from('beta_signups')
      .select('*')
      .eq('id', signup_id)
      .single();

    if (loadError || !signup) {
      return NextResponse.json({ error: 'Signup not found' }, { status: 404 });
    }

    if (signup.status !== 'pending') {
      return NextResponse.json({ 
        error: `Signup นี้ ${signup.status === 'approved' ? 'approve' : 'reject'} ไปแล้ว` 
      }, { status: 400 });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // REJECT - ง่าย แค่เปลี่ยน status
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (action === 'reject') {
      await supabase.from('beta_signups').update({
        status: 'rejected',
        rejected_at: new Date().toISOString(),
        rejected_reason: admin_note || null,
        admin_note: admin_note || null,
      }).eq('id', signup_id);

      return NextResponse.json({ success: true, action: 'rejected' });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // APPROVE - สร้าง shop + branch + auth user + profile
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    // ใช้ service role เพราะต้องสร้าง auth user
    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    // 1. สร้าง shop_short_id 8 หลัก
    function genShortId(): string {
      const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
      let result = '';
      for (let i = 0; i < 8; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
    }

    let shopShortId = genShortId();
    
    // เช็คไม่ให้ซ้ำ
    for (let i = 0; i < 5; i++) {
      const { data: existing } = await supabaseAdmin
        .from('shops').select('id').eq('shop_short_id', shopShortId).maybeSingle();
      if (!existing) break;
      shopShortId = genShortId();
    }

    // 2. สร้าง shop
    const trialEnds = new Date();
    trialEnds.setDate(trialEnds.getDate() + 30);

    const { data: newShop, error: shopError } = await supabaseAdmin
      .from('shops')
      .insert({
        name: signup.shop_name,
        shop_short_id: shopShortId,
        package: 'trial',
        status: 'active',
        expires_at: trialEnds.toISOString(),
        receipt_address: signup.province || null,
        receipt_phone: signup.phone || null,
        receipt_footer: 'ขอบคุณที่ใช้บริการ',
      })
      .select()
      .single();

    if (shopError || !newShop) {
      return NextResponse.json({ 
        error: 'สร้างร้านไม่สำเร็จ: ' + (shopError?.message || 'unknown') 
      }, { status: 500 });
    }

    // 3. สร้าง branch แรก (main)
    const { data: newBranch, error: branchError } = await supabaseAdmin
      .from('branches')
      .insert({
        shop_id: newShop.id,
        name: 'สาขาหลัก',
      })
      .select()
      .single();

    if (branchError || !newBranch) {
      // rollback shop
      await supabaseAdmin.from('shops').delete().eq('id', newShop.id);
      return NextResponse.json({ 
        error: 'สร้างสาขาไม่สำเร็จ: ' + (branchError?.message || 'unknown') 
      }, { status: 500 });
    }

    // 4. สร้าง auth user
    // ⚠️ สำคัญ: ต้องใช้ format เดียวกับ find-email/route.ts
    // find-email ใช้: shop_id.replace(/-/g, '').substring(0, 8)
    // ดังนั้น email ที่นี่ต้องใช้ shop UUID first 8 chars (ไม่ใช่ shop_short_id ที่สุ่ม)
    const shopIdShort = newShop.id.replace(/-/g, '').substring(0, 8);
    const email = `${signup.username}+${shopIdShort}@example.com`;
    
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: signup.password_hash,
      email_confirm: true, // auto confirm - ไม่ต้องส่ง email
    });

    if (authError || !authUser?.user) {
      // rollback
      await supabaseAdmin.from('branches').delete().eq('id', newBranch.id);
      await supabaseAdmin.from('shops').delete().eq('id', newShop.id);
      return NextResponse.json({ 
        error: 'สร้าง auth user ไม่สำเร็จ: ' + (authError?.message || 'unknown') 
      }, { status: 500 });
    }

    // 5. สร้าง profile (admin คนแรก)
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: authUser.user.id,
        username: signup.username,
        full_name: signup.contact_name,
        role: 'admin',
        shop_id: newShop.id,
        branch_id: newBranch.id,
      });

    if (profileError) {
      // rollback
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
      await supabaseAdmin.from('branches').delete().eq('id', newBranch.id);
      await supabaseAdmin.from('shops').delete().eq('id', newShop.id);
      return NextResponse.json({ 
        error: 'สร้าง profile ไม่สำเร็จ: ' + profileError.message 
      }, { status: 500 });
    }

    // 6. update signup เป็น approved
    await supabaseAdmin.from('beta_signups').update({
      status: 'approved',
      approved_shop_id: newShop.id,
      approved_at: new Date().toISOString(),
      approved_by: user.id,
      admin_note: admin_note || null,
    }).eq('id', signup_id);

    return NextResponse.json({ 
      success: true, 
      action: 'approved',
      shop: {
        id: newShop.id,
        name: newShop.name,
        shop_short_id: shopShortId,
      },
      user: {
        username: signup.username,
        email: email,
      },
    });
  } catch (e: any) {
    console.error('Beta approve error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
