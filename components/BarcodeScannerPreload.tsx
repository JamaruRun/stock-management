'use client';

import { useEffect } from 'react';

/**
 * Preload html5-qrcode ตอน browser idle
 * - ไม่ block initial render
 * - ทำให้กดสแกนครั้งแรกเร็วขึ้น 300-800ms
 * - ใช้ตอน user login เข้า dashboard แล้ว ไม่ได้กำลังทำอะไร
 */
export default function BarcodeScannerPreload() {
  useEffect(() => {
    // ใช้ requestIdleCallback ถ้ารองรับ - ไม่งั้น setTimeout
    const schedule = (cb: () => void) => {
      if ('requestIdleCallback' in window) {
        (window as any).requestIdleCallback(cb, { timeout: 3000 });
      } else {
        setTimeout(cb, 2000);
      }
    };

    schedule(() => {
      // Preload - ผลคือ browser มี chunk ใน cache แล้ว
      import('html5-qrcode').catch(() => {});
    });
  }, []);

  return null;
}
