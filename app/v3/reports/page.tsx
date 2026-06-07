'use client';

import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase-client';
import {
  TrendingUp, DollarSign, ShoppingCart, Smartphone,
  Award, BarChart3, PieChart, ShoppingBag, Wrench,
  Loader2, Lock,
} from 'lucide-react';

type RangeId = 'today' | '7days' | '30days' | '90days' | 'all';

interface Sale {
  type: 'stock' | 'goods' | 'parts';
  date: string;
  revenue: number;
  cost: number;
  profit: number;
  model?: string;
  staff?: string;
  customer?: string;
}

export default function V3ReportsPage() {
  const supabase = createClient();
  const [range, setRange] = useState<RangeId>('30days');
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState<Sale[]>([]);
  const [profile, setProfile] = useState<any>(null);

  async function load() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: p } = await supabase
        .from('profiles')
        .select('role, is_super_admin, shop_id')
        .eq('id', user.id)
        .single();
      setProfile(p);

      const [stockRes, goodsRes, partsRes] = await Promise.all([
        supabase
          .from('sales_history')
          .select('id, model, final_price, cost_price, profit, sold_date, sold_by_name')
          .order('sold_date', { ascending: false })
          .limit(2000),
        supabase
          .from('goods_sales')
          .select('id, name, subtotal, unit_price, quantity, sold_date, sold_by_name')
          .order('sold_date', { ascending: false })
          .limit(2000),
        supabase
          .from('parts_sales' as any)
          .select('*')
          .order('sold_date', { ascending: false })
          .limit(2000),
      ]);

      const all: Sale[] = [];

      (stockRes.data || []).forEach((r: any) => {
        const revenue = Number(r.final_price || 0);
        const cost = Number(r.cost_price || 0);
        all.push({
          type: 'stock',
          date: r.sold_date,
          revenue,
          cost,
          profit: Number(r.profit ?? (revenue - cost)),
          model: r.model,
          staff: r.sold_by_name,
        });
      });

      (goodsRes.data || []).forEach((r: any) => {
        const revenue = Number(r.subtotal || 0);
        all.push({
          type: 'goods',
          date: r.sold_date,
          revenue,
          cost: 0,
          profit: 0,
          model: r.name,
          staff: r.sold_by_name,
        });
      });

      if (!partsRes.error) {
        (partsRes.data || []).forEach((r: any) => {
          const revenue = Number(r.subtotal || r.unit_price * (r.quantity || 1) || 0);
          all.push({
            type: 'parts',
            date: r.sold_date || (r.created_at || '').split('T')[0],
            revenue,
            cost: 0,
            profit: 0,
            model: r.name || r.part_name,
            staff: r.sold_by_name,
          });
        });
      }

      setSales(all);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const isAdmin = profile?.role === 'admin' || profile?.is_super_admin;

  const filtered = useMemo(() => {
    if (range === 'all') return sales;
    const now = new Date();
    const start = new Date();
    if (range === 'today') start.setHours(0, 0, 0, 0);
    else if (range === '7days') start.setDate(now.getDate() - 7);
    else if (range === '30days') start.setDate(now.getDate() - 30);
    else if (range === '90days') start.setDate(now.getDate() - 90);
    const startISO = start.toISOString().split('T')[0];
    return sales.filter(s => (s.date || '') >= startISO);
  }, [sales, range]);

  const kpis = useMemo(() => {
    let totalRevenue = 0;
    let totalProfit = 0;
    let stockCount = 0;
    filtered.forEach(s => {
      totalRevenue += s.revenue;
      totalProfit += s.profit;
      if (s.type === 'stock') stockCount++;
    });
    return {
      totalRevenue,
      totalProfit,
      stockCount,
      txCount: filtered.length,
      avgPerTx: filtered.length > 0 ? totalRevenue / filtered.length : 0,
    };
  }, [filtered]);

  const dailySeries = useMemo(() => {
    const map = new Map<string, { date: string; revenue: number; profit: number }>();
    filtered.forEach(s => {
      const d = s.date;
      if (!d) return;
      if (!map.has(d)) map.set(d, { date: d, revenue: 0, profit: 0 });
      const entry = map.get(d)!;
      entry.revenue += s.revenue;
      entry.profit += s.profit;
    });
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [filtered]);

  const topModels = useMemo(() => {
    const map = new Map<string, { name: string; count: number; revenue: number }>();
    filtered.forEach(s => {
      if (!s.model) return;
      if (!map.has(s.model)) map.set(s.model, { name: s.model, count: 0, revenue: 0 });
      const entry = map.get(s.model)!;
      entry.count++;
      entry.revenue += s.revenue;
    });
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  }, [filtered]);

  const topStaff = useMemo(() => {
    const map = new Map<string, { name: string; count: number; revenue: number }>();
    filtered.forEach(s => {
      if (!s.staff) return;
      if (!map.has(s.staff)) map.set(s.staff, { name: s.staff, count: 0, revenue: 0 });
      const entry = map.get(s.staff)!;
      entry.count++;
      entry.revenue += s.revenue;
    });
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [filtered]);

  const bySource = useMemo(() => {
    const sums = { stock: 0, goods: 0, parts: 0 };
    filtered.forEach(s => { sums[s.type] += s.revenue; });
    const total = sums.stock + sums.goods + sums.parts;
    return [
      { label: 'ขายเครื่อง', value: sums.stock, pct: total ? sums.stock / total * 100 : 0, color: '#22c55e', Icon: Smartphone },
      { label: 'ขายของ', value: sums.goods, pct: total ? sums.goods / total * 100 : 0, color: '#06b6d4', Icon: ShoppingBag },
      { label: 'ขายอะไหล่', value: sums.parts, pct: total ? sums.parts / total * 100 : 0, color: '#ef4444', Icon: Wrench },
    ];
  }, [filtered]);

  if (!loading && profile && !isAdmin) {
    return (
      <div className="v3-card" style={{ padding: 40, textAlign: 'center' }}>
        <Lock size={48} strokeWidth={1.2} style={{ margin: '0 auto 12px', color: 'var(--text-muted)' }} />
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>เฉพาะแอดมิน</h2>
        <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>หน้ารายงานจำกัดให้แอดมินเท่านั้น</p>
      </div>
    );
  }

  return (
    <>
      <div className="v3-page-header v3-desktop-only">
        <div>
          <h1 className="v3-page-title">รายงาน</h1>
          <p className="v3-page-subtitle">ภาพรวมยอดขาย กำไร และสถิติ</p>
        </div>
      </div>

      <div className="v3-mobile-only" style={{ marginBottom: 12 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, fontFamily: 'Prompt, sans-serif' }}>
          รายงาน
        </h1>
        <p style={{ fontSize: 11, color: 'var(--text-dim)' }}>
          ภาพรวมยอดขาย กำไร และสถิติ
        </p>
      </div>

      <div className="v3-card" style={{ padding: 8, marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 4 }}>
          <RangeBtn active={range === 'today'} onClick={() => setRange('today')} label="วันนี้" />
          <RangeBtn active={range === '7days'} onClick={() => setRange('7days')} label="7 วัน" />
          <RangeBtn active={range === '30days'} onClick={() => setRange('30days')} label="30 วัน" />
          <RangeBtn active={range === '90days'} onClick={() => setRange('90days')} label="90 วัน" />
          <RangeBtn active={range === 'all'} onClick={() => setRange('all')} label="ทั้งหมด" />
        </div>
      </div>

      {loading ? (
        <div className="v3-card" style={{ padding: 60, textAlign: 'center', color: 'var(--text-dim)' }}>
          <Loader2 size={24} className="v3-spin" style={{ marginBottom: 10 }} />
          <div>กำลังคำนวณข้อมูล...</div>
        </div>
      ) : (
        <>
          <div className="v3-reports-kpis" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 10,
            marginBottom: 14,
          }}>
            <KpiCard
              label="รายได้รวม"
              value={`฿${kpis.totalRevenue.toLocaleString()}`}
              sub={`${kpis.txCount} รายการ`}
              color="#22c55e"
              Icon={DollarSign}
            />
            {isAdmin && (
              <KpiCard
                label="กำไรรวม"
                value={`฿${kpis.totalProfit.toLocaleString()}`}
                sub={kpis.totalRevenue > 0 ? `${((kpis.totalProfit / kpis.totalRevenue) * 100).toFixed(1)}%` : '-'}
                color="#3b82f6"
                Icon={TrendingUp}
              />
            )}
            <KpiCard
              label="เครื่องที่ขาย"
              value={kpis.stockCount}
              sub="เครื่อง"
              color="#8b5cf6"
              Icon={Smartphone}
            />
            <KpiCard
              label="เฉลี่ย/บิล"
              value={`฿${Math.round(kpis.avgPerTx).toLocaleString()}`}
              sub="ต่อรายการ"
              color="#f59e0b"
              Icon={ShoppingCart}
            />
          </div>

          <div className="v3-card" style={{ padding: 16, marginBottom: 14 }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 14,
              flexWrap: 'wrap',
              gap: 8,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 30, height: 30,
                  borderRadius: 8,
                  background: '#dbeafe',
                  color: '#3b82f6',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <BarChart3 size={16} />
                </div>
                <h3 style={{ fontSize: 14, fontWeight: 700, fontFamily: 'Prompt, sans-serif' }}>
                  ยอดขายรายวัน
                </h3>
              </div>
              <div style={{ display: 'flex', gap: 12, fontSize: 11 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 100, background: '#3b82f6' }} />
                  รายได้
                </span>
                {isAdmin && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 100, background: '#22c55e' }} />
                    กำไร
                  </span>
                )}
              </div>
            </div>

            {dailySeries.length === 0 ? (
              <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-dim)', fontSize: 12 }}>
                ไม่มีข้อมูลในช่วงเวลานี้
              </div>
            ) : (
              <SalesChart data={dailySeries} showProfit={isAdmin} />
            )}
          </div>

          <div className="v3-reports-row" style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 12,
            marginBottom: 14,
          }}>
            <div className="v3-card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div style={{
                  width: 30, height: 30,
                  borderRadius: 8,
                  background: '#fef3c7',
                  color: '#f59e0b',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <PieChart size={16} />
                </div>
                <h3 style={{ fontSize: 14, fontWeight: 700, fontFamily: 'Prompt, sans-serif' }}>
                  สัดส่วนรายได้
                </h3>
              </div>

              <SourcePie data={bySource} />

              <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {bySource.map(s => <SourceRow key={s.label} item={s} />)}
              </div>
            </div>

            <div className="v3-card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div style={{
                  width: 30, height: 30,
                  borderRadius: 8,
                  background: '#ede9fe',
                  color: '#8b5cf6',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Award size={16} />
                </div>
                <h3 style={{ fontSize: 14, fontWeight: 700, fontFamily: 'Prompt, sans-serif' }}>
                  Top พนักงาน
                </h3>
              </div>

              {topStaff.length === 0 ? (
                <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-dim)', fontSize: 12 }}>
                  ไม่มีข้อมูล
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {topStaff.map((s, i) => (
                    <StaffRow key={s.name} staff={s} rank={i + 1} maxRevenue={topStaff[0]?.revenue || 1} />
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="v3-card" style={{ padding: 16, marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{
                width: 30, height: 30,
                borderRadius: 8,
                background: '#dcfce7',
                color: '#22c55e',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <TrendingUp size={16} />
              </div>
              <h3 style={{ fontSize: 14, fontWeight: 700, fontFamily: 'Prompt, sans-serif' }}>
                Top 10 รุ่น/สินค้าขายดี
              </h3>
            </div>

            {topModels.length === 0 ? (
              <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-dim)', fontSize: 12 }}>
                ไม่มีข้อมูล
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {topModels.map((m, i) => (
                  <ModelRow key={m.name} model={m} rank={i + 1} maxRevenue={topModels[0]?.revenue || 1} />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <style jsx>{`
        @media (max-width: 768px) {
          :global(.v3-reports-kpis) {
            grid-template-columns: 1fr 1fr !important;
          }
          :global(.v3-reports-row) {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </>
  );
}

function RangeBtn({ active, onClick, label }: any) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: '8px 10px',
        background: active ? 'var(--accent)' : 'transparent',
        color: active ? '#fff' : 'var(--text-dim)',
        border: 'none',
        borderRadius: 8,
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
        fontFamily: 'inherit',
      }}
    >
      {label}
    </button>
  );
}

function KpiCard({ label, value, sub, color, Icon }: any) {
  return (
    <div className="v3-card" style={{ padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <div style={{
          width: 34, height: 34,
          borderRadius: 10,
          background: `${color}15`,
          color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Icon size={17} strokeWidth={2.2} />
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{label}</div>
      </div>
      <div style={{
        fontSize: 20, fontWeight: 800,
        fontFamily: 'Prompt, sans-serif',
        letterSpacing: '-0.3px',
        lineHeight: 1,
      }}>
        {value}
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>{sub}</div>
    </div>
  );
}

function SalesChart({ data, showProfit }: any) {
  const W = 600;
  const H = 200;
  const padL = 50;
  const padR = 16;
  const padT = 12;
  const padB = 30;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  const maxRev = Math.max(...data.map((d: any) => d.revenue), 1);
  const yScale = (v: number) => padT + chartH - (v / maxRev) * chartH;
  const xScale = (i: number) => data.length > 1
    ? padL + (i / (data.length - 1)) * chartW
    : padL + chartW / 2;

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(t => ({
    value: maxRev * t,
    y: padT + chartH - t * chartH,
  }));

  const revPath = data.map((d: any, i: number) =>
    `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(d.revenue)}`
  ).join(' ');

  const profitPath = data.map((d: any, i: number) =>
    `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(d.profit)}`
  ).join(' ');

  const areaPath = data.length > 1 
    ? revPath + ` L ${xScale(data.length - 1)} ${padT + chartH} L ${xScale(0)} ${padT + chartH} Z`
    : '';

  return (
    <div style={{ width: '100%', overflow: 'hidden' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        {yTicks.map((t, i) => (
          <g key={i}>
            <line
              x1={padL} y1={t.y} x2={W - padR} y2={t.y}
              stroke="var(--border)" strokeWidth={1} strokeDasharray="2 3"
              opacity={0.5}
            />
            <text x={padL - 6} y={t.y + 4} fontSize={9} fill="var(--text-dim)" textAnchor="end">
              {t.value > 1000 ? `${(t.value / 1000).toFixed(0)}k` : t.value.toFixed(0)}
            </text>
          </g>
        ))}

        <defs>
          <linearGradient id="blue-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.6} />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
          </linearGradient>
        </defs>

        {areaPath && (
          <path d={areaPath} fill="url(#blue-grad)" opacity={0.2} />
        )}

        <path d={revPath} stroke="#3b82f6" strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />

        {showProfit && (
          <path d={profitPath} stroke="#22c55e" strokeWidth={2} fill="none" strokeDasharray="4 3" strokeLinejoin="round" />
        )}

        {data.map((d: any, i: number) => (
          <g key={i}>
            <circle cx={xScale(i)} cy={yScale(d.revenue)} r={3} fill="#3b82f6" />
            {showProfit && (
              <circle cx={xScale(i)} cy={yScale(d.profit)} r={2.5} fill="#22c55e" />
            )}
          </g>
        ))}

        {data.length > 0 && [0, Math.floor(data.length / 2), data.length - 1]
          .filter((v, i, arr) => arr.indexOf(v) === i)
          .map(i => {
            const d = data[i];
            if (!d) return null;
            const label = new Date(d.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
            return (
              <text key={i} x={xScale(i)} y={H - padB + 16} fontSize={9} fill="var(--text-dim)" textAnchor="middle">
                {label}
              </text>
            );
          })}
      </svg>
    </div>
  );
}

function SourcePie({ data }: any) {
  const total = data.reduce((s: number, d: any) => s + d.value, 0);
  if (total === 0) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-dim)', fontSize: 12 }}>
        ไม่มีข้อมูล
      </div>
    );
  }

  const radius = 60;
  const stroke = 22;
  const circ = 2 * Math.PI * radius;

  let offset = 0;
  const segments = data.map((d: any) => {
    const portion = d.value / total;
    const len = portion * circ;
    const seg = { ...d, len, offset, dasharray: `${len} ${circ - len}` };
    offset += len;
    return seg;
  });

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    }}>
      <svg viewBox={`0 0 ${radius * 2 + stroke} ${radius * 2 + stroke}`} style={{ width: 150, height: 150 }}>
        <g transform={`translate(${radius + stroke / 2}, ${radius + stroke / 2}) rotate(-90)`}>
          {segments.map((s: any, i: number) => (
            <circle
              key={i}
              r={radius}
              fill="none"
              stroke={s.color}
              strokeWidth={stroke}
              strokeDasharray={s.dasharray}
              strokeDashoffset={-s.offset}
              opacity={s.value > 0 ? 1 : 0}
            />
          ))}
        </g>
      </svg>
      <div style={{
        position: 'absolute',
        textAlign: 'center',
      }}>
        <div style={{
          fontSize: 18,
          fontWeight: 800,
          fontFamily: 'Prompt, sans-serif',
          lineHeight: 1,
        }}>
          ฿{(total / 1000).toFixed(1)}k
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>รวม</div>
      </div>
    </div>
  );
}

function SourceRow({ item }: any) {
  const { Icon } = item;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{
        width: 28, height: 28,
        borderRadius: 8,
        background: `${item.color}15`,
        color: item.color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Icon size={14} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
          <span style={{ fontSize: 11, fontWeight: 600 }}>{item.label}</span>
          <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
            {item.pct.toFixed(0)}%
          </span>
        </div>
        <div style={{
          fontSize: 12,
          fontWeight: 700,
          fontFamily: 'Prompt, sans-serif',
        }}>
          ฿{item.value.toLocaleString()}
        </div>
      </div>
    </div>
  );
}

function StaffRow({ staff, rank, maxRevenue }: any) {
  const colors = ['#fbbf24', '#9ca3af', '#fb923c'];
  const medalColor = rank <= 3 ? colors[rank - 1] : '#e5e7eb';
  const pct = (staff.revenue / maxRevenue) * 100;

  return (
    <div style={{
      padding: 10,
      background: 'var(--surface-2)',
      borderRadius: 10,
      display: 'flex',
      alignItems: 'center',
      gap: 10,
    }}>
      <div style={{
        width: 26, height: 26,
        borderRadius: 13,
        background: medalColor,
        color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 800,
        fontSize: 11,
        fontFamily: 'Prompt, sans-serif',
        flexShrink: 0,
      }}>
        {rank}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{staff.name}</div>
        <div style={{
          height: 4,
          background: 'var(--surface)',
          borderRadius: 100,
          overflow: 'hidden',
        }}>
          <div style={{
            width: `${pct}%`,
            height: '100%',
            background: 'linear-gradient(90deg, #8b5cf6, #6366f1)',
            borderRadius: 100,
          }} />
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{
          fontSize: 12,
          fontWeight: 700,
          fontFamily: 'Prompt, sans-serif',
          color: '#8b5cf6',
        }}>
          ฿{staff.revenue.toLocaleString()}
        </div>
        <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>{staff.count} รายการ</div>
      </div>
    </div>
  );
}

function ModelRow({ model, rank, maxRevenue }: any) {
  const colors = ['#fbbf24', '#9ca3af', '#fb923c'];
  const medalColor = rank <= 3 ? colors[rank - 1] : 'transparent';
  const medalBg = rank <= 3 ? 'transparent' : 'var(--surface-2)';
  const medalTextColor = rank <= 3 ? '#fff' : 'var(--text-dim)';
  const pct = (model.revenue / maxRevenue) * 100;

  return (
    <div style={{
      padding: 10,
      background: 'var(--surface-2)',
      borderRadius: 10,
      display: 'flex',
      alignItems: 'center',
      gap: 10,
    }}>
      <div style={{
        width: 24, height: 24,
        borderRadius: 12,
        background: rank <= 3 ? medalColor : medalBg,
        color: medalTextColor,
        border: rank > 3 ? '1px solid var(--border)' : 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 700,
        fontSize: 11,
        fontFamily: 'Prompt, sans-serif',
        flexShrink: 0,
      }}>
        {rank}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 12,
          fontWeight: 600,
          marginBottom: 4,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {model.name}
        </div>
        <div style={{
          height: 4,
          background: 'var(--surface)',
          borderRadius: 100,
          overflow: 'hidden',
        }}>
          <div style={{
            width: `${pct}%`,
            height: '100%',
            background: 'linear-gradient(90deg, #22c55e, #16a34a)',
            borderRadius: 100,
          }} />
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{
          fontSize: 12,
          fontWeight: 700,
          fontFamily: 'Prompt, sans-serif',
        }}>
          ฿{model.revenue.toLocaleString()}
        </div>
        <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>{model.count} ชิ้น</div>
      </div>
    </div>
  );
}
