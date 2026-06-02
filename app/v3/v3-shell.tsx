'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';
import {
  Home, Smartphone, Wrench, ShoppingBag, ShoppingCart, Hammer, Coins, CreditCard,
  Users, BarChart3, Settings, Menu, Bell, MapPin, Search,
  Package, Camera, ChevronDown, X, LogOut, Building2, Crown, Plus, TrendingUp,
} from 'lucide-react';

interface Profile {
  id: string;
  username: string;
  full_name: string | null;
  role: string;
  branch_id: string | null;
  shop_id: string | null;
  is_super_admin: boolean;
  branches?: any;
  shops?: any;
}

const MENU = [
  { Icon: Home, label: 'หน้าหลัก', path: '/v3/home' },
  { Icon: Smartphone, label: 'สต๊อกเครื่อง', path: '/v3/stock' },
  { Icon: ShoppingCart, label: 'ขายสินค้า', path: '/v3/sell' },
  { Icon: Wrench, label: 'อะไหล่ซ่อม', path: '/v3/parts' },
  { Icon: Hammer, label: 'ใบงานซ่อม', path: '/v3/repair' },
  { Icon: ShoppingBag, label: 'อุปกรณ์เสริม', path: '/v3/goods' },
  { Icon: Coins, label: 'รับจำนำ', path: '/v3/pawn' },
  { Icon: CreditCard, label: 'ผ่อนชำระ', path: '/v3/installment' },
  { Icon: BarChart3, label: 'ประวัติทั้งหมด', path: '/v3/history' },
  { Icon: TrendingUp, label: 'รายงาน', path: '/v3/reports' },
  { Icon: Building2, label: 'จัดการผู้ใช้', path: '/v3/users', adminOnly: true },
  { Icon: Settings, label: 'ตั้งค่า', path: '/v3/settings' },
];

export default function V3Shell({
  profile,
  children,
}: {
  profile: Profile;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showScanModal, setShowScanModal] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  const isAdmin = profile.role === 'admin' || profile.is_super_admin;

  // Apply v3 theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'modern-blue');
    return () => {
      document.documentElement.setAttribute('data-theme', 'light');
    };
  }, []);

  // Detect mobile
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 1024);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Close profile menu on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setProfileMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close sidebar on navigation
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  const currentPage = MENU.find(m => pathname?.startsWith(m.path)) || MENU[0];
  const CurrentIcon = currentPage.Icon;
  const visibleMenu = MENU.filter(m => !m.adminOnly || isAdmin);

  const initial = (profile.full_name || profile.username || '?').charAt(0).toUpperCase();

  return (
    <>
      <div className="v3-app">
        {/* Sidebar */}
        <aside className={`v3-sidebar ${sidebarOpen ? 'open' : ''}`}>
          <div className="v3-sidebar-brand">
            <div className="v3-sidebar-brand-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="white" strokeWidth="2" strokeLinejoin="round"/>
                <path d="M2 17L12 22L22 17" stroke="white" strokeWidth="2" strokeLinejoin="round"/>
                <path d="M2 12L12 17L22 12" stroke="white" strokeWidth="2" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <div className="v3-sidebar-brand-text">CARE</div>
              <div className="v3-sidebar-brand-sub">MOBILE</div>
            </div>
          </div>

          <nav className="v3-sidebar-nav">
            {visibleMenu.map(item => {
              const ItemIcon = item.Icon;
              const active = pathname?.startsWith(item.path);
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={`v3-sidebar-item ${active ? 'active' : ''}`}
                >
                  <ItemIcon size={20} strokeWidth={2} />
                  <span>{item.label}</span>
                </Link>
              );
            })}

            {profile.is_super_admin && (
              <Link href="/super-admin" className="v3-sidebar-item">
                <Crown size={20} strokeWidth={2} />
                <span>Super Admin</span>
              </Link>
            )}
          </nav>

          <div className="v3-sidebar-profile">
            <div className="v3-sidebar-profile-avatar">{initial}</div>
            <div className="v3-sidebar-profile-info">
              <div className="v3-sidebar-profile-name">
                {profile.full_name || profile.username}
              </div>
              <div className="v3-sidebar-profile-role">
                {(profile.shops?.name || profile.shops?.[0]?.name || '')} · {(profile.branches?.name || profile.branches?.[0]?.name || '')}
              </div>
            </div>
          </div>
        </aside>

        {/* Mobile backdrop */}
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
          {/* Desktop Header */}
          {!isMobile && (
            <header className="v3-header">
              <div className="v3-header-search">
                <Search 
                  size={18} 
                  style={{ 
                    position: 'absolute', 
                    left: 14, 
                    top: '50%', 
                    transform: 'translateY(-50%)', 
                    color: 'var(--text-muted)',
                    pointerEvents: 'none',
                  }} 
                />
                <input type="text" placeholder="ค้นหา IMEI, รุ่น, ลูกค้า..." />
              </div>
              <div className="v3-header-actions">
                <button className="v3-header-branch">
                  <MapPin size={14} />
                  {profile.branches?.name || profile.branches?.[0]?.name || 'สาขาหลัก'}
                  <ChevronDown size={12} />
                </button>
                <button className="v3-header-btn">
                  <Bell size={18} />
                </button>
                <div ref={profileMenuRef} style={{ position: 'relative' }}>
                  <button 
                    className="v3-header-btn"
                    onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                    style={{
                      width: 'auto',
                      padding: '0 12px',
                      gap: 8,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <div style={{
                      width: 26, height: 26,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 12,
                      fontWeight: 700,
                    }}>{initial}</div>
                    <ChevronDown size={12} />
                  </button>
                  {profileMenuOpen && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      right: 0,
                      marginTop: 6,
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius)',
                      boxShadow: 'var(--shadow-lg)',
                      minWidth: 200,
                      padding: 6,
                      zIndex: 100,
                    }}>
                      <div style={{
                        padding: '10px 12px',
                        borderBottom: '1px solid var(--border)',
                        marginBottom: 4,
                      }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>
                          {profile.full_name || profile.username}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                          @{profile.username}
                        </div>
                      </div>
                      <Link
                        href="/v3/settings"
                        onClick={() => setProfileMenuOpen(false)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '8px 12px',
                          borderRadius: 6,
                          textDecoration: 'none',
                          color: 'var(--text)',
                          fontSize: 13,
                        }}
                      >
                        <Settings size={14} /> ตั้งค่า
                      </Link>
                      <button
                        onClick={handleLogout}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '8px 12px',
                          width: '100%',
                          background: 'transparent',
                          border: 'none',
                          borderRadius: 6,
                          color: 'var(--danger)',
                          fontSize: 13,
                          fontFamily: 'inherit',
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                      >
                        <LogOut size={14} /> ออกจากระบบ
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </header>
          )}

          {/* Mobile Header */}
          {isMobile && (
            <header className="v3-mobile-header">
              <button className="v3-mobile-header-back" onClick={() => setSidebarOpen(true)}>
                <Menu size={20} />
              </button>
              <div className="v3-mobile-header-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CurrentIcon size={18} strokeWidth={2.2} />
                {currentPage.label}
              </div>
              <button className="v3-mobile-header-back" onClick={handleLogout}>
                <LogOut size={18} />
              </button>
            </header>
          )}

          {/* Content */}
          <div className={isMobile ? 'v3-mobile-content' : 'v3-content'}>
            {children}
          </div>
        </div>

        {/* Mobile Bottom Nav */}
        <nav className="v3-bottom-nav">
          <Link
            href="/v3/home"
            className={`v3-bottom-nav-item ${pathname === '/v3/home' ? 'active' : ''}`}
          >
            <Home size={22} strokeWidth={pathname === '/v3/home' ? 2.4 : 2} />
            <span>หน้าหลัก</span>
          </Link>
          <Link
            href="/v3/stock"
            className={`v3-bottom-nav-item ${pathname?.startsWith('/v3/stock') ? 'active' : ''}`}
          >
            <Package size={22} strokeWidth={pathname?.startsWith('/v3/stock') ? 2.4 : 2} />
            <span>สต๊อก</span>
          </Link>

          <div className="v3-bottom-nav-item-scan-placeholder">
            <Camera size={22} />
            <span>Scan</span>
          </div>

          <Link
            href="/v3/repair"
            className={`v3-bottom-nav-item ${pathname?.startsWith('/v3/repair') ? 'active' : ''}`}
          >
            <Hammer size={22} strokeWidth={pathname?.startsWith('/v3/repair') ? 2.4 : 2} />
            <span>งานซ่อม</span>
          </Link>
          <button
            className="v3-bottom-nav-item"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={22} strokeWidth={2} />
            <span>เมนู</span>
          </button>
        </nav>

        {/* Floating Scan FAB */}
        <button className="v3-scan-fab" onClick={() => setShowScanModal(true)}>
          <Camera size={26} strokeWidth={2.2} />
        </button>

        {/* Action Sheet - Quick Actions */}
        {showScanModal && (
          <div
            onClick={() => setShowScanModal(false)}
            className="v3-action-sheet-overlay"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="v3-action-sheet"
            >
              {/* Drag handle (mobile only) */}
              <div className="v3-action-sheet-handle" />

              <div style={{ padding: '8px 20px 20px' }}>
                <h3 style={{
                  fontSize: 16, fontWeight: 700,
                  fontFamily: 'Prompt, Sarabun, sans-serif',
                  textAlign: 'center',
                  marginBottom: 4,
                  color: 'var(--text)',
                }}>
                  เลือกสิ่งที่จะทำ
                </h3>
                <p style={{
                  fontSize: 11,
                  color: 'var(--text-dim)',
                  textAlign: 'center',
                  marginBottom: 18,
                }}>
                  ทางลัดสำหรับสแกน / เพิ่มเครื่อง
                </p>

                {/* Section: เครื่อง */}
                <div style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: 'var(--text-dim)',
                  textTransform: 'uppercase',
                  letterSpacing: 0.6,
                  marginBottom: 8,
                }}>
                  📱 มือถือ / เครื่อง
                </div>
                <div className="v3-action-grid">
                  <ActionTile
                    Icon={ShoppingCart}
                    label="ขายเครื่อง"
                    color="#22c55e"
                    href="/v3/sell"
                    onClick={() => setShowScanModal(false)}
                  />
                  <ActionTile
                    Icon={Plus}
                    label="เพิ่มเครื่อง"
                    color="#3b82f6"
                    href="/v3/stock?add=1"
                    onClick={() => setShowScanModal(false)}
                  />
                  <ActionTile
                    Icon={Coins}
                    label="รับจำนำ"
                    color="#f59e0b"
                    href="/dashboard/pawn/add"
                    onClick={() => setShowScanModal(false)}
                  />
                  <ActionTile
                    Icon={CreditCard}
                    label="ผ่อนเครื่อง"
                    color="#8b5cf6"
                    href="/dashboard/installment/add"
                    onClick={() => setShowScanModal(false)}
                  />
                </div>

                {/* Section: สต๊อกของ */}
                <div style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: 'var(--text-dim)',
                  textTransform: 'uppercase',
                  letterSpacing: 0.6,
                  marginTop: 16,
                  marginBottom: 8,
                }}>
                  📦 อุปกรณ์เสริม / อะไหล่
                </div>
                <div className="v3-action-grid">
                  <ActionTile
                    Icon={ShoppingBag}
                    label="ขายของ"
                    color="#06b6d4"
                    href="/dashboard/goods/sell"
                    onClick={() => setShowScanModal(false)}
                  />
                  <ActionTile
                    Icon={Package}
                    label="ขายอะไหล่"
                    color="#ef4444"
                    href="/dashboard/parts/sell"
                    onClick={() => setShowScanModal(false)}
                  />
                </div>

                {/* Cancel button */}
                <button
                  onClick={() => setShowScanModal(false)}
                  style={{
                    width: '100%',
                    marginTop: 18,
                    padding: '13px',
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--text-dim)',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  ยกเลิก
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function ActionTile({ Icon, label, color, href, onClick }: any) {
  return (
    <Link
      href={href}
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: '14px 8px',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        textDecoration: 'none',
        color: 'var(--text)',
        fontSize: 12,
        fontWeight: 600,
        transition: 'all 0.15s',
      }}
    >
      <div style={{
        width: 44, height: 44,
        borderRadius: 12,
        background: `${color}15`,
        color: color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={22} strokeWidth={2.2} />
      </div>
      <span style={{ textAlign: 'center' }}>{label}</span>
    </Link>
  );
}
