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

// LINE รับ messages เป็น array ได้สูงสุด 5 ข้อความต่อการ reply 1 ครั้ง (ใช้ตอบหลายข้อความแทนตัดข้อมูลทิ้งเวลาคำตอบยาว)
async function replyLine(replyToken: string, texts: string | string[]) {
  const channelToken = process.env.LINE_MESSAGING_CHANNEL_TOKEN;
  if (!channelToken || !replyToken) return;
  const messages = (Array.isArray(texts) ? texts : [texts]).slice(0, 5).map((text) => ({ type: 'text', text }));
  const res = await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: { Authorization: `Bearer ${channelToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ replyToken, messages }),
  });
  if (!res.ok) {
    // เดิมไม่เช็ค response เลย ถ้า LINE ปฏิเสธ (เช่น replyToken หมดอายุเพราะประมวลผลช้าเกินไป) จะเงียบสนิท ไม่มีร่องรอยใน log ไหนเลย
    const body = await res.text().catch(() => '');
    console.error('LINE reply failed:', res.status, body);
  }
}

async function handleUserQuestion(supabase: any, userId: string, question: string, replyToken: string) {
  const { data: profile } = await supabase
    .from('profiles').select('shop_id, branch_id, full_name').eq('line_user_id', userId).single();

  if (!profile?.shop_id) {
    await replyLine(replyToken, '❌ บัญชี LINE นี้ยังไม่ได้เชื่อมกับระบบ\n\nไปที่หน้าตั้งค่า > แจ้งเตือน ในเว็บ แล้วกด "เชื่อม LINE" ก่อนถามได้เลยครับ');
    return;
  }

  const messages = await answerQuestion(supabase, profile.shop_id, profile.branch_id || null, 'line', userId, question);
  await replyLine(replyToken, messages);
}

const GROUP_QUESTION_PREFIX = /^ถาม[:\s]*/;

async function handleGroupQuestion(supabase: any, groupId: string, rawText: string, replyToken: string) {
  const question = rawText.replace(GROUP_QUESTION_PREFIX, '').trim();
  if (!question) return;

  const { data: shop } = await supabase
    .from('shops').select('id').eq('line_group_id', groupId).single();
  if (!shop?.id) return; // กลุ่มนี้ยังไม่ได้เชื่อมกับร้านไหนเลย เงียบไว้ ไม่ต้องตอบ

  // ใช้ groupId เป็น sender_key เพื่อจำกัด rate limit ร่วมกันทั้งกลุ่ม (ไม่ใช่แยกตามคนที่พิมพ์)
  const messages = await answerQuestion(supabase, shop.id, null, 'line', `group:${groupId}`, question);
  await replyLine(replyToken, messages);
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
                text: `🎉 บอทเข้ากลุ่มสำเร็จ!\n\n📋 Group ID:\n${groupId}\n\n📌 วิธีใช้:\n1. Copy Group ID ด้านบน\n2. กลับไปที่หน้า ⚙️ ตั้งค่า ในเว็บ\n3. ใส่ Group ID → กดบันทึก\n\n✅ ทุกคนในกลุ่มจะได้รับแจ้งเตือนพร้อมกัน\n\n💬 ถามข้อมูลร้านในกลุ่มนี้ได้เลย ให้ขึ้นต้นด้วยคำว่า "ถาม" เช่น "ถาม รายรับวันนี้เท่าไหร่"\n\n🎓 สอนคำย่อให้บอทได้เลย ให้ขึ้นต้นด้วยคำว่า "สอน" เช่น "สอน ip13 = iphone 13"`,
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
          // ครอบ try/catch เอง กัน exception ระหว่างทาง (เช่น Supabase/Gemini ล่มชั่วคราว) ทำให้เงียบไปเลยไม่ตอบอะไรทั้งนั้น
          try {
            await handleUserQuestion(supabase, event.source.userId, event.message.text, event.replyToken);
          } catch (err: any) {
            console.error('handleUserQuestion error:', err);
            await replyLine(event.replyToken, '⚠️ ระบบขัดข้องชั่วคราว ลองถามใหม่อีกครั้งได้เลยครับ').catch(() => {});
          }
        } else if (event.source?.type === 'group' && event.replyToken && (text.startsWith('ถาม') || text.startsWith('สอน'))) {
          // ในกลุ่ม ต้องขึ้นต้นด้วย "ถาม" หรือ "สอน" ถึงจะตอบ กันบอทตอบทุกข้อความที่คนคุยกันเองในกลุ่ม
          try {
            await handleGroupQuestion(supabase, event.source.groupId, event.message.text, event.replyToken);
          } catch (err: any) {
            console.error('handleGroupQuestion error:', err);
            await replyLine(event.replyToken, '⚠️ ระบบขัดข้องชั่วคราว ลองถามใหม่อีกครั้งได้เลยครับ').catch(() => {});
          }
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
