import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { extractDateRange } from '@/lib/gemini';

const THAI_OFFSET_MS = 7 * 60 * 60 * 1000;
const MAX_ITEMS_IN_MESSAGE = 20;

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

function todayThaiStr(): string {
  const thai = new Date(Date.now() + THAI_OFFSET_MS);
  return `${thai.getUTCFullYear()}-${String(thai.getUTCMonth() + 1).padStart(2, '0')}-${String(thai.getUTCDate()).padStart(2, '0')}`;
}

async function handleLedgerQuestion(supabase: any, userId: string, question: string, replyToken: string) {
  const { data: profile } = await supabase
    .from('profiles').select('shop_id, branch_id, full_name').eq('line_user_id', userId).single();

  if (!profile?.shop_id) {
    await replyLine(replyToken, '❌ บัญชี LINE นี้ยังไม่ได้เชื่อมกับระบบ\n\nไปที่หน้าตั้งค่า > แจ้งเตือน ในเว็บ แล้วกด "เชื่อม LINE" ก่อนถามได้เลยครับ');
    return;
  }

  const range = await extractDateRange(question, todayThaiStr());
  if ('error' in range) {
    await replyLine(replyToken, '🤔 ไม่เข้าใจคำถามนี้\n\nลองถามแบบนี้ดูครับ:\n• "รายรับรายจ่ายวันที่ 17"\n• "สรุปเดือนนี้"\n• "เมื่อวานได้เท่าไหร่"');
    return;
  }

  const { date_from, date_to } = range;
  const shopId = profile.shop_id;

  const [{ data: entries }, { data: sales }, { data: goods }] = await Promise.all([
    supabase.from('ledger_entries').select('*').eq('shop_id', shopId).is('deleted_at', null)
      .gte('business_date', date_from).lte('business_date', date_to)
      .order('business_date', { ascending: false }).order('created_at', { ascending: false }),
    supabase.from('sales_history').select('profit').eq('shop_id', shopId).gte('business_date', date_from).lte('business_date', date_to),
    supabase.from('goods_sales').select('subtotal').eq('shop_id', shopId).gte('business_date', date_from).lte('business_date', date_to),
  ]);

  const ledgerIncome = (entries || []).filter((e: any) => e.entry_type === 'income').reduce((s: number, e: any) => s + Number(e.amount || 0), 0);
  const ledgerExpense = (entries || []).filter((e: any) => e.entry_type === 'expense').reduce((s: number, e: any) => s + Number(e.amount || 0), 0);
  const salesProfit = (sales || []).reduce((s: number, r: any) => s + Number(r.profit || 0), 0);
  const goodsRevenue = (goods || []).reduce((s: number, r: any) => s + Number(r.subtotal || 0), 0);
  const totalIncome = ledgerIncome + salesProfit + goodsRevenue;
  const totalExpense = ledgerExpense;
  const netProfit = totalIncome - totalExpense;

  const periodTxt = date_from === date_to ? date_from : `${date_from} ถึง ${date_to}`;
  const lines = (entries || []).slice(0, MAX_ITEMS_IN_MESSAGE).map((e: any) => {
    const sign = e.entry_type === 'income' ? '+' : '-';
    return `${e.entry_type === 'income' ? '📥' : '📤'} ${e.description} ${sign}฿${Number(e.amount).toLocaleString()}`;
  });
  const remaining = (entries || []).length - lines.length;
  const moreTxt = remaining > 0 ? `\n...และอีก ${remaining} รายการ` : '';
  const detailTxt = lines.length > 0 ? `\n━━━━━━━━━━━━━\n${lines.join('\n')}${moreTxt}` : '';

  const message = [
    `📊 สรุปรายรับ-รายจ่าย ${periodTxt}`,
    '━━━━━━━━━━━━━',
    `💰 รายรับรวม: ฿${totalIncome.toLocaleString()}`,
    `   (สมุด ฿${ledgerIncome.toLocaleString()} · กำไรขายเครื่อง ฿${salesProfit.toLocaleString()} · ของแถม ฿${goodsRevenue.toLocaleString()})`,
    `💸 รายจ่ายรวม: ฿${totalExpense.toLocaleString()}`,
    `📈 กำไรสุทธิ: ฿${netProfit.toLocaleString()}`,
  ].join('\n') + detailTxt;

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
          // ทัก 1:1 หา OA มา - ถือเป็นคำถามข้อมูลรายรับ-รายจ่าย
          await handleLedgerQuestion(supabase, event.source.userId, event.message.text, event.replyToken);
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
