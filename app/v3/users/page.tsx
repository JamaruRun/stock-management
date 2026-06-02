'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';
import {
  Plus, Search, Users, MapPin, Shield,
  X, Trash2, MoreVertical, Crown, User,
  Building2, Phone, KeyRound, Lock,
} from 'lucide-react';

interface Profile {
  id: string;
  username: string;
  full_name: string | null;
  role: string;
  branch_id: string | null;
  shop_id: string | null;
  is_super_admin: boolean;
  created_at?: string;
  branches?: any;
}

interface Branch {
  id: string;
  name: string;
  address?: string | null;
  phone?: string | null;
}

export default function V3UsersPage() {
  const supabase = createClient();
  const router = useRouter();
  const [users, setUsers] = useState<Profile[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'users' | 'branches'>('users');
  const [activeRole, setActiveRole] = useState<'all' | 'admin' | 'staff'>('all');
  const [currentShopId, setCurrentShopId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [accessChecked, setAccessChecked] = useState(false);

  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [showAddUser, setShowAddUser] = useState(false);
  const [showAddBranch, setShowAddBranch] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [newUser, setNewUser] = useState({
    username: '', password: '', full_name: '',
    role: 'staff' as 'admin' | 'staff', branch_id: '',
  });
  const [newBranch, setNewBranch] = useState({ name: '', address: '', phone: '' });

  async function loadData() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }

      const { data: profileData } = await supabase
        .from('profiles')
        .select('role, shop_id, is_super_admin')
        .eq('id', user.id)
        .single();

      const admin = profileData?.role === 'admin' || profileData?.is_super_admin;
      setIsAdmin(!!admin);
      setAccessChecked(true);

      if (!admin) {
        setLoading(false);
        return;
      }

      setCurrentShopId(profileData?.shop_id || null);

      const [u, b] = await Promise.all([
        supabase.from('profiles').select('*, branches(name)').order('created_at', { ascending: false }),
        supabase.from('branches').select('*').order('created_at', { ascending: true }),
      ]);

      setUsers((u.data || []) as Profile[]);
      setBranches((b.data || []) as Branch[]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  const counts = useMemo(() => ({
    all: users.length,
    admin: users.filter(u => u.role === 'admin').length,
    staff: users.filter(u => u.role === 'staff').length,
    branches: branches.length,
  }), [users, branches]);

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      if (activeRole !== 'all' && u.role !== activeRole) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!u.username.toLowerCase().includes(s) &&
            !(u.full_name || '').toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [users, activeRole, search]);

  const filteredBranches = useMemo(() => {
    return branches.filter(b => {
      if (search) {
        const s = search.toLowerCase();
        if (!b.name.toLowerCase().includes(s) &&
            !(b.address || '').toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [branches, search]);

  async function handleAddUser(e: React.FormEvent) {
    e.preventDefault();
    if (!newUser.username || !newUser.password || !newUser.full_name || !newUser.branch_id) {
      alert('กรุณากรอกข้อมูลให้ครบ');
      return;
    }
    if (newUser.password.length < 6) {
      alert('รหัสผ่านต้องมีอย่างน้อย 6 ตัว');
      return;
    }

    setSubmitting(true);
    const res = await fetch('/api/admin/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newUser),
    });
    const result = await res.json().catch(() => ({}));
    setSubmitting(false);

    if (!res.ok) {
      alert('เพิ่มไม่สำเร็จ: ' + (result.error || ''));
      return;
    }

    alert(`สร้างบัญชี ${newUser.username} แล้ว`);
    setNewUser({ username: '', password: '', full_name: '', role: 'staff', branch_id: '' });
    setShowAddUser(false);
    loadData();
  }

  async function handleAddBranch(e: React.FormEvent) {
    e.preventDefault();
    if (!newBranch.name) { alert('กรุณาใส่ชื่อสาขา'); return; }
    if (!currentShopId) { alert('ไม่พบข้อมูลร้าน'); return; }

    setSubmitting(true);
    const { error } = await supabase.from('branches').insert({
      ...newBranch,
      shop_id: currentShopId,
    });
    setSubmitting(false);

    if (error) { alert('เพิ่มไม่สำเร็จ: ' + error.message); return; }
    alert(`สร้างสาขา ${newBranch.name} แล้ว`);
    setNewBranch({ name: '', address: '', phone: '' });
    setShowAddBranch(false);
    loadData();
  }

  async function handleDeleteUser(user: Profile) {
    if (!confirm(`ลบผู้ใช้ ${user.username}?\n\nย้อนกลับไม่ได้`)) return;
    setMenuOpenId(null);

    const res = await fetch('/api/admin/delete-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert('ลบไม่สำเร็จ: ' + (data.error || ''));
      return;
    }
    loadData();
  }

  async function handleResetPassword(user: Profile) {
    const newPass = prompt(`ตั้งรหัสผ่านใหม่สำหรับ ${user.username}\n(อย่างน้อย 6 ตัว)`);
    if (!newPass) return;
    if (newPass.length < 6) { alert('รหัสผ่านต้องมีอย่างน้อย 6 ตัว'); return; }
    setMenuOpenId(null);

    const res = await fetch('/api/admin/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, newPassword: newPass }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert('เปลี่ยนรหัสผ่านไม่สำเร็จ: ' + (data.error || ''));
      return;
    }
    alert(`เปลี่ยนรหัสผ่าน ${user.username} แล้ว`);
  }

  if (accessChecked && !isAdmin) {
    return (
      <div className="v3-card" style={{ padding: 40, textAlign: 'center' }}>
        <Lock size={48} strokeWidth={1.2} style={{ margin: '0 auto 12px', color: 'var(--text-muted)' }} />
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>ไม่มีสิทธิ์เข้าถึง</h2>
        <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>เฉพาะแอดมินเท่านั้น</p>
      </div>
    );
  }

  return (
    <>
      <div className="v3-page-header v3-desktop-only">
        <div>
          <h1 className="v3-page-title">จัดการผู้ใช้</h1>
          <p className="v3-page-subtitle">{counts.all} บัญชี · {counts.branches} สาขา</p>
        </div>
        <button
          onClick={() => activeTab === 'users' ? setShowAddUser(true) : setShowAddBranch(true)}
          className="v3-btn v3-btn-primary"
        >
          <Plus size={16} strokeWidth={2.5} />
          {activeTab === 'users' ? 'เพิ่มผู้ใช้' : 'เพิ่มสาขา'}
        </button>
      </div>

      <div className="v3-mobile-only" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
      }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, fontFamily: 'Prompt, sans-serif' }}>
            จัดการผู้ใช้
          </h1>
          <p style={{ fontSize: 11, color: 'var(--text-dim)' }}>
            {counts.all} บัญชี · {counts.branches} สาขา
          </p>
        </div>
        <button
          onClick={() => activeTab === 'users' ? setShowAddUser(true) : setShowAddBranch(true)}
          style={{
            width: 40, height: 40,
            borderRadius: 10,
            background: 'var(--accent)',
            color: '#fff',
            border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <Plus size={20} strokeWidth={2.5} />
        </button>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 10,
        marginBottom: 14,
      }}>
        <StatCard label="ทั้งหมด" value={counts.all} sub="บัญชีในระบบ" color="#3b82f6" Icon={Users} />
        <StatCard label="แอดมิน" value={counts.admin} sub="ผู้จัดการ" color="#f59e0b" Icon={Crown} />
        <StatCard label="สาขา" value={counts.branches} sub="สาขาทั้งหมด" color="#22c55e" Icon={Building2} />
      </div>

      <div style={{
        display: 'flex',
        gap: 6,
        marginBottom: 12,
        background: 'var(--surface-2)',
        padding: 4,
        borderRadius: 12,
      }}>
        <MainTab active={activeTab === 'users'} onClick={() => setActiveTab('users')} Icon={Users} label="ผู้ใช้" count={counts.all} />
        <MainTab active={activeTab === 'branches'} onClick={() => setActiveTab('branches')} Icon={Building2} label="สาขา" count={counts.branches} />
      </div>

      <div className="v3-card" style={{ marginBottom: 12, padding: 10 }}>
        <div style={{ position: 'relative', marginBottom: activeTab === 'users' ? 10 : 0 }}>
          <Search size={16} style={{
            position: 'absolute', left: 12, top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--text-muted)', pointerEvents: 'none',
          }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={activeTab === 'users' ? 'ค้นหา username / ชื่อ...' : 'ค้นหาชื่อสาขา / ที่อยู่...'}
            style={{ ...inputStyle, paddingLeft: 36 }}
          />
        </div>

        {activeTab === 'users' && (
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
            <RoleTab active={activeRole === 'all'} onClick={() => setActiveRole('all')} label="ทั้งหมด" count={counts.all} />
            <RoleTab active={activeRole === 'admin'} onClick={() => setActiveRole('admin')} label="แอดมิน" count={counts.admin} color="#f59e0b" />
            <RoleTab active={activeRole === 'staff'} onClick={() => setActiveRole('staff')} label="พนักงาน" count={counts.staff} color="#3b82f6" />
          </div>
        )}
      </div>

      {loading ? (
        <div className="v3-card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-dim)' }}>
          กำลังโหลด...
        </div>
      ) : activeTab === 'users' ? (
        filteredUsers.length === 0 ? (
          <EmptyState type="users" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filteredUsers.map(u => (
              <UserCard
                key={u.id}
                user={u}
                menuOpen={menuOpenId === u.id}
                onToggleMenu={() => setMenuOpenId(menuOpenId === u.id ? null : u.id)}
                onClose={() => setMenuOpenId(null)}
                onDelete={() => handleDeleteUser(u)}
                onResetPassword={() => handleResetPassword(u)}
              />
            ))}
          </div>
        )
      ) : (
        filteredBranches.length === 0 ? (
          <EmptyState type="branches" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filteredBranches.map(b => (
              <BranchCard key={b.id} branch={b} userCount={users.filter(u => u.branch_id === b.id).length} />
            ))}
          </div>
        )
      )}

      {showAddUser && (
        <Modal title="เพิ่มผู้ใช้ใหม่" onClose={() => setShowAddUser(false)}>
          <form onSubmit={handleAddUser} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Field label="Username" required>
              <input
                type="text"
                value={newUser.username}
                onChange={(e) => setNewUser({ ...newUser, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
                placeholder="username (ตัวเล็ก, ไม่มีช่องว่าง)"
                style={inputStyle}
              />
            </Field>
            <Field label="ชื่อ-นามสกุล" required>
              <input
                type="text"
                value={newUser.full_name}
                onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                placeholder="ชื่อ-นามสกุลของพนักงาน"
                style={inputStyle}
              />
            </Field>
            <Field label="รหัสผ่าน" required>
              <input
                type="text"
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                placeholder="อย่างน้อย 6 ตัวอักษร"
                style={inputStyle}
              />
            </Field>
            <Field label="สิทธิ์" required>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                <RoleBtn active={newUser.role === 'staff'} onClick={() => setNewUser({ ...newUser, role: 'staff' })} Icon={User} label="พนักงาน" />
                <RoleBtn active={newUser.role === 'admin'} onClick={() => setNewUser({ ...newUser, role: 'admin' })} Icon={Crown} label="แอดมิน" />
              </div>
            </Field>
            <Field label="สาขา" required>
              <select
                value={newUser.branch_id}
                onChange={(e) => setNewUser({ ...newUser, branch_id: e.target.value })}
                style={inputStyle}
              >
                <option value="">-- เลือกสาขา --</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </Field>
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <button type="button" onClick={() => setShowAddUser(false)} style={btnSecondary}>
                ยกเลิก
              </button>
              <button type="submit" disabled={submitting} style={btnPrimary}>
                {submitting ? 'กำลังบันทึก...' : '+ เพิ่มผู้ใช้'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showAddBranch && (
        <Modal title="เพิ่มสาขาใหม่" onClose={() => setShowAddBranch(false)}>
          <form onSubmit={handleAddBranch} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Field label="ชื่อสาขา" required>
              <input
                type="text"
                value={newBranch.name}
                onChange={(e) => setNewBranch({ ...newBranch, name: e.target.value })}
                placeholder="เช่น สาขาเซ็นทรัลบางนา"
                style={inputStyle}
              />
            </Field>
            <Field label="ที่อยู่">
              <input
                type="text"
                value={newBranch.address}
                onChange={(e) => setNewBranch({ ...newBranch, address: e.target.value })}
                placeholder="ที่อยู่ของสาขา"
                style={inputStyle}
              />
            </Field>
            <Field label="เบอร์โทร">
              <input
                type="text"
                value={newBranch.phone}
                onChange={(e) => setNewBranch({ ...newBranch, phone: e.target.value })}
                placeholder="0xx-xxx-xxxx"
                style={inputStyle}
              />
            </Field>
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <button type="button" onClick={() => setShowAddBranch(false)} style={btnSecondary}>
                ยกเลิก
              </button>
              <button type="submit" disabled={submitting} style={btnPrimary}>
                {submitting ? 'กำลังบันทึก...' : '+ เพิ่มสาขา'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

function StatCard({ label, value, sub, color, Icon }: any) {
  return (
    <div className="v3-card" style={{ padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <div style={{
          width: 34, height: 34,
          borderRadius: 10,
          background: `${color}15`,
          color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Icon size={17} strokeWidth={2.2} />
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{label}</div>
      </div>
      <div style={{
        fontSize: 22, fontWeight: 800,
        fontFamily: 'Prompt, sans-serif',
        lineHeight: 1,
      }}>
        {value}
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>{sub}</div>
    </div>
  );
}

function MainTab({ active, onClick, Icon, label, count }: any) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: '10px',
        background: active ? 'var(--surface)' : 'transparent',
        border: 'none',
        borderRadius: 10,
        cursor: 'pointer',
        fontSize: 13,
        fontWeight: 600,
        color: active ? 'var(--text)' : 'var(--text-dim)',
        fontFamily: 'inherit',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        boxShadow: active ? 'var(--shadow-sm)' : 'none',
      }}
    >
      <Icon size={15} />
      {label}
      <span style={{
        background: active ? 'var(--surface-2)' : 'rgba(0,0,0,0.05)',
        padding: '1px 7px',
        borderRadius: 100,
        fontSize: 10,
        fontWeight: 700,
      }}>
        {count}
      </span>
    </button>
  );
}

function RoleTab({ active, onClick, label, count, color }: any) {
  return (
    <button
      onClick={onClick}
      style={{
        flexShrink: 0,
        padding: '7px 12px',
        borderRadius: 100,
        border: '1px solid',
        borderColor: active ? (color || 'var(--accent)') : 'var(--border)',
        background: active ? (color || 'var(--accent)') : 'var(--surface)',
        color: active ? '#fff' : 'var(--text)',
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
        fontFamily: 'inherit',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
      <span style={{
        background: active ? 'rgba(255,255,255,0.25)' : 'var(--surface-2)',
        padding: '1px 7px',
        borderRadius: 100,
        fontSize: 10,
        fontWeight: 700,
      }}>
        {count}
      </span>
    </button>
  );
}

function UserCard({ user, menuOpen, onToggleMenu, onClose, onDelete, onResetPassword }: any) {
  const isUserAdmin = user.role === 'admin';
  const isSuper = user.is_super_admin;
  const roleColor = isSuper ? '#8b5cf6' : (isUserAdmin ? '#f59e0b' : '#3b82f6');
  const roleBg = isSuper ? '#ede9fe' : (isUserAdmin ? '#fef3c7' : '#dbeafe');
  const RoleIcon = isSuper ? Shield : (isUserAdmin ? Crown : User);

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 14,
      padding: 12,
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      position: 'relative',
    }}>
      <div style={{
        width: 48, height: 48,
        borderRadius: 24,
        background: `${roleColor}15`,
        color: roleColor,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
        fontWeight: 700,
        fontSize: 18,
        fontFamily: 'Prompt, sans-serif',
      }}>
        {(user.full_name || user.username).charAt(0).toUpperCase()}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 14, fontWeight: 700,
          fontFamily: 'Prompt, Sarabun, sans-serif',
          marginBottom: 2,
        }}>
          {user.full_name || 'ไม่มีชื่อ'}
        </div>
        <div style={{
          fontSize: 11,
          color: 'var(--text-dim)',
          fontFamily: 'monospace',
          marginBottom: 4,
        }}>
          @{user.username}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{
            padding: '2px 8px',
            fontSize: 10,
            fontWeight: 700,
            borderRadius: 100,
            background: roleBg,
            color: roleColor,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 3,
          }}>
            <RoleIcon size={10} />
            {isSuper ? 'Super Admin' : (isUserAdmin ? 'แอดมิน' : 'พนักงาน')}
          </span>
          {user.branches?.name && (
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
              <MapPin size={9} style={{ display: 'inline', marginRight: 2, verticalAlign: '-1px' }} />
              {user.branches.name}
            </span>
          )}
        </div>
      </div>

      <div style={{ position: 'relative' }}>
        <button
          onClick={(e) => { e.stopPropagation(); onToggleMenu(); }}
          style={{
            width: 32, height: 32,
            background: 'var(--surface-2)',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            color: 'var(--text-dim)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <MoreVertical size={15} />
        </button>
        {menuOpen && (
          <>
            <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 19 }} />
            <div style={{
              position: 'absolute',
              top: 36, right: 0,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              boxShadow: 'var(--shadow-lg)',
              minWidth: 160,
              padding: 4,
              zIndex: 20,
            }}>
              <button onClick={onResetPassword} style={menuBtnStyle}>
                <KeyRound size={13} /> เปลี่ยนรหัสผ่าน
              </button>
              {!isSuper && (
                <button onClick={onDelete} style={{ ...menuBtnStyle, color: 'var(--danger)' }}>
                  <Trash2 size={13} /> ลบบัญชี
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function BranchCard({ branch, userCount }: any) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 14,
      padding: 12,
      display: 'flex',
      alignItems: 'center',
      gap: 12,
    }}>
      <div style={{
        width: 48, height: 48,
        borderRadius: 12,
        background: '#dcfce7',
        color: '#16a34a',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Building2 size={22} strokeWidth={2} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 14, fontWeight: 700,
          fontFamily: 'Prompt, Sarabun, sans-serif',
          marginBottom: 2,
        }}>
          {branch.name}
        </div>
        {branch.address && (
          <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
            <MapPin size={10} style={{ display: 'inline', marginRight: 3, verticalAlign: '-1px' }} />
            {branch.address}
          </div>
        )}
        {branch.phone && (
          <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
            <Phone size={10} style={{ display: 'inline', marginRight: 3, verticalAlign: '-1px' }} />
            {branch.phone}
          </div>
        )}
      </div>

      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{
          fontSize: 18,
          fontWeight: 800,
          fontFamily: 'Prompt, sans-serif',
          color: 'var(--accent)',
          lineHeight: 1,
        }}>
          {userCount}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>พนักงาน</div>
      </div>
    </div>
  );
}

function Modal({ title, onClose, children }: any) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="v3-card"
        style={{
          maxWidth: 440,
          width: '100%',
          padding: 18,
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}>
          <h2 style={{
            fontSize: 16, fontWeight: 700,
            fontFamily: 'Prompt, sans-serif',
          }}>
            {title}
          </h2>
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32,
              background: 'var(--surface-2)',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, required, children }: any) {
  return (
    <div>
      <label style={{
        display: 'block',
        fontSize: 11,
        fontWeight: 600,
        marginBottom: 4,
        color: 'var(--text)',
      }}>
        {label} {required && <span style={{ color: '#ef4444' }}>*</span>}
      </label>
      {children}
    </div>
  );
}

function RoleBtn({ active, onClick, Icon, label }: any) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '10px',
        background: active ? 'var(--accent)' : 'var(--surface-2)',
        color: active ? '#fff' : 'var(--text)',
        border: '1px solid',
        borderColor: active ? 'var(--accent)' : 'var(--border)',
        borderRadius: 10,
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
        fontFamily: 'inherit',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
      }}
    >
      <Icon size={14} />
      {label}
    </button>
  );
}

function EmptyState({ type }: any) {
  const Icon = type === 'users' ? Users : Building2;
  return (
    <div className="v3-card" style={{ textAlign: 'center', padding: 40 }}>
      <Icon size={48} strokeWidth={1.2} style={{ margin: '0 auto 12px', color: 'var(--text-muted)' }} />
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
        {type === 'users' ? 'ยังไม่มีผู้ใช้' : 'ยังไม่มีสาขา'}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
        เริ่มต้นโดยการเพิ่ม{type === 'users' ? 'ผู้ใช้' : 'สาขา'}ใหม่
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  height: 38,
  padding: '0 12px',
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  color: 'var(--text)',
  fontSize: 13,
  fontFamily: 'inherit',
  outline: 'none',
};

const btnPrimary: React.CSSProperties = {
  flex: 1,
  padding: '11px',
  background: 'var(--accent)',
  color: '#fff',
  border: 'none',
  borderRadius: 10,
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const btnSecondary: React.CSSProperties = {
  flex: 1,
  padding: '11px',
  background: 'var(--surface-2)',
  color: 'var(--text)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const menuBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 10px',
  borderRadius: 6,
  color: 'var(--text)',
  fontSize: 12,
  border: 'none',
  background: 'transparent',
  width: '100%',
  textAlign: 'left',
  cursor: 'pointer',
  fontFamily: 'inherit',
};
