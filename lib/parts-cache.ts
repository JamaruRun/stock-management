interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const store = new Map<string, CacheEntry<any>>();
const TTL_MS = 5 * 60 * 1000; // 5 นาที

export function getCached<T>(key: string): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.data as T;
}

export function setCached<T>(key: string, data: T): void {
  store.set(key, { data, expiresAt: Date.now() + TTL_MS });
}

// เรียกตอน user เพิ่ม/แก้/ลบอะไหล่ — กัน cache เก่าค้าง
export function invalidateShopParts(shopId: string): void {
  store.delete(`parts:${shopId}`);
  store.delete(`compat:${shopId}`);
}