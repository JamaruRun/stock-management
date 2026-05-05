'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase-client';
import { redirect, useRouter } from 'next/navigation';
import Toast from '@/components/Toast';

export default function HistoryPage() {
  const supabase = createClient();
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStaff, setFilterStaff] = useState('');
  const [editing, setEditing] = useState<any>(null);
  const [deleting, setDeleting] = useState<any>(null);
  const [viewing, setViewing] = useState<any>(null);
  const [toast, setToast] = useState<{ title: string; msg: string; type: string } | null>(null);

  function showToast(title: string, msg: string, type: 'success' | 'danger' = 'success') {
    setToast({ title, msg, type });
    setTimeout(() => setToast(null), 2500);
  }

  async function loadData() {
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileData?.role !== 'admin') {
      router.push('/dashboard/stock');
      return;
    }

    setProfile(profileData);

    const { data: historyData } = await supabase
      .from('sales_history')
      .select(`
        *,
        sold_by_profile:profiles!sales_history_sold_by_fkey(full_name, username),
        added_by_profile:profiles!sales_history_added_by_fkey(full_name, username),
        branch:branches(name)
      `)
      .order('sold_date', { ascending: false });

    setItems(historyData || []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  // unique sellers
  const sellers = Array.from(
    new Map(
      items
        .filter((i) => i.sold_by_profile)
        .map((i) => [i.sold_by, i.sold_by_profile])
    ).entries()
  );

  // filter
  const filtered = items.filter((item) => {
    const s = search.toLowerCase();
    const matchSearch =
      !s ||
      item.imei.toLowerCase().includes(s) ||
      item.model.toLowerCase().includes(s) ||
      (item.sold_by_profile?.full_name || '').toLowerCase().includes(s);
    const matchStaff = !filterStaff || item.sold_by === filterStaff;
    return matchSearch && matchStaff;
  });

  // stats
  const totalRevenue = items.reduce((sum, i) => sum + Number(i.price), 0);
  const sellerCounts: Record<string, number> = {};
  items.forEach((i) => {
    if (i.sold_by) sellerCounts[i.sold_by] = (sellerCounts[i.sold_by] || 0) + 1;
  });
  const topSellerEntry = Object.entries(sellerCounts).sort((a, b) => b[1] - a[1])[0];
  const topSellerName = topSellerEntry
    ? items.find((i) => i.sold_by === topSellerEntry[0])?.sold_by_profile?.full_name
    : null;

  const now = new Date();
  const thisMonth = items.filter((i) => {
    const d = new Date(i.sold_date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  async function handleSaveEdit() {
    if (!editing) return;

    const { error } = await supabase
      .from('sales_history')
      .update({
        imei: editing.imei,
        model: editing.model,
        color: editing.color,
        spec: editing.spec,
        price: parseFloat(editing.price),
      })
      .eq('id', editing.id);

    if (error) {
      showToast('เกิดข้อผิดพลาด', error.message, 'danger');
      return;
    }

    showToast('บันทึกสำเร็จ', '');
    setEditing(null);
    loadData();
  }

  async function handleDelete() {
    if (!deleting) return;
    const { error } = await supabase.from('sales_history').delete().eq('id', deleting.id);

    if (error) {
      showToast('เกิดข้อผิดพลาด', error.message, 'danger');
      return;
    }

    showToast('ลบแล้ว', '');
    setDeleting(null);
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
        <h2>
          ประวัติการขาย <span className="badge-admin">ADMIN</span>
        </h2>
        <div className="desc">รายการเครื่องที่ขายไปแล้วทั้งหมด</div>
      </div>

      <div className="stats">
        <div className="stat">
          <div className="label">// SOLD</div>
          <div className="value success">{items.length}</div>
        </div>
        <div className="stat">
          <div className="label">// REVENUE</div>
          <div className="value accent small">฿{totalRevenue.toLocaleString()}</div>
        </div>
        <div className="stat">
          <div className="label">// TOP SELLER</div>
          <div className="value small">{topSellerName || '-'}</div>
        </div>
        <div className="stat">
          <div className="label">// THIS MONTH</div>
          <div className="value">{thisMonth}</div>
        </div>
      </div>

      <div className="toolbar">
        <div className="search-box">
          <input
            type="text"
            placeholder="ค้นหา IMEI, รุ่น, ผู้ขาย..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="filter-select" value={filterStaff} onChange={(e) => setFilterStaff(e.target.value)}>
          <option value="">พนักงานทั้งหมด</option>
          {sellers.map(([id, p]: [string, any]) => (
            <option key={id} value={id}>{p?.full_name}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">⌛</div>
          <div className="empty-title">ยังไม่มีประวัติการขาย</div>
          <div className="empty-sub">
            {search || filterStaff ? 'ไม่พบรายการที่ค้นหา' : 'ยังไม่มีเครื่องที่ขายออกไป'}
          </div>
        </div>
      ) : (
        <div className="item-list">
          {filtered.map((item) => (
            <div key={item.id} className="item-card">
              <div className="top-row">
                <div className="model">{item.model}</div>
                <div className="price">฿{Number(item.price).toLocaleString()}</div>
              </div>
              <div className="imei">IMEI: {item.imei}</div>
              <div className="meta">
                {item.color && <span className="tag">{item.color}</span>}
                {item.spec && <span className="tag">{item.spec}</span>}
                {item.branch?.name && <span className="tag">{item.branch.name}</span>}
                <span className="tag success">
                  ขายโดย: {
                    item.sold_by_profile?.full_name
                      ? item.sold_by_profile.full_name
                      : item.sold_by_name
                        ? `${item.sold_by_name} (ลาออก)`
                        : '-'
                  }
                </span>
              </div>
              <div className="footer">
                <div className="footer-info">
                  ลง {item.added_date} → ขาย {item.sold_date}
                </div>
                <div className="actions">
                  <button className="icon-btn" onClick={() => setViewing(item)} title="ดู">ⓘ</button>
                  <button className="icon-btn" onClick={() => setEditing({ ...item })} title="แก้ไข">✎</button>
                  <button className="icon-btn danger" onClick={() => setDeleting(item)} title="ลบ">×</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* View Modal */}
      {viewing && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setViewing(null)}>
          <div className="modal">
            <h3>รายละเอียดการขาย</h3>
            <p className="modal-sub">ข้อมูลเครื่องที่ขายแล้ว</p>
            <div className="detail-grid">
              <div className="detail-item full">
                <div className="label">IMEI</div>
                <div className="value mono">{viewing.imei}</div>
              </div>
              <div className="detail-item">
                <div className="label">รุ่น</div>
                <div className="value">{viewing.model}</div>
              </div>
              <div className="detail-item">
                <div className="label">สี</div>
                <div className="value">{viewing.color || '-'}</div>
              </div>
              <div className="detail-item">
                <div className="label">สเปค</div>
                <div className="value">{viewing.spec || '-'}</div>
              </div>
              <div className="detail-item">
                <div className="label">ราคา</div>
                <div className="value" style={{ color: 'var(--accent)' }}>
                  ฿{Number(viewing.price).toLocaleString()}
                </div>
              </div>
              <div className="detail-item">
                <div className="label">วันที่ลงสต๊อก</div>
                <div className="value">{viewing.added_date}</div>
              </div>
              <div className="detail-item">
                <div className="label">วันที่ขาย</div>
                <div className="value" style={{ color: 'var(--success)' }}>{viewing.sold_date}</div>
              </div>
              <div className="detail-item">
                <div className="label">สาขา</div>
                <div className="value">{viewing.branch?.name || '-'}</div>
              </div>
              <div className="detail-item">
                <div className="label">เพิ่มโดย</div>
                <div className="value">
                  {viewing.added_by_profile?.full_name 
                    ? viewing.added_by_profile.full_name
                    : viewing.added_by_name 
                      ? `${viewing.added_by_name} (ลาออก)`
                      : '-'}
                </div>
              </div>
              <div className="detail-item">
                <div className="label">ขายโดย</div>
                <div className="value">
                  {viewing.sold_by_profile?.full_name 
                    ? viewing.sold_by_profile.full_name
                    : viewing.sold_by_name 
                      ? `${viewing.sold_by_name} (ลาออก)`
                      : '-'}
                </div>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-sec" onClick={() => setViewing(null)}>ปิด</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editing && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setEditing(null)}>
          <div className="modal">
            <h3>แก้ไขประวัติการขาย</h3>
            <p className="modal-sub">แก้ไขรายละเอียด</p>
            <div className="form-grid">
              <div className="field full">
                <label>IMEI</label>
                <input
                  type="text"
                  maxLength={15}
                  value={editing.imei}
                  onChange={(e) => setEditing({ ...editing, imei: e.target.value })}
                />
              </div>
              <div className="field">
                <label>รุ่น</label>
                <input
                  type="text"
                  value={editing.model}
                  onChange={(e) => setEditing({ ...editing, model: e.target.value })}
                />
              </div>
              <div className="field">
                <label>สี</label>
                <input
                  type="text"
                  value={editing.color || ''}
                  onChange={(e) => setEditing({ ...editing, color: e.target.value })}
                />
              </div>
              <div className="field">
                <label>สเปค</label>
                <input
                  type="text"
                  value={editing.spec || ''}
                  onChange={(e) => setEditing({ ...editing, spec: e.target.value })}
                />
              </div>
              <div className="field">
                <label>ราคา</label>
                <input
                  type="number"
                  value={editing.price}
                  onChange={(e) => setEditing({ ...editing, price: e.target.value })}
                />
              </div>
            </div>
            <div className="modal-actions" style={{ marginTop: 20 }}>
              <button className="btn" onClick={handleSaveEdit}>บันทึก ✓</button>
              <button className="btn btn-sec" onClick={() => setEditing(null)}>ยกเลิก</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deleting && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setDeleting(null)}>
          <div className="modal">
            <h3 style={{ color: 'var(--danger)' }}>ยืนยันการลบ</h3>
            <p className="modal-sub">
              จะลบประวัติการขาย {deleting.model} (IMEI: {deleting.imei}) ?
            </p>
            <div className="modal-actions">
              <button className="btn btn-danger" onClick={handleDelete}>ลบ</button>
              <button className="btn btn-sec" onClick={() => setDeleting(null)}>ยกเลิก</button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast {...toast} />}
    </>
  );
}
