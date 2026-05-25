import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, subject, message, rating, page_url } = body;

    if (!message || message.trim().length < 5) {
      return NextResponse.json(
        { error: 'กรุณาเขียนข้อความอย่างน้อย 5 ตัวอักษร' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // ดึงข้อมูล profile + shop
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, full_name, username, shop_id, shops(name)')
      .eq('id', user.id)
      .single();

    const userAgent = req.headers.get('user-agent') || '';

    // บันทึก feedback
    const { data: fb, error: fbError } = await supabase
      .from('feedback')
      .insert({
        user_id: user.id,
        user_name: profile?.full_name || profile?.username || 'Unknown',
        user_username: profile?.username,
        shop_id: profile?.shop_id || null,
        shop_name: (profile?.shops as any)?.name || null,
        type: type || 'general',
        subject: subject?.trim() || null,
        message: message.trim(),
        rating: rating ? parseInt(rating) : null,
        page_url: page_url || null,
        user_agent: userAgent.substring(0, 500),
        status: 'new',
      })
      .select()
      .single();

    if (fbError) {
      console.error('Feedback insert error:', fbError);
      return NextResponse.json(
        { error: 'บันทึกไม่สำเร็จ: ' + fbError.message },
        { status: 500 }
      );
    }

    // ส่ง LINE notify ให้ super admin
    try {
      await notifySuperAdmin(fb);
    } catch (e) {
      console.warn('Failed to notify super admin:', e);
      // ไม่ throw - feedback บันทึกแล้ว
    }

    return NextResponse.json({ 
      success: true, 
      id: fb.id,
      message: 'ขอบคุณที่ส่ง feedback มาครับ!' 
    });
  } catch (e: any) {
    console.error('Feedback API error:', e);
    return NextResponse.json(
      { error: e.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

async function notifySuperAdmin(feedback: any) {
  const channelToken = process.env.LINE_MESSAGING_CHANNEL_TOKEN;
  if (!channelToken) return;

  // หา super admin ที่เปิดรับ notify
  const { createClient: createServiceClient } = await import('@supabase/supabase-js');
  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: admins } = await supabase
    .from('profiles')
    .select('line_user_id, full_name')
    .eq('is_super_admin', true)
    .eq('receive_feedback_notify', true)
    .not('line_user_id', 'is', null);

  if (!admins || admins.length === 0) {
    console.log('No super admin to notify');
    return;
  }

  // แปลง type → emoji
  const typeMap: Record<string, string> = {
    bug: '🐛 แจ้งบั๊ก',
    feature: '💡 ขอฟีเจอร์',
    general: '💬 ทั่วไป',
    praise: '⭐ ชื่นชม',
    complaint: '😞 ร้องเรียน',
  };

  const typeLabel = typeMap[feedback.type] || '💬 ทั่วไป';
  const ratingStars = feedback.rating 
    ? '⭐'.repeat(feedback.rating) + ' (' + feedback.rating + '/5)' 
    : '';

  const text = [
    '📬 Feedback ใหม่!',
    '',
    `${typeLabel}`,
    feedback.rating ? `เรตติ้ง: ${ratingStars}` : '',
    '',
    `👤 ${feedback.user_name}`,
    `🏪 ${feedback.shop_name || '-'}`,
    feedback.subject ? `📋 ${feedback.subject}` : '',
    '',
    '💬 ข้อความ:',
    feedback.message,
    '',
    feedback.page_url ? `📍 ${feedback.page_url}` : '',
  ].filter(Boolean).join('\n');

  // ส่งให้ admin แต่ละคน
  for (const admin of admins) {
    if (!admin.line_user_id) continue;
    
    try {
      await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${channelToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: admin.line_user_id,
          messages: [{ type: 'text', text }],
        }),
      });
    } catch (e) {
      console.error('Failed to send to', admin.line_user_id, e);
    }
  }
}
