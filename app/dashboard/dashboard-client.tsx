'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';
import { useState } from 'react';

interface Props {
  profile: any;
  children: React.ReactNode;
}

type Module = 'stock' | 'pawn' | 'installment' | 'users';

export default function DashboardClient({ profile, children }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [showLogout, setShowLogout] = useState(false);
  const [showModuleMenu, setShowModuleMenu] = useState(false);

  const isAdmin = profile.role === 'admin';

  // ตรวจว่าอยู่ใน module ไหน
  const currentModule: Module = pathname.startsWith('/dashboard/pawn')
    ? 'pawn'
    : pathname.startsWith('/dashboard/installment')
    ? 'installment'
    : pathname.startsWith('/dashboard/users')
    ? 'users'
    : 'stock';

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  // เมนูของแต่ละ module
  const stockNav = [
    { path: '/dashboard/add', icon: '+', label: 'เพิ่ม' },
    { path: '/dashboard/sell', icon: '→', label: 'ขาย' },
    { path: '/dashboard/stock', icon: '▦', label: 'สต๊อก' },
    ...(isAdmin ? [{ path: '/dashboard/history', icon: '⌛', label: 'ประวัติ', adminOnly: true }] : []),
  ];

  const pawnNav = [
    { path: '/dashboard/pawn/add', icon: '+', label: 'รับจำนำ' },
    { path: '/dashboard/pawn/redeem', icon: '→', label: 'ไถ่คืน' },
    { path: '/dashboard/pawn/stock', icon: '▦', label: 'สต๊อก' },
    ...(isAdmin ? [{ path: '/dashboard/pawn/history', icon: '⌛', label: 'ประวัติ', adminOnly: true }] : []),
  ];

  const installmentNav = [
    { path: '/dashboard/installment/add', icon: '+', label: 'เพิ่มผ่อน' },
    { path: '/dashboard/installment/stock', icon: '▦', label: 'สต๊อก' },
    ...(isAdmin ? [{ path: '/dashboard/installment/history', icon: '⌛', label: 'ประวัติ', adminOnly: true }] : []),
  ];

  const usersNav = [
    { path: '/dashboard/users', icon: '⚙', label: 'ผู้ใช้' },
  ];

  const navItems = currentModule === 'pawn' 
    ? pawnNav 
    : currentModule === 'installment'
    ? installmentNav
    : currentModule === 'users' 
    ? usersNav 
    : stockNav;

  const moduleInfo = {
    stock: { icon: '📦', label: 'สต๊อกเครื่อง', color: 'var(--accent)' },
    pawn: { icon: '💰', label: 'จำนำเครื่อง', color: '#ffa502' },
    installment: { icon: '💳', label: 'ผ่อนเครื่อง', color: '#3742fa' },
    users: { icon: '👥', label: 'จัดการผู้ใช้', color: '#3742fa' },
  };

  function switchModule(m: Module) {
    setShowModuleMenu(false);
    if (m === 'stock') router.push('/dashboard/stock');
    if (m === 'pawn') router.push('/dashboard/pawn/stock');
    if (m === 'installment') router.push('/dashboard/installment/stock');
    if (m === 'users') router.push('/dashboard/users');
  }

  return (
    <>
      <header className="top-header">
        <div className="header-brand">
          <button
            className="module-switcher"
            onClick={() => setShowModuleMenu(true)}
            title="เปลี่ยนโมดูล"
          >
            <span className="module-icon">{moduleInfo[currentModule].icon}</span>
            <span className="module-label">{moduleInfo[currentModule].label}</span>
            <span className="module-arrow">▾</span>
          </button>
        </div>
        <div className="header-user">
          <div className="user-info">
            <div className="name">{profile.full_name}</div>
            <div className={`role ${profile.role}`}>{profile.role.toUpperCase()}</div>
            {profile.branches?.name && <div className="branch">{profile.branches.name}</div>}
          </div>
          <button className="logout-btn" onClick={() => setShowLogout(true)}>
            <span>⏻</span>
            <span>ออก</span>
          </button>
        </div>
      </header>

      {/* Desktop: tab to switch modules */}
      <div className="module-tabs">
        <div className="module-tabs-inner">
          <button
            className={`module-tab ${currentModule === 'stock' ? 'active' : ''}`}
            onClick={() => switchModule('stock')}
          >
            <span>📦</span>
            <span>สต๊อกเครื่อง</span>
          </button>
          <button
            className={`module-tab ${currentModule === 'pawn' ? 'active' : ''}`}
            onClick={() => switchModule('pawn')}
          >
            <span>💰</span>
            <span>จำนำเครื่อง</span>
          </button>
          <button
            className={`module-tab ${currentModule === 'installment' ? 'active' : ''}`}
            onClick={() => switchModule('installment')}
          >
            <span>💳</span>
            <span>ผ่อนเครื่อง</span>
          </button>
          {isAdmin && (
            <button
              className={`module-tab ${currentModule === 'users' ? 'active' : ''}`}
              onClick={() => switchModule('users')}
            >
              <span>👥</span>
              <span>จัดการผู้ใช้</span>
            </button>
          )}
        </div>
      </div>

      {/* Bottom nav: items in current module */}
      <nav className="bottom-nav">
        {navItems.map((item) => {
          const active = pathname === item.path;
          return (
            <Link
              key={item.path}
              href={item.path}
              className={`nav-item ${active ? 'active' : ''} ${(item as any).adminOnly ? 'admin-only' : ''}`}
            >
              {(item as any).adminOnly && <span className="admin-badge">ADMIN</span>}
              <span className="icon">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <main className="main">{children}</main>

      {/* Module Switcher Modal (mobile) */}
      {showModuleMenu && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowModuleMenu(false)}>
          <div className="modal">
            <h3>เลือกโมดูล</h3>
            <p className="modal-sub">เลือกระบบที่ต้องการใช้งาน</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
              <button
                className="module-option"
                onClick={() => switchModule('stock')}
                style={{ borderColor: currentModule === 'stock' ? 'var(--accent)' : 'var(--border)' }}
              >
                <span style={{ fontSize: 24 }}>📦</span>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div style={{ fontWeight: 600 }}>สต๊อกเครื่อง</div>
                  <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                    เพิ่ม / ขาย / ดูสต๊อก / ประวัติการขาย
                  </div>
                </div>
                {currentModule === 'stock' && <span style={{ color: 'var(--accent)' }}>✓</span>}
              </button>

              <button
                className="module-option"
                onClick={() => switchModule('pawn')}
                style={{ borderColor: currentModule === 'pawn' ? 'var(--accent)' : 'var(--border)' }}
              >
                <span style={{ fontSize: 24 }}>💰</span>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div style={{ fontWeight: 600 }}>จำนำเครื่อง</div>
                  <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                    รับจำนำ / ไถ่คืน / สต๊อกจำนำ / ประวัติ
                  </div>
                </div>
                {currentModule === 'pawn' && <span style={{ color: 'var(--accent)' }}>✓</span>}
              </button>

              <button
                className="module-option"
                onClick={() => switchModule('installment')}
                style={{ borderColor: currentModule === 'installment' ? 'var(--accent)' : 'var(--border)' }}
              >
                <span style={{ fontSize: 24 }}>💳</span>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div style={{ fontWeight: 600 }}>ผ่อนเครื่อง</div>
                  <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                    เพิ่มผ่อน / สต๊อกผ่อน / ประวัติ
                  </div>
                </div>
                {currentModule === 'installment' && <span style={{ color: 'var(--accent)' }}>✓</span>}
              </button>

              {isAdmin && (
                <button
                  className="module-option"
                  onClick={() => switchModule('users')}
                  style={{ borderColor: currentModule === 'users' ? 'var(--accent)' : 'var(--border)' }}
                >
                  <span style={{ fontSize: 24 }}>👥</span>
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <div style={{ fontWeight: 600 }}>จัดการผู้ใช้ <span style={{ color: 'var(--accent)', fontSize: 10 }}>[ADMIN]</span></div>
                    <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                      เพิ่ม/ลบ พนักงานและสาขา
                    </div>
                  </div>
                  {currentModule === 'users' && <span style={{ color: 'var(--accent)' }}>✓</span>}
                </button>
              )}
            </div>
            <button className="btn btn-sec" onClick={() => setShowModuleMenu(false)}>
              ยกเลิก
            </button>
          </div>
        </div>
      )}

      {showLogout && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowLogout(false)}>
          <div className="modal">
            <h3>ออกจากระบบ?</h3>
            <p className="modal-sub">คุณต้องการออกจากระบบใช่หรือไม่</p>
            <div className="modal-actions">
              <button className="btn btn-danger" onClick={handleLogout}>
                ออกจากระบบ
              </button>
              <button className="btn btn-sec" onClick={() => setShowLogout(false)}>
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
