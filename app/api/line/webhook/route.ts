import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { answerQuestion } from '@/lib/assistant';

// Service role client (เพราะ webhook ไม่มี user session)
function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

function verifySignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.LINE_MESSAGING_CHANNEL_SECRET;
  if (!secret) return true; // ยังไม่ได้ตั้งค่า secret - ข้ามการเช็ค (backward compatible จนกว่าจะตั้งค่า)
  if (!signature) return false;
  const hash = crypto.createHmac('sha256', secret).update(rawBody).digest('base64');
  return hash === signature;
}

async function replyLine(replyToken: string, text: string) {
  const channelToken = process.env.LINE_MESSAGING_CHANNEL_TOKEN;
  if (!channelToken || !replyToken) return;
  await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: { Authorization: `Bearer ${channelToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ replyToken, messages: [{ type: 'text', text }] }),
  });
}

async function handleUserQuestion(supabase: any, userId: string, question: string, replyToken: string) {
  const { data: profile } = await supabase
    .from('profiles').select('shop_id, branch_id, full_name').eq('line_user_id', userId).single();

  if (!profile?.shop_id) {
    await replyLine(replyToken, '❌ บัญชี LINE นี้ยังไม่ได้เชื่อมกับระบบ\n\nไปที่หน้าตั้งค่า > แจ้งเตือน ในเว็บ แล้วกด "เชื่อม LINE" ก่อนถามได้เลยครับ');
    return;
  }

  const message = await answerQuestion(supabase, profile.shop_id, profile.branch_id || null, 'line', userId, question);
  await replyLine(replyToken, message);
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-line-signature');
    if (!verifySignature(rawBody, signature)) {
      return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
    }

    const body = JSON.parse(rawBody);
    const events = body.events || [];

    const supabase = getServiceClient();
    const channelToken = process.env.LINE_MESSAGING_CHANNEL_TOKEN;

    for (const event of events) {
      // เหตุการณ์ "join" - บอทถูก add เข้ากลุ่ม
      if (event.type === 'join' && event.source?.type === 'group') {
        const groupId = event.source.groupId;

        // ส่งข้อความตอบกลับในกลุ่ม - แจ้ง Group ID
        if (channelToken && event.replyToken) {
          await fetch('https://api.line.me/v2/bot/message/reply', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${channelToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              replyToken: event.replyToken,
              messages: [{
                type: 'text',
                text: `🎉 บอทเข้ากลุ่มสำเร็จ!\n\n📋 Group ID:\n${groupId}\n\n📌 วิธีใช้:\n1. Copy Group ID ด้านบน\n2. กลับไปที่หน้า ⚙️ ตั้งค่า ในเว็บ\n3. ใส่ Group ID → กดบันทึก\n\n✅ ทุกคนในกลุ่มจะได้รับแจ้งเตือนพร้อมกัน`,
              }],
            }),
          });
        }
      }

      // เหตุการณ์ "message"
      if (event.type === 'message' && event.message?.type === 'text') {
        const text = event.message.text.toLowerCase().trim();
        const isIdCommand = text === 'id' || text === '/id' || text === 'group id';

        if (isIdCommand && event.source?.type === 'group') {
          // มีคนพิมพ์ "id" ในกลุ่ม → ตอบกลับด้วย Group ID
          if (channelToken && event.replyToken) {
            const groupId = event.source.groupId;
            await fetch('https://api.line.me/v2/bot/message/reply', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${channelToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                replyToken: event.replyToken,
                messages: [{
                  type: 'text',
                  text: `📋 Group ID:\n${groupId}\n\n📌 Copy ไปวางในหน้าตั้งค่าของเว็บ`,
                }],
              }),
            });
          }
        } else if (event.source?.type === 'user' && event.replyToken) {
          // ทัก 1:1 หา OA มา - ถือเป็นคำถามข้อมูลร้าน
          await handleUserQuestion(supabase, event.source.userId, event.message.text, event.replyToken);
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('Webhook error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// LINE บางครั้งจะส่ง GET เพื่อ verify webhook URL
export async function GET() {
  return NextResponse.json({ status: 'ok' });
}
