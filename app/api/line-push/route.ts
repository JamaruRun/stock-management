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
      return NextResponse.json({ error: 'No shop' }, { status: 400 });
    }

    const { data: shop } = await supabase
      .from('shops').select('*').eq('id', profile.shop_id).single();

    if (!shop?.line_channel_access_token || !shop?.line_user_id) {
      return NextResponse.json({ skipped: true, reason: 'no LINE config' });
    }

    // เช็คประเภท notification
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

    // ส่ง LINE Messaging API - Push Message
    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${shop.line_channel_access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: shop.line_user_id,
        messages: [{
          type: 'text',
          text: message,
        }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
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
