'use client';

import { useState, useEffect } from 'react';

type Theme = 'modern-blue' | 'dark-pro' | 'orange-shop';

const THEMES: { id: Theme; name: string; emoji: string }[] = [
  { id: 'modern-blue', name: 'Clean Blue', emoji: '💎' },
  { id: 'dark-pro', name: 'Dark Pro', emoji: '🖤' },
  { id: 'orange-shop', name: 'Orange', emoji: '🧡' },
];

const SIDEBAR_MENU = [
  { icon: '🏠', label: 'หน้าหลัก', path: '/home', badge: null },
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
  const [activePath, setActivePath] = useState('/home');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showScanModal, setShowScanModal] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    return () => {
      document.documentElement.setAttribute('data-theme', 'light');
    };
  }, [theme]);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 1024);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const currentPage = SIDEBAR_MENU.find(m => m.path === activePath) || SIDEBAR_MENU[0];

  return (
    <>
      {/* Theme switcher floating */}
      <div style={{
        position: 'fixed',
        top: isMobile ? 'auto' : 16,
        bottom: isMobile ? 90 : 'auto',
        right: 12,
        zIndex: 100,
        background: 'rgba(15, 23, 42, 0.92)',
        backdropFilter: 'blur(20px)',
        padding: 6,
        borderRadius: 10,
        display: 'flex',
        gap: 4,
        boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
      }}>
        {THEMES.map(t => (
          <button
            key={t.id}
            onClick={() => setTheme(t.id)}
            style={{
              padding: '6px 10px',
              background: theme === t.id ? '#fff' : 'transparent',
              color: theme === t.id ? '#000' : '#fff',
              border: 'none',
              borderRadius: 6,
              fontSize: 10,
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
        <aside className={`v3-sidebar ${sidebarOpen ? 'open' : ''}`}>
          <div className="v3-sidebar-brand">
            <div className="v3-sidebar-brand-icon">C</div>
            <div>
              <div className="v3-sidebar-brand-text">CARE</div>
              <div className="v3-sidebar-brand-sub">MOBILE</div>
            </div>
          </div>

          <nav className="v3-sidebar-nav">
            {SIDEBAR_MENU.map(item => (
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

        {sidebarOpen && isMobile && (
          <div
            onClick={() => setSidebarOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.5)',
              zIndex: 49,
            }}
          />
        )}

        <div className="v3-main">
          {!isMobile && (
            <header className="v3-header">
              <div className="v3-header-search">
                <span className="v3-header-search-icon">🔍</span>
                <input type="text" placeholder="ค้นหา IMEI, รุ่น, ลูกค้า..." />
              </div>
              <div className="v3-header-actions">
                <button className="v3-header-branch">📍 สาขา 1 ▼</button>
                <button className="v3-header-btn">🔔<span className="v3-header-btn-badge">3</span></button>
                <button className="v3-header-btn">⚙️</button>
              </div>
            </header>
          )}

          {isMobile && (
            <header className="v3-mobile-header">
              <button className="v3-mobile-header-back" onClick={() => setSidebarOpen(true)}>☰</button>
              <div className="v3-mobile-header-title">
                {currentPage.icon} {currentPage.label}
              </div>
              <button className="v3-mobile-header-back" style={{ position: 'relative' }}>
                🔔
                <span style={{
                  position: 'absolute',
                  top: -2, right: -2,
                  background: 'var(--danger)',
                  color: '#fff',
                  fontSize: 9,
                  fontWeight: 700,
                  padding: '1px 5px',
                  borderRadius: 100,
                  minWidth: 16,
                  textAlign: 'center',
                  border: '2px solid var(--surface)',
                }}>3</span>
              </button>
            </header>
          )}

          <div className={isMobile ? 'v3-mobile-content' : 'v3-content'}>
            {!isMobile && (
              <div className="v3-page-header">
                <div>
                  <h1 className="v3-page-title">{currentPage.icon} {currentPage.label}</h1>
                  <p className="v3-page-subtitle">นี่คือ Mobile UX Phase — ลองเปิดจากมือถือดู!</p>
                </div>
              </div>
            )}

            {isMobile && (
              <div className="v3-card" style={{ marginBottom: 14, background: 'linear-gradient(135deg, #3b82f6, #6366f1)', color: '#fff', border: 'none' }}>
                <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 4 }}>📱 Mobile View — Phase 6 Preview</div>
                <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Bottom Nav + Scan FAB</div>
                <div style={{ fontSize: 12, opacity: 0.9, lineHeight: 1.6 }}>
                  ดูล่างจอครับ! มีปุ่มสีน้ำเงินลอย + แถบเมนู 4 ไอคอน
                </div>
              </div>
            )}

            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: isMobile ? 10 : 16,
              marginBottom: 20,
            }}>
              {[
                { label: 'ยอดขายวันนี้', value: '฿12,500', trend: '+18%', icon: '💰' },
                { label: 'กำไรวันนี้', value: '฿4,850', trend: '+22%', icon: '📈' },
                { label: 'เครื่องทั้งหมด', value: '128', trend: 'เครื่อง', icon: '📱' },
                { label: 'งานซ่อมค้าง', value: '7', trend: 'งาน', icon: '🛠️' },
              ].map((s, i) => (
                <div key={i} className="v3-card" style={{ padding: isMobile ? 14 : 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div style={{
                      width: isMobile ? 34 : 40,
                      height: isMobile ? 34 : 40,
                      borderRadius: 10,
                      background: 'var(--surface-2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: isMobile ? 16 : 20,
                    }}>{s.icon}</div>
                    <span className="v3-badge v3-badge-success" style={{ fontSize: 9 }}>{s.trend}</span>
                  </div>
                  <div style={{ fontSize: isMobile ? 11 : 13, color: 'var(--text-dim)', marginBottom: 2 }}>{s.label}</div>
                  <div style={{ fontSize: isMobile ? 18 : 24, fontWeight: 700, color: 'var(--text)' }}>{s.value}</div>
                </div>
              ))}
            </div>

            <div className="v3-card" style={{ marginBottom: 16 }}>
              <h2 style={{ fontSize: isMobile ? 14 : 17, fontWeight: 700, marginBottom: 12 }}>⚡ ทางลัด</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {[
                  { icon: '➕', label: 'เพิ่มเครื่อง' },
                  { icon: '🛍️', label: 'ขายสินค้า' },
                  { icon: '🔧', label: 'รับงานซ่อม' },
                  { icon: '💰', label: 'รับจำนำ' },
                  { icon: '👤', label: 'ลูกค้าใหม่' },
                  { icon: '🏷️', label: 'พิมพ์บาร์โค้ด' },
                ].map((a, i) => (
                  <button key={i} className="v3-btn v3-btn-secondary" style={{
                    height: 'auto',
                    padding: '12px 8px',
                    flexDirection: 'column',
                    gap: 4,
                    fontSize: 11,
                  }}>
                    <span style={{ fontSize: 20 }}>{a.icon}</span>
                    {a.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{
              padding: 14,
              background: 'var(--accent-light)',
              border: '1px solid var(--accent)',
              borderRadius: 'var(--radius)',
              color: 'var(--accent-text)',
              fontSize: 12,
              lineHeight: 1.6,
              marginBottom: 16,
            }}>
              <strong>📌 หน้านี้คือ /v3-preview</strong> — กำลังทดสอบ Phase 1 (Foundation) + Phase 6 (Mobile UX)<br />
              เปิดบนมือถือเพื่อเห็น Bottom Nav + ปุ่ม Scan ลอยตรงกลาง<br />
              เปิดบน desktop จะเห็น Sidebar + Header แทน
            </div>
          </div>
        </div>

        <nav className="v3-bottom-nav">
          <button
            className={`v3-bottom-nav-item ${activePath === '/home' ? 'active' : ''}`}
            onClick={() => setActivePath('/home')}
          >
            <span className="v3-bottom-nav-item-icon">🏠</span>
            <span>หน้าหลัก</span>
          </button>
          <button
            className={`v3-bottom-nav-item ${activePath === '/stock' ? 'active' : ''}`}
            onClick={() => setActivePath('/stock')}
          >
            <span className="v3-bottom-nav-item-icon">📦</span>
            <span>สต๊อก</span>
          </button>

          <div className="v3-bottom-nav-item-scan-placeholder">
            <span className="v3-bottom-nav-item-icon">📷</span>
            <span>Scan</span>
          </div>

          <button
            className={`v3-bottom-nav-item ${activePath === '/repair' ? 'active' : ''}`}
            onClick={() => setActivePath('/repair')}
          >
            <span className="v3-bottom-nav-item-icon">🛠️</span>
            <span>งานซ่อม</span>
          </button>
          <button
            className={`v3-bottom-nav-item ${activePath === '/menu' ? 'active' : ''}`}
            onClick={() => setSidebarOpen(true)}
          >
            <span className="v3-bottom-nav-item-icon">☰</span>
            <span>เมนู</span>
          </button>
        </nav>

        <button className="v3-scan-fab" onClick={() => setShowScanModal(true)}>
          📷
        </button>

        {showScanModal && (
          <div
            onClick={() => setShowScanModal(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.6)',
              zIndex: 100,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 20,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="v3-card"
              style={{ maxWidth: 380, width: '100%', textAlign: 'center' }}
            >
              <div style={{ fontSize: 60, marginBottom: 12 }}>📷</div>
              <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>สแกน Barcode / QR</h3>
              <p style={{ color: 'var(--text-dim)', fontSize: 13, marginBottom: 16 }}>
                จะเปิดกล้องอ่าน IMEI / Barcode / QR Code
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button className="v3-btn v3-btn-primary">📷 เปิดกล้องสแกน</button>
                <button className="v3-btn v3-btn-secondary" onClick={() => setShowScanModal(false)}>
                  ปิด
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
