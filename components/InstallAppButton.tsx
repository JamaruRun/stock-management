'use client';

import { useState } from 'react';
import { usePwaInstall } from '@/lib/use-pwa-install';
import { IOSInstallGuide } from './PWAInstallPrompt';

interface Props {
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
  onClick?: () => void;
}

/** Small persistent install button - a supplement to the auto-popup banner,
 * for when the browser never fires beforeinstallprompt (or the user already dismissed it).
 * Always visible unless the app is already running standalone/installed. */
export default function InstallAppButton({ className, style, children, onClick }: Props) {
  const { canInstall, promptInstall } = usePwaInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [showManualGuide, setShowManualGuide] = useState(false);

  if (!canInstall) return null;

  async function handleClick() {
    onClick?.();
    const result = await promptInstall();
    if (result === 'ios-guide') setShowIOSGuide(true);
    else if (result === 'manual-guide') setShowManualGuide(true);
  }

  return (
    <>
      <button className={className} onClick={handleClick} title="ติดตั้งแอป" style={style}>
        {children ?? '📲'}
      </button>
      {showIOSGuide && <IOSInstallGuide onClose={() => setShowIOSGuide(false)} />}
      {showManualGuide && <ManualInstallGuide onClose={() => setShowManualGuide(false)} />}
    </>
  );
}

function ManualInstallGuide({ onClose }: { onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 10000, padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)', borderRadius: 12, padding: 20,
          maxWidth: 380, width: '100%', color: 'var(--text)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <img src="/icon-192.png" alt="logo" style={{ width: 64, height: 64, borderRadius: 12 }} />
          <h3 style={{ margin: '12px 0 4px' }}>ติดตั้งแอป Stock</h3>
          <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>
            เบราว์เซอร์นี้ยังไม่ยืนยันว่าติดตั้งอัตโนมัติได้ ลองติดตั้งเองตามนี้
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <GuideRow text='Chrome/Edge: กดเมนู ⋮ มุมขวาบน แล้วเลือก "ติดตั้งแอป" หรือ "Add to Home screen"' icon="⋮" />
          <GuideRow text="หรือมองหาไอคอนติดตั้ง ⊕ ในแถบที่อยู่เว็บ (address bar)" icon="⊕" />
          <GuideRow text='มือถือทั่วไป: เมนูเบราว์เซอร์ → "เพิ่มไปยังหน้าจอหลัก"' icon="📱" />
        </div>
        <button
          onClick={onClose}
          style={{
            width: '100%', marginTop: 16, padding: 12, background: 'var(--accent)',
            color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >เข้าใจแล้ว</button>
      </div>
    </div>
  );
}

function GuideRow({ text, icon }: { text: string; icon: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, background: 'var(--surface-2)', borderRadius: 8 }}>
      <div style={{ fontSize: 18, flexShrink: 0 }}>{icon}</div>
      <div style={{ flex: 1, fontSize: 12.5, lineHeight: 1.4 }}>{text}</div>
    </div>
  );
}
