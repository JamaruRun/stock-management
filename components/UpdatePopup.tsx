'use client';

import { useEffect, useState } from 'react';

const APP_VERSION = '3.1.0';
const VERSION_KEY = 'stock_app_version_seen';

interface UpdateInfo {
  version: string;
  date: string;
  features: { icon: string; title: string; desc: string }[];
}

const LATEST_UPDATE: UpdateInfo = {
  version: '3.1.0',
  date: '2026-05-18',
  features: [
    {
      icon: '📊',
      title: 'หน้ารายงาน + กราฟ!',
      desc: 'กราฟรายได้รายวัน 7/30/90 วัน • Top 10 รุ่นขายดี • เปรียบเทียบรายได้กับกำไร • แยกตามสาขา',
    },
    {
      icon: '🏆',
      title: 'อันดับรุ่นขายดี',
      desc: 'ดูได้ว่ารุ่นไหนขายดีที่สุด มียอดเท่าไหร่ กำไรเท่าไหร่ - ช่วยตัดสินใจซื้อเข้าสต๊อก',
    },
    {
      icon: '💾',
      title: 'Backup ข้อมูลได้แล้ว',
      desc: 'ดาวน์โหลดข้อมูลทุกอย่างเป็น Excel หรือ JSON ได้ ป้องกันข้อมูลสูญหาย',
    },
    {
      icon: '📥',
      title: 'Export CSV รายงาน',
      desc: 'ในหน้ารายงาน กดปุ่ม Export CSV เพื่อเอาไปวิเคราะห์ใน Excel ต่อได้',
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
