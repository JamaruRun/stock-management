'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase-client';
import { redirect, useRouter } from 'next/navigation';
import Toast from '@/components/Toast';

export default function HistoryPage() {
  const supabase = createClient();
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStaff, setFilterStaff] = useState('');
  const [filterBranch, setFilterBranch] = useState('');
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

    const { data: branchesData } = await supabase.from('branches').select('*').order('name');
    setBranches(branchesData || []);

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

  const countByBranch = branches.reduce((acc: any, b) => {
    acc[b.id] = items.filter((i) => i.branch_id === b.id).length;
    return acc;
  }, {});

  // filter
  const filtered = items.filter((item) => {
    const s = search.toLowerCase();
    const matchSearch =
      !s ||
      item.imei.toLowerCase().includes(s) ||
      item.model.toLowerCase().includes(s) ||
      (item.sold_by_profile?.full_name || '').toLowerCase().includes(s);
    const matchStaff = !filterStaff || item.sold_by === filterStaff;
    const matchBranch = !filterBranch || item.branch_id === filterBranch;
    return matchSearch && matchStaff && matchBranch;
  });

  // stats
  const totalRevenue = items.reduce((sum, i) => sum + Number(i.final_price || i.price), 0);
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

    const price = parseFloat(editing.price) || 0;
    const discount = parseFloat(editing.discount) || 0;
    
    if (discount < 0) {
      showToast('ส่วนลดผิด', 'ส่วนลดติดลบไม่ได้', 'danger');
      return;
    }
    if (discount > price) {
      showToast('ส่วนลดเกิน', 'ส่วนลดเกินราคา', 'danger');
      return;
    }

    const final_price = price - discount;

    const { error } = await supabase
      .from('sales_history')
      .update({
        imei: editing.imei,
        model: editing.model,
        color: editing.color,
        spec: editing.spec,
        price,
        discount,
        final_price,
        device_condition: editing.device_condition || null,
        payment_type: editing.payment_type || null,
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

      {branches.length > 0 && (
        <div className="branch-tabs">
          <button
            className={`branch-tab ${filterBranch === '' ? 'active' : ''}`}
            onClick={() => setFilterBranch('')}
          >
            <span>ทุกสาขา</span>
            <span className="count">{items.length}</span>
          </button>
          {branches.map((b) => (
            <button
              key={b.id}
              className={`branch-tab ${filterBranch === b.id ? 'active' : ''}`}
              onClick={() => setFilterBranch(b.id)}
            >
              <span>{b.name}</span>
              <span className="count">{countByBranch[b.id] || 0}</span>
            </button>
          ))}
        </div>
      )}

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
                <div className="price">
                  {item.discount && Number(item.discount) > 0 ? (
                    <>
                      <span style={{ 
                        fontSize: 11, 
                        textDecoration: 'line-through', 
                        color: 'var(--text-dim)', 
                        marginRight: 6,
                        fontWeight: 'normal',
                      }}>
                        ฿{Number(item.price).toLocaleString()}
                      </span>
                      ฿{Number(item.final_price || item.price).toLocaleString()}
                    </>
                  ) : (
                    <>฿{Number(item.final_price || item.price).toLocaleString()}</>
                  )}
                </div>
              </div>
              <div className="imei">IMEI: {item.imei}</div>
              <div className="meta">
                {item.device_condition === 'new' && (
                  <span className="tag" style={{ color: 'var(--success)', borderColor: 'var(--success)' }}>
                    ✨ มือ 1
                  </span>
                )}
                {item.device_condition === 'used' && (
                  <span className="tag" style={{ color: '#3742fa', borderColor: '#3742fa' }}>
                    📱 มือ 2
                  </span>
                )}
                {item.payment_type === 'cash' && (
                  <span className="tag" style={{ color: 'var(--success)', borderColor: 'var(--success)' }}>
                    💵 เงินสด
                  </span>
                )}
                {item.payment_type === 'installment' && (
                  <span className="tag" style={{ color: '#3742fa', borderColor: '#3742fa' }}>
                    💳 ผ่อน
                  </span>
                )}
                {item.discount && Number(item.discount) > 0 && (
                  <span className="tag" style={{ color: '#ff6b6b', borderColor: '#ff6b6b' }}>
                    💸 ลด ฿{Number(item.discount).toLocaleString()}
                  </span>
                )}
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
                <div className="label">สภาพเครื่อง</div>
                <div className="value">
                  {viewing.device_condition === 'new' && '✨ มือ 1 (ใหม่)'}
                  {viewing.device_condition === 'used' && '📱 มือ 2 (มือสอง)'}
                  {!viewing.device_condition && '-'}
                </div>
              </div>
              <div className="detail-item">
                <div className="label">ประเภทการชำระ</div>
                <div className="value">
                  {viewing.payment_type === 'cash' && '💵 เงินสด'}
                  {viewing.payment_type === 'installment' && '💳 ผ่อน'}
                  {!viewing.payment_type && '-'}
                </div>
              </div>
              {viewing.discount && Number(viewing.discount) > 0 && (
                <>
                  <div className="detail-item">
                    <div className="label">ราคาเดิม</div>
                    <div className="value" style={{ textDecoration: 'line-through', color: 'var(--text-dim)' }}>
                      ฿{Number(viewing.price).toLocaleString()}
                    </div>
                  </div>
                  <div className="detail-item">
                    <div className="label">ส่วนลด</div>
                    <div className="value" style={{ color: '#ff6b6b' }}>
                      -฿{Number(viewing.discount).toLocaleString()}
                    </div>
                  </div>
                  <div className="detail-item">
                    <div className="label">ราคาขายจริง</div>
                    <div className="value" style={{ color: 'var(--success)' }}>
                      ฿{Number(viewing.final_price).toLocaleString()}
                    </div>
                  </div>
                </>
              )}
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
                <label>ราคา (เดิม)</label>
                <input
                  type="number"
                  value={editing.price}
                  onChange={(e) => setEditing({ ...editing, price: e.target.value })}
                />
              </div>
              <div className="field">
                <label>ส่วนลด</label>
                <input
                  type="number"
                  value={editing.discount || 0}
                  onChange={(e) => setEditing({ ...editing, discount: e.target.value })}
                  placeholder="0"
                />
              </div>
              <div className="field full">
                <label>ราคาขายจริง (คำนวณอัตโนมัติ)</label>
                <input
                  type="text"
                  value={`฿${((parseFloat(editing.price) || 0) - (parseFloat(editing.discount) || 0)).toLocaleString()}`}
                  disabled
                  style={{ opacity: 0.8, fontWeight: 600, color: 'var(--success)' }}
                />
              </div>
              <div className="field full">
                <label>สภาพเครื่อง</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setEditing({ ...editing, device_condition: 'new' })}
                    style={{
                      flex: 1, padding: '10px',
                      background: editing.device_condition === 'new' ? 'var(--success)' : 'var(--surface-2)',
                      color: editing.device_condition === 'new' ? '#fff' : 'var(--text)',
                      border: `1px solid ${editing.device_condition === 'new' ? 'var(--success)' : 'var(--border)'}`,
                      cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
                    }}
                  >
                    ✨ มือ 1
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing({ ...editing, device_condition: 'used' })}
                    style={{
                      flex: 1, padding: '10px',
                      background: editing.device_condition === 'used' ? '#3742fa' : 'var(--surface-2)',
                      color: editing.device_condition === 'used' ? '#fff' : 'var(--text)',
                      border: `1px solid ${editing.device_condition === 'used' ? '#3742fa' : 'var(--border)'}`,
                      cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
                    }}
                  >
                    📱 มือ 2
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing({ ...editing, device_condition: null })}
                    style={{
                      padding: '10px 14px',
                      background: !editing.device_condition ? 'var(--text-dim)' : 'var(--surface-2)',
                      color: !editing.device_condition ? '#fff' : 'var(--text-dim)',
                      border: `1px solid ${!editing.device_condition ? 'var(--text-dim)' : 'var(--border)'}`,
                      cursor: 'pointer', fontFamily: 'inherit', fontSize: 13,
                    }}
                  >
                    -
                  </button>
                </div>
              </div>
              <div className="field full">
                <label>ประเภทการชำระ</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setEditing({ ...editing, payment_type: 'cash' })}
                    style={{
                      flex: 1, padding: '10px',
                      background: editing.payment_type === 'cash' ? 'var(--success)' : 'var(--surface-2)',
                      color: editing.payment_type === 'cash' ? '#fff' : 'var(--text)',
                      border: `1px solid ${editing.payment_type === 'cash' ? 'var(--success)' : 'var(--border)'}`,
                      cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
                    }}
                  >
                    💵 เงินสด
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing({ ...editing, payment_type: 'installment' })}
                    style={{
                      flex: 1, padding: '10px',
                      background: editing.payment_type === 'installment' ? '#3742fa' : 'var(--surface-2)',
                      color: editing.payment_type === 'installment' ? '#fff' : 'var(--text)',
                      border: `1px solid ${editing.payment_type === 'installment' ? '#3742fa' : 'var(--border)'}`,
                      cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
                    }}
                  >
                    💳 ผ่อน
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing({ ...editing, payment_type: null })}
                    style={{
                      padding: '10px 14px',
                      background: !editing.payment_type ? 'var(--text-dim)' : 'var(--surface-2)',
                      color: !editing.payment_type ? '#fff' : 'var(--text-dim)',
                      border: `1px solid ${!editing.payment_type ? 'var(--text-dim)' : 'var(--border)'}`,
                      cursor: 'pointer', fontFamily: 'inherit', fontSize: 13,
                    }}
                  >
                    -
                  </button>
                </div>
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
