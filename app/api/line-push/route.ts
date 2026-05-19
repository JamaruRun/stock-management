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

    // ดึง shop_id ของ user ที่ login
    const { data: profile } = await supabase
      .from('profiles').select('shop_id').eq('id', user.id).single();
    
    if (!profile?.shop_id) {
      return NextResponse.json({ skipped: true, reason: 'no shop' });
    }

    // ดึง shop settings (notification preferences)
    const { data: shop } = await supabase
      .from('shops').select('*').eq('id', profile.shop_id).single();

    if (!shop) {
      return NextResponse.json({ skipped: true, reason: 'shop not found' });
    }

    // เช็คประเภท notification ของร้าน
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

    // ⭐ ดึง admin ทุกคนในร้านนี้ที่ผูก LINE แล้ว
    let adminQuery = supabase
      .from('profiles')
      .select('id, line_user_id, full_name')
      .eq('shop_id', profile.shop_id)
      .eq('role', 'admin')
      .not('line_user_id', 'is', null);

    // ถ้าเป็น test → ส่งให้แค่คนที่กดทดสอบ
    if (type === 'test') {
      adminQuery = adminQuery.eq('id', user.id);
    }

    const { data: admins } = await adminQuery;

    if (!admins || admins.length === 0) {
      return NextResponse.json({ 
        skipped: true, 
        reason: type === 'test' ? 'you not connected' : 'no admin connected to LINE' 
      });
    }

    // ใช้ Channel Access Token จาก env
    const channelToken = process.env.LINE_MESSAGING_CHANNEL_TOKEN;
    if (!channelToken) {
      return NextResponse.json({ 
        error: 'LINE Messaging not configured on server', 
        skipped: true 
      });
    }

    // ⭐ ส่งหา admin ทุกคนในร้านที่ผูก LINE แล้ว
    const results = await Promise.allSettled(
      admins.map(async (admin: any) => {
        const response = await fetch('https://api.line.me/v2/bot/message/push', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${channelToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: admin.line_user_id,
            messages: [{ type: 'text', text: message }],
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`LINE failed for ${admin.full_name}: ${errorText}`);
        }
        return admin.full_name;
      })
    );

    const success = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    if (failed > 0) {
      const errors = results
        .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
        .map(r => r.reason?.message || 'unknown')
        .join('; ');
      console.error('LINE Push partial fail:', errors);
    }

    return NextResponse.json({ 
      success: success > 0, 
      sentTo: success,
      failed: failed,
      total: admins.length,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
