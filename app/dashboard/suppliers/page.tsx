'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase-client';
import Toast from '@/components/Toast';

export default function SuppliersPage() {
  const supabase = createClient();
  const [items, setItems] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<any>(null);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<any>(null);
  const [viewingHistory, setViewingHistory] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [toast, setToast] = useState<{ title: string; msg: string; type: string } | null>(null);

  const [form, setForm] = useState({
    name: '', phone: '', contact_person: '', address: '', note: '',
  });

  function showToast(title: string, msg: string, type: 'success' | 'danger' = 'success') {
    setToast({ title, msg, type });
    setTimeout(() => setToast(null), 2500);
  }

  async function loadData() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const [profileRes, suppliersRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('suppliers').select('*').order('name'),
    ]);

    setProfile(profileRes.data);
    setItems(suppliersRes.data || []);
    setLoading(false);
  }

  useEffect(() => { loadData(); }, []);

  async function handleSave() {
    if (!form.name.trim()) {
      showToast('ใส่ชื่อ Supplier', '', 'danger');
      return;
    }

    if (adding) {
      const { error } = await supabase.from('suppliers').insert({
        name: form.name.trim(),
        phone: form.phone || null,
        contact_person: form.contact_person || null,
        address: form.address || null,
        note: form.note || null,
        shop_id: profile.shop_id,
      });
      if (error) {
        showToast('เกิดข้อผิดพลาด', error.message, 'danger');
        return;
      }
      showToast('เพิ่ม Supplier สำเร็จ', form.name);
    } else if (editing) {
      const { error } = await supabase.from('suppliers').update({
        name: form.name.trim(),
        phone: form.phone || null,
        contact_person: form.contact_person || null,
        address: form.address || null,
        note: form.note || null,
        updated_at: new Date().toISOString(),
      }).eq('id', editing.id);
      if (error) {
        showToast('เกิดข้อผิดพลาด', error.message, 'danger');
        return;
      }
      showToast('บันทึกสำเร็จ', '');
    }

    setAdding(false);
    setEditing(null);
    setForm({ name: '', phone: '', contact_person: '', address: '', note: '' });
    loadData();
  }

  async function handleDelete() {
    if (!deleting) return;
    const { error } = await supabase.from('suppliers').delete().eq('id', deleting.id);
    if (error) {
      showToast('ลบไม่สำเร็จ', error.message, 'danger');
      return;
    }
    showToast('ลบแล้ว', '');
    setDeleting(null);
    loadData();
  }

  async function viewHistory(supplier: any) {
    setViewingHistory(supplier);
    const { data } = await supabase
      .from('supplier_transactions')
      .select('*')
      .eq('supplier_id', supplier.id)
      .order('transaction_date', { ascending: false })
      .limit(50);
    setTransactions(data || []);
  }

  const filtered = items.filter(i => {
    const s = search.toLowerCase();
    return !s || 
      i.name.toLowerCase().includes(s) || 
      (i.phone && i.phone.includes(s)) ||
      (i.contact_person && i.contact_person.toLowerCase().includes(s));
  });

  const isAdmin = profile?.role === 'admin';

  if (loading) {
    return (
      <>
        <div className="page-header">
          <h1>📋 จัดการ Supplier</h1>
          <div className="desc">กำลังโหลด...</div>
        </div>
        <div className="skeleton skeleton-card"></div>
        <div className="skeleton skeleton-card"></div>
      </>
    );
  }

  if (!isAdmin) {
    return (
      <>
        <div className="page-header">
          <h1>📋 จัดการ Supplier</h1>
        </div>
        <div className="form-card">
          <div className="empty">
            <div className="empty-icon">🔒</div>
            <div className="empty-title">เฉพาะเจ้าของร้าน</div>
            <div className="empty-sub">หน้านี้สำหรับ Admin เท่านั้น</div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-header">
        <h1>📋 จัดการ Supplier <span className="badge-admin">ADMIN</span></h1>
        <div className="desc">ผู้ส่งสินค้า/ตัวแทนจำหน่าย • {items.length} ราย</div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <button 
          className="btn" 
          style={{ width: 'auto', flex: '1 1 200px' }}
          onClick={() => {
            setAdding(true);
            setEditing(null);
            setForm({ name: '', phone: '', contact_person: '', address: '', note: '' });
          }}
        >
          ➕ เพิ่ม Supplier
        </button>
      </div>

      <div className="toolbar">
        <div className="search-box">
          <input
            type="text"
            placeholder="ค้นหาชื่อ, เบอร์, ผู้ติดต่อ..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">📋</div>
          <div className="empty-title">
            {items.length === 0 ? 'ยังไม่มี Supplier' : 'ไม่พบรายการที่ค้นหา'}
          </div>
          <div className="empty-sub">
            {items.length === 0 ? 'กดเพิ่ม Supplier ด้านบน' : 'ลองเปลี่ยนคำค้นหา'}
          </div>
        </div>
      ) : (
        <div className="item-list">
          {filtered.map((item) => (
            <div key={item.id} className="item-card">
              <div className="top-row">
                <div>
                  <div className="model">{item.name}</div>
                  {item.contact_person && (
                    <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>
                      👤 {item.contact_person}
                    </div>
                  )}
                </div>
                {Number(item.balance) !== 0 && (
                  <div style={{ 
                    fontSize: 16, 
                    fontWeight: 700, 
                    color: Number(item.balance) < 0 ? 'var(--danger)' : 'var(--success)' 
                  }}>
                    {Number(item.balance) < 0 ? '-' : '+'}฿{Math.abs(Number(item.balance)).toLocaleString()}
                  </div>
                )}
              </div>
              <div className="meta">
                {item.phone && <span className="tag">📞 {item.phone}</span>}
                {item.address && <span className="tag">📍 {item.address.substring(0, 30)}{item.address.length > 30 ? '...' : ''}</span>}
              </div>
              {item.note && (
                <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 6 }}>
                  📝 {item.note}
                </div>
              )}
              <div className="footer">
                <div className="footer-info">
                  สร้าง {new Date(item.created_at).toLocaleDateString('th-TH')}
                </div>
                <div className="actions">
                  <button className="icon-btn" onClick={() => viewHistory(item)} title="ดูประวัติ">📜</button>
                  <button 
                    className="icon-btn" 
                    onClick={() => {
                      setEditing(item);
                      setAdding(false);
                      setForm({
                        name: item.name,
                        phone: item.phone || '',
                        contact_person: item.contact_person || '',
                        address: item.address || '',
                        note: item.note || '',
                      });
                    }}
                    title="แก้ไข"
                  >✎</button>
                  <button className="icon-btn danger" onClick={() => setDeleting(item)} title="ลบ">×</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {(adding || editing) && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && (setAdding(false), setEditing(null))}>
          <div className="modal">
            <h3>{adding ? '➕ เพิ่ม Supplier' : '✎ แก้ไข Supplier'}</h3>
            <p className="modal-sub">{adding ? 'ผู้ส่งสินค้า/ตัวแทนจำหน่าย' : 'แก้ไขข้อมูล'}</p>

            <div className="form-grid">
              <div className="field full">
                <label>ชื่อ Supplier <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input type="text" value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="ตัวแทน Apple ABC" autoFocus />
              </div>
              <div className="field">
                <label>เบอร์โทร</label>
                <input type="tel" value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="0812345678" />
              </div>
              <div className="field">
                <label>ผู้ติดต่อ</label>
                <input type="text" value={form.contact_person}
                  onChange={(e) => setForm({ ...form, contact_person: e.target.value })}
                  placeholder="คุณสมชาย" />
              </div>
              <div className="field full">
                <label>ที่อยู่</label>
                <input type="text" value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="ที่อยู่ร้าน/บริษัท" />
              </div>
              <div className="field full">
                <label>หมายเหตุ</label>
                <input type="text" value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  placeholder="ข้อมูลเพิ่มเติม" />
              </div>
            </div>

            <div className="modal-actions" style={{ marginTop: 20 }}>
              <button className="btn" onClick={handleSave}>
                {adding ? 'เพิ่ม' : 'บันทึก'} ✓
              </button>
              <button className="btn btn-sec" onClick={() => { setAdding(false); setEditing(null); }}>
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deleting && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setDeleting(null)}>
          <div className="modal">
            <h3 style={{ color: 'var(--danger)' }}>ลบ Supplier?</h3>
            <p className="modal-sub">
              จะลบ <strong>{deleting.name}</strong>?<br />
              <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>
                ⚠️ เครื่อง/ของที่ลิงก์ supplier นี้จะกลายเป็นไม่มี supplier
              </span>
            </p>
            <div className="modal-actions">
              <button className="btn btn-danger" onClick={handleDelete}>ลบ</button>
              <button className="btn btn-sec" onClick={() => setDeleting(null)}>ยกเลิก</button>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {viewingHistory && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setViewingHistory(null)}>
          <div className="modal" style={{ maxWidth: 600 }}>
            <h3>📜 ประวัติ {viewingHistory.name}</h3>
            <p className="modal-sub">รายการรับของ/จ่ายเงิน</p>

            <div style={{
              padding: 14,
              background: 'var(--surface-2)',
              borderRadius: 'var(--radius-sm)',
              marginBottom: 16,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>ยอดค้างจ่าย</div>
                <div style={{ 
                  fontSize: 24, 
                  fontWeight: 700, 
                  color: Number(viewingHistory.balance) < 0 ? 'var(--danger)' : Number(viewingHistory.balance) > 0 ? 'var(--success)' : 'var(--text)'
                }}>
                  {Number(viewingHistory.balance) < 0 ? '-' : ''}฿{Math.abs(Number(viewingHistory.balance)).toLocaleString()}
                </div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', textAlign: 'right' }}>
                {Number(viewingHistory.balance) < 0 ? 'เราติด Supplier' : Number(viewingHistory.balance) > 0 ? 'Supplier ติดเรา' : 'เคลียร์'}
              </div>
            </div>

            {transactions.length === 0 ? (
              <div className="empty">
                <div className="empty-sub">ยังไม่มีประวัติ</div>
              </div>
            ) : (
              <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                {transactions.map((tx) => (
                  <div key={tx.id} style={{
                    padding: '10px 12px',
                    borderBottom: '1px solid var(--border)',
                    fontSize: 13,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontWeight: 600 }}>
                          {tx.type === 'purchase' ? '🛒 รับของ' : '💵 จ่ายเงิน'}
                        </div>
                        {tx.description && (
                          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
                            {tx.description}
                          </div>
                        )}
                      </div>
                      <div style={{ 
                        fontWeight: 700, 
                        color: tx.type === 'purchase' ? 'var(--danger)' : 'var(--success)'
                      }}>
                        {tx.type === 'purchase' ? '-' : '+'}฿{Number(tx.amount).toLocaleString()}
                      </div>
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}>
                      {new Date(tx.transaction_date).toLocaleDateString('th-TH')} • {tx.created_by_name}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="modal-actions" style={{ marginTop: 16 }}>
              <button className="btn btn-sec" onClick={() => setViewingHistory(null)}>ปิด</button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast {...toast} />}
    </>
  );
}
