// ============================================
// lib/image-search.ts
// Smart Image Reuse: DB → Cache → Wikipedia → null
// ============================================

import { createClient } from './supabase-client';
import { fetchWikipediaImage } from './wikipedia-image';

export interface ImageSearchResult {
  url: string;
  source: 'db_reuse' | 'wikipedia' | 'cache' | 'manual';
  description?: string;
  reuseCount?: number; // จำนวนเครื่องในระบบที่ใช้รูปเดียวกัน
}

// localStorage cache key
const CACHE_KEY = 'v3_image_cache';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface CacheEntry {
  url: string;
  source: 'wikipedia' | 'db_reuse';
  timestamp: number;
}

function getCache(): Record<string, CacheEntry> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
  } catch {
    return {};
  }
}

function setCache(key: string, entry: CacheEntry) {
  if (typeof window === 'undefined') return;
  try {
    const cache = getCache();
    cache[key] = entry;
    // Clean expired entries
    const now = Date.now();
    for (const k in cache) {
      if (now - cache[k].timestamp > CACHE_TTL_MS) {
        delete cache[k];
      }
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // localStorage full - ignore
  }
}

function normalizeKey(modelName: string, shopId?: string): string {
  const norm = modelName.toLowerCase().trim().replace(/\s+/g, '_');
  return shopId ? `${shopId}:${norm}` : norm;
}

/**
 * Normalize model name for fuzzy matching
 * "iPhone 13 Pro" → "iphone13pro"
 * "Samsung Galaxy S24 Ultra" → "samsunggalaxys24ultra"
 */
function fuzzyNormalize(modelName: string): string {
  return modelName.toLowerCase().replace(/[\s\-_]+/g, '');
}

/**
 * Search image with Smart Reuse:
 * 1. localStorage cache (7 days)
 * 2. DB reuse - find same model in shop with image
 * 3. Wikipedia (free fallback)
 */
export async function searchImage(
  modelName: string,
  shopId?: string,
  signal?: AbortSignal
): Promise<ImageSearchResult | null> {
  if (!modelName || modelName.trim().length < 3) return null;

  const cleanModel = modelName.trim();
  const cacheKey = normalizeKey(cleanModel, shopId);

  // 1. Check localStorage cache
  const cache = getCache();
  if (cache[cacheKey] && Date.now() - cache[cacheKey].timestamp < CACHE_TTL_MS) {
    return {
      url: cache[cacheKey].url,
      source: cache[cacheKey].source === 'db_reuse' ? 'db_reuse' : 'cache',
    };
  }

  // 2. Try DB reuse - find existing image in shop
  if (shopId) {
    try {
      const dbResult = await findImageInDB(cleanModel, shopId, signal);
      if (dbResult) {
        setCache(cacheKey, {
          url: dbResult.url,
          source: 'db_reuse',
          timestamp: Date.now(),
        });
        return dbResult;
      }
    } catch (e) {
      if (signal?.aborted) return null;
      console.warn('DB image lookup failed:', e);
    }
  }

  // 3. Try Wikipedia
  try {
    const wiki = await fetchWikipediaImage(cleanModel, signal);
    if (wiki?.thumbnail) {
      setCache(cacheKey, {
        url: wiki.thumbnail,
        source: 'wikipedia' as any,
        timestamp: Date.now(),
      });
      return {
        url: wiki.thumbnail,
        source: 'wikipedia',
        description: wiki.description || undefined,
      };
    }
  } catch (e) {
    if (signal?.aborted) return null;
  }

  return null;
}

/**
 * ค้นรูปจาก DB - ลำดับ:
 * 1. exact match ใน stock ที่มี image_url
 * 2. exact match ใน sales_history (ขายแล้ว แต่เคยมีรูป)
 * 3. fuzzy match (ตัด space/dash)
 */
async function findImageInDB(
  modelName: string,
  shopId: string,
  signal?: AbortSignal
): Promise<ImageSearchResult | null> {
  if (signal?.aborted) return null;
  const supabase = createClient();
  const cleanModel = modelName.trim();

  // 1. Exact match in stock (current)
  const { data: stockData } = await supabase
    .from('stock')
    .select('image_url, model')
    .eq('shop_id', shopId)
    .ilike('model', cleanModel)
    .not('image_url', 'is', null)
    .limit(10);

  if (signal?.aborted) return null;

  if (stockData && stockData.length > 0) {
    const withImage = stockData.filter(s => s.image_url);
    if (withImage.length > 0) {
      return {
        url: withImage[0].image_url!,
        source: 'db_reuse',
        reuseCount: withImage.length,
      };
    }
  }

  // 2. Exact match in sales_history (already sold but image saved)
  const { data: salesData } = await supabase
    .from('sales_history')
    .select('image_url, model')
    .eq('shop_id', shopId)
    .ilike('model', cleanModel)
    .not('image_url', 'is', null)
    .limit(5);

  if (signal?.aborted) return null;

  if (salesData && salesData.length > 0) {
    const withImage = salesData.filter(s => s.image_url);
    if (withImage.length > 0) {
      return {
        url: withImage[0].image_url!,
        source: 'db_reuse',
        reuseCount: withImage.length,
      };
    }
  }

  // 3. Fuzzy match - try without spaces/special chars
  // เช่น "iPhone13Pro" vs "iPhone 13 Pro"
  const fuzzyTarget = fuzzyNormalize(cleanModel);
  if (fuzzyTarget.length >= 5) {
    const { data: fuzzyData } = await supabase
      .from('stock')
      .select('image_url, model')
      .eq('shop_id', shopId)
      .not('image_url', 'is', null)
      .limit(30);

    if (signal?.aborted) return null;

    if (fuzzyData && fuzzyData.length > 0) {
      const match = fuzzyData.find(s =>
        s.image_url && fuzzyNormalize(s.model) === fuzzyTarget
      );
      if (match) {
        return {
          url: match.image_url!,
          source: 'db_reuse',
          reuseCount: 1,
        };
      }
    }
  }

  return null;
}

/**
 * ดู stats รูปในร้าน - ใช้สำหรับ admin
 */
export async function getImageStats(shopId: string) {
  const supabase = createClient();
  const { count: totalCount } = await supabase
    .from('stock')
    .select('id', { count: 'exact', head: true })
    .eq('shop_id', shopId);

  const { count: withImageCount } = await supabase
    .from('stock')
    .select('id', { count: 'exact', head: true })
    .eq('shop_id', shopId)
    .not('image_url', 'is', null);

  return {
    total: totalCount || 0,
    withImage: withImageCount || 0,
    coverage: totalCount ? (withImageCount || 0) / totalCount : 0,
  };
}
