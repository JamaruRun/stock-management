import { classifyQuestion } from '@/lib/gemini';
import { fetchAllRows } from '@/lib/db-utils';

const RATE_LIMIT_PER_MINUTE = 5;
const RATE_LIMIT_PER_DAY = 50;
const MAX_ITEMS_IN_MESSAGE = 15;
// รายการที่ยาวเกินคำตอบเดียว (เช่นถามรุ่นที่มีหลายยี่ห้อ/เกรด) จะยอมโชว์ได้เยอะแค่ไหนก่อนจะเริ่มตัดแล้วบอกให้ถามเจาะจงขึ้น
const MAX_ITEMS_HARD_CAP = 100;

// แบ่งเป็นหลายข้อความแทนการตัดทิ้ง กันข้อความยาวเกิน limit ของแต่ละแพลตฟอร์ม (LINE ~5000 ตัวอักษร, Messenger ~2000)
// เผื่อ margin ไว้พอสมควรเพราะ LINE/Messenger นับความยาวรวม emoji/อักขระพิเศษไม่เท่ากับ .length เป๊ะๆ เสมอไป
const MAX_CHARS_BY_PLATFORM: Record<'line' | 'messenger', number> = { line: 4500, messenger: 1800 };
// LINE ส่งได้สูงสุด 5 ข้อความต่อการ reply 1 ครั้ง (ไม่งั้นต้องใช้ push message ซึ่งมีโควต้าจำกัด ผิดหลักการที่ตั้งใจให้ฟรี)
const MAX_CHUNKS = 5;

function chunkMessage(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text];
  // แบ่งตามรอยต่อรายการ (คั่นด้วยบรรทัดว่าง) ก่อน ไม่ตัดกลางรายการให้ข้อความขาดกลางคัน
  const blocks = text.split('\n\n');
  const chunks: string[] = [];
  let current = '';
  for (const block of blocks) {
    const candidate = current ? `${current}\n\n${block}` : block;
    if (candidate.length > maxChars && current) {
      chunks.push(current);
      current = block;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);
  // เผื่อกรณีมี block เดียวยาวเกิน maxChars เอง (ไม่ควรเกิดขึ้นบ่อย) ตัดตรงๆ กันพัง
  return chunks.flatMap((c) => {
    if (c.length <= maxChars) return [c];
    const hard: string[] = [];
    for (let i = 0; i < c.length; i += maxChars) hard.push(c.slice(i, i + maxChars));
    return hard;
  });
}

// ข้อความสั้นๆ ที่ไม่ใช่การถามหาอะไหล่แน่ๆ (ทักทาย/พูดเล่น) กันไม่ให้ fallback เดาเป็น stock_lookup ผิดๆ
const CHITCHAT_WORDS = ['สวัสดี', 'หวัดดี', 'ขอบคุณ', 'ขอบใจ', 'thanks', 'thank you', 'hello', 'hi', 'ทดสอบ', 'test', '555', 'ฮ่า'];
function looksLikeTerseProductQuery(q: string): boolean {
  const t = q.trim();
  if (t.length === 0 || t.length > 24) return false;
  const lower = t.toLowerCase();
  if (CHITCHAT_WORDS.some((w) => lower.includes(w))) return false;
  if (/รายรับ|รายจ่าย|กำไร|ยอดขาย|จำนำ|ครบกำหนด/.test(t)) return false; // ให้ Gemini ตัดสินเองตามเดิมสำหรับหมวดอื่น
  return true;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// แอดมินสอนคำย่อ/ชื่อเล่นให้บอทจำเองได้ผ่านแชท เช่น "สอน ip13 = iphone 13" หรือ "สอน ss คือ samsung"
// กันเคสตัวย่อ/รุ่นใหม่ๆ ที่ไม่ได้ฝังไว้ในโค้ด (เพิ่มไม่ทันตลอด) โดยไม่ต้องรอแก้โค้ด/deploy ใหม่ทุกครั้ง
const TEACH_PATTERN = /^สอน\s+(.+?)\s*(?:=|คือ)\s*(.+)$/i;

async function handleTeachCommand(supabase: any, shopId: string, rawText: string): Promise<string | null> {
  const m = rawText.trim().match(TEACH_PATTERN);
  if (!m) return null;
  const alias = m[1].trim();
  const expansion = m[2].trim();
  if (!alias || !expansion) {
    return '❌ รูปแบบไม่ถูกต้องครับ ลองพิมพ์แบบนี้: "สอน ip13 = iphone 13"';
  }
  const { error } = await supabase
    .from('assistant_aliases')
    .upsert({ shop_id: shopId, alias, expansion }, { onConflict: 'shop_id,alias' });
  if (error) return '❌ บันทึกไม่สำเร็จ: ' + error.message;
  return `✅ จำแล้วครับ: "${alias}" หมายถึง "${expansion}"\nต่อไปพิมพ์ "${alias}" ระบบจะเข้าใจอัตโนมัติ`;
}

// เอาคำย่อที่แอดมินสอนไว้ (เฉพาะร้านตัวเอง) มาแทนที่ในข้อความก่อนส่งให้ Gemini + ก่อนค้นฐานข้อมูล
// ทำเป็น substring replace ตรงๆ (ไม่สนขอบเขตคำ) เพราะคำย่อมักติดกับคำไทยไม่มีเว้นวรรคอยู่แล้ว (เช่น "แบตip13")
async function expandShopAliases(supabase: any, shopId: string, text: string): Promise<string> {
  const { data } = await supabase.from('assistant_aliases').select('alias, expansion').eq('shop_id', shopId);
  let result = text;
  for (const a of data || []) {
    result = result.replace(new RegExp(escapeRegExp(a.alias), 'gi'), a.expansion);
  }
  return result;
}

function todayThaiStr(): string {
  const thai = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return `${thai.getUTCFullYear()}-${String(thai.getUTCMonth() + 1).padStart(2, '0')}-${String(thai.getUTCDate()).padStart(2, '0')}`;
}

/** เรียกหลังยืนยันตัวตนผู้ถามแล้ว (reverse-lookup shop_id ของแต่ละแพลตฟอร์มทำก่อนเรียกฟังก์ชันนี้)
 * คืน array ของ message string (1 อันขึ้นไป) ให้ webhook ของแต่ละแพลตฟอร์มส่งต่อเป็นหลายข้อความ — ฟังก์ชันนี้ไม่ยุ่งกับการส่งข้อความจริง */
export async function answerQuestion(
  supabase: any,
  shopId: string,
  branchId: string | null,
  platform: 'line' | 'messenger',
  senderKey: string,
  question: string
): Promise<string[]> {
  const today = todayThaiStr();

  // ===== Rate limit (กัน quota Gemini/DB โดนใช้เกินจากสแปม) =====
  const oneMinAgo = new Date(Date.now() - 60 * 1000).toISOString();
  const { count: minuteCount } = await supabase
    .from('assistant_query_log').select('id', { count: 'exact', head: true })
    .eq('sender_key', senderKey).gte('created_at', oneMinAgo);
  if ((minuteCount || 0) >= RATE_LIMIT_PER_MINUTE) {
    return ['⏳ ถามถี่ไปหน่อยนะครับ รอสักครู่แล้วค่อยถามใหม่'];
  }

  const dayStart = `${today}T00:00:00.000Z`;
  const { count: dayCount } = await supabase
    .from('assistant_query_log').select('id', { count: 'exact', head: true })
    .eq('sender_key', senderKey).gte('created_at', dayStart);
  if ((dayCount || 0) >= RATE_LIMIT_PER_DAY) {
    return ['📵 วันนี้ถามครบจำนวนที่กำหนดแล้วครับ พรุ่งนี้ถามใหม่ได้เลย'];
  }

  // ===== "สอน" คำย่อ: ไม่ต้องผ่าน Gemini เลย จัดการแล้ว return ทันที =====
  const teachReply = await handleTeachCommand(supabase, shopId, question);
  if (teachReply) return [teachReply];

  const { data: logRow } = await supabase
    .from('assistant_query_log')
    .insert({ shop_id: shopId, platform, sender_key: senderKey, question })
    .select('id').single();

  const expandedQuestion = await expandShopAliases(supabase, shopId, question);
  const classified = await classifyQuestion(expandedQuestion, today);
  // เผื่อ Gemini เข้าใจข้อความสั้นๆ/แปลกๆ ผิดเป็น unknown (ไม่ deterministic 100% ทุกครั้ง) — ถ้าข้อความหน้าตาเหมือนกำลังถามหาอะไหล่
  // สั้นๆ อยู่แล้วให้ fallback เป็น stock_lookup เอง แทนที่จะปล่อยให้ตอบ "ไม่เข้าใจ" ทั้งที่จริงๆ น่าจะเดาเจตนาได้
  const parsed = classified.intent === 'unknown' && looksLikeTerseProductQuery(expandedQuestion)
    ? ({ intent: 'stock_lookup', keyword: expandedQuestion.trim() } as const)
    : classified;
  if (logRow?.id) {
    await supabase.from('assistant_query_log').update({ intent: parsed.intent }).eq('id', logRow.id);
  }

  let message: string;
  switch (parsed.intent) {
    case 'ledger':
      message = await answerLedger(supabase, shopId, branchId, parsed.date_from, parsed.date_to, parsed.keyword);
      break;
    case 'stock_lookup':
      message = await answerStockLookup(supabase, shopId, parsed.keyword);
      break;
    case 'low_stock':
      message = await answerLowStock(supabase, shopId);
      break;
    case 'dead_stock':
      message = await answerDeadStock(supabase, shopId, parsed.days);
      break;
    case 'pawn_lookup':
      message = await answerPawnLookup(supabase, shopId, parsed.keyword);
      break;
    case 'pawn_due_soon':
      message = await answerPawnDueSoon(supabase, shopId, parsed.days);
      break;
    case 'pawn_overdue':
      message = await answerPawnOverdue(supabase, shopId);
      break;
    default:
      message = '🤔 ไม่เข้าใจคำถามนี้\n\nลองถามแบบนี้ดูครับ:\n• "รายรับรายจ่ายวันที่ 17"\n• "สรุปเดือนนี้"\n• "อะไหล่จอ iPhone 11 เหลือกี่ชิ้น"\n• "จอ iPhone 11 ราคาเท่าไหร่"\n• "อะไหล่ใกล้หมดมีอะไรบ้าง"\n• "เดดสต็อคมีอะไรบ้าง"\n• "จำนำของคุณสมชายครบกำหนดเมื่อไหร่"\n• "เครื่องจำนำใกล้ครบกำหนดมีอะไรบ้าง"\n• "เครื่องจำนำเลยกำหนดมีอะไรบ้าง"\n\n💡 ถ้าใช้คำย่อ/ชื่อเล่นที่ระบบยังไม่รู้จัก สอนได้เลย พิมพ์ "สอน <คำย่อ> = <ความหมาย>" เช่น "สอน ip13 = iphone 13"';
  }

  const chunks = chunkMessage(message, MAX_CHARS_BY_PLATFORM[platform]).slice(0, MAX_CHUNKS);
  if (chunks.length <= 1) return chunks;
  return chunks.map((c, i) => `(ข้อความที่ ${i + 1}/${chunks.length})\n${c}`);
}

async function answerLedger(supabase: any, shopId: string, branchId: string | null, dateFrom: string, dateTo: string, keyword?: string) {
  let ledgerQ = supabase.from('ledger_entries').select('*').eq('shop_id', shopId).is('deleted_at', null)
    .gte('business_date', dateFrom).lte('business_date', dateTo)
    .order('business_date', { ascending: false }).order('created_at', { ascending: false });
  if (keyword) ledgerQ = ledgerQ.ilike('description', `%${keyword}%`);

  const [{ data: entries }, { data: sales }, { data: goods }] = await Promise.all([
    ledgerQ,
    supabase.from('sales_history').select('profit').eq('shop_id', shopId).gte('business_date', dateFrom).lte('business_date', dateTo),
    supabase.from('goods_sales').select('subtotal').eq('shop_id', shopId).gte('business_date', dateFrom).lte('business_date', dateTo),
  ]);

  const ledgerIncome = (entries || []).filter((e: any) => e.entry_type === 'income').reduce((s: number, e: any) => s + Number(e.amount || 0), 0);
  const ledgerExpense = (entries || []).filter((e: any) => e.entry_type === 'expense').reduce((s: number, e: any) => s + Number(e.amount || 0), 0);
  const salesProfit = keyword ? 0 : (sales || []).reduce((s: number, r: any) => s + Number(r.profit || 0), 0);
  const goodsRevenue = keyword ? 0 : (goods || []).reduce((s: number, r: any) => s + Number(r.subtotal || 0), 0);
  const totalIncome = ledgerIncome + salesProfit + goodsRevenue;
  const netProfit = totalIncome - ledgerExpense;

  const periodTxt = dateFrom === dateTo ? dateFrom : `${dateFrom} ถึง ${dateTo}`;
  const kwTxt = keyword ? ` (ค้นหา "${keyword}")` : '';
  const lines = (entries || []).slice(0, MAX_ITEMS_IN_MESSAGE).map((e: any) => {
    const sign = e.entry_type === 'income' ? '+' : '-';
    return `${e.entry_type === 'income' ? '📥' : '📤'} ${e.description} ${sign}฿${Number(e.amount).toLocaleString()}`;
  });
  const remaining = (entries || []).length - lines.length;
  const moreTxt = remaining > 0 ? `\n...และอีก ${remaining} รายการ` : '';
  const detailTxt = lines.length > 0 ? `\n━━━━━━━━━━━━━\n${lines.join('\n')}${moreTxt}` : '';

  const summaryLines = keyword
    ? [`💰 รายรับจากสมุด: ฿${ledgerIncome.toLocaleString()}`, `💸 รายจ่ายจากสมุด: ฿${ledgerExpense.toLocaleString()}`]
    : [
        `💰 รายรับรวม: ฿${totalIncome.toLocaleString()}`,
        `   (สมุด ฿${ledgerIncome.toLocaleString()} · กำไรขายเครื่อง ฿${salesProfit.toLocaleString()} · ของแถม ฿${goodsRevenue.toLocaleString()})`,
        `💸 รายจ่ายรวม: ฿${ledgerExpense.toLocaleString()}`,
        `📈 กำไรสุทธิ: ฿${netProfit.toLocaleString()}`,
      ];

  return [`📊 สรุปรายรับ-รายจ่าย ${periodTxt}${kwTxt}`, '━━━━━━━━━━━━━', ...summaryLines].join('\n') + detailTxt;
}

// ตัวย่อยี่ห้อที่ช่างซ่อมมือถือไทยนิยมพิมพ์กันสั้นๆ (เช่น "ip12" แทน "iphone 12", "ss a50" แทน "samsung a50")
// ขยายก่อนค้นหา เทียบกับชื่อรุ่นเต็มๆ ที่เก็บในระบบ (ไม่ได้เก็บเป็นตัวย่อ)
const BRAND_ABBREV: [RegExp, string][] = [
  [/^ip(\d.*)?$/i, 'iphone$1'],
  [/^ss(\d.*)?$/i, 'samsung$1'],
];
function expandAbbrev(word: string): string {
  for (const [re, replacement] of BRAND_ABBREV) {
    if (re.test(word)) return word.replace(re, replacement);
  }
  return word;
}

// คนพิมพ์มักติดคำไทย (ชื่อหมวด เช่น "แบต", "จอ") ชิดกับรุ่น/ตัวย่อภาษาอังกฤษโดยไม่เว้นวรรค (เช่น "แบตip12", "จอoppoa18")
// แยกคำตรงรอยต่อไทย↔อังกฤษ/ตัวเลข ก่อนค้นหา ไม่งั้นจะกลายเป็นคำเดียวยาวๆ ที่ไม่ตรงกับอะไรในระบบเลยสักคำ
function splitThaiLatinBoundary(word: string): string[] {
  return word.split(/(?<=[฀-๿])(?=[a-zA-Z0-9])|(?<=[a-zA-Z0-9])(?=[฀-๿])/).filter(Boolean);
}

/** ค้นหาแบบแยกคำ: ลองแบบเข้มก่อน (ต้องเจอทุกคำ) ถ้าไม่เจอเลยค่อย fallback เป็นแบบหลวม (เจอคำไหนก็ได้)
 * กันเคส Gemini สกัด keyword มาไม่สะอาด 100% (มีคำฟุ่มเฟือยหลงเหลือ) ไม่ให้ตอบ "ไม่พบ" ทั้งที่มีของจริง
 *
 * ข้อยกเว้นสำคัญ: ถ้าคำค้นมีคำที่มีตัวเลขปน (เช่น "ip12", "a18") ซึ่งมักเป็นรุ่นเครื่อง/รหัสเฉพาะที่ผู้ใช้ตั้งใจถามจริงๆ
 * แล้วไม่มีรายการไหนมีคำนั้นเลย ให้ถือว่า "ไม่มีของจริง" ไม่ fallback แบบหลวม — กันเคสถามรุ่นที่ไม่มีในสต็อค
 * แล้วดันไปเจอรายการอื่นที่บังเอิญมีคำทั่วไปตรงกัน (เช่น "จอ"/"งาน"/"tft") ทำให้ตอบรุ่นผิดเป็นรุ่นอื่นแทน */
function matchByWords<T>(rows: T[], keyword: string, getHaystack: (row: T) => string): T[] {
  const rawWords = keyword.toLowerCase().split(/\s+/).filter(Boolean).flatMap(splitThaiLatinBoundary);
  if (rawWords.length === 0) return [];
  // เทียบทั้งคำเดิม (มีช่องว่างคงเดิม) และคำที่ขยายตัวย่อแล้วแบบไม่มีช่องว่าง (กัน "iphone12" ไม่ตรงกับ "iphone 12" ที่มีเว้นวรรค)
  const words = rawWords.map((w) => ({ raw: w, expanded: expandAbbrev(w).replace(/\s+/g, '') }));
  const matchWord = (haystack: string, haystackCompact: string, w: { raw: string; expanded: string }) =>
    haystack.includes(w.raw) || haystackCompact.includes(w.expanded);

  const strict = rows.filter((r) => {
    const haystack = getHaystack(r).toLowerCase();
    const haystackCompact = haystack.replace(/\s+/g, '');
    return words.every((w) => matchWord(haystack, haystackCompact, w));
  });
  if (strict.length > 0) return strict;

  const hasModelLikeWord = rawWords.some((w) => /\d/.test(w));
  if (hasModelLikeWord) return [];

  return rows.filter((r) => {
    const haystack = getHaystack(r).toLowerCase();
    const haystackCompact = haystack.replace(/\s+/g, '');
    return words.some((w) => matchWord(haystack, haystackCompact, w));
  });
}

async function answerStockLookup(supabase: any, shopId: string, keyword: string) {
  // .select() ของ Supabase คืนสูงสุด 1000 แถวเสมอแม้ไม่ใส่ .limit() เอง ต้อง page ผ่าน fetchAllRows
  // ไม่งั้นร้านที่มีอะไหล่เกิน 1000 ชิ้น บอทจะหาของบางรุ่นไม่เจอทั้งที่มีจริงในสต๊อก
  const allParts = await fetchAllRows<any>(() =>
    supabase.from('parts')
      .select('id, name, sku, phone_model, battery_model, brand, stock_qty, low_stock_alert, cost_price, wholesale_price, sell_price')
      .eq('shop_id', shopId).order('id', { ascending: true })
  );
  const allPartIds = allParts.map((p: any) => p.id);

  // ดึง "รุ่นมือถือที่ใช้ได้" ทั้งหมดของทุกอะไหล่ (ไม่ใช่แค่ phone_model ซึ่งเป็นแค่รุ่นแรกที่ sync ไว้)
  // เพราะอะไหล่ 1 ชิ้นผูกได้หลายรุ่นผ่านตาราง part_compatibility เหมือนหน้า "ขาย"/"ใช้ในงานซ่อม" ที่ค้นหาแบบนี้อยู่แล้ว
  const modelsByPart: Record<string, string[]> = {};
  if (allPartIds.length > 0) {
    const compatRows = await fetchAllRows<any>(() =>
      supabase.from('part_compatibility').select('part_id, device_models(model_name)').in('part_id', allPartIds).order('part_id', { ascending: true })
    );
    for (const r of compatRows) {
      const name = (r as any).device_models?.model_name;
      if (!name) continue;
      (modelsByPart[(r as any).part_id] ||= []).push(name);
    }
  }

  // เทียบกับชื่ออะไหล่ + รุ่นเครื่องทั้งหมดที่ผูกไว้ + รุ่นแบต + ยี่ห้อ + sku รวมกัน เผื่อคำค้นมีทั้งชื่ออะไหล่และรุ่นเครื่อง/รุ่นแบต/ยี่ห้อปนกัน (เช่น "หน้าจอ oppo a18", "แบต apn 616-00259", "แบต leeplus")
  const matchedRaw = matchByWords(allParts || [], keyword, (p: any) =>
    `${p.name} ${p.phone_model || ''} ${(modelsByPart[p.id] || []).join(' ')} ${p.battery_model || ''} ${p.brand || ''} ${p.sku || ''}`
  );
  // เอาตัวที่มีของในสต๊อกขึ้นก่อนเสมอ ตัวหมดสต๊อกไปอยู่ท้ายๆ (คนถามอยากรู้ตัวที่ซื้อได้จริงก่อน)
  const matched = [...matchedRaw].sort((a: any, b: any) => (Number(b.stock_qty) > 0 ? 1 : 0) - (Number(a.stock_qty) > 0 ? 1 : 0));
  const data = matched.slice(0, MAX_ITEMS_HARD_CAP);
  if (!data || data.length === 0) {
    return `🔍 ไม่พบอะไหล่ที่ตรงกับ "${keyword}"`;
  }

  const partIds = data.map((p: any) => p.id);
  const { data: customRows } = await supabase.from('part_custom_prices')
    .select('part_id, label, price').in('part_id', partIds).order('sort_order');
  const customByPart: Record<string, { label: string; price: number }[]> = {};
  for (const r of customRows || []) (customByPart[r.part_id] ||= []).push({ label: r.label, price: Number(r.price || 0) });

  const lines = data.map((p: any) => {
    const priceParts = [
      p.cost_price ? `ทุน ฿${Number(p.cost_price).toLocaleString()}` : null,
      p.wholesale_price ? `ส่ง ฿${Number(p.wholesale_price).toLocaleString()}` : null,
      p.sell_price ? `ขาย ฿${Number(p.sell_price).toLocaleString()}` : null,
      ...(customByPart[p.id] || []).map((c) => `${c.label} ฿${c.price.toLocaleString()}`),
    ].filter(Boolean).join(' · ');
    const qty = Number(p.stock_qty || 0);
    const qtyTxt = qty === 0 ? '❌ ไม่มีอะไหล่ในสต๊อก (0 ชิ้น)' : `✅ คงเหลือ ${qty} ชิ้น`;
    const modelsTxt = (modelsByPart[p.id] || []).join(' / ') || p.phone_model || '';
    return `🔧 ${p.brand ? `${p.brand} ` : ''}${p.name}${modelsTxt ? ` - ${modelsTxt}` : ''}${p.battery_model ? ` [${p.battery_model}]` : ''}${p.sku ? ` (${p.sku})` : ''}\n   ${qtyTxt}${priceParts ? `\n   ราคา: ${priceParts}` : ''}`;
  });
  const remaining = matched.length - data.length;
  const moreTxt = remaining > 0 ? `\n\n...และอีก ${remaining} รายการ (ถามให้เจาะจงยี่ห้อ/เกรดเพิ่มเติมเพื่อดูครบ)` : '';
  return `🔍 ผลค้นหา "${keyword}" (${matched.length} รายการ)\n━━━━━━━━━━━━━\n${lines.join('\n\n')}${moreTxt}`;
}

async function answerLowStock(supabase: any, shopId: string) {
  const data = await fetchAllRows<any>(() =>
    supabase.from('parts').select('name, sku, stock_qty, low_stock_alert').eq('shop_id', shopId).order('id', { ascending: true })
  );
  const low = data.filter((p: any) => Number(p.stock_qty) <= Number(p.low_stock_alert ?? 2)).slice(0, MAX_ITEMS_IN_MESSAGE);
  if (low.length === 0) return '✅ ตอนนี้ไม่มีอะไหล่ใกล้หมดเลยครับ';
  const lines = low.map((p: any) => {
    const qty = Number(p.stock_qty || 0);
    const qtyTxt = qty === 0 ? '❌ ไม่มีอะไหล่ในสต๊อก (0 ชิ้น)' : `✅ เหลือ ${qty} ชิ้น`;
    return `⚠️ ${p.name}${p.sku ? ` (${p.sku})` : ''} — ${qtyTxt} (ขั้นต่ำ ${p.low_stock_alert ?? 2})`;
  });
  return `⚠️ อะไหล่ใกล้หมด (${low.length} รายการ)\n━━━━━━━━━━━━━\n${lines.join('\n')}`;
}

async function answerDeadStock(supabase: any, shopId: string, days: number) {
  const parts = await fetchAllRows<any>(() =>
    supabase.from('parts').select('id, name, sku, stock_qty, created_at').eq('shop_id', shopId).gt('stock_qty', 0).order('id', { ascending: true })
  );
  const partIds = parts.map((p: any) => p.id);
  if (partIds.length === 0) return '✅ ไม่มีอะไหล่ในสต็อกตอนนี้';

  const [moveTx, inTx] = await Promise.all([
    fetchAllRows<any>(() => supabase.from('part_transactions').select('part_id, created_at').in('part_id', partIds).in('type', ['out', 'used_in_repair']).order('id', { ascending: true })),
    fetchAllRows<any>(() => supabase.from('part_transactions').select('part_id, created_at').in('part_id', partIds).eq('type', 'in').order('id', { ascending: true })),
  ]);
  const lastMove: Record<string, string> = {};
  for (const t of moveTx || []) if (t.part_id && t.created_at && (!lastMove[t.part_id] || t.created_at > lastMove[t.part_id])) lastMove[t.part_id] = t.created_at;
  const lastReceived: Record<string, string> = {};
  for (const t of inTx || []) if (t.part_id && t.created_at && (!lastReceived[t.part_id] || t.created_at > lastReceived[t.part_id])) lastReceived[t.part_id] = t.created_at;

  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const dead = (parts || []).filter((p: any) => {
    const baseline = lastMove[p.id] || lastReceived[p.id] || p.created_at;
    if (!baseline) return true;
    return new Date(baseline).getTime() < cutoff;
  });

  if (dead.length === 0) return `✅ ไม่มีเดดสต็อค (ไม่เคลื่อนไหวเกิน ${days} วัน) เลยครับ`;
  const lines = dead.slice(0, MAX_ITEMS_IN_MESSAGE).map((p: any) => `📦 ${p.name}${p.sku ? ` (${p.sku})` : ''} — เหลือ ${p.stock_qty} ชิ้น`);
  const remaining = dead.length - lines.length;
  const moreTxt = remaining > 0 ? `\n...และอีก ${remaining} รายการ` : '';
  return `📦 เดดสต็อค (ไม่เคลื่อนไหวเกิน ${days} วัน) — ${dead.length} รายการ\n━━━━━━━━━━━━━\n${lines.join('\n')}${moreTxt}`;
}

async function answerPawnLookup(supabase: any, shopId: string, keyword: string) {
  const { data: allPawn } = await supabase.from('pawn_stock')
    .select('model, customer_name, due_date, pawn_price').eq('shop_id', shopId);
  // เทียบกับรุ่นเครื่อง + ชื่อลูกค้ารวมกัน เผื่อคำค้นมีทั้งสองอย่างปนกัน (เช่น "oppo a18 ของสมชาย")
  // ค้นหาแบบ client-side (ไม่ใช้ .or() ของ Supabase) เพื่อเลี่ยงปัญหา keyword มีอักขระพิเศษ (เช่น comma) ทำให้ query string พัง
  const matched = matchByWords(allPawn || [], keyword, (p: any) => `${p.model || ''} ${p.customer_name || ''}`);
  const data = matched.slice(0, MAX_ITEMS_HARD_CAP);
  if (!data || data.length === 0) return `🔍 ไม่พบเครื่องจำนำที่ตรงกับ "${keyword}"`;
  const lines = data.map((p: any) => `📱 ${p.model} — ${p.customer_name}\n   เงินต้น ฿${Number(p.pawn_price).toLocaleString()} • ครบกำหนด ${p.due_date || '-'}`);
  const remaining = matched.length - data.length;
  const moreTxt = remaining > 0 ? `\n\n...และอีก ${remaining} รายการ` : '';
  return `🔍 ผลค้นหาเครื่องจำนำ "${keyword}" (${matched.length} รายการ)\n━━━━━━━━━━━━━\n${lines.join('\n\n')}${moreTxt}`;
}

async function answerPawnDueSoon(supabase: any, shopId: string, days: number) {
  const today = todayThaiStr();
  const futureDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const { data } = await supabase.from('pawn_stock').select('model, customer_name, due_date')
    .eq('shop_id', shopId).neq('status', 'forfeited').gte('due_date', today).lte('due_date', futureDate)
    .order('due_date').limit(MAX_ITEMS_IN_MESSAGE);
  if (!data || data.length === 0) return `✅ ไม่มีเครื่องจำนำที่ใกล้ครบกำหนดใน ${days} วันข้างหน้าเลยครับ`;
  const lines = data.map((p: any) => `📱 ${p.model} — ${p.customer_name} (ครบ ${p.due_date})`);
  return `⏰ เครื่องจำนำใกล้ครบกำหนด (${days} วันข้างหน้า) — ${data.length} รายการ\n━━━━━━━━━━━━━\n${lines.join('\n')}`;
}

async function answerPawnOverdue(supabase: any, shopId: string) {
  const today = todayThaiStr();
  const { data } = await supabase.from('pawn_stock').select('model, customer_name, due_date')
    .eq('shop_id', shopId).neq('status', 'forfeited').lt('due_date', today)
    .order('due_date').limit(MAX_ITEMS_IN_MESSAGE);
  if (!data || data.length === 0) return '✅ ไม่มีเครื่องจำนำที่เลยกำหนดเลยครับ';
  const lines = data.map((p: any) => `🔴 ${p.model} — ${p.customer_name} (ครบ ${p.due_date})`);
  return `🔴 เครื่องจำนำเลยกำหนด — ${data.length} รายการ\n━━━━━━━━━━━━━\n${lines.join('\n')}`;
}
