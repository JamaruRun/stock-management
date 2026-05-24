'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-client';
import Toast from '@/components/Toast';
import ImportExcel from '@/components/ImportExcel';
import LabelPrint30x20 from '@/components/LabelPrint30x20';

export default function StockPage() {
  const supabase = createClient();
  const [items, setItems] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCondition, setFilterCondition] = useState('');
  const [filterBranch, setFilterBranch] = useState('');
  const [editing, setEditing] = useState<any>(null);
  const [deleting, setDeleting] = useState<any>(null);
  const [showImport, setShowImport] = useState(false);
  const [printingLabel, setPrintingLabel] = useState<any | null>(null);
  const [toast, setToast] = useState<{ title: string; msg: string; type: string } | null>(null);

  function showToast(title: string, msg: string, type: 'success' | 'danger' = 'success') {
    setToast({ title, msg, type });
    setTimeout(() => setToast(null), 2500);
  }

  async function loadData() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const [profileRes, stockRes] = await Promise.all([
      supabase.from('profiles').select('*, shops(name)').eq('id', user.id).single(),
      supabase
        .from('stock')
        .select('*, added_by_profile:profiles!stock_added_by_fkey(full_name), branch:branches(name)')
        .order('created_at', { ascending: false }),
    ]);

    setProfile(profileRes.data);
    setItems(stockRes.data || []);

    if (profileRes.data?.role === 'admin') {
      const { data: bs } = await supabase.from('branches').select('*').order('name');
      setBranches(bs || []);
    }

    setLoading(false);
  }

  useEffect(() => { loadData(); }, []);

  const isAdmin = profile?.role === 'admin';
  const countByBranch = branches.reduce((acc: any, b) => {
    acc[b.id] = items.filter((i) => i.branch_id === b.id).length;
    return acc;
  }, {});

  const filtered = items.filter((item) => {
    const s = search.toLowerCase();
    const matchSearch = !s ||
      item.imei.toLowerCase().includes(s) ||
      item.model.toLowerCase().includes(s) ||
      (item.color && item.color.toLowerCase().includes(s));
    const matchCondition = !filterCondition || item.device_condition === filterCondition;
    const matchBranch = !filterBranch || item.branch_id === filterBranch;
    return matchSearch && matchCondition && matchBranch;
  });

  const totalValue = items.reduce((sum, i) => sum + Number(i.price), 0);
  const newCount = items.filter(i => i.device_condition === 'new').length;
  const usedCount = items.filter(i => i.device_condition === 'used').length;

  async function handleSaveEdit() {
    if (!editing) return;
    if (!editing.imei || !editing.model) {
      showToast('ข้อมูลไม่ครบ', 'IMEI และรุ่นต้องไม่ว่าง', 'danger');
      return;
    }

    const { error } = await supabase.from('stock').update({
      imei: editing.imei,
      model: editing.model,
      color: editing.color,
      spec: editing.spec,
      price: parseFloat(editing.price),
      device_condition: editing.device_condition || null,
    }).eq('id', editing.id);

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
      showToast('ลบไม่สำเร็จ', error.message, 'danger');
      return;
    }
    showToast('ลบแล้ว', '');
    setDeleting(null);
    loadData();
  }

  if (loading) {
    return (
      <>
        <div className="page-header">
          <h1>สต๊อกเครื่อง</h1>
          <div className="desc">กำลังโหลด...</div>
        </div>
        <div className="stats">
          <div className="skeleton skeleton-card" style={{ height: 70 }}></div>
          <div className="skeleton skeleton-card" style={{ height: 70 }}></div>
        </div>
        <div className="skeleton skeleton-card"></div>
        <div className="skeleton skeleton-card"></div>
      </>
    );
  }

  return (
    <>
      <div className="page-header">
        <h1>สต๊อกเครื่อง</h1>
        <div className="desc">เครื่องที่ยังไม่ได้ขาย • {items.length} เครื่อง</div>
      </div>

      <div className="stats">
        <div className="stat">
          <div className="label">รวมทั้งหมด</div>
          <div className="value accent">{items.length}</div>
        </div>
        <div className="stat">
          <div className="label">มูลค่ารวม</div>
          <div className="value small">฿{(totalValue / 1000).toFixed(0)}K</div>
        </div>
        <div className="stat">
          <div className="label">มือ 1</div>
          <div className="value">{newCount}</div>
        </div>
        <div className="stat">
          <div className="label">มือ 2</div>
          <div className="value">{usedCount}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <Link href="/dashboard/add" className="btn" style={{ width: 'auto', flex: '1 1 200px' }}>
          ➕ เพิ่มเครื่อง
        </Link>
        <Link href="/dashboard/sell" className="btn btn-sec" style={{ width: 'auto', flex: '1 1 200px' }}>
          💰 ขายเครื่อง
        </Link>
        {isAdmin && (
          <Link href="/dashboard/history" className="btn btn-sec" style={{ width: 'auto', flex: '1 1 200px' }}>
            ⏱️ ประวัติการขาย
          </Link>
        )}
        {isAdmin && (
          <button
            onClick={() => setShowImport(true)}
            className="btn btn-sec"
            style={{ width: 'auto', flex: '1 1 200px' }}
          >
            📥 นำเข้า Excel
          </button>
        )}
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
        <select className="filter-select" value={filterCondition} onChange={(e) => setFilterCondition(e.target.value)}>
          <option value="">ทุกสภาพ</option>
          <option value="new">✨ มือ 1</option>
          <option value="used">📱 มือ 2</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">📱</div>
          <div className="empty-title">{items.length === 0 ? 'ยังไม่มีเครื่องในสต๊อก' : 'ไม่พบรายการที่ค้นหา'}</div>
          <div className="empty-sub">{items.length === 0 ? 'กดเพิ่มเครื่องด้านบน' : 'ลองเปลี่ยนคำค้นหา'}</div>
        </div>
      ) : (
        <div className="item-list">
          {filtered.map((item) => (
            <div key={item.id} className="item-card">
              <div className="top-row">
                <div>
                  <div className="model">{item.model}</div>
                  <div className="imei">{item.imei}</div>
                </div>
                <div className="price">฿{Number(item.price).toLocaleString()}</div>
              </div>
              <div className="meta">
                {item.color && <span className="tag">🎨 {item.color}</span>}
                {item.spec && <span className="tag">{item.spec}</span>}
                {item.device_condition === 'new' && <span className="tag success">✨ มือ 1</span>}
                {item.device_condition === 'used' && <span className="tag">📱 มือ 2</span>}
                {isAdmin && item.branch?.name && <span className="tag">📍 {item.branch.name}</span>}
              </div>
              <div className="footer">
                <div className="footer-info">
                  เพิ่มโดย {item.added_by_profile?.full_name || item.added_by_name || '-'} · {new Date(item.created_at).toLocaleDateString('th-TH')}
                </div>
                <div className="actions">
                  <button className="icon-btn" onClick={() => setPrintingLabel(item)} title="ปริ้นป้ายราคา">🏷️</button>
                  <button className="icon-btn" onClick={() => setEditing({ ...item })} title="แก้ไข">✎</button>
                  {isAdmin && (
                    <button className="icon-btn danger" onClick={() => setDeleting(item)} title="ลบ">×</button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Modal */}
      {editing && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setEditing(null)}>
          <div className="modal">
            <h3>แก้ไขเครื่อง</h3>
            <p className="modal-sub" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{editing.imei}</p>
            <div className="form-grid">
              <div className="field full">
                <label>รุ่น</label>
                <input type="text" value={editing.model}
                  onChange={(e) => setEditing({ ...editing, model: e.target.value })} />
              </div>
              <div className="field">
                <label>สี</label>
                <input type="text" value={editing.color || ''}
                  onChange={(e) => setEditing({ ...editing, color: e.target.value })} />
              </div>
              <div className="field">
                <label>สเปค</label>
                <input type="text" value={editing.spec || ''}
                  onChange={(e) => setEditing({ ...editing, spec: e.target.value })} />
              </div>
              <div className="field">
                <label>ราคา</label>
                <input type="number" value={editing.price}
                  onChange={(e) => setEditing({ ...editing, price: e.target.value })} />
              </div>
              <div className="field">
                <label>สภาพ</label>
                <select value={editing.device_condition || ''}
                  onChange={(e) => setEditing({ ...editing, device_condition: e.target.value })}>
                  <option value="">-- เลือก --</option>
                  <option value="new">✨ มือ 1</option>
                  <option value="used">📱 มือ 2</option>
                </select>
              </div>
            </div>
            <div className="modal-actions" style={{ marginTop: 20 }}>
              <button className="btn" onClick={handleSaveEdit}>บันทึก</button>
              <button className="btn btn-sec" onClick={() => setEditing(null)}>ยกเลิก</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deleting && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setDeleting(null)}>
          <div className="modal">
            <h3 style={{ color: 'var(--danger)' }}>ลบเครื่อง?</h3>
            <p className="modal-sub">
              จะลบ <strong>{deleting.model}</strong>?<br />
              {deleting.imei}
            </p>
            <div className="modal-actions">
              <button className="btn btn-danger" onClick={handleDelete}>ลบ</button>
              <button className="btn btn-sec" onClick={() => setDeleting(null)}>ยกเลิก</button>
            </div>
          </div>
        </div>
      )}

      {showImport && profile && (
        <ImportExcel
          type="stock"
          branchId={profile.branch_id}
          shopId={profile.shop_id}
          userId={profile.id}
          userName={profile.full_name || profile.username}
          onClose={() => setShowImport(false)}
          onSuccess={() => { setShowImport(false); loadData(); }}
        />
      )}

      {printingLabel && profile && (
        <LabelPrint30x20
          items={[{
            shopName: profile.shops?.name,
            productName: printingLabel.model,
            variant: [
              printingLabel.color,
              printingLabel.spec,
              printingLabel.device_condition === 'used' ? 'Used' : 'New',
            ].filter(Boolean).join(' '),
            price: Number(printingLabel.price),
            code: printingLabel.imei,
            showBarcode: true,
            showQR: true,
          }]}
          copies={1}
          onClose={() => setPrintingLabel(null)}
        />
      )}

      {toast && <Toast {...toast} />}
    </>
  );
}
