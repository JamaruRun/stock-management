export async function sendLineNotify(message: string, type: 'sale' | 'pawn' | 'goods' | 'installment' | 'low_stock' | 'test' = 'sale') {
  try {
    const res = await fetch('/api/line-notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, type }),
    });
    const data = await res.json();
    return data;
  } catch (e) {
    console.error('LINE Notify error:', e);
    return { error: true };
  }
}
