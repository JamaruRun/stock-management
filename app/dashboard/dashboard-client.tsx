'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-client';
import ThemeSwitcher from '@/components/ThemeSwitcher';
import TrialBanner from '@/components/TrialBanner';
import UpdatePopup from '@/components/UpdatePopup';

interface Props {
  profile: any;
  children: React.ReactNode;
}

export default function DashboardClient({ profile, children }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showLogout, setShowLogout] = useState(false);
  const [showThemeSwitcher, setShowThemeSwitcher] = useState(false);

  const isAdmin = profile.role === 'admin';

  // Sidebar nav items
  const navItems = [
    { path: '/dashboard/home', icon: '🏠', label: 'หน้าหลัก' },
    { path: '/dashboard/stock', icon: '📱', label: 'สต๊อกเครื่อง' },
    { path: '/dashboard/pawn/stock', icon: '💰', label: 'จำนำ' },
    { path: '/dashboard/installment/stock', icon: '💳', label: 'ผ่อน' },
    { path: '/dashboard/goods/stock', icon: '🎒', label: 'สต๊อกของ' },
    { path: '/dashboard/parts', icon: '🔧', label: 'อะไหล่ซ่อม' },
    { path: '/dashboard/repair', icon: '🛠️', label: 'ใบงานซ่อม' },
  ];

  // Bottom nav (mobile - 5 items max)
  const bottomNavItems = [
    { path: '/dashboard/home', icon: '🏠', label: 'หน้าหลัก' },
    { path: '/dashboard/stock', icon: '📱', label: 'เครื่อง' },
    { path: '/dashboard/pawn/stock', icon: '💰', label: 'จำนำ' },
    { path: '/dashboard/installment/stock', icon: '💳', label: 'ผ่อน' },
    { path: '/dashboard/goods/stock', icon: '🎒', label: 'ของ' },
  ];

  function isActive(path: string) {
    if (path === '/dashboard/home') {
      return pathname === '/dashboard/home' || pathname === '/dashboard';
    }
    // ดูว่าอยู่ในโมดูลเดียวกันไหม
    const moduleRoot = path.split('/').slice(0, 3).join('/'); // /dashboard/pawn
    return pathname.startsWith(moduleRoot);
  }

  function getInitials(name: string) {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  // ชื่อหน้าจาก path
  function getPageTitle() {
    if (pathname.startsWith('/dashboard/home') || pathname === '/dashboard') return 'หน้าหลัก';
    if (pathname.startsWith('/dashboard/stock')) return 'สต๊อกเครื่อง';
    if (pathname.startsWith('/dashboard/add')) return 'เพิ่มเครื่อง';
    if (pathname.startsWith('/dashboard/sell')) return 'ขายเครื่อง';
    if (pathname.startsWith('/dashboard/history')) return 'ประวัติการขาย';
    if (pathname.startsWith('/dashboard/pawn')) return 'จำนำเครื่อง';
    if (pathname.startsWith('/dashboard/installment')) return 'ผ่อนเครื่อง';
    if (pathname.startsWith('/dashboard/goods')) return 'สต๊อกของ';
    if (pathname.startsWith('/dashboard/parts')) return 'อะไหล่ซ่อม';
    if (pathname.startsWith('/dashboard/repair')) return 'ใบงานซ่อม';
    if (pathname.startsWith('/dashboard/users')) return 'จัดการผู้ใช้';
    return 'หน้าหลัก';
  }

  return (
    <div className="app-layout">
      {/* Sidebar Backdrop (mobile) */}
      <div 
        className={`sidebar-backdrop ${sidebarOpen ? 'open' : ''}`}
        onClick={() => setSidebarOpen(false)}
      ></div>

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          {/* Brand */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 10,
            padding: '4px 0 14px',
            marginBottom: 12,
            borderBottom: '1px solid var(--border)',
          }}>
            <img 
              src="/icon-192.png" 
              alt="Stock"
              style={{ 
                width: 32, 
                height: 32, 
                borderRadius: 8,
                flexShrink: 0,
              }}
            />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ 
                fontSize: 13, 
                fontWeight: 700, 
                color: 'var(--text)',
                lineHeight: 1.1,
              }}>Stock Manager</div>
              <div style={{ 
                fontSize: 10, 
                color: 'var(--text-dim)',
                marginTop: 2,
              }}>ระบบจัดการร้าน</div>
            </div>
          </div>

          <div className="sidebar-shop">
            <div className="sidebar-shop-icon">🏪</div>
            <div className="sidebar-shop-info">
              <div className="sidebar-shop-name">{profile.shops?.name || 'ร้านของคุณ'}</div>
              <div className="sidebar-shop-sub">{profile.branches?.name || 'สาขาหลัก'}</div>
            </div>
          </div>
        </div>

        <div className="sidebar-section">
          <div className="sidebar-section-title">เมนู</div>
          <nav className="sidebar-nav">
            {navItems.map((item) => (
              <Link
                key={item.path}
                href={item.path}
                className={`sidebar-item ${isActive(item.path) ? 'active' : ''}`}
                onClick={() => setSidebarOpen(false)}
              >
                <span className="sidebar-item-icon">{item.icon}</span>
                <span className="sidebar-item-text">{item.label}</span>
              </Link>
            ))}
          </nav>
        </div>

        {isAdmin && (
          <div className="sidebar-section">
            <div className="sidebar-section-title">ประวัติ (Admin)</div>
            <nav className="sidebar-nav">
              <Link
                href="/dashboard/history"
                className={`sidebar-item ${pathname === '/dashboard/history' ? 'active' : ''}`}
                onClick={() => setSidebarOpen(false)}
              >
                <span className="sidebar-item-icon">📱</span>
                <span className="sidebar-item-text">ขายเครื่อง</span>
              </Link>
              <Link
                href="/dashboard/pawn/history"
                className={`sidebar-item ${pathname === '/dashboard/pawn/history' ? 'active' : ''}`}
                onClick={() => setSidebarOpen(false)}
              >
                <span className="sidebar-item-icon">💰</span>
                <span className="sidebar-item-text">จำนำ</span>
              </Link>
              <Link
                href="/dashboard/installment/history"
                className={`sidebar-item ${pathname === '/dashboard/installment/history' ? 'active' : ''}`}
                onClick={() => setSidebarOpen(false)}
              >
                <span className="sidebar-item-icon">💳</span>
                <span className="sidebar-item-text">ผ่อน</span>
              </Link>
              <Link
                href="/dashboard/goods/history"
                className={`sidebar-item ${pathname === '/dashboard/goods/history' ? 'active' : ''}`}
                onClick={() => setSidebarOpen(false)}
              >
                <span className="sidebar-item-icon">🎒</span>
                <span className="sidebar-item-text">ขายของ</span>
              </Link>
            </nav>
          </div>
        )}

        {isAdmin && (
          <div className="sidebar-section">
            <div className="sidebar-section-title">วิเคราะห์ (Admin)</div>
            <nav className="sidebar-nav">
              <Link
                href="/dashboard/reports"
                className={`sidebar-item ${pathname.startsWith('/dashboard/reports') ? 'active' : ''}`}
                onClick={() => setSidebarOpen(false)}
              >
                <span className="sidebar-item-icon">📊</span>
                <span className="sidebar-item-text">รายงาน</span>
              </Link>
              <Link
                href="/dashboard/backup"
                className={`sidebar-item ${pathname.startsWith('/dashboard/backup') ? 'active' : ''}`}
                onClick={() => setSidebarOpen(false)}
              >
                <span className="sidebar-item-icon">💾</span>
                <span className="sidebar-item-text">Backup</span>
              </Link>
            </nav>
          </div>
        )}

        {isAdmin && (
          <div className="sidebar-section">
            <div className="sidebar-section-title">จัดการ (Admin)</div>
            <nav className="sidebar-nav">
              <Link
                href="/dashboard/users"
                className={`sidebar-item ${pathname.startsWith('/dashboard/users') ? 'active' : ''}`}
                onClick={() => setSidebarOpen(false)}
              >
                <span className="sidebar-item-icon">👥</span>
                <span className="sidebar-item-text">ผู้ใช้</span>
              </Link>
              <Link
                href="/dashboard/suppliers"
                className={`sidebar-item ${pathname.startsWith('/dashboard/suppliers') ? 'active' : ''}`}
                onClick={() => setSidebarOpen(false)}
              >
                <span className="sidebar-item-icon">📋</span>
                <span className="sidebar-item-text">Supplier</span>
              </Link>
              <Link
                href="/dashboard/settings"
                className={`sidebar-item ${pathname.startsWith('/dashboard/settings') ? 'active' : ''}`}
                onClick={() => setSidebarOpen(false)}
              >
                <span className="sidebar-item-icon">⚙️</span>
                <span className="sidebar-item-text">ตั้งค่า</span>
              </Link>
            </nav>
          </div>
        )}

        {profile.is_super_admin && (
          <div className="sidebar-section">
            <div className="sidebar-section-title">Super Admin</div>
            <nav className="sidebar-nav">
              <Link
                href="/super-admin"
                className="sidebar-item"
                onClick={() => setSidebarOpen(false)}
              >
                <span className="sidebar-item-icon">👑</span>
                <span className="sidebar-item-text">จัดการระบบ</span>
              </Link>
            </nav>
          </div>
        )}

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-user-avatar">{getInitials(profile.full_name)}</div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{profile.full_name || 'User'}</div>
              <div className="sidebar-user-role">{isAdmin ? 'Admin' : 'Staff'}</div>
            </div>
            <button 
              className="sidebar-user-btn" 
              onClick={() => setShowThemeSwitcher(true)}
              title="เปลี่ยน Theme"
            >
              🎨
            </button>
            <button 
              className="sidebar-user-btn" 
              onClick={() => setShowLogout(true)}
              title="ออกจากระบบ"
            >
              🚪
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="main-content">
        {/* Top Bar */}
        <div className="top-bar">
          <div className="top-bar-left">
            <button 
              className="hamburger-btn" 
              onClick={() => setSidebarOpen(true)}
              aria-label="Menu"
            >
              ☰
            </button>
            <div className="top-bar-title">{getPageTitle()}</div>
          </div>
          <div className="top-bar-actions">
            <button 
              className="top-bar-btn"
              onClick={() => setShowThemeSwitcher(true)}
              title="เปลี่ยน Theme"
              style={{ display: 'flex' }}
            >
              🎨
            </button>
          </div>
        </div>

        {/* Page Content */}
        <div className="main-inner">
          <TrialBanner />
          {children}
          <UpdatePopup />
        </div>
      </div>

      {/* Bottom Nav (Mobile) */}
      <nav className="bottom-nav">
        <div className="bottom-nav-inner">
          {bottomNavItems.map((item) => (
            <Link
              key={item.path}
              href={item.path}
              className={`bottom-nav-item ${isActive(item.path) ? 'active' : ''}`}
            >
              <div className="bottom-nav-item-icon">{item.icon}</div>
              <div className="bottom-nav-item-text">{item.label}</div>
            </Link>
          ))}
        </div>
      </nav>

      {/* Logout Modal */}
      {showLogout && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowLogout(false)}>
          <div className="modal">
            <h3>ออกจากระบบ?</h3>
            <p className="modal-sub">คุณต้องการออกจากระบบใช่ไหม</p>
            <div className="modal-actions">
              <button className="btn btn-danger" onClick={handleLogout}>ออกจากระบบ</button>
              <button className="btn btn-sec" onClick={() => setShowLogout(false)}>ยกเลิก</button>
            </div>
          </div>
        </div>
      )}

      {/* Theme Switcher Modal */}
      {showThemeSwitcher && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowThemeSwitcher(false)}>
          <div className="modal">
            <h3>เปลี่ยน Theme</h3>
            <p className="modal-sub">เลือกธีมที่ต้องการ</p>
            <ThemeSwitcher onClose={() => setShowThemeSwitcher(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
