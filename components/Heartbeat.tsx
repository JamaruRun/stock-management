'use client';

import { useEffect } from 'react';

const HEARTBEAT_INTERVAL = 60_000; // 1 นาที

export default function Heartbeat() {
  useEffect(() => {
    // ส่งครั้งแรกทันที
    const send = () => {
      fetch('/api/heartbeat', { method: 'POST' })
        .catch(() => {}); // silent fail
    };

    send();

    // ส่งทุก 1 นาที
    const interval = setInterval(send, HEARTBEAT_INTERVAL);

    // ส่งเมื่อกลับมา focus หน้านี้
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') send();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  return null;
}
