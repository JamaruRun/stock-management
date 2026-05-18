'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase-client';
import Toast from '@/components/Toast';

type Period = '7days' | '30days' | '90days' | 'thismonth' | 'lastmonth';

interface DailySale {
  date: string;
  label: string;
  revenue: number;
  profit: number;
  count: number;
}

interface ModelSale {
  model: string;
  count: number;
  revenue: number;
  profit: number;
}

interface BranchSale {
  branch_name: string;
  count: number;
  revenue: number;
  profit: number;
}

export default function ReportsPage() {
  const supabase = createClient();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>('30days');
  const [filterBranch, setFilterBranch] = useState('');
  const [branches, setBranches] = useState<any[]>([]);
  
  const [dailySales, setDailySales] = useState<DailySale[]>([]);
  const [topModels, setTopModels] = useState<ModelSale[]>([]);
  const [branchSales, setBranchSales] = useState<BranchSale[]>([]);
  const [summary, setSummary] = useState({
    totalRevenue: 0,
    totalProfit: 0,
    totalOrders: 0,
    avgPerDay: 0,
    profitMargin: 0,
    goodsRevenue: 0,
  });

  const [toast, setToast] = useState<{ title: string; msg: string; type: string } | null>(null);

  function showToast(title: string, msg: string, type: 'success' | 'danger' = 'success') {
    setToast({ title, msg, type });
    setTimeout(() => setToast(null), 2500);
  }

  function getDateRange(p: Period): { start: string; end: string; days: number } {
    const end = new Date();
    let start = new Date();
    let days = 30;

    switch (p) {
      case '7days':
        start.setDate(end.getDate() - 7);
        days = 7;
        break;
      case '30days':
        start.setDate(end.getDate() - 30);
        days = 30;
        break;
      case '90days':
        start.setDate(end.getDate() - 90);
        days = 90;
        break;
      case 'thismonth':
        start = new Date(end.getFullYear(), end.getMonth(), 1);
        days = end.getDate();
        break;
      case 'lastmonth':
        start = new Date(end.getFullYear(), end.getMonth() - 1, 1);
        end.setDate(0);
        days = end.getDate();
        break;
    }

    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
      days,
    };
  }

  async function loadReport() {
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data: p } = await supabase
      .from('profiles').select('*').eq('id', user.id).single();
    setProfile(p);

    if (p?.role === 'admin') {
      const { data: bs } = await supabase.from('branches').select('*').order('name');
      setBranches(bs || []);
    }

    const range = getDateRange(period);

    // Build query
    let salesQuery = supabase
      .from('sales_history')
      .select('sold_date, final_price, profit, model, branch_id, branch:branches(name)')
      .gte('sold_date', range.start)
      .lte('sold_date', range.end);

    let goodsQuery = supabase
      .from('goods_sales')
      .select('sold_date, total_price, profit')
      .gte('sold_date', range.start)
      .lte('sold_date', range.end);

    if (filterBranch) {
      salesQuery = salesQuery.eq('branch_id', filterBranch);
      goodsQuery = goodsQuery.eq('branch_id', filterBranch);
    }

    const [salesRes, goodsRes] = await Promise.all([salesQuery, goodsQuery]);

    const sales = salesRes.data || [];
    const goods = goodsRes.data || [];

    // === Daily Sales (7-30 วัน) ===
    const dailyMap = new Map<string, DailySale>();
    const showDays = Math.min(range.days, 30);
    
    for (let i = showDays - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const label = d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
      dailyMap.set(dateStr, { date: dateStr, label, revenue: 0, profit: 0, count: 0 });
    }

    sales.forEach((s: any) => {
      const entry = dailyMap.get(s.sold_date);
      if (entry) {
        entry.revenue += Number(s.final_price || 0);
        entry.profit += Number(s.profit || 0);
        entry.count += 1;
      }
    });

    goods.forEach((g: any) => {
      const entry = dailyMap.get(g.sold_date);
      if (entry) {
        entry.revenue += Number(g.total_price || 0);
        entry.profit += Number(g.profit || 0);
      }
    });

    setDailySales(Array.from(dailyMap.values()));

    // === Top Models ===
    const modelMap = new Map<string, ModelSale>();
    sales.forEach((s: any) => {
      const key = s.model;
      if (!modelMap.has(key)) {
        modelMap.set(key, { model: key, count: 0, revenue: 0, profit: 0 });
      }
      const m = modelMap.get(key)!;
      m.count += 1;
      m.revenue += Number(s.final_price || 0);
      m.profit += Number(s.profit || 0);
    });

    const topList = Array.from(modelMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    setTopModels(topList);

    // === Branch Sales ===
    if (p?.role === 'admin' && !filterBranch) {
      const branchMap = new Map<string, BranchSale>();
      sales.forEach((s: any) => {
        const key = s.branch?.name || 'ไม่ระบุสาขา';
        if (!branchMap.has(key)) {
          branchMap.set(key, { branch_name: key, count: 0, revenue: 0, profit: 0 });
        }
        const b = branchMap.get(key)!;
        b.count += 1;
        b.revenue += Number(s.final_price || 0);
        b.profit += Number(s.profit || 0);
      });
      setBranchSales(Array.from(branchMap.values()).sort((a, b) => b.revenue - a.revenue));
    } else {
      setBranchSales([]);
    }

    // === Summary ===
    const totalSalesRevenue = sales.reduce((s, r: any) => s + Number(r.final_price || 0), 0);
    const totalSalesProfit = sales.reduce((s, r: any) => s + Number(r.profit || 0), 0);
    const totalGoodsRevenue = goods.reduce((s, r: any) => s + Number(r.total_price || 0), 0);
    const totalGoodsProfit = goods.reduce((s, r: any) => s + Number(r.profit || 0), 0);
    const totalRevenue = totalSalesRevenue + totalGoodsRevenue;
    const totalProfit = totalSalesProfit + totalGoodsProfit;
    const totalOrders = sales.length;

    setSummary({
      totalRevenue,
      totalProfit,
      totalOrders,
      avgPerDay: range.days > 0 ? totalRevenue / range.days : 0,
      profitMargin: totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0,
      goodsRevenue: totalGoodsRevenue,
    });

    setLoading(false);
  }

  useEffect(() => { loadReport(); }, [period, filterBranch]);

  const isAdmin = profile?.role === 'admin';

  // Max value สำหรับ scale กราฟ
  const maxDailyRevenue = Math.max(...dailySales.map(d => d.revenue), 1);

  function exportCSV() {
    const rows = [
      ['วันที่', 'รายได้', 'กำไร', 'จำนวนออเดอร์'],
      ...dailySales.map(d => [d.date, d.revenue.toString(), d.profit.toString(), d.count.toString()]),
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `รายงาน-${period}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Export สำเร็จ', 'ดาวน์โหลด CSV แล้ว');
  }

  if (loading) {
    return (
      <>
        <div className="page-header">
          <h1>📊 รายงาน</h1>
          <div className="desc">กำลังโหลด...</div>
        </div>
        <div className="skeleton skeleton-card" style={{ height: 100 }}></div>
        <div className="skeleton skeleton-card" style={{ height: 200 }}></div>
      </>
    );
  }

  if (!isAdmin) {
    return (
      <>
        <div className="page-header">
          <h1>📊 รายงาน</h1>
        </div>
        <div className="form-card">
          <div className="empty">
            <div className="empty-icon">🔒</div>
            <div className="empty-title">เฉพาะเจ้าของร้าน</div>
            <div className="empty-sub">หน้ารายงานสำหรับ Admin เท่านั้น</div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-header">
        <h1>📊 รายงาน <span className="badge-admin">ADMIN</span></h1>
        <div className="desc">รายได้ • กำไร • รุ่นขายดี • วิเคราะห์ยอดขาย</div>
      </div>

      {/* Period Selector */}
      <div className="toolbar" style={{ marginBottom: 20 }}>
        <select className="filter-select" value={period} onChange={(e) => setPeriod(e.target.value as Period)} 
          style={{ flex: '1 1 200px' }}>
          <option value="7days">7 วันล่าสุด</option>
          <option value="30days">30 วันล่าสุด</option>
          <option value="90days">90 วันล่าสุด</option>
          <option value="thismonth">เดือนนี้</option>
          <option value="lastmonth">เดือนที่แล้ว</option>
        </select>
        {branches.length > 0 && (
          <select className="filter-select" value={filterBranch} onChange={(e) => setFilterBranch(e.target.value)}
            style={{ flex: '1 1 200px' }}>
            <option value="">ทุกสาขา</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        )}
        <button onClick={exportCSV} className="btn btn-sec" style={{ width: 'auto', flex: '1 1 140px' }}>
          📥 Export CSV
        </button>
      </div>

      {/* Hero Summary */}
      <div className="hero-card">
        <div className="hero-card-header">
          <div>
            <div className="hero-card-label">รายได้รวม</div>
            <div className="hero-card-value">฿{summary.totalRevenue.toLocaleString()}</div>
          </div>
          {summary.totalOrders > 0 && (
            <div className="hero-card-trend">
              {summary.totalOrders} ออเดอร์
            </div>
          )}
        </div>
        <div className="hero-card-stats">
          <div className="hero-card-stat">
            <span>💰</span>
            <span>กำไร ฿{summary.totalProfit.toLocaleString()}</span>
          </div>
          <div className="hero-card-stat">
            <span>📈</span>
            <span>มาร์จิ้น {summary.profitMargin.toFixed(1)}%</span>
          </div>
          <div className="hero-card-stat">
            <span>📅</span>
            <span>เฉลี่ย ฿{Math.round(summary.avgPerDay).toLocaleString()}/วัน</span>
          </div>
        </div>
      </div>

      {/* Daily Sales Chart */}
      <div className="form-card">
        <h3>📈 รายได้รายวัน ({dailySales.length} วัน)</h3>
        
        {dailySales.every(d => d.revenue === 0) ? (
          <div className="empty">
            <div className="empty-icon">📊</div>
            <div className="empty-title">ยังไม่มียอดขายในช่วงนี้</div>
            <div className="empty-sub">ลองเลือกช่วงอื่น</div>
          </div>
        ) : (
          <div style={{ marginTop: 16 }}>
            <div style={{ 
              display: 'grid',
              gridTemplateColumns: `repeat(${dailySales.length}, 1fr)`,
              gap: 2,
              height: 200,
              alignItems: 'end',
              padding: '0 4px',
            }}>
              {dailySales.map((d, i) => {
                const heightPct = (d.revenue / maxDailyRevenue) * 100;
                const profitPct = d.revenue > 0 ? (d.profit / d.revenue) * 100 : 0;
                return (
                  <div key={i} 
                    style={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      alignItems: 'center', 
                      height: '100%',
                      justifyContent: 'flex-end',
                      position: 'relative',
                    }}
                    title={`${d.label}\nรายได้: ฿${d.revenue.toLocaleString()}\nกำไร: ฿${d.profit.toLocaleString()}\nออเดอร์: ${d.count}`}
                  >
                    {d.revenue > 0 && (
                      <div style={{ 
                        fontSize: 9, 
                        color: 'var(--text-dim)', 
                        marginBottom: 2,
                        whiteSpace: 'nowrap',
                      }}>
                        ฿{d.revenue >= 1000 ? Math.round(d.revenue / 1000) + 'K' : d.revenue}
                      </div>
                    )}
                    <div style={{ 
                      width: '100%',
                      height: `${Math.max(heightPct, d.revenue > 0 ? 2 : 0)}%`,
                      background: 'linear-gradient(180deg, var(--accent) 0%, var(--accent-strong) 100%)',
                      borderRadius: '4px 4px 0 0',
                      position: 'relative',
                      transition: 'all 0.3s ease',
                    }}>
                      {/* Profit overlay */}
                      <div style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        height: `${profitPct}%`,
                        background: 'linear-gradient(180deg, var(--success) 0%, var(--success) 100%)',
                        opacity: 0.7,
                        borderRadius: profitPct >= 99 ? '4px 4px 0 0' : 0,
                      }}/>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ 
              display: 'grid',
              gridTemplateColumns: `repeat(${dailySales.length}, 1fr)`,
              gap: 2,
              marginTop: 8,
              padding: '0 4px',
            }}>
              {dailySales.map((d, i) => (
                <div key={i} style={{ 
                  fontSize: 9, 
                  color: 'var(--text-dim)',
                  textAlign: 'center',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {i % Math.max(1, Math.floor(dailySales.length / 8)) === 0 ? d.label : ''}
                </div>
              ))}
            </div>

            {/* Legend */}
            <div style={{ 
              display: 'flex', 
              gap: 16, 
              marginTop: 16, 
              justifyContent: 'center',
              fontSize: 11,
              color: 'var(--text-dim)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 12, height: 12, background: 'var(--accent)', borderRadius: 2 }}/>
                <span>รายได้</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 12, height: 12, background: 'var(--success)', borderRadius: 2, opacity: 0.7 }}/>
                <span>กำไร</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Top Models */}
      <div className="form-card">
        <h3>🏆 Top รุ่นขายดี</h3>
        {topModels.length === 0 ? (
          <div className="empty">
            <div className="empty-sub">ยังไม่มียอดขาย</div>
          </div>
        ) : (
          <div style={{ marginTop: 12 }}>
            {topModels.map((m, i) => {
              const maxCount = topModels[0].count;
              const pct = (m.count / maxCount) * 100;
              const colors = ['#fbbf24', '#9ca3af', '#cd7f32', 'var(--accent)', 'var(--accent)'];
              return (
                <div key={i} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                      <span style={{ 
                        fontWeight: 700, 
                        color: colors[i] || 'var(--text)',
                        fontSize: 14,
                        width: 24,
                        textAlign: 'center',
                      }}>
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                      </span>
                      <span style={{ 
                        fontSize: 13, 
                        fontWeight: 600,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {m.model}
                      </span>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: 12 }}>
                      <span style={{ fontWeight: 700 }}>{m.count} เครื่อง</span>
                      <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                        ฿{m.revenue.toLocaleString()} • กำไร ฿{m.profit.toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <div style={{ height: 6, background: 'var(--surface-2)', borderRadius: 3 }}>
                    <div style={{ 
                      height: '100%', 
                      width: `${pct}%`, 
                      background: colors[i] || 'var(--accent)',
                      borderRadius: 3,
                      transition: 'width 0.3s',
                    }}/>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Branch Sales (Admin + ดูทุกสาขา) */}
      {branchSales.length > 0 && (
        <div className="form-card">
          <h3>🏪 ยอดขายแยกสาขา</h3>
          <div style={{ marginTop: 12 }}>
            {branchSales.map((b, i) => {
              const maxRev = branchSales[0].revenue;
              const pct = maxRev > 0 ? (b.revenue / maxRev) * 100 : 0;
              return (
                <div key={i} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>📍 {b.branch_name}</span>
                    <div style={{ textAlign: 'right', fontSize: 12 }}>
                      <span style={{ fontWeight: 700 }}>฿{b.revenue.toLocaleString()}</span>
                      <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                        {b.count} ออเดอร์ • กำไร ฿{b.profit.toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <div style={{ height: 6, background: 'var(--surface-2)', borderRadius: 3 }}>
                    <div style={{ 
                      height: '100%', 
                      width: `${pct}%`, 
                      background: 'var(--accent)',
                      borderRadius: 3,
                    }}/>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {toast && <Toast {...toast} />}
    </>
  );
}
