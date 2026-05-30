'use client';

import { useState, useEffect } from 'react';
import {
  // Sidebar icons
  Home, Smartphone, Wrench, ShoppingBag, Hammer, Coins, CreditCard,
  Users, BarChart3, Settings, Menu, Bell, MapPin, Search,
  // Bottom nav
  Package, Camera,
  // KPI cards
  Wallet, TrendingUp,
  // Quick actions
  Plus, ShoppingCart, UserPlus, Barcode,
  // Misc
  ChevronDown, X, Gem, Moon, Flame,
} from 'lucide-react';

type Theme = 'modern-blue' | 'dark-pro' | 'orange-shop';

const THEMES: { id: Theme; name: string; Icon: typeof Gem }[] = [
  { id: 'modern-blue', name: 'Clean Blue', Icon: Gem },
  { id: 'dark-pro', name: 'Dark Pro', Icon: Moon },
  { id: 'orange-shop', name: 'Orange', Icon: Flame },
];

const SIDEBAR_MENU = [
  { Icon: Home, label: 'หน้าหลัก', path: '/home', badge: null },
  { Icon: Smartphone, label: 'สต๊อกเครื่อง', path: '/stock', badge: null },
  { Icon: Wrench, label: 'สต๊อกอะไหล่', path: '/parts', badge: '2' },
  { Icon: ShoppingBag, label: 'ขายสินค้า', path: '/sell', badge: null },
  { Icon: Hammer, label: 'งานซ่อม', path: '/repair', badge: '7' },
  { Icon: Coins, label: 'รับจำนำ', path: '/pawn', badge: null },
  { Icon: CreditCard, label: 'ผ่อน', path: '/installment', badge: null },
  { Icon: Users, label: 'ลูกค้า', path: '/customers', badge: null },
  { Icon: BarChart3, label: 'รายงาน', path: '/reports', badge: null },
  { Icon: Settings, label: 'ตั้งค่า', path: '/settings', badge: null },
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
  const CurrentIcon = currentPage.Icon;

  return (
    <>
      {/* Theme switcher */}
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
        {THEMES.map(t => {
          const ThemeIcon = t.Icon;
          return (
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
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <ThemeIcon size={12} />
              {t.name}
            </button>
          );
        })}
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
            {SIDEBAR_MENU.map(item => {
              const ItemIcon = item.Icon;
              return (
                <a
                  key={item.path}
                  href="#"
                  onClick={(e) => { e.preventDefault(); setActivePath(item.path); setSidebarOpen(false); }}
                  className={`v3-sidebar-item ${activePath === item.path ? 'active' : ''}`}
                >
                  <ItemIcon size={20} strokeWidth={2} />
                  <span>{item.label}</span>
                  {item.badge && <span className="v3-sidebar-item-badge">{item.badge}</span>}
                </a>
              );
            })}
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
              position: 'fixed', inset: 0,
              background: 'rgba(0,0,0,0.5)',
              zIndex: 49,
            }}
          />
        )}

        <div className="v3-main">
          {!isMobile && (
            <header className="v3-header">
              <div className="v3-header-search">
                <Search size={18} className="v3-header-search-icon" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input type="text" placeholder="ค้นหา IMEI, รุ่น, ลูกค้า..." />
              </div>
              <div className="v3-header-actions">
                <button className="v3-header-branch">
                  <MapPin size={14} />
                  สาขา 1
                  <ChevronDown size={12} />
                </button>
                <button className="v3-header-btn">
                  <Bell size={18} />
                  <span className="v3-header-btn-badge">3</span>
                </button>
                <button className="v3-header-btn"><Settings size={18} /></button>
              </div>
            </header>
          )}

          {isMobile && (
            <header className="v3-mobile-header">
              <button className="v3-mobile-header-back" onClick={() => setSidebarOpen(true)}>
                <Menu size={20} />
              </button>
              <div className="v3-mobile-header-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CurrentIcon size={18} strokeWidth={2.2} />
                {currentPage.label}
              </div>
              <button className="v3-mobile-header-back" style={{ position: 'relative' }}>
                <Bell size={18} />
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
                  <h1 className="v3-page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <CurrentIcon size={24} strokeWidth={2.2} />
                    {currentPage.label}
                  </h1>
                  <p className="v3-page-subtitle">ลองเปิดจากมือถือดู!</p>
                </div>
              </div>
            )}

            {isMobile && (
              <div className="v3-card" style={{ marginBottom: 14, background: 'linear-gradient(135deg, #3b82f6, #6366f1)', color: '#fff', border: 'none' }}>
                <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Smartphone size={14} />
                  Mobile View — Phase 6 Preview
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Bottom Nav + Scan FAB</div>
                <div style={{ fontSize: 12, opacity: 0.9, lineHeight: 1.6 }}>
                  ดูล่างจอครับ! ปุ่ม Scan สีน้ำเงิน + แถบเมนู 4 ไอคอน
                </div>
              </div>
            )}

            {/* KPI Cards with line icons */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: isMobile ? 10 : 16,
              marginBottom: 20,
            }}>
              {[
                { label: 'ยอดขายวันนี้', value: '฿12,500', trend: '+18%', Icon: Wallet, color: '#3b82f6' },
                { label: 'กำไรวันนี้', value: '฿4,850', trend: '+22%', Icon: TrendingUp, color: '#22c55e' },
                { label: 'เครื่องทั้งหมด', value: '128', trend: 'เครื่อง', Icon: Smartphone, color: '#06b6d4' },
                { label: 'งานซ่อมค้าง', value: '7', trend: 'งาน', Icon: Hammer, color: '#f59e0b' },
              ].map((s, i) => {
                const KpiIcon = s.Icon;
                return (
                  <div key={i} className="v3-card" style={{ padding: isMobile ? 14 : 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                      <div style={{
                        width: isMobile ? 38 : 44,
                        height: isMobile ? 38 : 44,
                        borderRadius: 10,
                        background: `${s.color}15`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: s.color,
                      }}>
                        <KpiIcon size={isMobile ? 18 : 22} strokeWidth={2.2} />
                      </div>
                      <span className="v3-badge v3-badge-success" style={{ fontSize: 9 }}>{s.trend}</span>
                    </div>
                    <div style={{ fontSize: isMobile ? 11 : 13, color: 'var(--text-dim)', marginBottom: 2 }}>{s.label}</div>
                    <div style={{ fontSize: isMobile ? 18 : 24, fontWeight: 700, color: 'var(--text)' }}>{s.value}</div>
                  </div>
                );
              })}
            </div>

            {/* Quick actions with line icons */}
            <div className="v3-card" style={{ marginBottom: 16 }}>
              <h2 style={{ fontSize: isMobile ? 14 : 17, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Plus size={16} /> ทางลัด
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {[
                  { Icon: Plus, label: 'เพิ่มเครื่อง' },
                  { Icon: ShoppingCart, label: 'ขายสินค้า' },
                  { Icon: Hammer, label: 'รับงานซ่อม' },
                  { Icon: Coins, label: 'รับจำนำ' },
                  { Icon: UserPlus, label: 'ลูกค้าใหม่' },
                  { Icon: Barcode, label: 'พิมพ์บาร์โค้ด' },
                ].map((a, i) => {
                  const QIcon = a.Icon;
                  return (
                    <button key={i} className="v3-btn v3-btn-secondary" style={{
                      height: 'auto',
                      padding: '14px 8px',
                      flexDirection: 'column',
                      gap: 6,
                      fontSize: 11,
                    }}>
                      <QIcon size={22} strokeWidth={2} />
                      {a.label}
                    </button>
                  );
                })}
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
              <strong>📌 หน้านี้คือ /v3-preview</strong> — ใช้ Lucide Icons แทน emoji แล้ว ดูเป็นมืออาชีพขึ้น
            </div>
          </div>
        </div>

        {/* Bottom Navigation with line icons */}
        <nav className="v3-bottom-nav">
          <button
            className={`v3-bottom-nav-item ${activePath === '/home' ? 'active' : ''}`}
            onClick={() => setActivePath('/home')}
          >
            <Home size={22} strokeWidth={activePath === '/home' ? 2.4 : 2} />
            <span>หน้าหลัก</span>
          </button>
          <button
            className={`v3-bottom-nav-item ${activePath === '/stock' ? 'active' : ''}`}
            onClick={() => setActivePath('/stock')}
          >
            <Package size={22} strokeWidth={activePath === '/stock' ? 2.4 : 2} />
            <span>สต๊อก</span>
          </button>

          <div className="v3-bottom-nav-item-scan-placeholder">
            <Camera size={22} />
            <span>Scan</span>
          </div>

          <button
            className={`v3-bottom-nav-item ${activePath === '/repair' ? 'active' : ''}`}
            onClick={() => setActivePath('/repair')}
          >
            <Hammer size={22} strokeWidth={activePath === '/repair' ? 2.4 : 2} />
            <span>งานซ่อม</span>
          </button>
          <button
            className={`v3-bottom-nav-item ${activePath === '/menu' ? 'active' : ''}`}
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={22} strokeWidth={2} />
            <span>เมนู</span>
          </button>
        </nav>

        {/* Floating Scan Button with Camera icon */}
        <button className="v3-scan-fab" onClick={() => setShowScanModal(true)}>
          <Camera size={26} strokeWidth={2.2} />
        </button>

        {showScanModal && (
          <div
            onClick={() => setShowScanModal(false)}
            style={{
              position: 'fixed', inset: 0,
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
              style={{ maxWidth: 380, width: '100%', textAlign: 'center', position: 'relative' }}
            >
              <button
                onClick={() => setShowScanModal(false)}
                style={{
                  position: 'absolute', top: 12, right: 12,
                  width: 32, height: 32, borderRadius: 8,
                  background: 'var(--surface-2)', border: 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', color: 'var(--text)',
                }}
              >
                <X size={18} />
              </button>
              <div style={{
                width: 80, height: 80,
                margin: '0 auto 16px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff',
              }}>
                <Camera size={40} strokeWidth={2} />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>สแกน Barcode / QR</h3>
              <p style={{ color: 'var(--text-dim)', fontSize: 13, marginBottom: 16 }}>
                จะเปิดกล้องอ่าน IMEI / Barcode / QR Code
              </p>
              <button className="v3-btn v3-btn-primary" style={{ width: '100%' }}>
                <Camera size={16} />
                เปิดกล้องสแกน
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
