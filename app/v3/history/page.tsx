'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-client';
import {
  Search, BarChart3, Smartphone, ShoppingBag, Wrench, Coins,
  CreditCard, Hammer, Calendar, User, TrendingUp,
  Filter, Eye, FileText,
} from 'lucide-react';

type EventType = 'stock_sale' | 'goods_sale' | 'parts_sale' | 'repair' | 'pawn' | 'installment';

interface HistoryEvent {
  id: string;
  type: EventType;
  date: string;
  title: string;
  detail: string;
  amount: number;
  customer?: string;
  staff?: string;
  branch?: string;
  imei?: string;
  link?: string;
  iconColor: string;
}

const TYPE_INFO: Record<EventType, { label: string; color: string; bg: string; Icon: any }> = {
  stock_sale: { label: 'ขายเครื่อง', color: '#22c55e', bg: '#dcfce7', Icon: Smartphone },
  goods_sale: { label: 'ขายของ', color: '#06b6d4', bg: '#cffafe', Icon: ShoppingBag },
  parts_sale: { label: 'ขายอะไหล่', color: '#ef4444', bg: '#fee2e2', Icon: Wrench },
  repair: { label: 'งานซ่อม', color: '#a855f7', bg: '#f3e8ff', Icon: Hammer },
  pawn: { label: 'จำนำ', color: '#f59e0b', bg: '#fef3c7', Icon: Coins },
  installment: { label: 'ผ่อน', color: '#8b5cf6', bg: '#ede9fe', Icon: CreditCard },
};

export default function V3HistoryPage() {
  const supabase = createClient();
  const [events, setEvents] = useState<HistoryEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeType, setActiveType] = useState<string>('all');
  const [dateRange, setDateRange] = useState<'today' | '7days' | '30days' | 'all'>('30days');
  const [profile, setProfile] = useState<any>(null);

  async function load() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: p } = await supabase
        .from('profiles')
        .select('role, is_super_admin')
        .eq('id', user.id)
        .single();
      setProfile(p);

      // ดึงทั้ง 6 source พร้อมกัน (parallel)
      const [stockSales, goodsSales, partsSales, repairs, pawns, installments] = await Promise.all([
        supabase
          .from('sales_history')
          .select('id, imei, model, color, spec, final_price, discount, sold_date, sold_by_name, payment_type, branch_id, branch:branches(name)')
          .order('sold_date', { ascending: false })
          .limit(200),
        supabase
          .from('goods_sales')
          .select('id, name, sku, unit_price, quantity, subtotal, sold_date, sold_by_name, branch_id, branch:branches(name), receipt_id')
          .order('sold_date', { ascending: false })
          .limit(200),
        supabase
          .from('parts_sales' as any)
          .select('*')
          .order('sold_date', { ascending: false })
          .limit(200),
        supabase
          .from('repair_jobs')
          .select('id, job_no, customer_name, device_model, problem_description, status, total_price, created_at, technician_name:added_by_name, branch_id, branch:branches(name)')
          .order('created_at', { ascending: false })
          .limit(200),
        supabase
          .from('pawn_stock')
          .select('id, model, imei, customer_name, pawn_price, pawn_date, status, branch_id, branch:branches(name), added_by_name')
          .order('pawn_date', { ascending: false })
          .limit(200),
        supabase
          .from('installment_stock')
          .select('id, imei, model, customer_name, full_price, down_payment, start_date, branch_id, branch:branches(name), added_by_name')
          .order('start_date', { ascending: false })
          .limit(200),
      ]);

      const allEvents: HistoryEvent[] = [];

      // 1. Stock Sales
      (stockSales.data || []).forEach((r: any) => {
        allEvents.push({
          id: `stock-${r.id}`,
          type: 'stock_sale',
          date: r.sold_date,
          title: r.model,
          detail: [r.color, r.spec, r.imei ? `IMEI: ${r.imei.slice(-6)}` : null].filter(Boolean).join(' • '),
          amount: Number(r.final_price || 0),
          imei: r.imei,
          staff: r.sold_by_name,
          branch: r.branch?.name,
          iconColor: TYPE_INFO.stock_sale.color,
          link: '/dashboard/history',
        });
      });

      // 2. Goods Sales (group by receipt)
      const goodsByReceipt = new Map<string, any[]>();
      (goodsSales.data || []).forEach((r: any) => {
        const key = r.receipt_id || r.id;
        if (!goodsByReceipt.has(key)) goodsByReceipt.set(key, []);
        goodsByReceipt.get(key)!.push(r);
      });
      goodsByReceipt.forEach((rows, receiptId) => {
        const first = rows[0];
        const total = rows.reduce((s, x) => s + Number(x.subtotal || 0), 0);
        const totalQty = rows.reduce((s, x) => s + Number(x.quantity || 0), 0);
        const itemsLabel = rows.length === 1
          ? `${first.name} × ${first.quantity}`
          : `${rows.length} รายการ (${totalQty} ชิ้น)`;
        allEvents.push({
          id: `goods-${receiptId}`,
          type: 'goods_sale',
          date: first.sold_date,
          title: itemsLabel,
          detail: rows.slice(0, 3).map((r: any) => r.name).join(' • '),
          amount: total,
          staff: first.sold_by_name,
          branch: first.branch?.name,
          iconColor: TYPE_INFO.goods_sale.color,
          link: '/dashboard/goods/history',
        });
      });

      // 3. Parts Sales
      if (!partsSales.error) {
        (partsSales.data || []).forEach((r: any) => {
          allEvents.push({
            id: `parts-${r.id}`,
            type: 'parts_sale',
            date: r.sold_date || r.created_at,
            title: r.name || r.part_name || 'อะไหล่',
            detail: [r.phone_model, r.grade].filter(Boolean).join(' • '),
            amount: Number(r.subtotal || r.unit_price * (r.quantity || 1) || 0),
            staff: r.sold_by_name,
            iconColor: TYPE_INFO.parts_sale.color,
          });
        });
      }

      // 4. Repair Jobs
      (repairs.data || []).forEach((r: any) => {
        const isClosed = r.status === 'delivered' || r.status === 'done';
        allEvents.push({
          id: `repair-${r.id}`,
          type: 'repair',
          date: (r.created_at || '').split('T')[0],
          title: `${r.job_no} • ${r.device_model}`,
          detail: r.problem_description || '-',
          amount: Number(r.total_price || 0),
          customer: r.customer_name,
          staff: r.technician_name,
          branch: r.branch?.name,
          iconColor: TYPE_INFO.repair.color,
          link: '/v3/repair',
        });
      });

      // 5. Pawn
      (pawns.data || []).forEach((r: any) => {
        allEvents.push({
          id: `pawn-${r.id}`,
          type: 'pawn',
          date: r.pawn_date,
          title: r.model,
          detail: [r.imei ? `IMEI: ${r.imei.slice(-6)}` : null].filter(Boolean).join(' • '),
          amount: Number(r.pawn_price || 0),
          customer: r.customer_name,
          staff: r.added_by_name,
          branch: r.branch?.name,
          iconColor: TYPE_INFO.pawn.color,
          link: '/v3/pawn',
        });
      });

      // 6. Installments
      (installments.data || []).forEach((r: any) => {
        allEvents.push({
          id: `inst-${r.id}`,
          type: 'installment',
          date: r.start_date,
          title: r.model,
          detail: [`ดาวน์ ฿${Number(r.down_payment || 0).toLocaleString()}`, r.imei ? `IMEI: ${r.imei.slice(-6)}` : null].filter(Boolean).join(' • '),
          amount: Number(r.full_price || 0),
          customer: r.customer_name,
          staff: r.added_by_name,
          branch: r.branch?.name,
          iconColor: TYPE_INFO.installment.color,
          link: '/v3/installment',
        });
      });

      // Sort by date (newest first)
      allEvents.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      setEvents(allEvents);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  // Date filter
  const dateFiltered = useMemo(() => {
    if (dateRange === 'all') return events;
    const now = new Date();
    const start = new Date();
    if (dateRange === 'today') start.setHours(0, 0, 0, 0);
    else if (dateRange === '7days') start.setDate(now.getDate() - 7);
    else if (dateRange === '30days') start.setDate(now.getDate() - 30);
    const startISO = start.toISOString().split('T')[0];
    return events.filter(e => (e.date || '') >= startISO);
  }, [events, dateRange]);

  // Filtered
  const filtered = useMemo(() => {
    return dateFiltered.filter(e => {
      if (activeType !== 'all' && e.type !== activeType) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!e.title.toLowerCase().includes(s) &&
            !e.detail.toLowerCase().includes(s) &&
            !(e.customer || '').toLowerCase().includes(s) &&
            !(e.staff || '').toLowerCase().includes(s) &&
            !(e.imei || '').toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [dateFiltered, activeType, search]);

  // Group by date
  const grouped = useMemo(() => {
    const map = new Map<string, HistoryEvent[]>();
    filtered.forEach(e => {
      const d = e.date || 'no-date';
      if (!map.has(d)) map.set(d, []);
      map.get(d)!.push(e);
    });
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  // Counts by type
  const typeCounts = useMemo(() => {
    const c: Record<string, number> = { all: dateFiltered.length };
    Object.keys(TYPE_INFO).forEach(k => {
      c[k] = dateFiltered.filter(e => e.type === k).length;
    });
    return c;
  }, [dateFiltered]);

  // Total revenue (only sales)
  const totalRevenue = useMemo(() => {
    return filtered
      .filter(e => e.type === 'stock_sale' || e.type === 'goods_sale' || e.type === 'parts_sale')
      .reduce((s, e) => s + e.amount, 0);
  }, [filtered]);

  return (
    <>
      <div className="v3-page-header v3-desktop-only">
        <div>
          <h1 className="v3-page-title">ประวัติทั้งหมด</h1>
          <p className="v3-page-subtitle">{filtered.length} รายการ · รายได้ ฿{totalRevenue.toLocaleString()}</p>
        </div>
      </div>

      <div className="v3-mobile-only" style={{ marginBottom: 12 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, fontFamily: 'Prompt, sans-serif' }}>
          ประวัติทั้งหมด
        </h1>
        <p style={{ fontSize: 11, color: 'var(--text-dim)' }}>
          {filtered.length} รายการ · ฿{totalRevenue.toLocaleString()}
        </p>
      </div>

      {/* Date Range tabs */}
      <div className="v3-card" style={{ marginBottom: 10, padding: 8 }}>
        <div style={{ display: 'flex', gap: 4 }}>
          <DateBtn active={dateRange === 'today'} onClick={() => setDateRange('today')} label="วันนี้" />
          <DateBtn active={dateRange === '7days'} onClick={() => setDateRange('7days')} label="7 วัน" />
          <DateBtn active={dateRange === '30days'} onClick={() => setDateRange('30days')} label="30 วัน" />
          <DateBtn active={dateRange === 'all'} onClick={() => setDateRange('all')} label="ทั้งหมด" />
        </div>
      </div>

      {/* Search + Type filter */}
      <div className="v3-card" style={{ marginBottom: 12, padding: 10 }}>
        <div style={{ position: 'relative', marginBottom: 10 }}>
          <Search size={16} style={{
            position: 'absolute', left: 12, top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--text-muted)', pointerEvents: 'none',
          }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหา รุ่น / ลูกค้า / พนักงาน / IMEI..."
            style={{
              width: '100%',
              height: 38,
              padding: '0 12px 0 36px',
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              color: 'var(--text)',
              fontSize: 13,
              fontFamily: 'inherit',
              outline: 'none',
            }}
          />
        </div>

        <div style={{
          display: 'flex',
          gap: 6,
          overflowX: 'auto',
          paddingBottom: 4,
        }}>
          <Tab active={activeType === 'all'} onClick={() => setActiveType('all')} label="ทั้งหมด" count={typeCounts.all} />
          {(Object.keys(TYPE_INFO) as EventType[]).map(t => (
            <Tab
              key={t}
              active={activeType === t}
              onClick={() => setActiveType(t)}
              label={TYPE_INFO[t].label}
              count={typeCounts[t] || 0}
              color={TYPE_INFO[t].color}
            />
          ))}
        </div>
      </div>

      {/* Timeline */}
      {loading ? (
        <div className="v3-card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-dim)' }}>
          กำลังโหลดประวัติทั้งหมด...
        </div>
      ) : grouped.length === 0 ? (
        <EmptyState />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {grouped.map(([date, dayEvents]) => (
            <DayGroup key={date} date={date} events={dayEvents} />
          ))}
        </div>
      )}
    </>
  );
}

function DateBtn({ active, onClick, label }: any) {
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

function Tab({ active, onClick, label, count, color }: any) {
  return (
    <button
      onClick={onClick}
      style={{
        flexShrink: 0,
        padding: '7px 12px',
        borderRadius: 100,
        border: '1px solid',
        borderColor: active ? (color || 'var(--accent)') : 'var(--border)',
        background: active ? (color || 'var(--accent)') : 'var(--surface)',
        color: active ? '#fff' : 'var(--text)',
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
        fontFamily: 'inherit',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
      <span style={{
        background: active ? 'rgba(255,255,255,0.25)' : 'var(--surface-2)',
        padding: '1px 7px',
        borderRadius: 100,
        fontSize: 10,
        fontWeight: 700,
      }}>
        {count}
      </span>
    </button>
  );
}

function DayGroup({ date, events }: { date: string; events: HistoryEvent[] }) {
  const dateObj = new Date(date);
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayISO = yesterday.toISOString().split('T')[0];

  let dateLabel = dateObj.toLocaleDateString('th-TH', {
    weekday: 'long', day: 'numeric', month: 'short', year: '2-digit',
  });
  if (date === today) dateLabel = `วันนี้ • ${dateLabel}`;
  else if (date === yesterdayISO) dateLabel = `เมื่อวาน • ${dateLabel}`;

  const dayRevenue = events
    .filter(e => e.type === 'stock_sale' || e.type === 'goods_sale' || e.type === 'parts_sale')
    .reduce((s, e) => s + e.amount, 0);

  return (
    <div>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 12px',
        background: 'var(--surface-2)',
        borderRadius: 10,
        marginBottom: 8,
      }}>
        <div style={{
          fontSize: 12,
          fontWeight: 700,
          fontFamily: 'Prompt, sans-serif',
          color: 'var(--text)',
        }}>
          <Calendar size={12} style={{ display: 'inline', marginRight: 6, verticalAlign: '-1px' }} />
          {dateLabel}
        </div>
        {dayRevenue > 0 && (
          <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
            รายได้ <strong style={{ color: '#22c55e' }}>฿{dayRevenue.toLocaleString()}</strong>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {events.map(e => (
          <EventCard key={e.id} event={e} />
        ))}
      </div>
    </div>
  );
}

function EventCard({ event }: { event: HistoryEvent }) {
  const info = TYPE_INFO[event.type];
  const Icon = info.Icon;

  const content = (
    <div style={{
      display: 'flex',
      gap: 12,
      padding: 12,
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderLeft: `4px solid ${info.color}`,
      borderRadius: 12,
      cursor: event.link ? 'pointer' : 'default',
      transition: 'all 0.15s',
    }}>
      <div style={{
        width: 36, height: 36,
        borderRadius: 10,
        background: info.bg,
        color: info.color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Icon size={18} strokeWidth={2.2} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 2 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{
              fontSize: 11,
              fontWeight: 600,
              color: info.color,
              marginBottom: 2,
            }}>
              {info.label}
            </div>
            <div style={{
              fontSize: 13,
              fontWeight: 700,
              color: 'var(--text)',
              fontFamily: 'Prompt, Sarabun, sans-serif',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {event.title}
            </div>
          </div>
          <div style={{
            fontSize: 14,
            fontWeight: 800,
            fontFamily: 'Prompt, sans-serif',
            color: 'var(--text)',
            whiteSpace: 'nowrap',
          }}>
            ฿{event.amount.toLocaleString()}
          </div>
        </div>

        {event.detail && (
          <div style={{
            fontSize: 11,
            color: 'var(--text-dim)',
            marginTop: 2,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {event.detail}
          </div>
        )}

        {(event.customer || event.staff) && (
          <div style={{
            fontSize: 10,
            color: 'var(--text-muted)',
            marginTop: 4,
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
          }}>
            {event.customer && (
              <span>
                <User size={9} style={{ display: 'inline', marginRight: 2, verticalAlign: '-1px' }} />
                {event.customer}
              </span>
            )}
            {event.staff && (
              <span>โดย: {event.staff}</span>
            )}
            {event.branch && (
              <span>• {event.branch}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return event.link ? (
    <Link href={event.link} style={{ textDecoration: 'none', color: 'inherit' }}>
      {content}
    </Link>
  ) : content;
}

function EmptyState() {
  return (
    <div className="v3-card" style={{ textAlign: 'center', padding: 40 }}>
      <BarChart3 size={48} strokeWidth={1.2} style={{ margin: '0 auto 12px', color: 'var(--text-muted)' }} />
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
        ไม่พบประวัติในช่วงเวลานี้
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
        ลองเปลี่ยนช่วงเวลาหรือตัวกรอง
      </div>
    </div>
  );
}
