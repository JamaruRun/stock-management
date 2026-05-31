'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-client';
import {
  Wallet, TrendingUp, Smartphone, Hammer, Coins, CreditCard,
  ShoppingBag, AlertTriangle, Plus, ShoppingCart,
  UserPlus, Barcode, ArrowRight, ArrowUp, ArrowDown, Eye,
} from 'lucide-react';

interface DayPoint {
  date: string; // YYYY-MM-DD
  revenue: number;
}

interface TopProduct {
  brand: string;
  model: string;
  count: number;
}

export default function V3HomePage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userName, setUserName] = useState('');

  const [todayRev, setTodayRev] = useState(0);
  const [yesterdayRev, setYesterdayRev] = useState(0);
  const [todayProfit, setTodayProfit] = useState(0);
  const [yesterdayProfit, setYesterdayProfit] = useState(0);
  const [stockCount, setStockCount] = useState(0);
  const [repairPending, setRepairPending] = useState(0);
  const [pawnDueSoon, setPawnDueSoon] = useState(0);
  const [partsLow, setPartsLow] = useState(0);

  const [chartDays, setChartDays] = useState<7 | 30>(7);
  const [salesByDay, setSalesByDay] = useState<DayPoint[]>([]);

  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase
          .from('profiles')
          .select('role, full_name, is_super_admin')
          .eq('id', user.id)
          .single();

        const isAdminUser = profile?.role === 'admin' || profile?.is_super_admin;
        setIsAdmin(isAdminUser);
        setUserName(profile?.full_name || '');

        const now = new Date();
        const today = toISODate(now);
        const yesterday = toISODate(addDays(now, -1));
        const since30 = toISODate(addDays(now, -29));

        const [sales30Res, stockRes, repairRes, pawnRes, partsRes] = await Promise.all([
          // ขายย้อนหลัง 30 วัน (สำหรับ chart + top products + เทียบเมื่อวาน)
          isAdminUser
            ? supabase
                .from('sales_history')
                .select('final_price, profit, sold_date, brand, model')
                .gte('sold_date', since30)
                .order('sold_date', { ascending: true })
            : Promise.resolve({ data: [] }),
          supabase.from('stock').select('id', { count: 'exact', head: true }),
          supabase.from('repair_jobs').select('status'),
          supabase.from('pawn_stock').select('due_date, status'),
          supabase.from('parts').select('stock_qty, low_stock_alert'),
        ]);

        const sales = (sales30Res.data || []) as any[];

        // Today / Yesterday
        const tRev = sales.filter(s => s.sold_date === today).reduce((a, b) => a + Number(b.final_price || 0), 0);
        const yRev = sales.filter(s => s.sold_date === yesterday).reduce((a, b) => a + Number(b.final_price || 0), 0);
        const tProf = sales.filter(s => s.sold_date === today).reduce((a, b) => a + Number(b.profit || 0), 0);
        const yProf = sales.filter(s => s.sold_date === yesterday).reduce((a, b) => a + Number(b.profit || 0), 0);
        setTodayRev(tRev); setYesterdayRev(yRev);
        setTodayProfit(tProf); setYesterdayProfit(yProf);

        // Sales by Day (30 days) - keep all, slice on render
        const byDay: Record<string, number> = {};
        for (let i = 0; i < 30; i++) {
          const d = toISODate(addDays(now, -29 + i));
          byDay[d] = 0;
        }
        for (const s of sales) {
          if (s.sold_date && byDay[s.sold_date] !== undefined) {
            byDay[s.sold_date] += Number(s.final_price || 0);
          }
        }
        const points: DayPoint[] = Object.entries(byDay).map(([date, revenue]) => ({ date, revenue }));
        setSalesByDay(points);

        // Top Products (last 30 days)
        const counter: Record<string, TopProduct> = {};
        for (const s of sales) {
          const brand = (s.brand || 'ไม่ระบุ').trim();
          const model = (s.model || 'ไม่ระบุ').trim();
          const k = `${brand}__${model}`;
          if (!counter[k]) counter[k] = { brand, model, count: 0 };
          counter[k].count += 1;
        }
        const top = Object.values(counter).sort((a, b) => b.count - a.count).slice(0, 5);
        setTopProducts(top);

        setStockCount(stockRes.count || 0);

        const repairs = (repairRes.data || []) as any[];
        setRepairPending(repairs.filter(r =>
          r.status !== 'completed' && r.status !== 'cancelled' && r.status !== 'delivered'
        ).length);

        const in7 = new Date(now.getTime() + 7 * 24 * 3600 * 1000);
        const pawns = (pawnRes.data || []) as any[];
        setPawnDueSoon(pawns.filter(p => {
          if (p.status && p.status !== 'active') return false;
          if (!p.due_date) return false;
          const due = new Date(p.due_date);
          return due >= now && due <= in7;
        }).length);

        const partsList = (partsRes.data || []) as any[];
        setPartsLow(partsList.filter(p =>
          Number(p.stock_qty) <= Number(p.low_stock_alert || 2) && Number(p.stock_qty) > 0
        ).length);

      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Chart visible points
  const chartPoints = useMemo(() => {
    return chartDays === 7 ? salesByDay.slice(-7) : salesByDay;
  }, [salesByDay, chartDays]);

  const chartTotal = useMemo(() => chartPoints.reduce((a, b) => a + b.revenue, 0), [chartPoints]);
  const chartAvg = useMemo(() => {
    if (chartPoints.length === 0) return 0;
    return Math.round(chartTotal / chartPoints.length);
  }, [chartPoints, chartTotal]);

  const revTrend = trendPct(todayRev, yesterdayRev);
  const profitTrend = trendPct(todayProfit, yesterdayProfit);
  const weekTotal = useMemo(() => salesByDay.slice(-7).reduce((a, b) => a + b.revenue, 0), [salesByDay]);
  const prevWeekTotal = useMemo(() => salesByDay.slice(0, 23).slice(-7).reduce((a, b) => a + b.revenue, 0), [salesByDay]);
  const weekTrend = trendPct(weekTotal, prevWeekTotal);

  const todayStr = new Date().toLocaleDateString('th-TH', {
    year: 'numeric', month: 'long', day: 'numeric'
  });

  const alerts = [
    partsLow > 0 && {
      icon: AlertTriangle,
      title: `จออะไหล่ใกล้หมด ${partsLow} รายการ`,
      desc: 'ใกล้หมดสต๊อก',
      href: '/v3/parts',
      color: '#ef4444',
    },
    repairPending > 0 && {
      icon: Hammer,
      title: `งานซ่อมค้าง ${repairPending} งาน`,
      desc: 'เกินกำหนดแล้ว',
      href: '/v3/repair',
      color: '#f59e0b',
    },
    pawnDueSoon > 0 && {
      icon: Coins,
      title: `รับจำนำใกล้ครบกำหนด ${pawnDueSoon} ใบ`,
      desc: 'ภายใน 7 วัน',
      href: '/v3/pawn',
      color: '#f59e0b',
    },
  ].filter(Boolean) as any[];

  return (
    <>
      {/* Mobile Hero - แสดงเฉพาะมือถือ (จัดการด้วย CSS class) */}
      <div className="v3-mobile-hero">
        <div className="v3-mobile-hero-greet">สวัสดีครับ{userName ? `, ${userName}` : ''} 👋</div>
        <div className="v3-mobile-hero-title">ยินดีต้อนรับกลับมา</div>
        {isAdmin && (
          <div className="v3-mobile-hero-stats">
            <div className="v3-mobile-hero-stat">
              <div className="v3-mobile-hero-stat-label">ยอดขายวันนี้</div>
              <div className="v3-mobile-hero-stat-value">฿{todayRev.toLocaleString()}</div>
            </div>
            <div className="v3-mobile-hero-stat">
              <div className="v3-mobile-hero-stat-label">กำไรวันนี้</div>
              <div className="v3-mobile-hero-stat-value">฿{todayProfit.toLocaleString()}</div>
            </div>
          </div>
        )}
      </div>

      {/* Greeting (desktop only - hide on mobile) */}
      <div className="v3-page-header v3-desktop-only">
        <div>
          <h1 className="v3-page-title">
            สวัสดีครับ{userName ? `, ${userName}` : ''} 👋
          </h1>
          <p className="v3-page-subtitle">ยินดีต้อนรับกลับมา · {todayStr}</p>
        </div>
      </div>

      {/* KPI Cards 5 — ตาม ref */}
      <div className="v3-kpi-grid" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 12,
        marginBottom: 16,
      }}>
        {isAdmin && (
          <KpiCard
            label="ยอดขายวันนี้"
            value={loading ? '...' : `฿${todayRev.toLocaleString()}`}
            trend={revTrend}
            trendLabel="จากเมื่อวาน"
            Icon={Wallet}
            color="#3b82f6"
          />
        )}
        {isAdmin && (
          <KpiCard
            label="กำไรวันนี้"
            value={loading ? '...' : `฿${todayProfit.toLocaleString()}`}
            trend={profitTrend}
            trendLabel="จากเมื่อวาน"
            Icon={TrendingUp}
            color="#22c55e"
          />
        )}
        <KpiCard
          label="เครื่องทั้งหมด"
          value={loading ? '...' : stockCount.toString()}
          trend={null}
          trendLabel="เครื่อง"
          Icon={Smartphone}
          color="#06b6d4"
        />
        <KpiCard
          label="งานซ่อมค้าง"
          value={loading ? '...' : repairPending.toString()}
          trend={null}
          trendLabel="งาน"
          Icon={Hammer}
          color="#f59e0b"
        />
        <KpiCard
          label="จำนำใกล้ครบ"
          value={loading ? '...' : pawnDueSoon.toString()}
          trend={null}
          trendLabel="ภายใน 7 วัน"
          Icon={Coins}
          color="#ef4444"
        />
      </div>

      {/* Alerts + Chart + Top - 3 col on desktop */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.4fr) minmax(0, 1fr)',
        gap: 12,
        marginBottom: 16,
      }} className="v3-dash-row">
        {/* Alerts */}
        <div className="v3-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ fontSize: 14, fontWeight: 700 }}>แจ้งเตือนที่ต้องจัดการ</h2>
            <Link href="/v3/history" style={{ fontSize: 11, color: 'var(--accent)', textDecoration: 'none' }}>
              ดูทั้งหมด →
            </Link>
          </div>
          {alerts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 12 }}>
              ✨ ไม่มีรายการแจ้งเตือน
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {alerts.map((a, i) => {
                const AIcon = a.icon;
                return (
                  <Link key={i} href={a.href} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: 10,
                    background: `${a.color}10`,
                    border: `1px solid ${a.color}25`,
                    borderRadius: 10,
                    textDecoration: 'none',
                    color: 'var(--text)',
                  }}>
                    <div style={{
                      width: 32, height: 32,
                      borderRadius: 8,
                      background: `${a.color}20`,
                      color: a.color,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <AIcon size={16} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>{a.title}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{a.desc}</div>
                    </div>
                    <Link href={a.href} style={{
                      fontSize: 10,
                      padding: '4px 8px',
                      background: 'var(--surface)',
                      borderRadius: 6,
                      color: 'var(--text-dim)',
                      textDecoration: 'none',
                      whiteSpace: 'nowrap',
                    }}>ดูสินค้า</Link>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Sales Chart */}
        <div className="v3-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h2 style={{ fontSize: 14, fontWeight: 700 }}>
              ยอดขาย {chartDays} วันที่ผ่านมา
            </h2>
            <div className="v3-chart-toggle">
              <button className={chartDays === 7 ? 'active' : ''} onClick={() => setChartDays(7)}>7 วัน</button>
              <button className={chartDays === 30 ? 'active' : ''} onClick={() => setChartDays(30)}>30 วัน</button>
            </div>
          </div>
          <div style={{
            fontSize: 26, fontWeight: 800, lineHeight: 1.1, marginBottom: 4,
            fontFamily: 'Prompt, Sarabun, sans-serif',
          }} className="v3-num">
            ฿{chartTotal.toLocaleString()}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 12 }}>
            {weekTrend !== null && weekTrend > 0 && (
              <span style={{ color: '#22c55e', fontWeight: 600 }}>▲ {weekTrend}% </span>
            )}
            {weekTrend !== null && weekTrend < 0 && (
              <span style={{ color: '#ef4444', fontWeight: 600 }}>▼ {Math.abs(weekTrend)}% </span>
            )}
            จากช่วงก่อนหน้า
          </div>
          <SalesChart points={chartPoints} />
        </div>

        {/* Top Products */}
        <div className="v3-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ fontSize: 14, fontWeight: 700 }}>รุ่นขายดี Top 5</h2>
            <Link href="/v3/stock" style={{ fontSize: 11, color: 'var(--accent)', textDecoration: 'none' }}>
              ดูทั้งหมด →
            </Link>
          </div>
          {topProducts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 12 }}>
              ยังไม่มียอดขาย
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {topProducts.map((p, i) => (
                <TopProductRow key={i} rank={i + 1} brand={p.brand} model={p.model} count={p.count} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="v3-card">
        <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>
          ทางลัด (Quick Actions)
        </h2>
        <div className="v3-quick-grid" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
          gap: 8,
        }}>
          <QuickAction Icon={Plus} label="เพิ่มเครื่อง" href="/v3/stock/add" color="#3b82f6" />
          <QuickAction Icon={ShoppingCart} label="ขายสินค้า" href="/v3/goods/sell" color="#22c55e" />
          <QuickAction Icon={Hammer} label="รับงานซ่อม" href="/v3/repair/new" color="#f59e0b" />
          <QuickAction Icon={Coins} label="รับจำนำ" href="/v3/pawn/new" color="#ef4444" />
          <QuickAction Icon={UserPlus} label="ลูกค้าใหม่" href="/v3/users" color="#8b5cf6" />
          <QuickAction Icon={Barcode} label="พิมพ์บาร์โค้ด" href="/v3/stock" color="#06b6d4" />
        </div>
      </div>

      <style jsx>{`
        @media (max-width: 1024px) {
          :global(.v3-dash-row) {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </>
  );
}

/* ============ Helper Components ============ */

function KpiCard({ label, value, trend, trendLabel, Icon, color }: any) {
  return (
    <div className="v3-card" style={{ padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{
          width: 32, height: 32,
          borderRadius: 8,
          background: `${color}15`,
          color: color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={18} strokeWidth={2.2} />
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{label}</div>
      </div>
      <div className="v3-num" style={{
        fontSize: 22, fontWeight: 800, color: 'var(--text)', lineHeight: 1.1,
        fontFamily: 'Prompt, Sarabun, sans-serif', letterSpacing: '-0.5px',
      }}>
        {value}
      </div>
      <div style={{ fontSize: 11, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
        {trend !== null && trend !== undefined && (
          <>
            {trend > 0 ? (
              <span style={{ color: '#22c55e', display: 'inline-flex', alignItems: 'center', fontWeight: 600 }}>
                <ArrowUp size={12} /> {trend}%
              </span>
            ) : trend < 0 ? (
              <span style={{ color: '#ef4444', display: 'inline-flex', alignItems: 'center', fontWeight: 600 }}>
                <ArrowDown size={12} /> {Math.abs(trend)}%
              </span>
            ) : (
              <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>0%</span>
            )}
            <span style={{ color: 'var(--text-muted)' }}>{trendLabel}</span>
          </>
        )}
        {trend === null && <span style={{ color: 'var(--text-muted)' }}>{trendLabel}</span>}
      </div>
    </div>
  );
}

function QuickAction({ Icon, label, href, color }: any) {
  return (
    <Link href={href} style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      padding: '16px 8px',
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 14,
      textDecoration: 'none',
      color: 'var(--text)',
      fontSize: 12,
      fontWeight: 500,
      transition: 'all 0.15s',
    }}>
      <div style={{
        width: 40, height: 40,
        borderRadius: 10,
        background: `${color}12`,
        color: color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={22} strokeWidth={2} />
      </div>
      <span style={{ textAlign: 'center' }}>{label}</span>
    </Link>
  );
}

function TopProductRow({ rank, brand, model, count }: { rank: number; brand: string; model: string; count: number }) {
  const rankClass = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : '';
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '8px 0',
      borderBottom: rank < 5 ? '1px solid var(--border)' : 'none',
    }}>
      <span className={`v3-top-rank ${rankClass}`}>{rank}</span>
      <PhoneThumb brand={brand} model={model} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ 
          fontSize: 13, 
          fontWeight: 600, 
          whiteSpace: 'nowrap', 
          overflow: 'hidden', 
          textOverflow: 'ellipsis',
          color: 'var(--text)',
        }}>
          {model}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
          <span style={{ color: 'var(--text)', fontWeight: 700 }}>{count}</span> เครื่อง
        </div>
      </div>
    </div>
  );
}

function PhoneThumb({ brand, model }: { brand: string; model?: string }) {
  const b = (brand || '').toLowerCase();
  const m = (model || '').toLowerCase();
  
  // สีหลังกล่อง + สีตัวมือถือตามแบรนด์
  const bgColor = '#f1f5f9';
  
  let bodyColor = '#1e293b';
  let screenColor = '#0f172a';
  let hasNotch = false;
  let hasDynamicIsland = false;
  let hasCameraGrid = false;
  
  if (b.includes('iphone') || b.includes('apple')) {
    bodyColor = m.includes('pro') ? '#1c1c1e' : m.includes('white') || m.includes('starlight') ? '#f5f5f7' : '#1c1c1e';
    screenColor = '#000';
    // iPhone 14+ Pro = Dynamic Island, ก่อนหน้านี้ = notch
    if (m.match(/1[4-9]|2[0-9]/) && m.includes('pro')) hasDynamicIsland = true;
    else if (m.match(/x|11|12|13|14|15/)) hasNotch = true;
    hasCameraGrid = m.includes('pro') || !!m.match(/1[1-9]/);
  } else if (b.includes('samsung')) {
    bodyColor = '#1e293b';
    screenColor = '#000';
  } else if (b.includes('oppo')) {
    bodyColor = '#16a34a';
    screenColor = '#0f172a';
  } else if (b.includes('vivo')) {
    bodyColor = '#1d4ed8';
    screenColor = '#0f172a';
  } else if (b.includes('xiaomi') || b.includes('redmi')) {
    bodyColor = '#ea580c';
    screenColor = '#0f172a';
  } else if (b.includes('huawei')) {
    bodyColor = '#7c2d12';
    screenColor = '#0f172a';
  } else if (b.includes('realme')) {
    bodyColor = '#facc15';
    screenColor = '#0f172a';
  }

  return (
    <div style={{
      width: 44,
      height: 56,
      background: bgColor,
      borderRadius: 8,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      overflow: 'hidden',
    }}>
      <svg width="28" height="44" viewBox="0 0 28 44" xmlns="http://www.w3.org/2000/svg">
        {/* Body */}
        <rect
          x="1" y="1"
          width="26" height="42"
          rx="4" ry="4"
          fill={bodyColor}
          stroke="rgba(0,0,0,0.1)"
          strokeWidth="0.5"
        />
        {/* Screen */}
        <rect
          x="2.5" y="3"
          width="23" height="38"
          rx="2.5" ry="2.5"
          fill={screenColor}
        />
        
        {/* Notch (iPhone X-13) */}
        {hasNotch && (
          <rect x="10" y="3" width="8" height="1.5" rx="0.75" fill={bodyColor} />
        )}
        
        {/* Dynamic Island (iPhone 14 Pro+) */}
        {hasDynamicIsland && (
          <rect x="11" y="4.5" width="6" height="1.5" rx="0.75" fill="#000" />
        )}
        
        {/* Speaker dot (no notch) */}
        {!hasNotch && !hasDynamicIsland && (
          <rect x="12" y="4.5" width="4" height="0.6" rx="0.3" fill="rgba(255,255,255,0.2)" />
        )}
        
        {/* Camera grid (back side hint) - Pro models */}
        {hasCameraGrid && (
          <g opacity="0.4">
            <circle cx="6" cy="8" r="1" fill="rgba(255,255,255,0.3)" />
          </g>
        )}
      </svg>
    </div>
  );
}

function SalesChart({ points }: { points: DayPoint[] }) {
  const max = Math.max(...points.map(p => p.revenue), 1);
  const min = 0;
  const W = 100;
  const H = 60;
  const stepX = points.length > 1 ? W / (points.length - 1) : W;

  const coords = points.map((p, i) => ({
    x: i * stepX,
    y: H - ((p.revenue - min) / (max - min || 1)) * H,
    value: p.revenue,
    date: p.date,
  }));

  const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(2)} ${c.y.toFixed(2)}`).join(' ');
  const areaPath = `${linePath} L ${W} ${H} L 0 ${H} Z`;

  return (
    <div style={{ position: 'relative' }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        style={{ width: '100%', height: 140, display: 'block' }}
      >
        <defs>
          <linearGradient id="v3SalesGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#v3SalesGrad)" />
        <path d={linePath} fill="none" stroke="#2563eb" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
        {coords.map((c, i) => (
          <circle key={i} cx={c.x} cy={c.y} r="1.5" fill="#2563eb" />
        ))}
      </svg>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: 9,
        color: 'var(--text-muted)',
        marginTop: 4,
      }}>
        {points.length > 0 && (
          <>
            <span>{thaiDayMonth(points[0].date)}</span>
            {points.length > 4 && <span>{thaiDayMonth(points[Math.floor(points.length / 2)].date)}</span>}
            <span>{thaiDayMonth(points[points.length - 1].date)}</span>
          </>
        )}
      </div>
    </div>
  );
}

/* ============ Utilities ============ */

function toISODate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function trendPct(current: number, previous: number): number | null {
  if (previous === 0 && current === 0) return null;
  if (previous === 0) return 100;
  return Math.round(((current - previous) / previous) * 100);
}

function thaiDayMonth(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
  } catch {
    return iso;
  }
}
