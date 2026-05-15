'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';
import Toast from '@/components/Toast';

export default function GoodsHistoryPage() {
  const supabase = createClient();
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterBranch, setFilterBranch] = useState('');
  const [viewing, setViewing] = useState<any>(null);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [deletingReceipt, setDeletingReceipt] = useState<any>(null);
  const [deletingItem, setDeletingItem] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ title: string; msg: string; type: string } | null>(null);

  function showToast(title: string, msg: string, type: 'success' | 'danger' = 'success') {
    setToast({ title, msg, type });
    setTimeout(() => setToast(null), 2500);
  }

  async function load() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    if (p?.role !== 'admin') {
      router.push('/dashboard/goods/stock');
      return;
    }
    setProfile(p);

    const { data } = await supabase
      .from('goods_sales')
      .select('*, branch:branches(name), sold_by_profile:profiles!goods_sales_sold_by_fkey(full_name)')
      .order('created_at', { ascending: false });
    setItems(data || []);

    const { data: bs } = await supabase.from('branches').select('*').order('name');
    setBranches(bs || []);

    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleSaveEdit() {
    if (!editingItem) return;
    
    const unit_price = parseFloat(editingItem.unit_price) || 0;
    const quantity = parseInt(editingItem.quantity) || 1;
    const subtotal = unit_price * quantity;

    setSubmitting(true);
    const { error } = await supabase.from('goods_sales').update({
      name: editingItem.name,
      sku: editingItem.sku,
      category: editingItem.category || null,
      unit_price,
      quantity,
      subtotal,
    }).eq('id', editingItem.id);
    setSubmitting(false);

    if (error) {
      showToast('แก้ไม่สำเร็จ', error.message, 'danger');
      return;
    }

    showToast('แก้ไขสำเร็จ', '');
    setEditingItem(null);
    setViewing(null);
    load();
  }

  async function handleDeleteItem() {
    if (!deletingItem) return;
    setSubmitting(true);
    const { error } = await supabase.from('goods_sales').delete().eq('id', deletingItem.id);
    setSubmitting(false);
    if (error) {
      showToast('ลบไม่สำเร็จ', error.message, 'danger');
      return;
    }
    showToast('ลบรายการแล้ว', '');
    setDeletingItem(null);
    setViewing(null);
    load();
  }

  async function handleDeleteReceipt() {
    if (!deletingReceipt) return;
    setSubmitting(true);
    const { error } = await supabase.from('goods_sales').delete().eq('receipt_id', deletingReceipt.receipt_id);
    setSubmitting(false);
    if (error) {
      showToast('ลบไม่สำเร็จ', error.message, 'danger');
      return;
    }
    showToast('ลบใบเสร็จแล้ว', '');
    setDeletingReceipt(null);
    setViewing(null);
    load();
  }

  // Group โดย receipt_id (รวมเป็นใบเสร็จ)
  const receipts = items.reduce((acc: any, item) => {
    if (!acc[item.receipt_id]) {
      acc[item.receipt_id] = {
        receipt_id: item.receipt_id,
        sold_date: item.sold_date,
        sold_by_name: item.sold_by_profile?.full_name || item.sold_by_name,
        branch_name: item.branch?.name,
        branch_id: item.branch_id,
        created_at: item.created_at,
        items: [],
        total: 0,
        item_count: 0,
        qty_total: 0,
      };
    }
    acc[item.receipt_id].items.push(item);
    acc[item.receipt_id].total += Number(item.subtotal);
    acc[item.receipt_id].item_count += 1;
    acc[item.receipt_id].qty_total += item.quantity;
    return acc;
  }, {});

  const receiptList: any[] = Object.values(receipts);

  const filtered = receiptList.filter((r) => {
    const s = search.toLowerCase();
    const matchSearch = !s ||
      r.items.some((i: any) => i.name.toLowerCase().includes(s) || i.sku.toLowerCase().includes(s)) ||
      (r.sold_by_name && r.sold_by_name.toLowerCase().includes(s));
    const matchBranch = !filterBranch || r.branch_id === filterBranch;
    return matchSearch && matchBranch;
  });

  const totalRevenue = filtered.reduce((sum, r) => sum + r.total, 0);
  const totalReceipts = filtered.length;
  
  const countByBranch = branches.reduce((acc: any, b) => {
    acc[b.id] = receiptList.filter((r) => r.branch_id === b.id).length;
    return acc;
  }, {});

  if (loading) {
    return <div className="loading"><div className="spinner"></div><div>กำลังโหลด...</div></div>;
  }

  return (
    <>
      <div className="page-header">
        <h2>ประวัติขายของ <span className="badge-admin">ADMIN</span></h2>
        <div className="desc">รายการขายอุปกรณ์เสริม + อะไหล่</div>
      </div>

      <div className="stats">
        <div className="stat">
          <div className="label">// RECEIPTS</div>
          <div className="value accent">{totalReceipts}</div>
        </div>
        <div className="stat">
          <div className="label">// REVENUE</div>
          <div className="value small">฿{totalRevenue.toLocaleString()}</div>
        </div>
      </div>

      {branches.length > 0 && (
        <div className="branch-tabs">
          <button
            className={`branch-tab ${filterBranch === '' ? 'active' : ''}`}
            onClick={() => setFilterBranch('')}
          >
            <span>ทุกสาขา</span>
            <span className="count">{receiptList.length}</span>
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
          <input type="text" placeholder="ค้นหา ชื่อสินค้า, SKU, ผู้ขาย..."
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">📜</div>
          <div className="empty-title">ยังไม่มีประวัติ</div>
        </div>
      ) : (
        <div className="item-list">
          {filtered.map((r) => (
            <div key={r.receipt_id} className="item-card">
              <div onClick={() => setViewing(r)} style={{ cursor: 'pointer' }}>
                <div className="top-row">
                  <div className="model">
                    ใบเสร็จ #{r.receipt_id.slice(0, 8).toUpperCase()}
                  </div>
                  <div className="price">฿{r.total.toLocaleString()}</div>
                </div>
                <div className="imei">
                  {r.items.length} รายการ • {r.qty_total} ชิ้น
                </div>
                <div className="meta">
                  {r.branch_name && <span className="tag">{r.branch_name}</span>}
                  <span className="tag success">
                    ขายโดย: {r.sold_by_name || '-'}
                  </span>
                </div>
              </div>
              <div className="footer">
                <div className="footer-info">
                  {new Date(r.created_at).toLocaleString('th-TH')}
                </div>
                <div className="actions">
                  <button className="icon-btn" onClick={() => setViewing(r)} title="ดูรายละเอียด">👁</button>
                  <button className="icon-btn danger" onClick={(e) => { e.stopPropagation(); setDeletingReceipt(r); }} title="ลบใบเสร็จ">×</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {viewing && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setViewing(null)}>
          <div className="modal">
            <h3>ใบเสร็จ #{viewing.receipt_id.slice(0, 8).toUpperCase()}</h3>
            <p className="modal-sub">
              {new Date(viewing.created_at).toLocaleString('th-TH')} • {viewing.branch_name}
            </p>

            <div style={{ marginBottom: 16 }}>
              {viewing.items.map((item: any, idx: number) => (
                <div key={idx} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: 10,
                  borderBottom: '1px solid var(--border)',
                  alignItems: 'center',
                  gap: 8,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{item.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'JetBrains Mono, monospace' }}>
                      {item.sku} • ฿{Number(item.unit_price).toLocaleString()} × {item.quantity}
                    </div>
                  </div>
                  <div style={{ fontWeight: 600, color: 'var(--accent)', whiteSpace: 'nowrap' }}>
                    ฿{Number(item.subtotal).toLocaleString()}
                  </div>
                  <div style={{ display: 'flex', gap: 2 }}>
                    <button className="icon-btn" onClick={() => setEditingItem({ ...item })}
                      title="แก้ไข" style={{ width: 28, height: 28, fontSize: 12 }}>✎</button>
                    <button className="icon-btn danger" onClick={() => setDeletingItem(item)}
                      title="ลบรายการนี้" style={{ width: 28, height: 28, fontSize: 14 }}>×</button>
                  </div>
                </div>
              ))}
            </div>

            <div style={{
              display: 'flex', justifyContent: 'space-between',
              fontSize: 20, fontWeight: 700, color: 'var(--accent)',
              padding: 12, background: 'var(--surface-2)',
            }}>
              <span>รวม:</span>
              <span>฿{viewing.total.toLocaleString()}</span>
            </div>

            <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-dim)' }}>
              ขายโดย: {viewing.sold_by_name || '-'}
            </div>

            <div className="modal-actions" style={{ marginTop: 16 }}>
              <button className="btn btn-danger" onClick={() => setDeletingReceipt(viewing)} style={{ flex: 1 }}>
                ลบทั้งใบเสร็จ
              </button>
              <button className="btn btn-sec" onClick={() => setViewing(null)} style={{ flex: 1 }}>
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Item Modal */}
      {editingItem && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setEditingItem(null)}>
          <div className="modal">
            <h3>แก้ไขรายการ</h3>
            <p className="modal-sub" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{editingItem.sku}</p>
            <div className="form-grid">
              <div className="field full">
                <label>ชื่อสินค้า</label>
                <input type="text" value={editingItem.name}
                  onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })} />
              </div>
              <div className="field">
                <label>ราคา/ชิ้น</label>
                <input type="number" value={editingItem.unit_price}
                  onChange={(e) => setEditingItem({ ...editingItem, unit_price: e.target.value })} />
              </div>
              <div className="field">
                <label>จำนวน</label>
                <input type="number" value={editingItem.quantity}
                  onChange={(e) => setEditingItem({ ...editingItem, quantity: e.target.value })} />
              </div>
              <div className="field full">
                <label>ยอดรวม (คำนวณอัตโนมัติ)</label>
                <input type="text" disabled
                  value={`฿${((parseFloat(editingItem.unit_price) || 0) * (parseInt(editingItem.quantity) || 0)).toLocaleString()}`}
                  style={{ opacity: 0.8, fontWeight: 600, color: 'var(--accent)' }} />
              </div>
            </div>
            <div className="modal-actions" style={{ marginTop: 20 }}>
              <button className="btn" onClick={handleSaveEdit} disabled={submitting}>
                {submitting ? 'กำลังบันทึก...' : 'บันทึก ✓'}
              </button>
              <button className="btn btn-sec" onClick={() => setEditingItem(null)}>ยกเลิก</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Item Modal */}
      {deletingItem && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setDeletingItem(null)}>
          <div className="modal">
            <h3 style={{ color: 'var(--danger)' }}>ลบรายการ?</h3>
            <p className="modal-sub">
              ลบ <strong>{deletingItem.name}</strong> ออกจากใบเสร็จ?<br />
              ⚠️ ลบแล้วกู้คืนไม่ได้
            </p>
            <div className="modal-actions">
              <button className="btn btn-danger" onClick={handleDeleteItem} disabled={submitting}>
                ลบ
              </button>
              <button className="btn btn-sec" onClick={() => setDeletingItem(null)}>ยกเลิก</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Receipt Modal */}
      {deletingReceipt && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setDeletingReceipt(null)}>
          <div className="modal">
            <h3 style={{ color: 'var(--danger)' }}>ลบทั้งใบเสร็จ?</h3>
            <p className="modal-sub">
              ใบเสร็จ #{deletingReceipt.receipt_id.slice(0, 8).toUpperCase()}<br />
              {deletingReceipt.items.length} รายการ • รวม ฿{deletingReceipt.total.toLocaleString()}<br />
              ⚠️ <strong>ลบแล้วกู้คืนไม่ได้</strong>
            </p>
            <div className="modal-actions">
              <button className="btn btn-danger" onClick={handleDeleteReceipt} disabled={submitting}>
                {submitting ? 'กำลังลบ...' : 'ลบใบเสร็จ'}
              </button>
              <button className="btn btn-sec" onClick={() => setDeletingReceipt(null)}>ยกเลิก</button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast {...toast} />}
    </>
  );
}
