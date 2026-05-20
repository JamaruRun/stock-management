import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles').select('role, shop_id').eq('id', user.id).single();
  
  if (profile?.role !== 'admin' || !profile?.shop_id) {
    return NextResponse.json({ error: 'Not admin' }, { status: 403 });
  }

  const { group_id } = await req.json();
  
  if (!group_id || typeof group_id !== 'string' || !group_id.startsWith('C')) {
    return NextResponse.json({ error: 'Invalid Group ID (ต้องขึ้นต้นด้วย C)' }, { status: 400 });
  }

  const { error } = await supabase
    .from('shops')
    .update({
      line_group_id: group_id.trim(),
      line_group_connected_at: new Date().toISOString(),
    })
    .eq('id', profile.shop_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // ส่งข้อความทดสอบเข้ากลุ่มทันที
  const channelToken = process.env.LINE_MESSAGING_CHANNEL_TOKEN;
  if (channelToken) {
    try {
      const { data: shop } = await supabase
        .from('shops').select('name').eq('id', profile.shop_id).single();
      
      await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${channelToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: group_id.trim(),
          messages: [{
            type: 'text',
            text: `✅ เชื่อมกลุ่มสำเร็จ!\n\n🏪 ร้าน: ${shop?.name || 'ของคุณ'}\n\nต่อจากนี้ระบบจะส่งแจ้งเตือนยอดขาย/จำนำ/ผ่อน เข้ากลุ่มนี้ทุกครั้ง`,
          }],
        }),
      });
    } catch (e) {
      console.error('Welcome message failed:', e);
    }
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles').select('role, shop_id').eq('id', user.id).single();
  
  if (profile?.role !== 'admin' || !profile?.shop_id) {
    return NextResponse.json({ error: 'Not admin' }, { status: 403 });
  }

  const { error } = await supabase
    .from('shops')
    .update({
      line_group_id: null,
      line_group_connected_at: null,
    })
    .eq('id', profile.shop_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
