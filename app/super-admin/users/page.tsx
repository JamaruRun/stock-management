'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-client';

interface UserRow {
  id: string;
  username: string;
  full_name: string | null;
  role: string;
  shop_id: string;
  shop_name?: string;
  branch_name?: string;
  last_seen_at: string | null;
  is_super_admin: boolean;
}

export default function SuperAdminUsersPage() {
  const supabase = createClient();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState<'all' | 'admin' | 'staff'>('all');

  // Edit modal
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'danger' } | null>(null);

  function showToast(msg: string, type: 'success' | 'danger' = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select(`
        id, username, full_name, role, shop_id, last_seen_at, is_super_admin,
        shops(name),
        branches(name)
      `)
      .order('shop_id', { ascending: true });

    const mapped: UserRow[] = (data || []).map((u: any) => ({
      id: u.id,
      username: u.username,
      full_name: u.full_name,
      role: u.role,
      shop_id: u.shop_id,
      shop_name: u.shops?.name || '-',
      branch_name: u.branches?.name || '-',
      last_seen_at: u.last_seen_at,
      is_super_admin: u.is_super_admin || false,
    }));

    setUsers(mapped);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    let result = users;
    if (filterRole !== 'all') {
      result = result.filter(u => u.role === filterRole);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(u =>
        u.username?.toLowerCase().includes(q) ||
        u.full_name?.toLowerCase().includes(q) ||
        u.shop_name?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [users, filterRole, search]);

  function openEdit(u: UserRow) {
    setEditing(u);
    setNewUsername(u.username || '');
    setNewPassword('');
    setNewFullName(u.full_name || '');
    setError('');
  }

  function closeEdit() {
    setEditing(null);
    setNewUsername('');
    setNewPassword('');
    setNewFullName('');
    setError('');
  }

  async function handleSave() {
    if (!editing) return;
    setError('');
    setSaving(true);

    const payload: any = { userId: editing.id };

    if (newFullName !== editing.full_name) {
      payload.full_name = newFullName;
    }

    if (newUsername !== editing.username) {
      payload.username = newUsername;
    }

    if (newPassword) {
      if (newPassword.length < 6) {
        setError('รหัสผ่านต้องอย่างน้อย 6 ตัว');
        setSaving(false);
        return;
      }
      payload.password = newPassword;
    }

    if (Object.keys(payload).length === 1) {
      setError('ไม่มีอะไรเปลี่ยน');
      setSaving(false);
      return;
    }

    try {
      const res = await fetch('/api/super-admin/update-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      setSaving(false);

      if (!res.ok) {
        setError(data.error || 'เกิดข้อผิดพลาด');
        return;
      }

      showToast('บันทึกสำเร็จ', 'success');
      closeEdit();
      load();
    } catch (e: any) {
      setSaving(false);
      setError('เกิดข้อผิดพลาด: ' + e.message);
    }
  }

  async function handleImpersonate(u: UserRow) {
    if (u.is_super_admin) {
      showToast('ไม่สามารถ login as super admin', 'danger');
      return;
    }

    const confirm1 = confirm(
      `🔐 Login เป็น ${u.full_name || u.username}?\n\n` +
      `🏪 ร้าน: ${u.shop_name}\n` +
      `👤 Role: ${u.role}\n\n` +
      `⚠️ คำเตือน:\n` +
      `• คุณจะ logout จากบัญชี super admin\n` +
      `• ทุก action จะเกิดในชื่อ user นี้\n` +
      `• เมื่อเสร็จต้อง login กลับเป็น super admin\n\n` +
      `ดำเนินการต่อ?`
    );

    if (!confirm1) return;

    showToast('กำลัง login as ...', 'success');

    try {
      const res = await fetch('/api/super-admin/impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: u.id }),
      });

      const data = await res.json();

      if (!res.ok) {
        showToast('ไม่สำเร็จ: ' + (data.error || ''), 'danger');
        return;
      }

      // Redirect ไป magic link → จะ login เป็น user นั้น
      window.location.href = data.action_link;
    } catch (e: any) {
      showToast('เกิดข้อผิดพลาด: ' + e.message, 'danger');
    }
  }

  function timeAgo(dateStr: string | null) {
    if (!dateStr) return 'ไม่เคย';
    const s = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (s < 60) return 'เมื่อสักครู่';
    if (s < 3600) return `${Math.floor(s/60)} นาทีก่อน`;
    if (s < 86400) return `${Math.floor(s/3600)} ชม.ก่อน`;
    const days = Math.floor(s / 86400);
    if (days < 30) return `${days} วันก่อน`;
    return `${Math.floor(days/30)} เดือนก่อน`;
  }

  return (
    <>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div>
          <h1>👥 จัดการ Users ทั้งหมด</h1>
          <div className="desc">ดู • เปลี่ยน Username • รีเซ็ตรหัสผ่าน • ของทุกร้าน</div>
        </div>
        <Link href="/super-admin" style={{
          padding: '8px 14px',
          background: 'var(--surface-2)',
          color: 'var(--text)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          fontSize: 12,
          textDecoration: 'none',
        }}>← กลับ</Link>
      </div>

      {/* Search + Filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍 ค้นหา: username / ชื่อ / ร้าน"
          style={{
            flex: 1,
            minWidth: 200,
            padding: 12,
            fontSize: 14,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            color: 'var(--text)',
            fontFamily: 'inherit',
          }}
        />
        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value as any)}
          style={{
            padding: 12,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            color: 'var(--text)',
            fontFamily: 'inherit',
            fontSize: 13,
          }}
        >
          <option value="all">ทุกบทบาท</option>
          <option value="admin">👑 Admin</option>
          <option value="staff">👤 Staff</option>
        </select>
      </div>

      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 8 }}>
        แสดง {filtered.length} users
      </div>

      {loading ? (
        <div className="skeleton" style={{ height: 200 }}></div>
      ) : filtered.length === 0 ? (
        <div className="form-card">
          <div className="empty">
            <div className="empty-icon" style={{ opacity: 0.3 }}>👥</div>
            <div className="empty-title">ไม่พบ users</div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(u => (
            <div
              key={u.id}
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderLeft: `3px solid ${u.is_super_admin ? '#8b5cf6' : u.role === 'admin' ? '#f59e0b' : '#10b981'}`,
                borderRadius: 'var(--radius-sm)',
                padding: 12,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>
                    {u.is_super_admin ? '🔱' : u.role === 'admin' ? '👑' : '👤'} {u.full_name || u.username}
                  </span>
                  {u.is_super_admin && (
                    <span style={{
                      fontSize: 9,
                      padding: '2px 6px',
                      background: '#8b5cf620',
                      color: '#8b5cf6',
                      borderRadius: 4,
                      fontWeight: 700,
                    }}>SUPER ADMIN</span>
                  )}
                </div>
                <div style={{
                  fontSize: 11,
                  color: 'var(--text-dim)',
                  fontFamily: 'monospace',
                  marginBottom: 2,
                }}>
                  @{u.username}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                  🏪 {u.shop_name} · 📍 {u.branch_name} · 🕐 {timeAgo(u.last_seen_at)}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button
                  onClick={() => handleImpersonate(u)}
                  disabled={u.is_super_admin}
                  title={u.is_super_admin ? 'Login as ตัวเองไม่ได้' : 'Login เป็น user นี้'}
                  style={{
                    padding: '8px 12px',
                    background: u.is_super_admin ? 'var(--surface-2)' : '#8b5cf6',
                    color: u.is_super_admin ? 'var(--text-dim)' : '#fff',
                    border: 'none',
                    borderRadius: 6,
                    cursor: u.is_super_admin ? 'not-allowed' : 'pointer',
                    fontSize: 11,
                    fontWeight: 600,
                    fontFamily: 'inherit',
                    whiteSpace: 'nowrap',
                  }}
                >
                  🔐 Login as
                </button>
                <button
                  onClick={() => openEdit(u)}
                  style={{
                    padding: '8px 12px',
                    background: 'var(--accent)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontSize: 11,
                    fontWeight: 600,
                    fontFamily: 'inherit',
                    whiteSpace: 'nowrap',
                  }}
                >
                  ✏️ แก้ไข
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Modal */}
      {editing && (
        <div className="modal-overlay" onClick={closeEdit}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <div>
                <h3 style={{ margin: 0 }}>✏️ แก้ไข User</h3>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-dim)' }}>
                  🏪 {editing.shop_name}
                </p>
              </div>
              <button onClick={closeEdit} style={{
                background: 'var(--surface-2)',
                border: 'none',
                borderRadius: '50%',
                width: 30,
                height: 30,
                cursor: 'pointer',
                fontSize: 13,
                color: 'var(--text)',
                fontFamily: 'inherit',
              }}>✕</button>
            </div>

            {error && (
              <div style={{
                padding: 10,
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: 6,
                color: '#dc2626',
                fontSize: 12,
                marginBottom: 12,
              }}>
                ⚠️ {error}
              </div>
            )}

            <div className="form-grid">
              <div className="field full">
                <label>ชื่อ-นามสกุล</label>
                <input
                  type="text"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                />
              </div>

              <div className="field full">
                <label>
                  Username (เข้าระบบ)
                  {editing.is_super_admin && (
                    <span style={{ fontSize: 11, color: '#ef4444', marginLeft: 6 }}>
                      ⚠️ Super Admin - ระวังเปลี่ยน
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  placeholder={editing.username}
                  style={{
                    fontFamily: 'monospace',
                    background: newUsername !== editing.username ? 'rgba(59, 130, 246, 0.08)' : undefined,
                  }}
                  maxLength={30}
                />
                <small style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                  a-z, 0-9, _ • อย่างน้อย 3 ตัว
                  {newUsername !== editing.username && (
                    <span style={{ color: '#3b82f6', marginLeft: 6 }}>
                      ⚠️ จะเปลี่ยน {editing.username} → {newUsername}
                    </span>
                  )}
                </small>
              </div>

              <div className="field full">
                <label>รหัสผ่านใหม่ (เว้นว่าง = ไม่เปลี่ยน)</label>
                <input
                  type="text"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••"
                  style={{ fontFamily: 'monospace' }}
                />
              </div>
            </div>

            <div style={{
              padding: 10,
              background: 'rgba(245, 158, 11, 0.08)',
              borderLeft: '3px solid #f59e0b',
              borderRadius: 6,
              fontSize: 11,
              color: '#92400e',
              marginTop: 14,
              lineHeight: 1.5,
            }}>
              ⚠️ <strong>หมายเหตุ:</strong> เปลี่ยน username แล้วลูกค้าต้องใช้ username ใหม่ตอน login • บอกลูกค้าก่อนทุกครั้ง
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button onClick={closeEdit} className="btn btn-sec" disabled={saving}>
                ยกเลิก
              </button>
              <button onClick={handleSave} className="btn" disabled={saving}>
                {saving ? '⏳ กำลังบันทึก...' : '💾 บันทึก'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{
          position: 'fixed',
          bottom: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '12px 20px',
          background: toast.type === 'success' ? '#10b981' : '#ef4444',
          color: '#fff',
          borderRadius: 8,
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          zIndex: 9999,
          fontSize: 13,
          fontWeight: 600,
        }}>
          {toast.msg}
        </div>
      )}
    </>
  );
}
