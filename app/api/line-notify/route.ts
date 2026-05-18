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

    // โหลด profile + shop
    const { data: profile } = await supabase
      .from('profiles').select('shop_id').eq('id', user.id).single();
    
    if (!profile?.shop_id) {
      return NextResponse.json({ error: 'No shop' }, { status: 400 });
    }

    const { data: shop } = await supabase
      .from('shops').select('*').eq('id', profile.shop_id).single();

    if (!shop?.line_token) {
      return NextResponse.json({ error: 'No LINE token', skipped: true });
    }

    // เช็คประเภทการแจ้งเตือนว่าเปิดอยู่ไหม
    if (type === 'sale' && !shop.line_notify_sale) {
      return NextResponse.json({ skipped: true, reason: 'sale notify off' });
    }
    if (type === 'pawn' && !shop.line_notify_pawn) {
      return NextResponse.json({ skipped: true, reason: 'pawn notify off' });
    }
    if (type === 'goods' && !shop.line_notify_goods) {
      return NextResponse.json({ skipped: true, reason: 'goods notify off' });
    }
    if (type === 'installment' && !shop.line_notify_installment) {
      return NextResponse.json({ skipped: true, reason: 'installment notify off' });
    }
    if (type === 'low_stock' && !shop.line_notify_low_stock) {
      return NextResponse.json({ skipped: true, reason: 'low stock notify off' });
    }

    // ส่ง LINE Notify
    const params = new URLSearchParams();
    params.append('message', message);

    const response = await fetch('https://notify-api.line.me/api/notify', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${shop.line_token}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({ 
        error: 'LINE Notify failed', 
        status: response.status,
        detail: errorText,
      }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
