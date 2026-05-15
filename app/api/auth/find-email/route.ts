import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// API นี้เปิดให้ทุกคนเรียก (ก่อน login) เพื่อหา email candidates จาก username
// ความปลอดภัย: ไม่เปิดเผยข้อมูลอื่น แค่บอกว่า username นี้มี email ไหนบ้าง
// ผู้ที่ login ต้องรู้ password ของ user นั้นๆ อยู่ดี

export async function POST(request: NextRequest) {
  try {
    const { username } = await request.json();
    if (!username) {
      return NextResponse.json({ error: 'ต้องระบุ username' }, { status: 400 });
    }

    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SERVICE_KEY) {
      return NextResponse.json({ error: 'ระบบยังไม่ได้ตั้งค่า' }, { status: 500 });
    }

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      SERVICE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // ดึง profiles ทั้งหมดที่ใช้ username นี้
    const { data: profiles, error } = await adminClient
      .from('profiles')
      .select('id, username, shop_id')
      .eq('username', username.trim().toLowerCase());

    if (error || !profiles || profiles.length === 0) {
      // ไม่มี user → return error
      return NextResponse.json({ error: 'ไม่พบ user' }, { status: 404 });
    }

    // สร้าง list ของ emails ที่เป็นไปได้
    const emails = profiles.map(p => {
      if (!p.shop_id) {
        // legacy user (ก่อน multi-tenant) - ใช้ format เก่า
        return `${username}@example.com`;
      }
      const shopShortId = p.shop_id.replace(/-/g, '').substring(0, 8);
      return `${username}+${shopShortId}@example.com`;
    });

    // เพิ่ม legacy format (กรณีมี user เก่าก่อน multi-tenant)
    if (!emails.includes(`${username}@example.com`)) {
      emails.push(`${username}@example.com`);
    }

    return NextResponse.json({ emails });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
