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
            <div key={r.receipt_id} className="item-card" onClick={() => setViewing(r)} style={{ cursor: 'pointer' }}>
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
              <div className="footer">
                <div className="footer-info">
                  {new Date(r.created_at).toLocaleString('th-TH')}
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
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{item.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'JetBrains Mono, monospace' }}>
                      {item.sku} • ฿{Number(item.unit_price).toLocaleString()} × {item.quantity}
                    </div>
                  </div>
                  <div style={{ fontWeight: 600, color: 'var(--accent)' }}>
                    ฿{Number(item.subtotal).toLocaleString()}
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
              <button className="btn btn-sec" onClick={() => setViewing(null)} style={{ width: '100%' }}>
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
