'use client';

import Link from 'next/link';
import { Construction, ArrowRight } from 'lucide-react';

export default function V3Placeholder() {
  return (
    <>
      <div className="v3-page-header">
        <div>
          <h1 className="v3-page-title">🚧 ยังไม่พร้อม</h1>
          <p className="v3-page-subtitle">หน้านี้กำลังพัฒนา - กลับไปใช้เวอร์ชั่นเดิมก่อน</p>
        </div>
      </div>

      <div className="v3-card" style={{ textAlign: 'center', padding: 40 }}>
        <Construction size={60} strokeWidth={1.5} style={{ margin: '0 auto 16px', color: 'var(--text-muted)' }} />
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>กำลังพัฒนาเวอร์ชั่นใหม่</h2>
        <p style={{ color: 'var(--text-dim)', fontSize: 14, marginBottom: 20 }}>
          หน้านี้ยังไม่พร้อมในเวอร์ชั่น v3 ใช้เวอร์ชั่นเดิมไปก่อนได้ครับ
        </p>
        <Link
          href="/dashboard/settings"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '12px 24px',
            background: 'var(--accent)',
            color: '#fff',
            borderRadius: 'var(--radius)',
            textDecoration: 'none',
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          ไปเวอร์ชั่นเดิม <ArrowRight size={16} />
        </Link>
      </div>
    </>
  );
}
