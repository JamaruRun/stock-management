'use client';

import { useEffect, useState } from 'react';

const APP_VERSION = '3.9.80';
const VERSION_KEY = 'stock_app_version_seen';

interface UpdateInfo {
  version: string;
  date: string;
  features: { icon: string; title: string; desc: string }[];
}

const LATEST_UPDATE: UpdateInfo = {
  version: '3.9.9',
  date: '2026-05-27',
  features: [
    {
      icon: '🧾',
      title: 'ปริ้นใบเสร็จหลังขายของได้แล้ว!',
      desc: 'ขายอุปกรณ์เสริมเสร็จ → กดปริ้นใบเสร็จได้ทันที ส่งให้ลูกค้าได้',
    },
    {
      icon: '✏️',
      title: 'เปลี่ยน Username ได้',
      desc: 'Admin เปลี่ยน username ของตัวเอง / พนักงานได้แล้ว ในเมนูจัดการผู้ใช้',
    },
    {
      icon: '🛡️',
      title: 'เช็คซ้ำกัน Username ซ้ำกัน',
      desc: 'ระบบเช็คก่อนเปลี่ยน ไม่ให้ซ้ำกับคนอื่นในระบบ',
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
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <img 
              src="/icon-192.png" 
              alt="Stock"
              style={{ 
                width: 52, 
                height: 52, 
                borderRadius: 12,
                flexShrink: 0,
                boxShadow: '0 4px 12px rgba(59, 130, 246, 0.2)',
              }}
            />
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
