'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase-client';
import Toast from '@/components/Toast';

export default function StockPage() {
  const supabase = createClient();
  const [items, setItems] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterModel, setFilterModel] = useState('');
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

    setProfile(profileData);

    const { data: stockData } = await supabase
      .from('stock')
      .select('*, added_by_profile:profiles!stock_added_by_fkey(full_name, username), branch:branches(name)')
      .order('created_at', { ascending: false });

    setItems(stockData || []);

    // โหลดรายชื่อสาขาเฉพาะ admin
    if (profileData?.role === 'admin') {
      const { data: branchesData } = await supabase.from('branches').select('*').order('name');
      setBranches(branchesData || []);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  const isAdmin = profile?.role === 'admin';

  // unique models
  const models = Array.from(new Set(items.map((i) => i.model)));

  // จำนวนเครื่องในแต่ละสาขา
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
      (item.color && item.color.toLowerCase().includes(s));
    const matchModel = !filterModel || item.model === filterModel;
    const matchBranch = !filterBranch || item.branch_id === filterBranch;
    return matchSearch && matchModel && matchBranch;
  });

  // stats
  const totalValue = items.reduce((sum, i) => sum + Number(i.price), 0);
  const latestItem = items[0];

  async function handleSaveEdit() {
    if (!editing) return;

    if (!editing.imei || !editing.model) {
      showToast('ข้อมูลไม่ครบ', 'IMEI และรุ่นต้องไม่ว่าง', 'danger');
      return;
    }

    const { error } = await supabase
      .from('stock')
      .update({
        imei: editing.imei,
        model: editing.model,
        color: editing.color,
        spec: editing.spec,
        price: parseFloat(editing.price),
        device_condition: editing.device_condition || null,
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

    const { error } = await supabase.from('stock').delete().eq('id', deleting.id);

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
        <h2>สต๊อกปัจจุบัน</h2>
        <div className="desc">เครื่องที่ยังไม่ได้ขาย</div>
      </div>

      <div className="stats">
        <div className="stat">
          <div className="label">// TOTAL</div>
          <div className="value accent">{items.length}</div>
        </div>
        <div className="stat">
          <div className="label">// VALUE</div>
          <div className="value small">฿{totalValue.toLocaleString()}</div>
        </div>
        <div className="stat">
          <div className="label">// MODELS</div>
          <div className="value">{models.length}</div>
        </div>
        <div className="stat">
          <div className="label">// LATEST</div>
          <div className="value small">{latestItem ? latestItem.model : '-'}</div>
        </div>
      </div>

      {isAdmin && branches.length > 0 && (
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
            placeholder="ค้นหา IMEI, รุ่น, สี..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="filter-select" value={filterModel} onChange={(e) => setFilterModel(e.target.value)}>
          <option value="">ทุกรุ่น</option>
          {models.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">▦</div>
          <div className="empty-title">ไม่มีเครื่องในสต๊อก</div>
          <div className="empty-sub">
            {search || filterModel || filterBranch ? 'ไม่พบรายการที่ค้นหา' : 'ยังไม่มีเครื่องที่เพิ่มเข้ามา'}
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
                {item.color && <span className="tag">{item.color}</span>}
                {item.spec && <span className="tag">{item.spec}</span>}
                {isAdmin && item.branch?.name && <span className="tag">{item.branch.name}</span>}
              </div>
              <div className="footer">
                <div className="footer-info">
                  + {item.added_date} • {
                    item.added_by_profile?.full_name 
                      ? item.added_by_profile.full_name
                      : item.added_by_name 
                        ? `${item.added_by_name} (ลาออก)`
                        : '-'
                  }
                </div>
                <div className="actions">
                  <button className="icon-btn" onClick={() => setViewing(item)} title="ดู">ⓘ</button>
                  {isAdmin && (
                    <>
                      <button className="icon-btn" onClick={() => setEditing({ ...item })} title="แก้ไข">✎</button>
                      <button className="icon-btn danger" onClick={() => setDeleting(item)} title="ลบ">×</button>
                    </>
                  )}
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
            <h3>รายละเอียดเครื่อง</h3>
            <p className="modal-sub">ข้อมูลเครื่องในระบบ</p>
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
                <div className="label">สภาพเครื่อง</div>
                <div className="value">
                  {viewing.device_condition === 'new' && '✨ มือ 1 (ใหม่)'}
                  {viewing.device_condition === 'used' && '📱 มือ 2 (มือสอง)'}
                  {!viewing.device_condition && '-'}
                </div>
              </div>
              <div className="detail-item full">
                <div className="label">เพิ่มโดย</div>
                <div className="value">
                  {viewing.added_by_profile?.full_name 
                    ? viewing.added_by_profile.full_name
                    : viewing.added_by_name 
                      ? `${viewing.added_by_name} (ลาออก)`
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
            <h3>แก้ไขสต๊อก</h3>
            <p className="modal-sub">แก้ไขรายละเอียดเครื่อง</p>
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
              <div className="field full">
                <label>สภาพเครื่อง</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setEditing({ ...editing, device_condition: 'new' })}
                    style={{
                      flex: 1,
                      padding: '10px',
                      background: editing.device_condition === 'new' ? 'var(--success)' : 'var(--surface-2)',
                      color: editing.device_condition === 'new' ? '#fff' : 'var(--text)',
                      border: `1px solid ${editing.device_condition === 'new' ? 'var(--success)' : 'var(--border)'}`,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    ✨ มือ 1
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing({ ...editing, device_condition: 'used' })}
                    style={{
                      flex: 1,
                      padding: '10px',
                      background: editing.device_condition === 'used' ? '#3742fa' : 'var(--surface-2)',
                      color: editing.device_condition === 'used' ? '#fff' : 'var(--text)',
                      border: `1px solid ${editing.device_condition === 'used' ? '#3742fa' : 'var(--border)'}`,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      fontSize: 13,
                      fontWeight: 600,
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
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      fontSize: 13,
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
              จะลบ {deleting.model} (IMEI: {deleting.imei}) ออกจากระบบ?
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
