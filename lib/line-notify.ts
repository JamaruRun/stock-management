export async function sendLinePush(message: string, type: 'sale' | 'pawn' | 'goods' | 'installment' | 'low_stock' | 'test' = 'sale') {
  try {
    const res = await fetch('/api/line-push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, type }),
    });
    return await res.json();
  } catch (e) {
    console.error('LINE Push error:', e);
    return { error: true };
  }
}

// alias เก่าเพื่อ compatibility
export const sendLineNotify = sendLinePush;
