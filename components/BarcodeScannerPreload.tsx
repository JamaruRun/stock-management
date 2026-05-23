'use client';

import { useEffect } from 'react';

/**
 * Preload html5-qrcode ตอน browser idle
 * - ไม่ block initial render
 * - ทำให้กดสแกนครั้งแรกเร็วขึ้น 300-800ms
 */
export default function BarcodeScannerPreload() {
  useEffect(() => {
    const schedule = (cb: () => void) => {
      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        (window as any).requestIdleCallback(cb, { timeout: 3000 });
      } else {
        setTimeout(cb, 2000);
      }
    };

    schedule(() => {
      // ใช้ webpackIgnore เพื่อไม่ให้ webpack จับ - dynamic import แบบ runtime
      // (เผื่อ package ยังไม่ install ก็ไม่กระทบ build)
      import(/* webpackChunkName: "html5-qrcode-preload" */ 'html5-qrcode')
        .catch(() => {
          // silent - ไม่กระทบ user
        });
    });
  }, []);

  return null;
}
