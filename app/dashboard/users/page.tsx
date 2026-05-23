'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase-client';
import { useRouter } from 'next/navigation';
import Toast from '@/components/Toast';

export default function UsersPage() {
  const supabase = createClient();
  const router = useRouter();
  const [users, setUsers] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentShopId, setCurrentShopId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddUser, setShowAddUser] = useState(false);
  const [showAddBranch, setShowAddBranch] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [deletingBranch, setDeletingBranch] = useState<any>(null);
  const [forceDeleteBranch, setForceDeleteBranch] = useState<any>(null);
  const [deletingUser, setDeletingUser] = useState<any>(null);
  const [toast, setToast] = useState<{ title: string; msg: string; type: string } | null>(null);

  const [newUser, setNewUser] = useState({
    username: '', password: '', full_name: '', role: 'staff' as 'admin' | 'staff', branch_id: '',
  });
  const [newBranch, setNewBranch] = useState({ name: '', address: '', phone: '' });
  const [submitting, setSubmitting] = useState(false);

  function showToast(title: string, msg: string, type: 'success' | 'danger' = 'success') {
    setToast({ title, msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  async function loadData() {
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    setCurrentUserId(user.id);

    const { data: profileData } = await supabase
      .from('profiles').select('role, shop_id').eq('id', user.id).single();

    if (profileData?.role !== 'admin') {
      router.push('/dashboard/stock');
      return;
    }

    setCurrentShopId(profileData.shop_id);

    const { data: usersData } = await supabase
      .from('profiles')
      .select('*, branches(name)')
      .order('created_at', { ascending: false });

    const { data: branchesData } = await supabase
      .from('branches')
      .select('*')
      .order('created_at', { ascending: true });

    setUsers(usersData || []);
    setBranches(branchesData || []);
    setLoading(false);
  }

  useEffect(() => { loadData(); }, []);

  async function handleAddUser(e: React.FormEvent) {
    e.preventDefault();
    if (!newUser.username || !newUser.password || !newUser.full_name || !newUser.branch_id) {
      showToast('ข้อมูลไม่ครบ', 'กรุณากรอกข้อมูลให้ครบ', 'danger');
      return;
    }

    if (newUser.password.length < 6) {
      showToast('รหัสผ่านสั้นเกินไป', 'รหัสผ่านต้องมีอย่างน้อย 6 ตัว', 'danger');
      return;
    }

    setSubmitting(true);
    const res = await fetch('/api/admin/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newUser),
    });

    const result = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      showToast('เพิ่มไม่สำเร็จ', result.error || 'เกิดข้อผิดพลาด', 'danger');
      return;
    }

    showToast('เพิ่มสำเร็จ', `สร้างบัญชี ${newUser.username} แล้ว`);
    setNewUser({ username: '', password: '', full_name: '', role: 'staff', branch_id: '' });
    setShowAddUser(false);
    loadData();
  }

  async function handleEditUser(e: React.FormEvent) {
    e.preventDefault();
    if (!editingUser.full_name || !editingUser.branch_id) {
      showToast('ข้อมูลไม่ครบ', '', 'danger');
      return;
    }

    const payload: any = {
      userId: editingUser.id,
      full_name: editingUser.full_name,
      role: editingUser.role,
      branch_id: editingUser.branch_id,
    };

    // ถ้ามีรหัสผ่านใหม่
    if (editingUser.newPassword) {
      if (editingUser.newPassword.length < 6) {
        showToast('รหัสผ่านสั้นเกินไป', 'อย่างน้อย 6 ตัว', 'danger');
        return;
      }
      payload.password = editingUser.newPassword;
    }

    setSubmitting(true);
    const res = await fetch('/api/admin/update-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const result = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      showToast('แก้ไขไม่สำเร็จ', result.error || 'เกิดข้อผิดพลาด', 'danger');
      return;
    }

    showToast('แก้ไขสำเร็จ', '');
    setEditingUser(null);
    loadData();
  }

  async function handleAddBranch(e: React.FormEvent) {
    e.preventDefault();
    if (!newBranch.name) {
      showToast('กรุณาใส่ชื่อสาขา', '', 'danger');
      return;
    }

    if (!currentShopId) {
      showToast('ไม่พบข้อมูลร้าน', 'กรุณา login ใหม่', 'danger');
      return;
    }

    setSubmitting(true);
    // ⭐ สำคัญ: ต้องใส่ shop_id เพื่อให้ผ่าน RLS
    const { error } = await supabase.from('branches').insert({
      ...newBranch,
      shop_id: currentShopId,
    });
    setSubmitting(false);

    if (error) {
      showToast('เพิ่มไม่สำเร็จ', error.message, 'danger');
      return;
    }

    showToast('เพิ่มสำเร็จ', `สร้างสาขา ${newBranch.name} แล้ว`);
    setNewBranch({ name: '', address: '', phone: '' });
    setShowAddBranch(false);
    loadData();
  }

  async function handleDeleteBranch(force = false) {
    if (!deletingBranch) return;

    setSubmitting(true);
    const res = await fetch('/api/admin/delete-branch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branchId: deletingBranch.id, force }),
    });

    const result = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      // ถ้ามีข้อมูลในสาขา + ลบได้แบบ force
      if (result.canForce && !force) {
        setForceDeleteBranch({ ...deletingBranch, details: result.details });
        setDeletingBranch(null);
        return;
      }
      showToast('ลบไม่สำเร็จ', result.error || 'เกิดข้อผิดพลาด', 'danger');
      return;
    }

    showToast('ลบสาขาแล้ว', '');
    setDeletingBranch(null);
    setForceDeleteBranch(null);
    loadData();
  }

  async function handleDeleteUser() {
    if (!deletingUser) return;

    const res = await fetch('/api/admin/delete-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: deletingUser.id }),
    });

    const result = await res.json();

    if (!res.ok) {
      showToast('ลบไม่สำเร็จ', result.error || 'เกิดข้อผิดพลาด', 'danger');
      return;
    }

    showToast('ลบแล้ว', '');
    setDeletingUser(null);
    loadData();
  }

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <div>กำลังโหลด...</div>
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <h1>👥 จัดการผู้ใช้ <span className="badge-admin">ADMIN</span></h1>
        <div className="desc">เพิ่ม/แก้ไข/ลบ ผู้ใช้และสาขา</div>
      </div>

      {/* Branches Section */}
      <div className="form-card">
        <h3>สาขา ({branches.length})</h3>
        <div className="item-list" style={{ marginBottom: 16 }}>
          {branches.map((b) => (
            <div key={b.id} className="item-card">
              <div className="top-row">
                <div className="model">{b.name}</div>
              </div>
              {b.address && <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>📍 {b.address}</div>}
              {b.phone && <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>📞 {b.phone}</div>}
              <div className="footer">
                <div className="footer-info">
                  สร้าง {new Date(b.created_at).toLocaleDateString('th-TH')}
                </div>
                <div className="actions">
                  <button className="icon-btn danger" onClick={() => setDeletingBranch(b)} title="ลบสาขา">×</button>
                </div>
              </div>
            </div>
          ))}
        </div>
        <button className="btn" onClick={() => setShowAddBranch(true)}>
          + เพิ่มสาขา
        </button>
      </div>

      {/* Users Section */}
      <div className="form-card">
        <h3>ผู้ใช้ ({users.length})</h3>
        <div className="item-list" style={{ marginBottom: 16 }}>
          {users.map((u) => {
            const isMe = u.id === currentUserId;
            return (
              <div key={u.id} className="item-card">
                <div className="top-row">
                  <div className="model">
                    {u.full_name}
                    {isMe && <span style={{ color: 'var(--accent)', fontSize: 11, marginLeft: 8 }}>(คุณ)</span>}
                  </div>
                  <div className="price" style={{ fontSize: 12 }}>{u.role.toUpperCase()}</div>
                </div>
                <div className="imei">@{u.username}</div>
                <div className="meta">
                  {u.branches?.name && <span className="tag">{u.branches.name}</span>}
                </div>
                <div className="footer">
                  <div className="footer-info">
                    สร้าง {new Date(u.created_at).toLocaleDateString('th-TH')}
                  </div>
                  <div className="actions">
                    <button
                      className="icon-btn"
                      onClick={() => setEditingUser({ ...u, newPassword: '' })}
                      title="แก้ไข"
                    >✎</button>
                    {!isMe && (
                      <button
                        className="icon-btn danger"
                        onClick={() => setDeletingUser(u)}
                        title="ลบ"
                      >×</button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <button className="btn" onClick={() => setShowAddUser(true)}>
          + เพิ่มผู้ใช้
        </button>
      </div>

      {/* Add User Modal */}
      {showAddUser && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowAddUser(false)}>
          <div className="modal">
            <h3>เพิ่มผู้ใช้ใหม่</h3>
            <p className="modal-sub">สร้างบัญชีพนักงานหรือเจ้าของร้าน</p>
            <form onSubmit={handleAddUser}>
              <div className="form-grid">
                <div className="field">
                  <label>Username</label>
                  <input type="text" value={newUser.username}
                    onChange={(e) => setNewUser({ ...newUser, username: e.target.value.toLowerCase() })}
                    placeholder="staff01" required />
                </div>
                <div className="field">
                  <label>ชื่อ-นามสกุล</label>
                  <input type="text" value={newUser.full_name}
                    onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                    placeholder="สมชาย ใจดี" required />
                </div>
                <div className="field">
                  <label>Password (อย่างน้อย 6 ตัว)</label>
                  <input type="text" value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    placeholder="รหัสผ่าน" required />
                </div>
                <div className="field">
                  <label>บทบาท</label>
                  <select value={newUser.role}
                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value as any })}>
                    <option value="staff">พนักงาน (Staff)</option>
                    <option value="admin">เจ้าของร้าน (Admin)</option>
                  </select>
                </div>
                <div className="field full">
                  <label>สาขา</label>
                  <select value={newUser.branch_id}
                    onChange={(e) => setNewUser({ ...newUser, branch_id: e.target.value })} required>
                    <option value="">-- เลือกสาขา --</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="modal-actions" style={{ marginTop: 20 }}>
                <button type="submit" className="btn" disabled={submitting}>
                  {submitting ? 'กำลังเพิ่ม...' : 'เพิ่มผู้ใช้ ✓'}
                </button>
                <button type="button" className="btn btn-sec" onClick={() => setShowAddUser(false)}>
                  ยกเลิก
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setEditingUser(null)}>
          <div className="modal">
            <h3>แก้ไขผู้ใช้</h3>
            <p className="modal-sub">@{editingUser.username} • {editingUser.id === currentUserId ? '(คุณ)' : ''}</p>
            <form onSubmit={handleEditUser}>
              <div className="form-grid">
                <div className="field full">
                  <label>ชื่อ-นามสกุล</label>
                  <input type="text" value={editingUser.full_name || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, full_name: e.target.value })}
                    required />
                </div>
                <div className="field">
                  <label>บทบาท</label>
                  <select value={editingUser.role}
                    onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })}
                    disabled={editingUser.id === currentUserId}>
                    <option value="staff">พนักงาน (Staff)</option>
                    <option value="admin">เจ้าของร้าน (Admin)</option>
                  </select>
                  {editingUser.id === currentUserId && (
                    <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
                      ลดสิทธิ์ตัวเองไม่ได้
                    </div>
                  )}
                </div>
                <div className="field">
                  <label>สาขา</label>
                  <select value={editingUser.branch_id || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, branch_id: e.target.value })} required>
                    <option value="">-- เลือก --</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
                <div className="field full">
                  <label>เปลี่ยนรหัสผ่าน (เว้นว่าง = ไม่เปลี่ยน)</label>
                  <input type="text" value={editingUser.newPassword || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, newPassword: e.target.value })}
                    placeholder="อย่างน้อย 6 ตัว" />
                </div>
              </div>
              <div className="modal-actions" style={{ marginTop: 20 }}>
                <button type="submit" className="btn" disabled={submitting}>
                  {submitting ? 'กำลังบันทึก...' : 'บันทึก ✓'}
                </button>
                <button type="button" className="btn btn-sec" onClick={() => setEditingUser(null)}>
                  ยกเลิก
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Branch Modal */}
      {showAddBranch && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowAddBranch(false)}>
          <div className="modal">
            <h3>เพิ่มสาขาใหม่</h3>
            <p className="modal-sub">เพิ่มสาขาของร้าน</p>
            <form onSubmit={handleAddBranch}>
              <div className="form-grid">
                <div className="field full">
                  <label>ชื่อสาขา</label>
                  <input type="text" value={newBranch.name}
                    onChange={(e) => setNewBranch({ ...newBranch, name: e.target.value })}
                    placeholder="สาขาเซ็นทรัล" required />
                </div>
                <div className="field full">
                  <label>ที่อยู่</label>
                  <input type="text" value={newBranch.address}
                    onChange={(e) => setNewBranch({ ...newBranch, address: e.target.value })}
                    placeholder="ที่อยู่สาขา" />
                </div>
                <div className="field full">
                  <label>เบอร์โทร</label>
                  <input type="tel" value={newBranch.phone}
                    onChange={(e) => setNewBranch({ ...newBranch, phone: e.target.value })}
                    placeholder="02-xxx-xxxx" />
                </div>
              </div>
              <div className="modal-actions" style={{ marginTop: 20 }}>
                <button type="submit" className="btn" disabled={submitting}>
                  {submitting ? 'กำลังเพิ่ม...' : 'เพิ่มสาขา ✓'}
                </button>
                <button type="button" className="btn btn-sec" onClick={() => setShowAddBranch(false)}>
                  ยกเลิก
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Branch Modal */}
      {deletingBranch && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setDeletingBranch(null)}>
          <div className="modal">
            <h3 style={{ color: 'var(--danger)' }}>ลบสาขา?</h3>
            <p className="modal-sub">จะลบสาขา <strong>{deletingBranch.name}</strong> ออกจากระบบ</p>
            <div className="modal-actions">
              <button className="btn btn-danger" onClick={() => handleDeleteBranch(false)} disabled={submitting}>
                {submitting ? 'กำลังลบ...' : 'ลบสาขา'}
              </button>
              <button className="btn btn-sec" onClick={() => setDeletingBranch(null)}>
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Force Delete Branch (when has data) */}
      {forceDeleteBranch && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setForceDeleteBranch(null)}>
          <div className="modal">
            <h3 style={{ color: 'var(--danger)' }}>⚠️ สาขามีข้อมูลใช้งานอยู่</h3>
            <p className="modal-sub">
              สาขา <strong>{forceDeleteBranch.name}</strong> มีข้อมูล:
            </p>
            <div style={{
              background: 'var(--surface-2)',
              padding: 14,
              marginBottom: 16,
              fontSize: 13,
              fontFamily: 'JetBrains Mono, monospace',
            }}>
              {forceDeleteBranch.details.stock > 0 && <div>📦 สต๊อก: {forceDeleteBranch.details.stock}</div>}
              {forceDeleteBranch.details.sales > 0 && <div>💵 ประวัติขาย: {forceDeleteBranch.details.sales}</div>}
              {forceDeleteBranch.details.pawn > 0 && <div>💰 จำนำ: {forceDeleteBranch.details.pawn}</div>}
              {forceDeleteBranch.details.pawnHistory > 0 && <div>📋 ประวัติจำนำ: {forceDeleteBranch.details.pawnHistory}</div>}
              {forceDeleteBranch.details.installment > 0 && <div>💳 ผ่อน: {forceDeleteBranch.details.installment}</div>}
              {forceDeleteBranch.details.installmentHistory > 0 && <div>📋 ประวัติผ่อน: {forceDeleteBranch.details.installmentHistory}</div>}
            </div>
            <p style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 16 }}>
              ⚠️ การกดยืนยันจะ <strong>ลบข้อมูลทั้งหมด</strong> ในสาขานี้!
            </p>
            <div className="modal-actions">
              <button className="btn btn-danger"
                onClick={() => { setDeletingBranch(forceDeleteBranch); handleDeleteBranch(true); }}
                disabled={submitting}>
                {submitting ? 'กำลังลบ...' : 'ลบทั้งหมด'}
              </button>
              <button className="btn btn-sec" onClick={() => setForceDeleteBranch(null)}>
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete User Modal */}
      {deletingUser && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setDeletingUser(null)}>
          <div className="modal">
            <h3 style={{ color: 'var(--danger)' }}>ลบผู้ใช้?</h3>
            <p className="modal-sub">
              จะลบบัญชี <strong>{deletingUser.full_name}</strong> (@{deletingUser.username})<br />
              ✅ ข้อมูลสต๊อก/ประวัติที่เคยทำไว้จะยังอยู่ (จะแสดงชื่อ "{deletingUser.full_name} (ลาออก)")
            </p>
            <div className="modal-actions">
              <button className="btn btn-danger" onClick={handleDeleteUser}>
                ลบบัญชี
              </button>
              <button className="btn btn-sec" onClick={() => setDeletingUser(null)}>
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast {...toast} />}
    </>
  );
}
