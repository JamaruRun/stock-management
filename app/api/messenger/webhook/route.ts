import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { answerQuestion } from '@/lib/assistant';

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

function verifySignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.MESSENGER_APP_SECRET;
  if (!secret) return true; // ยังไม่ได้ตั้งค่า secret - ข้ามการเช็ค
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return signatureHeader.slice(7) === expected;
}

// Messenger Send API ไม่มี array ของหลายข้อความในคำขอเดียวแบบ LINE ต้องยิงทีละข้อความเรียงกันแทน
async function sendMessengerReply(psid: string, texts: string | string[]) {
  const token = process.env.MESSENGER_PAGE_ACCESS_TOKEN;
  if (!token) return;
  for (const text of Array.isArray(texts) ? texts : [texts]) {
    const res = await fetch(`https://graph.facebook.com/v21.0/me/messages?access_token=${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipient: { id: psid }, message: { text } }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error('Messenger reply failed:', res.status, body);
    }
  }
}

// Facebook webhook verification handshake
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === process.env.MESSENGER_VERIFY_TOKEN && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: 'forbidden' }, { status: 403 });
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-hub-signature-256');
    if (!verifySignature(rawBody, signature)) {
      return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
    }

    const body = JSON.parse(rawBody);
    const supabase = getServiceClient();

    for (const entry of body.entry || []) {
      for (const event of entry.messaging || []) {
        const senderId: string | undefined = event.sender?.id;
        const text: string | undefined = event.message?.text;
        if (!senderId || !text) continue;

        const linkMatch = text.trim().match(/^เชื่อม\s+(\d{6})$/);
        if (linkMatch) {
          const code = linkMatch[1];
          const { data: profile } = await supabase
            .from('profiles').select('id, messenger_link_code_expires_at')
            .eq('messenger_link_code', code).single();

          if (!profile || !profile.messenger_link_code_expires_at || new Date(profile.messenger_link_code_expires_at).getTime() < Date.now()) {
            await sendMessengerReply(senderId, '❌ โค้ดไม่ถูกต้องหรือหมดอายุแล้ว กลับไปกดสร้างโค้ดใหม่ในหน้าตั้งค่าครับ');
            continue;
          }

          await supabase.from('profiles').update({
            messenger_psid: senderId, messenger_link_code: null, messenger_link_code_expires_at: null,
          }).eq('id', profile.id);
          await sendMessengerReply(senderId, '✅ เชื่อมสำเร็จ! ทักถามข้อมูลร้านได้เลยครับ');
          continue;
        }

        const { data: profile } = await supabase
          .from('profiles').select('shop_id, branch_id').eq('messenger_psid', senderId).single();

        if (!profile?.shop_id) {
          await sendMessengerReply(senderId, '❌ บัญชี Messenger นี้ยังไม่ได้เชื่อมกับระบบ\n\nไปที่หน้าตั้งค่า > แจ้งเตือน ในเว็บ แล้วกด "เชื่อม Messenger" เพื่อรับโค้ดมาพิมพ์ที่นี่ก่อนครับ');
          continue;
        }

        // ครอบ try/catch เอง กัน exception ระหว่างทาง (เช่น Supabase/Gemini ล่มชั่วคราว) ทำให้เงียบไปเลยไม่ตอบอะไรทั้งนั้น
        try {
          const messages = await answerQuestion(supabase, profile.shop_id, profile.branch_id || null, 'messenger', senderId, text);
          await sendMessengerReply(senderId, messages);
        } catch (err: any) {
          console.error('answerQuestion error:', err);
          await sendMessengerReply(senderId, '⚠️ ระบบขัดข้องชั่วคราว ลองถามใหม่อีกครั้งได้เลยครับ').catch(() => {});
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('Messenger webhook error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
