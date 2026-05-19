import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
  try {
    const { message, type } = await req.json();
    
    if (!message) {
      return NextResponse.json({ error: 'No message' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // ⭐ ดึง shop_id จาก profile ของผู้ใช้ที่ login อยู่
    const { data: profile } = await supabase
      .from('profiles').select('shop_id').eq('id', user.id).single();
    
    if (!profile?.shop_id) {
      return NextResponse.json({ skipped: true, reason: 'no shop' });
    }

    // ⭐ ดึง line_user_id จาก shop ของผู้ใช้นี้เท่านั้น
    const { data: shop } = await supabase
      .from('shops').select('*').eq('id', profile.shop_id).single();

    // ถ้าร้านนี้ยังไม่ได้เชื่อม LINE → ข้าม (ไม่ error)
    if (!shop?.line_user_id) {
      return NextResponse.json({ skipped: true, reason: 'shop not connected to LINE' });
    }

    // เช็คประเภท notification ของร้านนี้
    const typeMap: Record<string, string> = {
      sale: 'line_notify_sale',
      pawn: 'line_notify_pawn',
      goods: 'line_notify_goods',
      installment: 'line_notify_installment',
      low_stock: 'line_notify_low_stock',
    };

    if (type !== 'test' && typeMap[type] && !shop[typeMap[type]]) {
      return NextResponse.json({ skipped: true, reason: `${type} notify off` });
    }

    // ⭐ ใช้ Channel Access Token จาก env (OA กลางของระบบ)
    const channelToken = process.env.LINE_MESSAGING_CHANNEL_TOKEN;
    if (!channelToken) {
      return NextResponse.json({ 
        error: 'LINE Messaging not configured on server', 
        skipped: true 
      });
    }

    // ⭐ ส่งหา line_user_id ของร้านนี้เท่านั้น (ไม่ใช่ broadcast!)
    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${channelToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: shop.line_user_id, // ⭐ เฉพาะร้านนี้
        messages: [{
          type: 'text',
          text: message,
        }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('LINE Push failed for shop', profile.shop_id, ':', errorText);
      return NextResponse.json({ 
        error: 'LINE Push failed', 
        status: response.status,
        detail: errorText,
      }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
