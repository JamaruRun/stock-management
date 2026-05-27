import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      shop_name, contact_name, phone, line_id, province,
      business_type, shop_size, branch_count, current_system,
      username, password, note,
    } = body;

    // Validation
    if (!shop_name?.trim() || !contact_name?.trim() || !phone?.trim() || !username?.trim() || !password?.trim()) {
      return NextResponse.json({ error: 'กรุณากรอกข้อมูลที่จำเป็น' }, { status: 400 });
    }

    if (username.length < 3 || !/^[a-z0-9_]+$/.test(username)) {
      return NextResponse.json({ error: 'Username ผิดรูปแบบ' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'รหัสผ่านสั้นเกินไป' }, { status: 400 });
    }

    // Service role - bypass RLS
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // เช็ค username + phone ซ้ำ
    const { data: existing } = await supabase
      .from('beta_signups')
      .select('id, username, phone')
      .or(`username.eq.${username},phone.eq.${phone}`)
      .limit(1);

    if (existing && existing.length > 0) {
      const dup = existing[0];
      if (dup.username === username) {
        return NextResponse.json({ error: 'Username นี้มีคนใช้แล้ว' }, { status: 400 });
      }
      if (dup.phone === phone) {
        return NextResponse.json({ error: 'เบอร์นี้เคยสมัครแล้ว — ติดต่อทีมงานได้เลย' }, { status: 400 });
      }
    }

    // Insert beta signup
    const { data: newSignup, error: insertError } = await supabase
      .from('beta_signups')
      .insert({
        shop_name: shop_name.trim(),
        contact_name: contact_name.trim(),
        phone: phone.replace(/[-\s]/g, ''),
        line_id: line_id?.trim() || null,
        province: province?.trim() || null,
        business_type: business_type || 'mobile_shop',
        shop_size: shop_size || 'small',
        branch_count: parseInt(branch_count) || 1,
        current_system: current_system || 'none',
        username: username.trim().toLowerCase(),
        password_hash: password,
        note: note?.trim() || null,
        status: 'pending',
      })
      .select()
      .single();

    if (insertError) {
      console.error('Beta signup insert error:', insertError);
      return NextResponse.json({ error: 'บันทึกไม่สำเร็จ: ' + insertError.message }, { status: 500 });
    }

    // ส่ง LINE notify ให้ super admin (ไม่ rollback ถ้าล้มเหลว)
    notifySuperAdmins(newSignup, supabase).catch((e) => {
      console.warn('LINE notify failed:', e);
    });

    return NextResponse.json({
      success: true,
      id: newSignup.id,
      message: 'ส่งคำขอเรียบร้อย!',
    });
  } catch (e: any) {
    console.error('Beta signup API error:', e);
    return NextResponse.json({ error: e.message || 'Unknown error' }, { status: 500 });
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// LINE notify ให้ super admin ทุกคน
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function notifySuperAdmins(signup: any, supabase: any) {
  const channelToken = process.env.LINE_MESSAGING_CHANNEL_TOKEN;
  if (!channelToken) {
    console.log('No LINE channel token');
    return;
  }

  // หา super admin ที่ link LINE แล้ว
  const { data: admins } = await supabase
    .from('profiles')
    .select('line_user_id, full_name')
    .eq('is_super_admin', true)
    .not('line_user_id', 'is', null);

  if (!admins || admins.length === 0) {
    console.log('No super admin with LINE linked');
    return;
  }

  // Map ข้อมูลให้อ่านง่าย
  const businessMap: Record<string, string> = {
    mobile_shop: '📱 ร้านขายมือถือ',
    repair_shop: '🔧 ร้านซ่อม',
    both: '📱🔧 ขาย+ซ่อม',
    other: '🏪 อื่นๆ',
  };

  const sizeMap: Record<string, string> = {
    solo: '👤 เจ้าของคนเดียว',
    small: '👥 เล็ก (2-4)',
    medium: '👥👥 กลาง (5-10)',
    large: '👥👥👥 ใหญ่ (10+)',
  };

  const systemMap: Record<string, string> = {
    none: '✏️ ยังไม่มี / จดมือ',
    excel: '📊 Excel / Google Sheet',
    other_app: '📱 แอปอื่น',
    other: '❓ อื่นๆ',
  };

  // สร้างข้อความ
  const text = [
    '🎉 มีคนสมัคร Beta ใหม่!',
    '',
    `🏪 ร้าน: ${signup.shop_name}`,
    `👤 ผู้ติดต่อ: ${signup.contact_name}`,
    `📞 เบอร์: ${signup.phone}`,
    signup.line_id ? `💬 LINE: ${signup.line_id}` : '',
    signup.province ? `📍 จังหวัด: ${signup.province}` : '',
    '',
    `${businessMap[signup.business_type] || signup.business_type}`,
    `${sizeMap[signup.shop_size] || signup.shop_size}`,
    `🏬 สาขา: ${signup.branch_count} สาขา`,
    `📋 ระบบเดิม: ${systemMap[signup.current_system] || signup.current_system}`,
    '',
    `🔑 Username: ${signup.username}`,
    '',
    signup.note ? `💭 หมายเหตุ:\n${signup.note}\n` : '',
    '👉 เข้า Super Admin Panel เพื่อ approve',
    'https://stock-management-mu-two.vercel.app/super-admin',
  ].filter(Boolean).join('\n');

  // ส่งให้ super admin แต่ละคน
  const results = await Promise.allSettled(
    admins.map((admin: any) =>
      fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${channelToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: admin.line_user_id,
          messages: [{ type: 'text', text }],
        }),
      })
    )
  );

  console.log(`LINE notify: ${results.filter(r => r.status === 'fulfilled').length}/${admins.length} success`);
}
