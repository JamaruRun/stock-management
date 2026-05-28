'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase-client';
import Link from 'next/link';
import Toast from '@/components/Toast';

interface Shop {
  id: string;
  name: string;
  owner_name?: string;
  phone?: string;
  province?: string;
  email?: string;
  package: 'trial' | 'monthly' | 'yearly' | 'lifetime';
  expires_at?: string;
  status: 'active' | 'suspended' | 'expired';
  note?: string;
  suspension_note?: string;
  created_at: string;
}

export default function SuperAdminPage() {
  const supabase = createClient();
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Shop | null>(null);
  const [deleting, setDeleting] = useState<Shop | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ title: string; msg: string; type: string } | null>(null);

  const [newShop, setNewShop] = useState({
    name: '',
    owner_name: '',
    phone: '',
    email: '',
    package: 'trial' as 'trial' | 'monthly' | 'yearly' | 'lifetime',
    trialDays: 30,
    // Admin user for the shop
    adminUsername: '',
    adminPassword: '',
    adminFullName: '',
    branchName: 'สาขาหลัก',
  });

  function showToast(title: string, msg: string, type: 'success' | 'danger' = 'success') {
    setToast({ title, msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  async function loadData() {
    setLoading(true);
    const { data } = await supabase.from('shops').select('*').order('created_at', { ascending: false });
    setShops((data || []) as Shop[]);
    setLoading(false);
  }

  useEffect(() => { loadData(); }, []);

  function getDaysLeft(expiresAt?: string): number | null {
    if (!expiresAt) return null;
    const now = new Date();
    const expire = new Date(expiresAt);
    const diff = Math.ceil((expire.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  }

  function getStatusInfo(shop: Shop) {
    if (shop.status === 'suspended') return { label: 'ระงับ', color: '#ff4757' };
    if (shop.package === 'lifetime') return { label: 'ตลอดชีวิต', color: 'var(--accent)' };
    
    const daysLeft = getDaysLeft(shop.expires_at);
    if (daysLeft === null) return { label: 'ไม่มีวันหมดอายุ', color: 'var(--text-dim)' };
    if (daysLeft <= 0) return { label: 'หมดอายุ', color: '#ff4757' };
    if (daysLeft <= 7) return { label: `เหลือ ${daysLeft} วัน`, color: '#ffa502' };
    return { label: `เหลือ ${daysLeft} วัน`, color: 'var(--success)' };
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newShop.name || !newShop.adminUsername || !newShop.adminPassword || !newShop.adminFullName) {
      showToast('ข้อมูลไม่ครบ', 'กรุณากรอกข้อมูลที่จำเป็น', 'danger');
      return;
    }

    if (newShop.adminPassword.length < 6) {
      showToast('รหัสผ่านสั้นเกินไป', 'อย่างน้อย 6 ตัว', 'danger');
      return;
    }

    setSubmitting(true);
    const res = await fetch('/api/super-admin/create-shop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newShop),
    });
    const result = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      showToast('สร้างไม่สำเร็จ', result.error || 'error', 'danger');
      return;
    }

    showToast('สร้างร้านสำเร็จ', `${newShop.name} • ${newShop.adminUsername}`);
    setShowCreate(false);
    setNewShop({
      name: '', owner_name: '', phone: '', email: '',
      package: 'trial', trialDays: 30,
      adminUsername: '', adminPassword: '', adminFullName: '',
      branchName: 'สาขาหลัก',
    });
    loadData();
  }

  async function handleUpdate() {
    if (!editing) return;
    setSubmitting(true);
    const res = await fetch('/api/super-admin/update-shop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editing),
    });
    const result = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      showToast('อัพเดทไม่สำเร็จ', result.error || 'error', 'danger');
      return;
    }

    showToast('อัพเดทสำเร็จ', '');
    setEditing(null);
    loadData();
  }

  async function handleExtend(shopId: string, days: number) {
    setSubmitting(true);
    const shop = shops.find(s => s.id === shopId);
    if (!shop) return;

    const currentExpires = shop.expires_at ? new Date(shop.expires_at) : new Date();
    const newExpires = new Date(Math.max(currentExpires.getTime(), new Date().getTime()));
    newExpires.setDate(newExpires.getDate() + days);

    const res = await fetch('/api/super-admin/update-shop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...shop,
        expires_at: newExpires.toISOString(),
        status: 'active',
      }),
    });

    setSubmitting(false);

    if (!res.ok) {
      showToast('ต่ออายุไม่สำเร็จ', '', 'danger');
      return;
    }

    showToast('ต่ออายุสำเร็จ', `+${days} วัน`);
    loadData();
  }

  async function handleDelete() {
    if (!deleting) return;
    setSubmitting(true);
    const res = await fetch('/api/super-admin/delete-shop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shopId: deleting.id }),
    });
    const result = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      showToast('ลบไม่สำเร็จ', result.error || 'error', 'danger');
      return;
    }

    showToast('ลบร้านแล้ว', '');
    setDeleting(null);
    loadData();
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Header */}
      <header className="top-header" style={{ borderColor: 'var(--danger)' }}>
        <div className="header-brand">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 22 }}>👑</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>SUPER ADMIN</div>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'JetBrains Mono, monospace' }}>
                System Management
              </div>
            </div>
          </div>
        </div>
        <Link href="/dashboard/home" className="btn btn-sec" style={{ width: 'auto', padding: '8px 16px' }}>
          ← กลับระบบหลัก
        </Link>
      </header>

      <main className="main">
        <div className="page-header">
          <h1>👑 จัดการร้านลูกค้า</h1>
          <div className="desc">ทุกร้านในระบบ • Super Admin Panel</div>
        </div>

        {/* Quick Links */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', 
          gap: 10,
          marginBottom: 20,
        }}>
          <Link href="/super-admin/beta" style={{
            padding: 14,
            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            borderRadius: 'var(--radius-sm)',
            color: '#fff',
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            transition: 'transform 0.15s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <div style={{ fontSize: 28 }}>📋</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>Beta Signups</div>
              <div style={{ fontSize: 11, opacity: 0.9 }}>คำขอสมัครใหม่</div>
            </div>
          </Link>

          <Link href="/super-admin/online" style={{
            padding: 14,
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            borderRadius: 'var(--radius-sm)',
            color: '#fff',
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            transition: 'transform 0.15s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <div style={{ fontSize: 28 }}>🟢</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>Online Users</div>
              <div style={{ fontSize: 11, opacity: 0.9 }}>ใครออนไลน์</div>
            </div>
          </Link>

          <Link href="/super-admin/feedback" style={{
            padding: 14,
            background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
            borderRadius: 'var(--radius-sm)',
            color: '#fff',
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            transition: 'transform 0.15s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <div style={{ fontSize: 28 }}>📬</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>Feedback</div>
              <div style={{ fontSize: 11, opacity: 0.9 }}>ข้อเสนอแนะ + บั๊ก</div>
            </div>
          </Link>

          <Link href="/super-admin/activity" style={{
            padding: 14,
            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            borderRadius: 'var(--radius-sm)',
            color: '#fff',
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            transition: 'transform 0.15s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <div style={{ fontSize: 28 }}>📊</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>Shop Activity</div>
              <div style={{ fontSize: 11, opacity: 0.9 }}>ใครใช้บ่อย • พร้อมจ่าย</div>
            </div>
          </Link>

          <Link href="/super-admin/users" style={{
            padding: 14,
            background: 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)',
            borderRadius: 'var(--radius-sm)',
            color: '#fff',
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            transition: 'transform 0.15s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <div style={{ fontSize: 28 }}>👥</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>จัดการ Users</div>
              <div style={{ fontSize: 11, opacity: 0.9 }}>เปลี่ยน Username • Password</div>
            </div>
          </Link>
        </div>

        <div className="stats">
          <div className="stat">
            <div className="label">รวมทั้งหมด</div>
            <div className="value accent">{shops.length}</div>
          </div>
          <div className="stat">
            <div className="label">ใช้งานปกติ</div>
            <div className="value success">
              {shops.filter(s => {
                if (s.status !== 'active') return false;
                if (!s.expires_at) return true;
                return new Date(s.expires_at) > new Date();
              }).length}
            </div>
          </div>
          <div className="stat">
            <div className="label">ทดลองใช้</div>
            <div className="value" style={{ color: '#ffa502' }}>
              {shops.filter(s => s.package === 'trial').length}
            </div>
          </div>
          <div className="stat">
            <div className="label">// LIFETIME</div>
            <div className="value">
              {shops.filter(s => s.package === 'lifetime').length}
            </div>
          </div>
        </div>

        <button className="btn" onClick={() => setShowCreate(true)} style={{ marginBottom: 20 }}>
          + เพิ่มร้านใหม่
        </button>

        {loading ? (
          <div className="loading"><div className="spinner"></div><div>กำลังโหลด...</div></div>
        ) : shops.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">🏪</div>
            <div className="empty-title">ยังไม่มีร้าน</div>
            <div className="empty-sub">กดเพิ่มร้านใหม่ด้านบน</div>
          </div>
        ) : (
          <div className="item-list">
            {shops.map((shop) => {
              const status = getStatusInfo(shop);
              return (
                <div key={shop.id} className="item-card">
                  <div className="top-row">
                    <div className="model">{shop.name}</div>
                    <div className="price" style={{ color: status.color, fontSize: 13 }}>
                      {status.label}
                    </div>
                  </div>
                  {shop.owner_name && <div className="imei">👤 {shop.owner_name}</div>}
                  <div className="meta">
                    <span className="tag" style={{
                      color: shop.package === 'lifetime' ? 'var(--accent)' :
                             shop.package === 'trial' ? '#ffa502' : 'var(--text)',
                      borderColor: shop.package === 'lifetime' ? 'var(--accent)' :
                                   shop.package === 'trial' ? '#ffa502' : 'var(--border)',
                    }}>
                      {shop.package === 'trial' && '🎁 Trial'}
                      {shop.package === 'monthly' && '📅 รายเดือน'}
                      {shop.package === 'yearly' && '📆 รายปี'}
                      {shop.package === 'lifetime' && '👑 ตลอดชีวิต'}
                    </span>
                    {shop.status === 'suspended' && (
                      <span className="tag" style={{ color: '#ff4757', borderColor: '#ff4757' }}>
                        ⛔ ระงับ
                      </span>
                    )}
                    {shop.phone && <span className="tag">📞 {shop.phone}</span>}
                  </div>
                  <div className="footer">
                    <div className="footer-info">
                      สร้างเมื่อ {new Date(shop.created_at).toLocaleDateString('th-TH')}
                    </div>
                    <div className="actions">
                      {shop.package !== 'lifetime' && shop.status === 'active' && (
                        <>
                          <button className="icon-btn" onClick={() => handleExtend(shop.id, 30)} title="ต่อ 30 วัน">
                            +30
                          </button>
                          <button className="icon-btn" onClick={() => handleExtend(shop.id, 365)} title="ต่อ 1 ปี">
                            +1y
                          </button>
                        </>
                      )}
                      <button className="icon-btn" onClick={() => setEditing({ ...shop })} title="แก้ไข">✎</button>
                      <button className="icon-btn danger" onClick={() => setDeleting(shop)} title="ลบ">×</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Create Shop Modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowCreate(false)}>
          <div className="modal" style={{ maxWidth: 560 }}>
            <h3>เพิ่มร้านใหม่</h3>
            <p className="modal-sub">สร้างร้านพร้อมบัญชี Admin คนแรก</p>
            <form onSubmit={handleCreate}>
              <div style={{ marginBottom: 12, fontSize: 11, color: 'var(--accent)', fontFamily: 'JetBrains Mono, monospace', letterSpacing: 1 }}>
                // ข้อมูลร้าน
              </div>
              <div className="form-grid">
                <div className="field full">
                  <label>ชื่อร้าน <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input type="text" value={newShop.name}
                    onChange={(e) => setNewShop({ ...newShop, name: e.target.value })} required />
                </div>
                <div className="field">
                  <label>ชื่อเจ้าของ</label>
                  <input type="text" value={newShop.owner_name}
                    onChange={(e) => setNewShop({ ...newShop, owner_name: e.target.value })} />
                </div>
                <div className="field">
                  <label>เบอร์โทร</label>
                  <input type="tel" value={newShop.phone}
                    onChange={(e) => setNewShop({ ...newShop, phone: e.target.value })} />
                </div>
                <div className="field">
                  <label>แพ็คเกจ</label>
                  <select value={newShop.package}
                    onChange={(e) => setNewShop({ ...newShop, package: e.target.value as any })}>
                    <option value="trial">🎁 Trial</option>
                    <option value="monthly">📅 รายเดือน</option>
                    <option value="yearly">📆 รายปี</option>
                    <option value="lifetime">👑 ตลอดชีวิต</option>
                  </select>
                </div>
                {newShop.package !== 'lifetime' && (
                  <div className="field">
                    <label>จำนวนวัน</label>
                    <input type="number" value={newShop.trialDays}
                      onChange={(e) => setNewShop({ ...newShop, trialDays: parseInt(e.target.value) || 30 })} />
                  </div>
                )}
              </div>

              <div style={{ marginTop: 16, marginBottom: 12, fontSize: 11, color: 'var(--accent)', fontFamily: 'JetBrains Mono, monospace', letterSpacing: 1 }}>
                // บัญชี Admin ของร้าน
              </div>
              <div className="form-grid">
                <div className="field">
                  <label>Username <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input type="text" value={newShop.adminUsername}
                    onChange={(e) => setNewShop({ ...newShop, adminUsername: e.target.value.toLowerCase() })}
                    placeholder="shop01_admin" required />
                </div>
                <div className="field">
                  <label>Password <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input type="text" value={newShop.adminPassword}
                    onChange={(e) => setNewShop({ ...newShop, adminPassword: e.target.value })}
                    placeholder="อย่างน้อย 6 ตัว" required />
                </div>
                <div className="field">
                  <label>ชื่อ-นามสกุล <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input type="text" value={newShop.adminFullName}
                    onChange={(e) => setNewShop({ ...newShop, adminFullName: e.target.value })}
                    placeholder="เจ้าของร้าน" required />
                </div>
                <div className="field">
                  <label>ชื่อสาขาแรก</label>
                  <input type="text" value={newShop.branchName}
                    onChange={(e) => setNewShop({ ...newShop, branchName: e.target.value })} />
                </div>
              </div>
              <div className="modal-actions" style={{ marginTop: 20 }}>
                <button type="submit" className="btn" disabled={submitting}>
                  {submitting ? 'กำลังสร้าง...' : 'สร้างร้าน ✓'}
                </button>
                <button type="button" className="btn btn-sec" onClick={() => setShowCreate(false)}>
                  ยกเลิก
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Shop Modal */}
      {editing && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setEditing(null)}>
          <div className="modal">
            <h3>แก้ไขร้าน</h3>
            <p className="modal-sub">{editing.name}</p>
            <div className="form-grid">
              <div className="field full">
                <label>ชื่อร้าน</label>
                <input type="text" value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div className="field">
                <label>ชื่อเจ้าของ</label>
                <input type="text" value={editing.owner_name || ''}
                  onChange={(e) => setEditing({ ...editing, owner_name: e.target.value })} />
              </div>
              <div className="field">
                <label>เบอร์โทร</label>
                <input type="tel" value={editing.phone || ''}
                  onChange={(e) => setEditing({ ...editing, phone: e.target.value })} />
              </div>
              <div className="field">
                <label>แพ็คเกจ</label>
                <select value={editing.package}
                  onChange={(e) => setEditing({ ...editing, package: e.target.value as any })}>
                  <option value="trial">🎁 Trial</option>
                  <option value="monthly">📅 รายเดือน</option>
                  <option value="yearly">📆 รายปี</option>
                  <option value="lifetime">👑 ตลอดชีวิต</option>
                </select>
              </div>
              <div className="field">
                <label>สถานะ</label>
                <select value={editing.status}
                  onChange={(e) => setEditing({ ...editing, status: e.target.value as any })}>
                  <option value="active">✅ Active</option>
                  <option value="suspended">⛔ Suspended</option>
                </select>
              </div>
              <div className="field full">
                <label>วันหมดอายุ {editing.package === 'lifetime' && '(lifetime - ไม่ต้องตั้ง)'}</label>
                <input type="datetime-local" 
                  value={editing.expires_at ? new Date(editing.expires_at).toISOString().slice(0, 16) : ''}
                  onChange={(e) => setEditing({ ...editing, expires_at: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
                  disabled={editing.package === 'lifetime'} />
              </div>
              
              {/* 🆕 หมายเหตุการระงับ - แสดงเมื่อ status = suspended */}
              {editing.status === 'suspended' && (
                <div className="field full">
                  <label style={{ color: '#ef4444', fontWeight: 700 }}>
                    ⛔ หมายเหตุการระงับ (ลูกค้าจะเห็นข้อความนี้)
                  </label>
                  <textarea
                    value={(editing as any).suspension_note || ''}
                    onChange={(e) => setEditing({ ...editing, suspension_note: e.target.value } as any)}
                    placeholder="เช่น: ค้างชำระค่าบริการ - กรุณาติดต่อทีมงานเพื่อชำระเงิน 0812345678"
                    rows={3}
                    style={{ 
                      resize: 'vertical', 
                      fontFamily: 'inherit',
                      background: 'rgba(239, 68, 68, 0.05)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                    }}
                  />
                  <small style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                    💡 ข้อความนี้จะแสดงตอนลูกค้าพยายาม login • ใส่ช่องทางติดต่อด้วย
                  </small>
                </div>
              )}
              
              <div className="field full">
                <label>หมายเหตุภายใน (super admin only)</label>
                <input type="text" value={editing.note || ''}
                  onChange={(e) => setEditing({ ...editing, note: e.target.value })} 
                  placeholder="โน้ตของคุณ - ลูกค้าไม่เห็น"
                />
              </div>
            </div>
            <div className="modal-actions" style={{ marginTop: 20 }}>
              <button className="btn" onClick={handleUpdate} disabled={submitting}>
                {submitting ? 'กำลังบันทึก...' : 'บันทึก ✓'}
              </button>
              <button className="btn btn-sec" onClick={() => setEditing(null)}>ยกเลิก</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleting && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setDeleting(null)}>
          <div className="modal">
            <h3 style={{ color: 'var(--danger)' }}>⚠️ ลบร้าน?</h3>
            <p className="modal-sub">
              จะลบ <strong>{deleting.name}</strong> และข้อมูลทั้งหมด<br />
              (สต๊อก, ประวัติ, พนักงาน, สาขา) — กู้คืนไม่ได้!
            </p>
            <div className="modal-actions">
              <button className="btn btn-danger" onClick={handleDelete} disabled={submitting}>
                {submitting ? 'กำลังลบ...' : 'ลบร้าน'}
              </button>
              <button className="btn btn-sec" onClick={() => setDeleting(null)}>ยกเลิก</button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast {...toast} />}
    </div>
  );
}
