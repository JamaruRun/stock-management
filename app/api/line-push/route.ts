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

    const { data: profile } = await supabase
      .from('profiles').select('shop_id').eq('id', user.id).single();
    
    if (!profile?.shop_id) {
      return NextResponse.json({ skipped: true, reason: 'no shop' });
    }

    const { data: shop } = await supabase
      .from('shops').select('*').eq('id', profile.shop_id).single();

    if (!shop) {
      return NextResponse.json({ skipped: true, reason: 'shop not found' });
    }

    // เช็คประเภท notification
    const typeMap: Record<string, string> = {
      sale: 'line_notify_sale',
      pawn: 'line_notify_pawn',
      goods: 'line_notify_goods',
      installment: 'line_notify_installment',
      low_stock: 'line_notify_low_stock',
      parts_low: 'line_notify_parts_low',
      restock: 'line_notify_restock',
      repair_log: 'line_notify_repair_log',
    };

    if (type !== 'test' && typeMap[type] && !shop[typeMap[type]]) {
      return NextResponse.json({ skipped: true, reason: `${type} notify off` });
    }

    const channelToken = process.env.LINE_MESSAGING_CHANNEL_TOKEN;
    if (!channelToken) {
      return NextResponse.json({ 
        error: 'LINE Messaging not configured on server', 
        skipped: true 
      });
    }

    // ⭐ Priority 1: ส่งเข้ากลุ่ม (ถ้ามี group_id)
    if (shop.line_group_id) {
      const response = await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${channelToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: shop.line_group_id,
          messages: [{ type: 'text', text: message }],
        }),
      });

      if (response.ok) {
        return NextResponse.json({ success: true, target: 'group' });
      } else {
        const errorText = await response.text();
        console.error('LINE Group push failed:', errorText);
        // ถ้าส่งเข้ากลุ่ม fail → fallback ส่งหา admin แต่ละคน
      }
    }

    // ⭐ Priority 2: ส่งหา admin แต่ละคน (fallback)
    let adminQuery = supabase
      .from('profiles')
      .select('id, line_user_id, full_name')
      .eq('shop_id', profile.shop_id)
      .eq('role', 'admin')
      .not('line_user_id', 'is', null);

    if (type === 'test') {
      adminQuery = adminQuery.eq('id', user.id);
    }

    const { data: admins } = await adminQuery;

    if (!admins || admins.length === 0) {
      return NextResponse.json({ 
        skipped: true, 
        reason: shop.line_group_id 
          ? 'group send failed and no admin connected'
          : (type === 'test' ? 'you not connected' : 'no admin connected to LINE') 
      });
    }

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

    return NextResponse.json({ 
      success: success > 0, 
      target: 'individuals',
      sentTo: success,
      failed: failed,
      total: admins.length,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
