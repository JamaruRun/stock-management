'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

type Theme = 'modern-blue' | 'dark-pro' | 'orange-shop';

const THEMES: { id: Theme; name: string; emoji: string }[] = [
  { id: 'modern-blue', name: 'Clean Blue', emoji: '💎' },
  { id: 'dark-pro', name: 'Dark Pro', emoji: '🖤' },
  { id: 'orange-shop', name: 'Orange Shop', emoji: '🧡' },
];

const MENU = [
  { icon: '🏠', label: 'หน้าหลัก', path: '/', badge: null },
  { icon: '📱', label: 'สต๊อกเครื่อง', path: '/stock', badge: null },
  { icon: '🔧', label: 'สต๊อกอะไหล่', path: '/parts', badge: '2' },
  { icon: '🛍️', label: 'ขายสินค้า', path: '/sell', badge: null },
  { icon: '🛠️', label: 'งานซ่อม', path: '/repair', badge: '7' },
  { icon: '💰', label: 'รับจำนำ', path: '/pawn', badge: null },
  { icon: '💳', label: 'ผ่อน', path: '/installment', badge: null },
  { icon: '👥', label: 'ลูกค้า', path: '/customers', badge: null },
  { icon: '📊', label: 'รายงาน', path: '/reports', badge: null },
  { icon: '⚙️', label: 'ตั้งค่า', path: '/settings', badge: null },
];

export default function V3Preview() {
  const [theme, setTheme] = useState<Theme>('modern-blue');
  const [activePath, setActivePath] = useState('/');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    return () => {
      // reset back to default theme on leave
      document.documentElement.setAttribute('data-theme', 'light');
    };
  }, [theme]);

  return (
    <>
      {/* Theme switcher floating */}
      <div style={{
        position: 'fixed',
        top: 16,
        right: 16,
        zIndex: 100,
        background: 'rgba(15, 23, 42, 0.95)',
        backdropFilter: 'blur(20px)',
        padding: 8,
        borderRadius: 12,
        display: 'flex',
        gap: 6,
        boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
      }}>
        {THEMES.map(t => (
          <button
            key={t.id}
            onClick={() => setTheme(t.id)}
            style={{
              padding: '8px 12px',
              background: theme === t.id ? '#fff' : 'transparent',
              color: theme === t.id ? '#000' : '#fff',
              border: 'none',
              borderRadius: 8,
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
              whiteSpace: 'nowrap',
            }}
          >
            {t.emoji} {t.name}
          </button>
        ))}
      </div>

      <div className="v3-app">
        {/* Sidebar */}
        <aside className={`v3-sidebar ${sidebarOpen ? 'open' : ''}`}>
          <div className="v3-sidebar-brand">
            <div className="v3-sidebar-brand-icon">C</div>
            <div>
              <div className="v3-sidebar-brand-text">CARE</div>
              <div className="v3-sidebar-brand-sub">MOBILE</div>
            </div>
          </div>

          <nav className="v3-sidebar-nav">
            {MENU.map(item => (
              <a
                key={item.path}
                href="#"
                onClick={(e) => { e.preventDefault(); setActivePath(item.path); setSidebarOpen(false); }}
                className={`v3-sidebar-item ${activePath === item.path ? 'active' : ''}`}
              >
                <span className="v3-sidebar-item-icon">{item.icon}</span>
                <span>{item.label}</span>
                {item.badge && <span className="v3-sidebar-item-badge">{item.badge}</span>}
              </a>
            ))}
          </nav>

          <div className="v3-sidebar-profile">
            <div className="v3-sidebar-profile-avatar">ค</div>
            <div className="v3-sidebar-profile-info">
              <div className="v3-sidebar-profile-name">แคร์โมบาย</div>
              <div className="v3-sidebar-profile-role">เจ้าของร้าน · สาขา 1</div>
            </div>
          </div>
        </aside>

        {/* Main */}
        <div className="v3-main">
          {/* Header */}
          <header className="v3-header">
            <button
              className="v3-header-btn"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              style={{ display: 'none' }}
              id="mobile-toggle"
            >☰</button>

            <div className="v3-header-search">
              <span className="v3-header-search-icon">🔍</span>
              <input type="text" placeholder="ค้นหา IMEI, รุ่น, ลูกค้า..." />
            </div>

            <div className="v3-header-actions">
              <button className="v3-header-branch">
                📍 สาขา 1
                <span style={{ fontSize: 10, opacity: 0.6 }}>▼</span>
              </button>
              <button className="v3-header-btn">
                🔔
                <span className="v3-header-btn-badge">3</span>
              </button>
              <button className="v3-header-btn">⚙️</button>
            </div>
          </header>

          {/* Content */}
          <div className="v3-content">
            <div className="v3-page-header">
              <div>
                <h1 className="v3-page-title">สวัสดีครับ, แคร์โมบาย 👋</h1>
                <p className="v3-page-subtitle">ยินดีต้อนรับกลับมา · นี่คือตัวอย่าง Phase 1 Foundation</p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="v3-btn v3-btn-secondary">📥 Export</button>
                <button className="v3-btn v3-btn-primary">+ เพิ่มเครื่องใหม่</button>
              </div>
            </div>

            {/* Phase 1 Demo Cards */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: 16,
              marginBottom: 24,
            }}>
              {[
                { label: 'ยอดขายวันนี้', value: '฿12,500', trend: '+18%', icon: '💰', color: 'var(--accent)' },
                { label: 'กำไรวันนี้', value: '฿4,850', trend: '+22%', icon: '📈', color: 'var(--success)' },
                { label: 'เครื่องทั้งหมด', value: '128', trend: 'เครื่อง', icon: '📱', color: 'var(--info)' },
                { label: 'งานซ่อมค้าง', value: '7', trend: 'งาน', icon: '🛠️', color: 'var(--warning)' },
              ].map((s, i) => (
                <div key={i} className="v3-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      background: 'var(--surface-2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 20,
                    }}>{s.icon}</div>
                    <span className="v3-badge v3-badge-success">{s.trend}</span>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 4 }}>{s.label}</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>{s.value}</div>
                </div>
              ))}
            </div>

            <div className="v3-card v3-card-lg" style={{ marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>🎯 Phase 1 Foundation Preview</h2>
              <p style={{ color: 'var(--text-dim)', lineHeight: 1.7, fontSize: 14, marginBottom: 16 }}>
                หน้านี้เป็นตัวอย่างของ Sidebar + Header + Cards + Theme ใหม่ตาม reference SaaS
                ลองสลับ <strong>3 ธีม</strong> ด้านขวาบนดู และคลิกเมนูใน sidebar เพื่อทดสอบ active state
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span className="v3-badge v3-badge-success">✓ Tokens System</span>
                <span className="v3-badge v3-badge-info">✓ Sidebar Gradient</span>
                <span className="v3-badge v3-badge-warning">✓ Header + Search</span>
                <span className="v3-badge v3-badge-gray">✓ 3 Themes</span>
                <span className="v3-badge v3-badge-gray">✓ Cards Component</span>
                <span className="v3-badge v3-badge-gray">✓ Buttons</span>
              </div>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 16,
              marginBottom: 16,
            }}>
              <div className="v3-card">
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>🎨 Components</h3>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                  <button className="v3-btn v3-btn-primary v3-btn-sm">Primary</button>
                  <button className="v3-btn v3-btn-secondary v3-btn-sm">Secondary</button>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <span className="v3-badge v3-badge-success">พร้อมขาย</span>
                  <span className="v3-badge v3-badge-warning">รอตรวจ</span>
                  <span className="v3-badge v3-badge-danger">ขายแล้ว</span>
                  <span className="v3-badge v3-badge-info">จองแล้ว</span>
                  <span className="v3-badge v3-badge-gray">ยกเลิก</span>
                </div>
              </div>

              <div className="v3-card">
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>📋 Active Menu</h3>
                <div style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.8 }}>
                  เมนูปัจจุบัน: <strong style={{ color: 'var(--accent)' }}>{activePath}</strong><br />
                  ลองคลิกเมนูใน sidebar ทางซ้าย<br />
                  จะเห็น active state เปลี่ยน
                </div>
              </div>

              <div className="v3-card">
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>📱 Responsive</h3>
                <div style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.8 }}>
                  ลองย่อหน้าจอ &lt; 1024px<br />
                  Sidebar จะซ่อน + มีปุ่ม ☰<br />
                  (Mobile UX สมบูรณ์ใน Phase 6)
                </div>
              </div>
            </div>

            <div style={{
              padding: 20,
              background: 'var(--accent-light)',
              border: '1px solid var(--accent)',
              borderRadius: 'var(--radius-lg)',
              color: 'var(--accent-text)',
              fontSize: 14,
              lineHeight: 1.7,
            }}>
              <strong>📌 หมายเหตุสำหรับเจ้าของระบบ:</strong><br />
              หน้านี้คือ <code>/v3-preview</code> — เป็น preview เท่านั้น ไม่กระทบหน้าจริง<br />
              ระบบเก่าทุกหน้ายังใช้งานปกติ 100% ลูกค้าเก่าไม่เห็นการเปลี่ยนแปลง<br />
              เมื่อ approve แล้ว ค่อย apply Phase 2 (Dashboard), Phase 3 (Stock Cards), ฯลฯ
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @media (max-width: 1024px) {
          #mobile-toggle { display: flex !important; }
        }
      `}</style>
    </>
  );
}
