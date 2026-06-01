// ============================================
// lib/wikipedia-image.ts
// ดึงรูปมือถือจาก Wikipedia API (ฟรี + ไม่ต้อง auth + ลิขสิทธิ์เปิด)
// ============================================

export interface WikiImageResult {
  thumbnail: string | null;
  original: string | null;
  description: string | null;
  pageUrl: string | null;
}

/**
 * ค้นหารูปเครื่องจาก Wikipedia
 * รองรับทั้งภาษาอังกฤษและไทย
 */
export async function fetchWikipediaImage(
  modelName: string,
  signal?: AbortSignal
): Promise<WikiImageResult | null> {
  if (!modelName || modelName.trim().length < 3) return null;

  // ลองหลายแบบ — ตัวอย่าง: "iPhone 13 Pro" → "IPhone_13_Pro"
  const variants = generateSearchVariants(modelName);

  for (const variant of variants) {
    try {
      const result = await tryWikipediaPage(variant, signal);
      if (result?.thumbnail) return result;
    } catch (e) {
      // ลอง variant ถัดไป
      if (signal?.aborted) return null;
    }
  }

  return null;
}

async function tryWikipediaPage(
  title: string,
  signal?: AbortSignal
): Promise<WikiImageResult | null> {
  // ใช้ REST API endpoint /page/summary/
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;

  const res = await fetch(url, {
    signal,
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!res.ok) return null;
  const data = await res.json();

  if (!data.thumbnail?.source) return null;

  return {
    thumbnail: data.thumbnail.source,
    original: data.originalimage?.source || data.thumbnail.source,
    description: data.description || data.extract || null,
    pageUrl: data.content_urls?.desktop?.page || null,
  };
}

/**
 * สร้าง variants ของชื่อ model เพื่อค้นหาใน Wikipedia
 * เช่น "iPhone 13 Pro" → ["IPhone_13_Pro", "Apple_iPhone_13_Pro", "IPhone_13"]
 */
function generateSearchVariants(modelName: string): string[] {
  const cleaned = modelName.trim();
  const variants = new Set<string>();

  // 1. แบบดิบ
  variants.add(cleaned.replace(/\s+/g, '_'));

  // 2. iPhone fix capitalization
  if (/iphone/i.test(cleaned)) {
    variants.add(cleaned.replace(/iphone/i, 'IPhone').replace(/\s+/g, '_'));
    variants.add('Apple_' + cleaned.replace(/iphone/i, 'iPhone').replace(/\s+/g, '_'));
  }

  // 3. Samsung Galaxy
  if (/samsung/i.test(cleaned) || /galaxy/i.test(cleaned)) {
    if (!cleaned.toLowerCase().includes('samsung')) {
      variants.add('Samsung_' + cleaned.replace(/\s+/g, '_'));
    }
  }

  // 4. ตัด suffix ออก
  // "iPhone 13 Pro Max 256GB" → "IPhone_13_Pro_Max"
  const noStorage = cleaned.replace(/\s+\d+\s?(GB|TB|gb|tb).*$/i, '').trim();
  if (noStorage !== cleaned && noStorage.length >= 3) {
    variants.add(noStorage.replace(/\s+/g, '_'));
    if (/iphone/i.test(noStorage)) {
      variants.add(noStorage.replace(/iphone/i, 'IPhone').replace(/\s+/g, '_'));
    }
  }

  return Array.from(variants);
}

/**
 * Debounced version - ใช้ตอน user พิมพ์
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
