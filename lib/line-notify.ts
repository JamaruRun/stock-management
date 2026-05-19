function getThaiDateTime(): string {
  const now = new Date();
  const date = now.toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const time = now.toLocaleTimeString('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${date} ${time} น.`;
}

export async function sendLinePush(
  message: string, 
  type: 'sale' | 'pawn' | 'goods' | 'installment' | 'low_stock' | 'test' = 'sale'
) {
  try {
    // เพิ่มวันเวลาท้ายข้อความอัตโนมัติ (ยกเว้น test ที่มีอยู่แล้ว)
    const messageWithTime = type === 'test' 
      ? message 
      : `${message}\n\n🕐 ${getThaiDateTime()}`;

    const res = await fetch('/api/line-push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: messageWithTime, type }),
    });
    return await res.json();
  } catch (e) {
    console.error('LINE Push error:', e);
    return { error: true };
  }
}

// alias เก่าเพื่อ compatibility
export const sendLineNotify = sendLinePush;
