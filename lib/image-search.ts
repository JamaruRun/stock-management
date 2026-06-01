// ============================================
// lib/image-search.ts
// Hybrid Image Search: Wikipedia → Google CSE → Fallback
// ============================================

import { fetchWikipediaImage } from './wikipedia-image';

export interface ImageSearchResult {
  url: string;
  source: 'wikipedia' | 'google' | 'manual';
  description?: string;
}

// localStorage cache key
const CACHE_KEY = 'v3_image_cache';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface CacheEntry {
  url: string;
  source: 'wikipedia' | 'google';
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

function normalizeKey(modelName: string): string {
  return modelName.toLowerCase().trim().replace(/\s+/g, '_');
}

/**
 * ค้นหารูปแบบ hybrid:
 * 1. Cache (7 days)
 * 2. Wikipedia (ฟรี)
 * 3. Google CSE (เสีย quota)
 */
export async function searchImage(
  modelName: string,
  signal?: AbortSignal
): Promise<ImageSearchResult | null> {
  if (!modelName || modelName.trim().length < 3) return null;
  const key = normalizeKey(modelName);

  // 1. Check cache
  const cache = getCache();
  if (cache[key] && Date.now() - cache[key].timestamp < CACHE_TTL_MS) {
    return {
      url: cache[key].url,
      source: cache[key].source,
    };
  }

  // 2. Try Wikipedia
  try {
    const wiki = await fetchWikipediaImage(modelName, signal);
    if (wiki?.thumbnail) {
      setCache(key, { url: wiki.thumbnail, source: 'wikipedia', timestamp: Date.now() });
      return { url: wiki.thumbnail, source: 'wikipedia', description: wiki.description || undefined };
    }
  } catch (e) {
    if (signal?.aborted) return null;
  }

  // 3. Try Google CSE
  try {
    const google = await fetchGoogleImage(modelName, signal);
    if (google) {
      setCache(key, { url: google, source: 'google', timestamp: Date.now() });
      return { url: google, source: 'google' };
    }
  } catch (e) {
    if (signal?.aborted) return null;
    console.warn('Google CSE failed:', e);
  }

  return null;
}

async function fetchGoogleImage(
  query: string,
  signal?: AbortSignal
): Promise<string | null> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_CSE_API_KEY;
  const cseId = process.env.NEXT_PUBLIC_GOOGLE_CSE_ID;

  if (!apiKey || !cseId) {
    return null; // ยังไม่ setup
  }

  // ใส่คำที่ช่วยกรองให้เจอ "product shot"
  const enhancedQuery = `${query} smartphone phone product`;
  const url = new URL('https://www.googleapis.com/customsearch/v1');
  url.searchParams.set('key', apiKey);
  url.searchParams.set('cx', cseId);
  url.searchParams.set('q', enhancedQuery);
  url.searchParams.set('searchType', 'image');
  url.searchParams.set('num', '3');
  url.searchParams.set('imgType', 'photo');
  url.searchParams.set('imgSize', 'medium');
  url.searchParams.set('safe', 'active');

  const res = await fetch(url.toString(), { signal });
  if (!res.ok) {
    if (res.status === 429 || res.status === 403) {
      console.warn('Google CSE quota exceeded or restricted');
    }
    return null;
  }

  const data = await res.json();
  if (!data.items || data.items.length === 0) return null;

  // เลือก image ตัวแรกที่ผ่าน filter
  for (const item of data.items) {
    const link = item.link;
    if (!link) continue;
    // กรอง: ไม่เอารูปที่กว้างเกินไป (banner ads)
    const w = item.image?.width || 0;
    const h = item.image?.height || 0;
    if (w > 0 && h > 0) {
      const ratio = w / h;
      if (ratio > 2.5 || ratio < 0.3) continue; // skip banner/super-tall
    }
    return link;
  }

  return data.items[0]?.link || null;
}

/**
 * ตรวจสอบว่า Google CSE configured ไหม
 */
export function isGoogleCSEConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_GOOGLE_CSE_API_KEY &&
    process.env.NEXT_PUBLIC_GOOGLE_CSE_ID
  );
}
