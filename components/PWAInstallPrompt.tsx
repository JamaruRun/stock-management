'use client';

import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'stock_pwa_install_dismissed_at';
const DISMISS_DURATION_DAYS = 14;

export default function PWAInstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    // Detect iOS (Safari ไม่รองรับ install prompt - ต้องบอกวิธีเอง)
    const ua = navigator.userAgent;
    const iOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    const standalone = (window.navigator as any).standalone === true;
    setIsIOS(iOS);

    // Already installed?
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || standalone;
    if (isStandalone) return;

    // ลูกค้าปิดไปแล้ว?
    const dismissedAt = localStorage.getItem(DISMISS_KEY);
    if (dismissedAt) {
      const daysAgo = (Date.now() - parseInt(dismissedAt)) / (1000 * 60 * 60 * 24);
      if (daysAgo < DISMISS_DURATION_DAYS) return;
    }

    // Android/Desktop: ฟัง event
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setTimeout(() => setShow(true), 3000); // โชว์หลัง 3 วินาที
    };
    window.addEventListener('beforeinstallprompt', handler);

    // iOS: โชว์ guide หลัง 5 วินาที
    if (iOS && !standalone) {
      setTimeout(() => setShow(true), 5000);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  async function handleInstall() {
    if (isIOS) {
      setShowIOSGuide(true);
      return;
    }
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === 'accepted') {
      setShow(false);
      setDeferred(null);
    }
  }

  function handleDismiss() {
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
    setShow(false);
  }

  if (!show) return null;

  if (showIOSGuide) {
    return (
      <div
        onClick={() => setShowIOSGuide(false)}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: 16,
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            background: 'var(--surface)',
            borderRadius: 12,
            padding: 20,
            maxWidth: 380,
            width: '100%',
            color: 'var(--text)',
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <img src="/icon-192.png" alt="logo" style={{ width: 64, height: 64, borderRadius: 12 }} />
            <h3 style={{ margin: '12px 0 4px' }}>ติดตั้ง Stock บน iPhone</h3>
            <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>ใช้งานเหมือนแอปจริงไม่ต้องเปิด browser</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Step n="1" text='แตะปุ่ม "แชร์" ที่ Safari' icon="⬆️" />
            <Step n="2" text='เลื่อนลงหา "Add to Home Screen"' icon="➕" />
            <Step n="3" text='แตะ "Add" มุมขวาบน' icon="✅" />
          </div>
          <button
            onClick={() => setShowIOSGuide(false)}
            style={{
              width: '100%',
              marginTop: 16,
              padding: 12,
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >เข้าใจแล้ว</button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 16,
        left: 16,
        right: 16,
        zIndex: 9999,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
        padding: 14,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        maxWidth: 480,
        margin: '0 auto',
      }}
    >
      <img
        src="/icon-192.png"
        alt="Stock"
        style={{ width: 48, height: 48, borderRadius: 10, flexShrink: 0 }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
          ติดตั้งแอป Stock
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
          เปิดเร็วกว่า • ทำงานนอก browser • มี icon บนหน้าจอ
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
        <button
          onClick={handleInstall}
          style={{
            padding: '8px 14px',
            background: 'var(--accent)',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
            whiteSpace: 'nowrap',
          }}
        >
          📥 ติดตั้ง
        </button>
        <button
          onClick={handleDismiss}
          style={{
            padding: '4px 8px',
            background: 'transparent',
            color: 'var(--text-dim)',
            border: 'none',
            fontSize: 10,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          ภายหลัง
        </button>
      </div>
    </div>
  );
}

function Step({ n, text, icon }: { n: string; text: string; icon: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: 10,
        background: 'var(--surface-2)',
        borderRadius: 8,
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          background: 'var(--accent)',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 700,
          fontSize: 13,
          flexShrink: 0,
        }}
      >{n}</div>
      <div style={{ flex: 1, fontSize: 13 }}>{text}</div>
      <div style={{ fontSize: 20 }}>{icon}</div>
    </div>
  );
}
