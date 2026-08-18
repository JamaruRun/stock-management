// ใช้ Gemini แค่ "แปลคำถามภาษาธรรมชาติ -> ช่วงวันที่" เท่านั้น ห้ามให้ Gemini สรุปตัวเลขการเงินเอง
// (ตัวเลขจริงต้อง query จากฐานข้อมูลตรงๆ เสมอ กันข้อมูลการเงินหลอน/เพี้ยน)
export type DateRangeResult = { date_from: string; date_to: string } | { error: string };

export async function extractDateRange(question: string, todayStr: string): Promise<DateRangeResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { error: 'GEMINI_API_KEY not configured' };

  const prompt = `วันนี้คือวันที่ ${todayStr} (รูปแบบ YYYY-MM-DD)
ผู้ใช้ถามคำถามเกี่ยวกับสมุดรายรับ-รายจ่ายของร้านซ่อมมือถือเป็นภาษาไทย: "${question}"

ถ้าคำถามนี้กำลังถามหาข้อมูลรายรับ-รายจ่ายของช่วงวันที่ใดวันหนึ่ง (เช่น วันที่เจาะจง, เมื่อวาน, เดือนนี้, สัปดาห์นี้, ช่วงวันที่ระบุ) ให้ตอบกลับเป็น JSON เท่านั้นในรูปแบบ:
{"date_from": "YYYY-MM-DD", "date_to": "YYYY-MM-DD"}

กฎการตีความ:
- "วันที่ N" (ไม่ระบุเดือน) หมายถึงวันที่ N ของเดือนปัจจุบัน (จากวันนี้ที่ให้มา)
- "เมื่อวาน" = วันนี้ลบ 1 วัน, "วันนี้" = วันนี้
- "เดือนนี้" = ตั้งแต่วันที่ 1 ถึงวันสุดท้ายของเดือนปัจจุบัน
- "สัปดาห์นี้"/"7 วันที่ผ่านมา" = ย้อนหลัง 7 วันจากวันนี้ถึงวันนี้
- ถ้าถามวันเดียว ให้ date_from และ date_to เป็นวันเดียวกัน

ถ้าคำถามนี้ไม่เกี่ยวกับรายรับ-รายจ่าย หรือตีความช่วงวันที่ไม่ได้เลย ให้ตอบกลับเป็น JSON:
{"error": "เหตุผลสั้นๆ"}

ตอบเป็น JSON เท่านั้น ห้ามมีข้อความอื่นนอกเหนือจาก JSON`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0 },
        }),
      }
    );
    if (!res.ok) return { error: `Gemini API error: ${res.status}` };
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return { error: 'ไม่ได้รับคำตอบจาก AI' };

    const parsed = JSON.parse(text);
    if (parsed.error) return { error: String(parsed.error) };
    if (!parsed.date_from || !parsed.date_to || !/^\d{4}-\d{2}-\d{2}$/.test(parsed.date_from) || !/^\d{4}-\d{2}-\d{2}$/.test(parsed.date_to)) {
      return { error: 'รูปแบบวันที่ไม่ถูกต้อง' };
    }
    return { date_from: parsed.date_from, date_to: parsed.date_to };
  } catch (e: any) {
    return { error: 'แปลคำถามไม่สำเร็จ: ' + e.message };
  }
}
