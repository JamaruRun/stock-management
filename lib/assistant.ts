import { classifyQuestion } from '@/lib/gemini';

const RATE_LIMIT_PER_MINUTE = 5;
const RATE_LIMIT_PER_DAY = 50;
const MAX_ITEMS_IN_MESSAGE = 15;

function todayThaiStr(): string {
  const thai = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return `${thai.getUTCFullYear()}-${String(thai.getUTCMonth() + 1).padStart(2, '0')}-${String(thai.getUTCDate()).padStart(2, '0')}`;
}

/** เรียกหลังยืนยันตัวตนผู้ถามแล้ว (reverse-lookup shop_id ของแต่ละแพลตฟอร์มทำก่อนเรียกฟังก์ชันนี้)
 * คืน message string ให้ webhook ของแต่ละแพลตฟอร์มเอาไปส่งเอง — ฟังก์ชันนี้ไม่ยุ่งกับการส่งข้อความ */
export async function answerQuestion(
  supabase: any,
  shopId: string,
  branchId: string | null,
  platform: 'line' | 'messenger',
  senderKey: string,
  question: string
): Promise<string> {
  const today = todayThaiStr();

  // ===== Rate limit (กัน quota Gemini/DB โดนใช้เกินจากสแปม) =====
  const oneMinAgo = new Date(Date.now() - 60 * 1000).toISOString();
  const { count: minuteCount } = await supabase
    .from('assistant_query_log').select('id', { count: 'exact', head: true })
    .eq('sender_key', senderKey).gte('created_at', oneMinAgo);
  if ((minuteCount || 0) >= RATE_LIMIT_PER_MINUTE) {
    return '⏳ ถามถี่ไปหน่อยนะครับ รอสักครู่แล้วค่อยถามใหม่';
  }

  const dayStart = `${today}T00:00:00.000Z`;
  const { count: dayCount } = await supabase
    .from('assistant_query_log').select('id', { count: 'exact', head: true })
    .eq('sender_key', senderKey).gte('created_at', dayStart);
  if ((dayCount || 0) >= RATE_LIMIT_PER_DAY) {
    return '📵 วันนี้ถามครบจำนวนที่กำหนดแล้วครับ พรุ่งนี้ถามใหม่ได้เลย';
  }

  const { data: logRow } = await supabase
    .from('assistant_query_log')
    .insert({ shop_id: shopId, platform, sender_key: senderKey, question })
    .select('id').single();

  const parsed = await classifyQuestion(question, today);
  if (logRow?.id) {
    await supabase.from('assistant_query_log').update({ intent: parsed.intent }).eq('id', logRow.id);
  }

  switch (parsed.intent) {
    case 'ledger':
      return answerLedger(supabase, shopId, branchId, parsed.date_from, parsed.date_to, parsed.keyword);
    case 'stock_lookup':
      return answerStockLookup(supabase, shopId, parsed.keyword);
    case 'low_stock':
      return answerLowStock(supabase, shopId);
    case 'dead_stock':
      return answerDeadStock(supabase, shopId, parsed.days);
    case 'pawn_lookup':
      return answerPawnLookup(supabase, shopId, parsed.keyword);
    case 'pawn_due_soon':
      return answerPawnDueSoon(supabase, shopId, parsed.days);
    case 'pawn_overdue':
      return answerPawnOverdue(supabase, shopId);
    default:
      return '🤔 ไม่เข้าใจคำถามนี้\n\nลองถามแบบนี้ดูครับ:\n• "รายรับรายจ่ายวันที่ 17"\n• "สรุปเดือนนี้"\n• "อะไหล่จอ iPhone 11 เหลือกี่ชิ้น"\n• "จอ iPhone 11 ราคาเท่าไหร่"\n• "อะไหล่ใกล้หมดมีอะไรบ้าง"\n• "เดดสต็อคมีอะไรบ้าง"\n• "จำนำของคุณสมชายครบกำหนดเมื่อไหร่"\n• "เครื่องจำนำใกล้ครบกำหนดมีอะไรบ้าง"\n• "เครื่องจำนำเลยกำหนดมีอะไรบ้าง"';
  }
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

/** ค้นหาแบบแยกคำ: ลองแบบเข้มก่อน (ต้องเจอทุกคำ) ถ้าไม่เจอเลยค่อย fallback เป็นแบบหลวม (เจอคำไหนก็ได้)
 * กันเคส Gemini สกัด keyword มาไม่สะอาด 100% (มีคำฟุ่มเฟือยหลงเหลือ) ไม่ให้ตอบ "ไม่พบ" ทั้งที่มีของจริง
 *
 * ข้อยกเว้นสำคัญ: ถ้าคำค้นมีคำที่มีตัวเลขปน (เช่น "ip12", "a18") ซึ่งมักเป็นรุ่นเครื่อง/รหัสเฉพาะที่ผู้ใช้ตั้งใจถามจริงๆ
 * แล้วไม่มีรายการไหนมีคำนั้นเลย ให้ถือว่า "ไม่มีของจริง" ไม่ fallback แบบหลวม — กันเคสถามรุ่นที่ไม่มีในสต็อค
 * แล้วดันไปเจอรายการอื่นที่บังเอิญมีคำทั่วไปตรงกัน (เช่น "จอ"/"งาน"/"tft") ทำให้ตอบรุ่นผิดเป็นรุ่นอื่นแทน */
function matchByWords<T>(rows: T[], keyword: string, getHaystack: (row: T) => string): T[] {
  const words = keyword.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const strict = rows.filter((r) => {
    const haystack = getHaystack(r).toLowerCase();
    return words.every((w) => haystack.includes(w));
  });
  if (strict.length > 0) return strict;

  const hasModelLikeWord = words.some((w) => /\d/.test(w));
  if (hasModelLikeWord) return [];

  return rows.filter((r) => {
    const haystack = getHaystack(r).toLowerCase();
    return words.some((w) => haystack.includes(w));
  });
}

async function answerStockLookup(supabase: any, shopId: string, keyword: string) {
  const { data: allParts } = await supabase.from('parts')
    .select('id, name, sku, phone_model, battery_model, brand, stock_qty, low_stock_alert, cost_price, wholesale_price, sell_price')
    .eq('shop_id', shopId);
  const allPartIds = (allParts || []).map((p: any) => p.id);

  // ดึง "รุ่นมือถือที่ใช้ได้" ทั้งหมดของทุกอะไหล่ (ไม่ใช่แค่ phone_model ซึ่งเป็นแค่รุ่นแรกที่ sync ไว้)
  // เพราะอะไหล่ 1 ชิ้นผูกได้หลายรุ่นผ่านตาราง part_compatibility เหมือนหน้า "ขาย"/"ใช้ในงานซ่อม" ที่ค้นหาแบบนี้อยู่แล้ว
  const modelsByPart: Record<string, string[]> = {};
  if (allPartIds.length > 0) {
    const { data: compatRows } = await supabase.from('part_compatibility')
      .select('part_id, device_models(model_name)').in('part_id', allPartIds);
    for (const r of compatRows || []) {
      const name = (r as any).device_models?.model_name;
      if (!name) continue;
      (modelsByPart[(r as any).part_id] ||= []).push(name);
    }
  }

  // เทียบกับชื่ออะไหล่ + รุ่นเครื่องทั้งหมดที่ผูกไว้ + รุ่นแบต + ยี่ห้อ + sku รวมกัน เผื่อคำค้นมีทั้งชื่ออะไหล่และรุ่นเครื่อง/รุ่นแบต/ยี่ห้อปนกัน (เช่น "หน้าจอ oppo a18", "แบต apn 616-00259", "แบต leeplus")
  const data = matchByWords(allParts || [], keyword, (p: any) =>
    `${p.name} ${p.phone_model || ''} ${(modelsByPart[p.id] || []).join(' ')} ${p.battery_model || ''} ${p.brand || ''} ${p.sku || ''}`
  ).slice(0, 10);
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
    const qtyTxt = qty === 0 ? '❌ ไม่มีอะไหล่ในสต๊อก (0 ชิ้น)' : `คงเหลือ ${qty} ชิ้น`;
    const modelsTxt = (modelsByPart[p.id] || []).join(' / ') || p.phone_model || '';
    return `🔧 ${p.brand ? `${p.brand} ` : ''}${p.name}${modelsTxt ? ` - ${modelsTxt}` : ''}${p.battery_model ? ` [${p.battery_model}]` : ''}${p.sku ? ` (${p.sku})` : ''}\n   ${qtyTxt}${priceParts ? `\n   ราคา: ${priceParts}` : ''}`;
  });
  return `🔍 ผลค้นหา "${keyword}"\n━━━━━━━━━━━━━\n${lines.join('\n')}`;
}

async function answerLowStock(supabase: any, shopId: string) {
  const { data } = await supabase.from('parts').select('name, sku, stock_qty, low_stock_alert').eq('shop_id', shopId);
  const low = (data || []).filter((p: any) => Number(p.stock_qty) <= Number(p.low_stock_alert ?? 2)).slice(0, MAX_ITEMS_IN_MESSAGE);
  if (low.length === 0) return '✅ ตอนนี้ไม่มีอะไหล่ใกล้หมดเลยครับ';
  const lines = low.map((p: any) => {
    const qty = Number(p.stock_qty || 0);
    const qtyTxt = qty === 0 ? '❌ ไม่มีอะไหล่ในสต๊อก (0 ชิ้น)' : `เหลือ ${qty} ชิ้น`;
    return `⚠️ ${p.name}${p.sku ? ` (${p.sku})` : ''} — ${qtyTxt} (ขั้นต่ำ ${p.low_stock_alert ?? 2})`;
  });
  return `⚠️ อะไหล่ใกล้หมด (${low.length} รายการ)\n━━━━━━━━━━━━━\n${lines.join('\n')}`;
}

async function answerDeadStock(supabase: any, shopId: string, days: number) {
  const { data: parts } = await supabase.from('parts').select('id, name, sku, stock_qty, created_at').eq('shop_id', shopId).gt('stock_qty', 0);
  const partIds = (parts || []).map((p: any) => p.id);
  if (partIds.length === 0) return '✅ ไม่มีอะไหล่ในสต็อกตอนนี้';

  const [{ data: moveTx }, { data: inTx }] = await Promise.all([
    supabase.from('part_transactions').select('part_id, created_at').in('part_id', partIds).in('type', ['out', 'used_in_repair']),
    supabase.from('part_transactions').select('part_id, created_at').in('part_id', partIds).eq('type', 'in'),
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
  const data = matchByWords(allPawn || [], keyword, (p: any) => `${p.model || ''} ${p.customer_name || ''}`).slice(0, 10);
  if (!data || data.length === 0) return `🔍 ไม่พบเครื่องจำนำที่ตรงกับ "${keyword}"`;
  const lines = data.map((p: any) => `📱 ${p.model} — ${p.customer_name}\n   เงินต้น ฿${Number(p.pawn_price).toLocaleString()} • ครบกำหนด ${p.due_date || '-'}`);
  return `🔍 ผลค้นหาเครื่องจำนำ "${keyword}"\n━━━━━━━━━━━━━\n${lines.join('\n')}`;
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
