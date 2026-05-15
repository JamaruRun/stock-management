'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase-client';
import Link from 'next/link';
import Toast from '@/components/Toast';
import ImportExcel from '@/components/ImportExcel';

interface InstallmentItem {
  id: string;
  imei: string;
  model: string;
  color?: string;
  spec?: string;
  full_price: number;
  down_payment: number;
  installment_amount: number;
  total_periods: number;
  start_date: string;
  customer_name: string;
  customer_phone: string;
  customer_id_card: string;
  added_by_name?: string;
  added_by_profile?: { full_name: string };
  branch_id?: string;
  branch?: { name: string };
  paid_periods: number;
  total_paid: number;
}

export default function InstallmentStockPage() {
  const supabase = createClient();
  const [items, setItems] = useState<InstallmentItem[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterBranch, setFilterBranch] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [toast, setToast] = useState<{ title: string; msg: string; type: string } | null>(null);

  function showToast(title: string, msg: string, type: 'success' | 'danger' = 'success') {
    setToast({ title, msg, type });
    setTimeout(() => setToast(null), 2500);
  }

  async function loadData() {
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data: profileData } = await supabase
      .from('profiles').select('*').eq('id', user.id).single();
    setProfile(profileData);

    const { data: stockData } = await supabase
      .from('installment_stock')
      .select('*, added_by_profile:profiles!installment_stock_added_by_fkey(full_name), branch:branches(name)')
      .order('created_at', { ascending: false });

    // ดึงจำนวนงวดที่จ่ายแล้วของแต่ละรายการ
    const itemsWithPayments = await Promise.all(
      (stockData || []).map(async (item) => {
        const { data: payments } = await supabase
          .from('installment_payments')
          .select('amount')
          .eq('installment_id', item.id);
        const totalPaid = (payments || []).reduce((sum, p) => sum + Number(p.amount), 0);
        return {
          ...item,
          paid_periods: payments?.length || 0,
          total_paid: totalPaid,
        };
      })
    );

    setItems(itemsWithPayments as any);

    if (profileData?.role === 'admin') {
      const { data: branchesData } = await supabase.from('branches').select('*').order('name');
      setBranches(branchesData || []);
    }

    setLoading(false);
  }

  useEffect(() => { loadData(); }, []);

  const isAdmin = profile?.role === 'admin';
  const countByBranch = branches.reduce((acc: any, b) => {
    acc[b.id] = items.filter((i) => i.branch_id === b.id).length;
    return acc;
  }, {});

  // คำนวณสถานะของแต่ละรายการ
  function getStatus(item: InstallmentItem) {
    const remaining = item.total_periods - item.paid_periods;
    if (remaining === 0) return { label: 'ครบแล้ว', color: 'var(--success)', urgent: false };
    if (remaining <= 2) return { label: `เหลือ ${remaining} งวด`, color: 'var(--warning)', urgent: false };
    
    // ตรวจว่าเลยกำหนดไหม - คำนวณงวดที่ควรจ่ายแล้ว
    const startDate = new Date(item.start_date);
    const now = new Date();
    const monthsPassed = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30));
    
    if (monthsPassed > item.paid_periods) {
      return { label: `ค้าง ${monthsPassed - item.paid_periods} งวด`, color: 'var(--danger)', urgent: true };
    }
    
    return { label: 'ปกติ', color: 'var(--text-dim)', urgent: false };
  }

  const filtered = items.filter((item) => {
    const s = search.toLowerCase();
    const matchSearch = !s ||
      item.imei.toLowerCase().includes(s) ||
      item.model.toLowerCase().includes(s) ||
      item.customer_name.toLowerCase().includes(s) ||
      item.customer_phone.includes(s) ||
      item.customer_id_card.includes(s);
    
    const matchBranch = !filterBranch || item.branch_id === filterBranch;
    if (!matchBranch) return false;
    
    if (!filterStatus) return matchSearch;
    const status = getStatus(item);
    if (filterStatus === 'overdue' && !status.urgent) return false;
    if (filterStatus === 'normal' && status.urgent) return false;
    if (filterStatus === 'almost-done') {
      const remaining = item.total_periods - item.paid_periods;
      return matchSearch && remaining > 0 && remaining <= 2;
    }
    
    return matchSearch;
  });

  const stats = {
    total: items.length,
    overdue: items.filter(i => getStatus(i).urgent).length,
    almostDone: items.filter(i => {
      const r = i.total_periods - i.paid_periods;
      return r > 0 && r <= 2;
    }).length,
    totalValue: items.reduce((sum, i) => sum + (Number(i.installment_amount) * (i.total_periods - i.paid_periods)), 0),
  };

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
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <h2>สต๊อกผ่อน</h2>
          <div className="desc">เครื่องที่ลูกค้าผ่อนอยู่</div>
        </div>
        {isAdmin && profile?.shop_id && profile?.branch_id && (
          <button
            onClick={() => setShowImport(true)}
            style={{
              padding: '6px 12px',
              background: 'transparent',
              border: '1px solid var(--border)',
              color: 'var(--text-dim)',
              fontFamily: 'inherit',
              fontSize: 11,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              alignSelf: 'flex-start',
            }}
            title="นำเข้าข้อมูลจาก Excel"
          >
            📥 นำเข้า Excel
          </button>
        )}
      </div>

      {showImport && profile?.shop_id && profile?.branch_id && (
        <ImportExcel
          type="installment"
          branchId={profile.branch_id}
          shopId={profile.shop_id}
          userId={profile.id}
          userName={profile.full_name}
          onClose={() => setShowImport(false)}
          onSuccess={loadData}
        />
      )}

      <div className="stats">
        <div className="stat">
          <div className="label">// ACTIVE</div>
          <div className="value accent">{stats.total}</div>
        </div>
        <div className="stat">
          <div className="label">// OVERDUE</div>
          <div className="value" style={{ color: 'var(--danger)' }}>{stats.overdue}</div>
        </div>
        <div className="stat">
          <div className="label">// ALMOST DONE</div>
          <div className="value" style={{ color: 'var(--warning)' }}>{stats.almostDone}</div>
        </div>
        <div className="stat">
          <div className="label">// REMAINING</div>
          <div className="value small">฿{stats.totalValue.toLocaleString()}</div>
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
          <input type="text" placeholder="ค้นหา IMEI, รุ่น, ลูกค้า, เบอร์, บัตรปชช..."
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="filter-select" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">ทุกสถานะ</option>
          <option value="normal">ปกติ</option>
          <option value="overdue">ค้างชำระ</option>
          <option value="almost-done">ใกล้ครบ (เหลือ ≤2 งวด)</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">💳</div>
          <div className="empty-title">ไม่มีเครื่องผ่อน</div>
          <div className="empty-sub">
            {search || filterStatus ? 'ไม่พบรายการที่ค้นหา' : 'ยังไม่มีเครื่องที่ผ่อนอยู่'}
          </div>
        </div>
      ) : (
        <div className="item-list">
          {filtered.map((item) => {
            const status = getStatus(item);
            const remaining = (Number(item.installment_amount) * (item.total_periods - item.paid_periods));
            const progress = (item.paid_periods / item.total_periods) * 100;
            
            return (
              <Link href={`/dashboard/installment/detail?id=${item.id}`} key={item.id}
                style={{ textDecoration: 'none', color: 'inherit' }}>
                <div className="item-card" style={{ cursor: 'pointer' }}>
                  <div className="top-row">
                    <div className="model">{item.model}</div>
                    <div className="price">฿{Number(item.installment_amount).toLocaleString()}/ง.</div>
                  </div>
                  <div className="imei">IMEI: {item.imei}</div>
                  
                  {/* Progress bar */}
                  <div style={{ margin: '8px 0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}>
                      <span style={{ color: 'var(--text-dim)' }}>
                        {item.paid_periods}/{item.total_periods} งวด
                      </span>
                      <span style={{ color: status.color, fontWeight: 600 }}>
                        {status.label}
                      </span>
                    </div>
                    <div style={{ height: 4, background: 'var(--surface-2)', borderRadius: 0, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${progress}%`,
                        background: status.urgent ? 'var(--danger)' : 'var(--accent)',
                        transition: 'width 0.3s'
                      }} />
                    </div>
                  </div>
                  
                  <div className="meta">
                    {item.color && <span className="tag">{item.color}</span>}
                    {item.spec && <span className="tag">{item.spec}</span>}
                    <span className="tag" style={{ color: '#ffa502', borderColor: '#ffa502' }}>
                      👤 {item.customer_name}
                    </span>
                    <span className="tag">📞 {item.customer_phone}</span>
                  </div>
                  <div className="footer">
                    <div className="footer-info">
                      เริ่ม {item.start_date} • คงเหลือ ฿{remaining.toLocaleString()}
                    </div>
                    <div className="actions">
                      <button className="icon-btn" title="ดูรายละเอียด">→</button>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {toast && <Toast {...toast} />}
    </>
  );
}
