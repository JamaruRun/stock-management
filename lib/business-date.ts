// คำนวณ "วันบัญชี" (business date) จาก timestamp จริง เทียบกับเวลาตัดรอบ (cutoff) ของร้าน
// cutoff = '00:00' (ค่า default) หมายถึงไม่มีการเลื่อนวันเลย — business_date = วันปฏิทินตรงๆ เสมอ
// cutoff อื่น: ถ้าเวลาของ timestamp ผ่าน cutoff ของวันนั้นไปแล้ว ให้เลื่อนไปวันถัดไป
// ตัวอย่าง: cutoff=21:00, รายการ 22:00 ของวันที่ 18 → business_date = 19 (ผ่าน cutoff ของวันที่ 18 แล้ว)
//           cutoff=21:00, รายการ 20:00 ของวันที่ 19 → business_date = 19 (ยังไม่ถึง cutoff ของวันที่ 19)
//
// คำนวณโดยยึดเวลาไทย (Asia/Bangkok, UTC+7) เสมอ ไม่ว่าจะรันฝั่ง browser หรือ server (Vercel ปกติรัน UTC)
// เพื่อไม่ให้ business_date เพี้ยนตาม timezone ของเครื่องที่รันโค้ด
const THAI_OFFSET_MS = 7 * 60 * 60 * 1000;

export function computeBusinessDate(timestamp: string | Date, cutoffTime: string): string {
  const thaiMs = new Date(timestamp).getTime() + THAI_OFFSET_MS;
  const thai = new Date(thaiMs); // ใช้ getUTC* อ่านค่าที่ shift มาแล้ว = wall-clock เวลาไทยที่แท้จริง

  const [cutH, cutM] = (cutoffTime || '00:00').split(':').map((n) => parseInt(n, 10) || 0);
  const cutoffMinutes = cutH * 60 + cutM;

  let y = thai.getUTCFullYear();
  let mo = thai.getUTCMonth();
  let day = thai.getUTCDate();

  if (cutoffMinutes > 0) {
    const localMinutes = thai.getUTCHours() * 60 + thai.getUTCMinutes();
    if (localMinutes >= cutoffMinutes) {
      const next = new Date(Date.UTC(y, mo, day + 1));
      y = next.getUTCFullYear(); mo = next.getUTCMonth(); day = next.getUTCDate();
    }
  }
  return `${y}-${String(mo + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** ดึงเวลาตัดรอบวันบัญชีของร้าน (ค่า default '00:00' ถ้าไม่พบ) */
export async function getShopCutoffTime(supabase: any, shopId: string): Promise<string> {
  if (!shopId) return '00:00';
  const { data } = await supabase.from('shops').select('daily_cutoff_time').eq('id', shopId).single();
  return data?.daily_cutoff_time || '00:00';
}
