'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-client';
import Toast from '@/components/Toast';

export default function GoodsStockPage() {
  const supabase = createClient();
  const [items, setItems] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterBranch, setFilterBranch] = useState('');
  const [editing, setEditing] = useState<any>(null);
  const [deleting, setDeleting] = useState<any>(null);
  const [toast, setToast] = useState<{ title: string; msg: string; type: string } | null>(null);

  function showToast(title: string, msg: string, type: 'success' | 'danger' = 'success') {
    setToast({ title, msg, type });
    setTimeout(() => setToast(null), 2500);
  }

  async function loadData() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    setProfile(p);

    const { data: goodsData } = await supabase
      .from('goods')
      .select('*, branch:branches(name)')
      .order('created_at', { ascending: false });
    setItems(goodsData || []);

    if (p?.role === 'admin') {
      const { data: bs } = await supabase.from('branches').select('*').order('name');
      setBranches(bs || []);
    }

    setLoading(false);
  }

  useEffect(() => { loadData(); }, []);

  const isAdmin = profile?.role === 'admin';
  const categories = Array.from(new Set(items.map((i) => i.category).filter(Boolean)));
  const countByBranch = branches.reduce((acc: any, b) => {
    acc[b.id] = items.filter((i) => i.branch_id === b.id).length;
    return acc;
  }, {});

  const filtered = items.filter((item) => {
    const s = search.toLowerCase();
    const matchSearch = !s ||
      item.name.toLowerCase().includes(s) ||
      item.sku.toLowerCase().includes(s) ||
      (item.category && item.category.toLowerCase().includes(s));
    const matchCat = !filterCategory || item.category === filterCategory;
    const matchBranch = !filterBranch || item.branch_id === filterBranch;
    return matchSearch && matchCat && matchBranch;
  });

  const totalQty = items.reduce((sum, i) => sum + (i.stock_qty || 0), 0);
  const totalValue = items.reduce((sum, i) => sum + (i.stock_qty * i.sell_price), 0);
  const lowStockCount = items.filter(i => i.stock_qty <= (i.low_stock_alert || 5)).length;

  async function handleSaveEdit() {
    if (!editing) return;
    if (!editing.name || !editing.sell_price) {
      showToast('ข้อมูลไม่ครบ', '', 'danger');
      return;
    }

    const { error } = await supabase.from('goods').update({
      name: editing.name,
      category: editing.category || null,
      cost_price: parseFloat(editing.cost_price) || 0,
      sell_price: parseFloat(editing.sell_price),
      stock_qty: parseInt(editing.stock_qty) || 0,
      low_stock_alert: parseInt(editing.low_stock_alert) || 5,
      note: editing.note || null,
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
    const { error } = await supabase.from('goods').delete().eq('id', deleting.id);
    if (error) {
      showToast('ลบไม่สำเร็จ', error.message, 'danger');
      return;
    }
    showToast('ลบแล้ว', '');
    setDeleting(null);
    loadData();
  }

  if (loading) {
    return <div className="loading"><div className="spinner"></div><div>กำลังโหลด...</div></div>;
  }

  return (
    <>
      <div className="page-header">
        <h2>สต๊อกของ 🎒</h2>
        <div className="desc">อุปกรณ์เสริม + อะไหล่ที่ขายในร้าน</div>
      </div>

      <div className="stats">
        <div className="stat">
          <div className="label">// SKU</div>
          <div className="value accent">{items.length}</div>
        </div>
        <div className="stat">
          <div className="label">// TOTAL QTY</div>
          <div className="value">{totalQty}</div>
        </div>
        <div className="stat">
          <div className="label">// VALUE</div>
          <div className="value small">฿{totalValue.toLocaleString()}</div>
        </div>
        <div className="stat">
          <div className="label">// LOW STOCK</div>
          <div className="value" style={{ color: lowStockCount > 0 ? '#ff4757' : 'var(--text-dim)' }}>
            {lowStockCount}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <Link href="/dashboard/goods/add" className="btn" style={{ width: 'auto', flex: '1 1 200px' }}>
          + เพิ่มสินค้า
        </Link>
        <Link href="/dashboard/goods/print" className="btn btn-sec" style={{ width: 'auto', flex: '1 1 200px' }}>
          🖨️ ปริ้น Barcode
        </Link>
        <Link href="/dashboard/goods/sell" className="btn btn-sec" style={{ 
          width: 'auto', 
          flex: '1 1 200px',
          background: 'var(--success)',
          color: '#fff',
          borderColor: 'var(--success)',
        }}>
          📷 ขายของ (สแกน)
        </Link>
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
            placeholder="ค้นหา ชื่อ, SKU, หมวด..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="filter-select" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
          <option value="">ทุกหมวด</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">🎒</div>
          <div className="empty-title">ยังไม่มีสินค้า</div>
          <div className="empty-sub">{search || filterCategory ? 'ไม่พบรายการที่ค้นหา' : 'กดเพิ่มสินค้าด้านบน'}</div>
        </div>
      ) : (
        <div className="item-list">
          {filtered.map((item) => {
            const isLow = item.stock_qty <= (item.low_stock_alert || 5);
            const isOut = item.stock_qty <= 0;
            return (
              <div key={item.id} className="item-card">
                <div className="top-row">
                  <div className="model">{item.name}</div>
                  <div className="price">฿{Number(item.sell_price).toLocaleString()}</div>
                </div>
                <div className="imei" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                  {item.sku}
                </div>
                <div className="meta">
                  {item.category && <span className="tag">{item.category}</span>}
                  <span className="tag" style={{
                    color: isOut ? '#ff4757' : isLow ? '#ffa502' : 'var(--success)',
                    borderColor: isOut ? '#ff4757' : isLow ? '#ffa502' : 'var(--success)',
                    fontWeight: 600,
                  }}>
                    📦 คงเหลือ {item.stock_qty}
                    {isOut && ' (หมด!)'}
                    {!isOut && isLow && ' (ใกล้หมด)'}
                  </span>
                  {isAdmin && item.branch?.name && <span className="tag">{item.branch.name}</span>}
                </div>
                <div className="footer">
                  <div className="footer-info">
                    {isAdmin ? (
                      <>ทุน ฿{Number(item.cost_price).toLocaleString()} → ขาย ฿{Number(item.sell_price).toLocaleString()}</>
                    ) : (
                      <>ราคาขาย ฿{Number(item.sell_price).toLocaleString()}</>
                    )}
                  </div>
                  <div className="actions">
                    <button className="icon-btn" onClick={() => setEditing({ ...item })} title="แก้ไข">✎</button>
                    {isAdmin && (
                      <button className="icon-btn danger" onClick={() => setDeleting(item)} title="ลบ">×</button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Modal */}
      {editing && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setEditing(null)}>
          <div className="modal">
            <h3>แก้ไขสินค้า</h3>
            <p className="modal-sub" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{editing.sku}</p>
            <div className="form-grid">
              <div className="field full">
                <label>ชื่อสินค้า</label>
                <input type="text" value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div className="field">
                <label>หมวดหมู่</label>
                <input type="text" value={editing.category || ''}
                  onChange={(e) => setEditing({ ...editing, category: e.target.value })} />
              </div>
              <div className="field">
                <label>คงเหลือ</label>
                <input type="number" value={editing.stock_qty}
                  onChange={(e) => setEditing({ ...editing, stock_qty: e.target.value })} />
              </div>
              {isAdmin && (
                <div className="field">
                  <label>ราคาทุน <span style={{ color: 'var(--text-dim)', fontSize: 10 }}>(Admin)</span></label>
                  <input type="number" value={editing.cost_price}
                    onChange={(e) => setEditing({ ...editing, cost_price: e.target.value })} />
                </div>
              )}
              <div className="field">
                <label>ราคาขาย</label>
                <input type="number" value={editing.sell_price}
                  onChange={(e) => setEditing({ ...editing, sell_price: e.target.value })} />
              </div>
              <div className="field full">
                <label>แจ้งเตือนเมื่อคงเหลือต่ำกว่า</label>
                <input type="number" value={editing.low_stock_alert || 5}
                  onChange={(e) => setEditing({ ...editing, low_stock_alert: e.target.value })} />
              </div>
              <div className="field full">
                <label>หมายเหตุ</label>
                <input type="text" value={editing.note || ''}
                  onChange={(e) => setEditing({ ...editing, note: e.target.value })} />
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
            <h3 style={{ color: 'var(--danger)' }}>ลบสินค้า?</h3>
            <p className="modal-sub">
              จะลบ <strong>{deleting.name}</strong>?<br />
              ประวัติการขายที่เคยมีจะยังอยู่
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
