// ใช้ Gemini แค่ "แปลคำถามภาษาธรรมชาติ -> intent + พารามิเตอร์" เท่านั้น ห้ามให้ Gemini สรุปตัวเลขเอง
// (ตัวเลขจริงต้อง query จากฐานข้อมูลตรงๆ เสมอ กันข้อมูลหลอน/เพี้ยน)
export type AssistantIntent =
  | { intent: 'ledger'; date_from: string; date_to: string; keyword?: string }
  | { intent: 'stock_lookup'; keyword: string }
  | { intent: 'low_stock' }
  | { intent: 'dead_stock'; days: number }
  | { intent: 'stock_value'; keyword?: string }
  | { intent: 'pawn_lookup'; keyword: string }
  | { intent: 'pawn_due_soon'; days: number }
  | { intent: 'pawn_overdue' }
  | { intent: 'unknown'; reason: string };

export async function classifyQuestion(question: string, todayStr: string): Promise<AssistantIntent> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { intent: 'unknown', reason: 'GEMINI_API_KEY not configured' };

  const prompt = `วันนี้คือวันที่ ${todayStr} (รูปแบบ YYYY-MM-DD)
ผู้ใช้เป็นแอดมินร้านซ่อมมือถือ ถามคำถามเป็นภาษาไทยกับบอทของระบบจัดการร้าน: "${question}"

ให้แยกประเภทคำถาม (intent) แล้วตอบเป็น JSON เท่านั้น ไม่มีข้อความอื่นนอกเหนือ JSON โดยเลือก 1 แบบจาก schema ต่อไปนี้ตามที่ตรงที่สุด:

1. คำถามเกี่ยวกับรายรับ-รายจ่าย/ยอดขาย/กำไร ตามช่วงวันที่:
   {"intent":"ledger","date_from":"YYYY-MM-DD","date_to":"YYYY-MM-DD","keyword":"คำค้นเพิ่มเติมถ้ามี เช่น อะไหล่, ซ่อม (ไม่มีก็ไม่ต้องใส่ field นี้)"}
   - "วันที่ N" (ไม่ระบุเดือน) = วันที่ N ของเดือนปัจจุบัน
   - "เมื่อวาน"=วันนี้ลบ1วัน, "วันนี้"=วันนี้, "เมื่อวานซืน"=วันนี้ลบ2วัน
   - "เดือนนี้"=วันที่1ถึงวันสุดท้ายของเดือนปัจจุบัน, "เดือนที่แล้ว"=วันที่1ถึงวันสุดท้ายของเดือนก่อนหน้า
   - "สัปดาห์นี้"/"7วันที่ผ่านมา"=ย้อนหลัง7วันถึงวันนี้, "สัปดาห์ที่แล้ว"/"อาทิตย์ที่แล้ว"=ย้อนหลัง14ถึง8วันก่อน
   - "ปีนี้"=วันที่1ม.ค.ถึงวันนี้ของปีปัจจุบัน
   - ถ้าระบุชื่อเดือนตรงๆ (เช่น "เดือนมกราคม") ให้ตีความเป็นเดือนนั้นของปีปัจจุบัน (หรือปีที่แล้วถ้าเดือนนั้นยังไม่ถึงในปีปัจจุบัน)
   - ถามวันเดียวให้ date_from=date_to

2. ถามหาอะไหล่/ของ เจาะจงชื่อ/รุ่น ไม่ว่าจะถามเหลือกี่ชิ้น หรือถามราคา (ราคาทุน/ราคาส่ง/ราคาขาย/ราคาเท่าไหร่):
   {"intent":"stock_lookup","keyword":"ชื่อ/รุ่นอะไหล่ที่ถาม"}
   (ใช้ intent เดียวกันทั้งถามจำนวนและถามราคา เพราะตอบทั้งจำนวนและราคาให้พร้อมกันอยู่แล้ว)
   - ถ้าข้อความสั้นๆ ไม่มีคำถาม/กริยาเลย เป็นแค่ชื่อรุ่น/รหัสอะไหล่คำเดียวหรือไม่กี่คำ (เช่น พิมพ์แค่ "a77" หรือ "ip12" หรือ "จอ oppo a18" เดี่ยวๆ ไม่มีคำอื่นต่อท้าย)
     ให้ถือเป็น stock_lookup โดยอัตโนมัติเสมอ (คนพิมพ์สั้นๆ แบบนี้ก็เพราะตั้งใจถามหาอะไหล่รุ่นนั้นอยู่แล้ว ไม่ใช่ unknown)
   - กฎนี้ใช้แม้คำไทย+อังกฤษจะติดกันไม่มีเว้นวรรค เช่น "แบตip13", "จอoppoa18", "แบตss20" ก็ให้ถือเป็น stock_lookup เหมือนกัน
     (ระบบฝั่งค้นหาจะแยกคำ/ขยายตัวย่อเองอยู่แล้ว หน้าที่ตรงนี้แค่ต้องไม่ตัดสินว่าเป็น unknown เพราะข้อความดูแปลกๆ ไม่มีช่องว่าง)
     ใส่ keyword เป็นข้อความเดิมที่พิมพ์มาตรงๆ ได้เลยไม่ต้องพยายามแยกคำเอง เช่น "แบตip13" -> keyword: "แบตip13"

3. ถามอะไหล่ใกล้หมด/ต้องสั่งเพิ่ม (ไม่เจาะจงชื่อ):
   {"intent":"low_stock"}

4. ถามเดดสต็อค/อะไหล่ที่ไม่เคลื่อนไหว/ค้างสต็อคนาน:
   {"intent":"dead_stock","days":90}
   (days = จำนวนวันที่ถาม ถ้าไม่ระบุใช้ 90)

5. ถามมูลค่า/ต้นทุนรวมของสต๊อกทั้งหมด (ไม่ใช่ถามอะไหล่ตัวใดตัวหนึ่ง แต่ถามภาพรวมทั้งร้าน/ทั้งหมวด):
   {"intent":"stock_value","keyword":"หมวด/ยี่ห้อ/รุ่นที่ระบุถ้ามี เช่น แบต, จอ, iphone (ไม่มีก็ไม่ต้องใส่ field นี้ = รวมทุกอย่าง)"}
   ตัวอย่าง: "ต้นทุนรวมทั้งหมดเท่าไหร่", "มูลค่าสต๊อกตอนนี้เท่าไหร่", "สต๊อกแบตทั้งหมดคิดเป็นเงินเท่าไหร่"

6. ถามหาเครื่องจำนำเจาะจงชื่อลูกค้า/รุ่นเครื่อง:
   {"intent":"pawn_lookup","keyword":"ชื่อลูกค้าหรือรุ่นเครื่องที่ถาม"}

7. ถามเครื่องจำนำที่ใกล้ครบกำหนด (ไม่เจาะจงเครื่อง):
   {"intent":"pawn_due_soon","days":7}
   (days = จำนวนวันข้างหน้าที่ถาม ถ้าไม่ระบุใช้ 7)

8. ถามเครื่องจำนำที่เลยกำหนดแล้ว:
   {"intent":"pawn_overdue"}

กฎสำคัญสำหรับ field "keyword" (ข้อ 2 และ 5): ให้ใส่เฉพาะคำที่เป็นชื่อของจริง (ชื่ออะไหล่, ยี่ห้อ/รุ่นเครื่อง, ชื่อลูกค้า) เท่านั้น
ห้ามใส่คำถาม/คำลงท้าย/คำฟุ่มเฟือยปนไปด้วย เช่น "ไหม", "บ้าง", "ครับ", "ค่ะ", "เท่าไหร่", "เท่าไร", "กี่ชิ้น", "เหลือ", "ราคา", "มี...อยู่", "ของ" (ที่แปลว่า belonging to)
เพราะระบบจะเอา keyword ไปค้นหาแบบตรงตัวในฐานข้อมูล ถ้าใส่คำฟุ่มเฟือยปนจะหาไม่เจอทั้งที่มีของจริง

ตัวอย่าง (คำถาม -> keyword ที่ถูกต้อง):
- "มีอะไหล่หน้าจอ oppo a18 ไหมครับ" -> keyword: "หน้าจอ oppo a18" (ตัด "มี...ไหมครับ" ออก)
- "จอ iphone 11 เหลือกี่ชิ้น" -> keyword: "จอ iphone 11" (ตัด "เหลือกี่ชิ้น" ออก)
- "แบตเตอรี่ samsung a50 ราคาเท่าไหร่" -> keyword: "แบตเตอรี่ samsung a50" (ตัด "ราคาเท่าไหร่" ออก)
- "จำนำของคุณสมชายอยู่รุ่นไหน" -> keyword: "สมชาย" (ตัด "จำนำของ...อยู่รุ่นไหน" ออก)

ถ้าคำถามไม่ตรงกับข้อไหนเลย หรือดูไม่ใช่คำถามเกี่ยวกับร้าน (เช่นทักทาย, ถามเรื่องอื่น) ให้ตอบ:
{"intent":"unknown","reason":"เหตุผลสั้นๆ"}`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0 },
        }),
      }
    );
    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      console.error('Gemini API error:', res.status, errBody);
      return { intent: 'unknown', reason: `Gemini API error: ${res.status}` };
    }
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      console.error('Gemini API: no text in response', JSON.stringify(data));
      return { intent: 'unknown', reason: 'ไม่ได้รับคำตอบจาก AI' };
    }

    const parsed = JSON.parse(text);
    return validateIntent(parsed);
  } catch (e: any) {
    console.error('Gemini classify exception:', e);
    return { intent: 'unknown', reason: 'แปลคำถามไม่สำเร็จ: ' + e.message };
  }
}

function validateIntent(parsed: any): AssistantIntent {
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  switch (parsed?.intent) {
    case 'ledger':
      if (!dateRe.test(parsed.date_from) || !dateRe.test(parsed.date_to)) {
        return { intent: 'unknown', reason: 'รูปแบบวันที่ไม่ถูกต้อง' };
      }
      return { intent: 'ledger', date_from: parsed.date_from, date_to: parsed.date_to, keyword: parsed.keyword || undefined };
    case 'stock_lookup':
      if (!parsed.keyword) return { intent: 'unknown', reason: 'ไม่มีคำค้นหาอะไหล่' };
      return { intent: 'stock_lookup', keyword: String(parsed.keyword) };
    case 'low_stock':
      return { intent: 'low_stock' };
    case 'dead_stock':
      return { intent: 'dead_stock', days: Number(parsed.days) > 0 ? Number(parsed.days) : 90 };
    case 'stock_value':
      return { intent: 'stock_value', keyword: parsed.keyword || undefined };
    case 'pawn_lookup':
      if (!parsed.keyword) return { intent: 'unknown', reason: 'ไม่มีคำค้นหาเครื่องจำนำ' };
      return { intent: 'pawn_lookup', keyword: String(parsed.keyword) };
    case 'pawn_due_soon':
      return { intent: 'pawn_due_soon', days: Number(parsed.days) > 0 ? Number(parsed.days) : 7 };
    case 'pawn_overdue':
      return { intent: 'pawn_overdue' };
    default:
      return { intent: 'unknown', reason: String(parsed?.reason || 'ไม่เข้าใจคำถาม') };
  }
}
