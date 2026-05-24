'use client';

import { useEffect, useState } from 'react';

const APP_VERSION = '3.8.4';
const VERSION_KEY = 'stock_app_version_seen';

interface UpdateInfo {
  version: string;
  date: string;
  features: { icon: string; title: string; desc: string }[];
}

const LATEST_UPDATE: UpdateInfo = {
  version: '3.8.4',
  date: '2026-05-24',
  features: [
    {
      icon: '🏷️',
      title: 'ปริ้นป้ายราคาเครื่อง Easy Print แล้ว!',
      desc: 'ขนาด 30×20mm • รองรับเครื่องพิมพ์ความร้อน • มี Barcode + QR ในป้ายเดียว',
    },
    {
      icon: '📥',
      title: 'นำเข้าสต๊อกเครื่องจาก Excel',
      desc: 'อัพโหลดไฟล์ Excel เพิ่มเครื่องครั้งละหลายร้อยเครื่อง • Supplier ใหม่สร้างอัตโนมัติ',
    },
    {
      icon: '📱',
      title: 'ใช้ได้กับทุก module',
      desc: 'สต๊อกเครื่อง • สต๊อกของ • อะไหล่ซ่อม — กดปุ่ม 🏷️ ในแต่ละรายการได้เลย',
    },
  ],
};

export default function UpdatePopup() {
  const [show, setShow] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);

  useEffect(() => {
    try {
      const lastSeen = localStorage.getItem(VERSION_KEY);
      if (lastSeen !== APP_VERSION) {
        setUpdateInfo(LATEST_UPDATE);
        setShow(true);
      }
    } catch (e) {
      // localStorage unavailable - skip
    }
  }, []);

  function handleClose() {
    try {
      localStorage.setItem(VERSION_KEY, APP_VERSION);
    } catch (e) {}
    setShow(false);
  }

  if (!show || !updateInfo) return null;

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && handleClose()}>
      <div className="modal" style={{ maxWidth: 480 }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 12,
        }}>
          <div>
            <div style={{
              display: 'inline-block',
              fontSize: 11,
              color: 'var(--accent)',
              fontFamily: 'JetBrains Mono, monospace',
              letterSpacing: 1,
              padding: '2px 8px',
              border: '1px solid var(--accent)',
              marginBottom: 8,
            }}>
              v{updateInfo.version}
            </div>
            <h3 style={{ margin: 0 }}>🎉 อัพเดทใหม่!</h3>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'JetBrains Mono, monospace' }}>
            {updateInfo.date}
          </div>
        </div>

        <p className="modal-sub" style={{ marginTop: 0 }}>
          มีฟีเจอร์ใหม่มาให้ใช้งาน
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
          {updateInfo.features.map((f, i) => (
            <div key={i} style={{
              display: 'flex',
              gap: 12,
              padding: 12,
              background: 'var(--surface-2)',
              borderLeft: '3px solid var(--accent)',
            }}>
              <span style={{ fontSize: 20 }}>{f.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
                  {f.title}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.5 }}>
                  {f.desc}
                </div>
              </div>
            </div>
          ))}
        </div>

        <button className="btn" onClick={handleClose} style={{ width: '100%' }}>
          เข้าใจแล้ว ✓
        </button>
      </div>
    </div>
  );
}
