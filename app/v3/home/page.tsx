'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-client';
import {
  Wallet, TrendingUp, Smartphone, Hammer, Coins, CreditCard,
  ShoppingBag, Wrench, AlertTriangle, Plus, ShoppingCart,
  UserPlus, Barcode, ArrowRight, Package,
} from 'lucide-react';

interface Stats {
  todayRevenue: number;
  todayProfit: number;
  todayOrders: number;
  stockCount: number;
  pawnCount: number;
  installmentCount: number;
  goodsCount: number;
  partsLow: number;
  repairPending: number;
  pawnDueSoon: number;
}

export default function V3HomePage() {
  const supabase = createClient();
  const [stats, setStats] = useState<Stats>({
    todayRevenue: 0,
    todayProfit: 0,
    todayOrders: 0,
    stockCount: 0,
    pawnCount: 0,
    installmentCount: 0,
    goodsCount: 0,
    partsLow: 0,
    repairPending: 0,
    pawnDueSoon: 0,
  });
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userName, setUserName] = useState('');

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

        const today = new Date().toISOString().split('T')[0];

        const [salesRes, stockRes, pawnRes, installRes, goodsRes, partsRes, repairRes] = await Promise.all([
          isAdminUser
            ? supabase.from('sales_history').select('final_price, profit').eq('sold_date', today)
            : Promise.resolve({ data: [] }),
          supabase.from('stock').select('id', { count: 'exact', head: true }),
          supabase.from('pawn_stock').select('due_date, status'),
          supabase.from('installment_stock').select('id', { count: 'exact', head: true }),
          supabase.from('goods').select('stock_qty, low_stock_alert'),
          supabase.from('parts').select('stock_qty, low_stock_alert'),
          supabase.from('repair_jobs').select('status'),
        ]);

        const todayRevenue = (salesRes.data || []).reduce((s: number, r: any) => s + Number(r.final_price || 0), 0);
        const todayProfit = (salesRes.data || []).reduce((s: number, r: any) => s + Number(r.profit || 0), 0);
        const todayOrders = (salesRes.data || []).length;

        const pawnActive = (pawnRes.data || []).filter((p: any) => p.status === 'active' || !p.status);
        const now = new Date();
        const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        const pawnDueSoon = pawnActive.filter((p: any) => {
          if (!p.due_date) return false;
          const due = new Date(p.due_date);
          return due >= now && due <= in7Days;
        }).length;

        const partsLow = (partsRes.data || []).filter((p: any) => 
          Number(p.stock_qty) <= Number(p.low_stock_alert || 2) && Number(p.stock_qty) > 0
        ).length;

        const repairPending = (repairRes.data || []).filter((r: any) => 
          r.status !== 'completed' && r.status !== 'cancelled' && r.status !== 'delivered'
        ).length;

        setStats({
          todayRevenue, todayProfit, todayOrders,
          stockCount: stockRes.count || 0,
          pawnCount: pawnActive.length,
          installmentCount: installRes.count || 0,
          goodsCount: (goodsRes.data || []).length,
          partsLow,
          repairPending,
          pawnDueSoon,
        });
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const todayStr = new Date().toLocaleDateString('th-TH', { 
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
  });

  const alerts = [
    stats.partsLow > 0 && {
      type: 'warning' as const,
      icon: AlertTriangle,
      title: `อะไหล่ใกล้หมด ${stats.partsLow} รายการ`,
      desc: 'ควรสั่งเพิ่ม',
      href: '/v3/parts',
      color: '#f59e0b',
    },
    stats.repairPending > 0 && {
      type: 'info' as const,
      icon: Hammer,
      title: `งานซ่อมค้าง ${stats.repairPending} งาน`,
      desc: 'ต้องดำเนินการ',
      href: '/v3/repair',
      color: '#3b82f6',
    },
    stats.pawnDueSoon > 0 && {
      type: 'danger' as const,
      icon: Coins,
      title: `จำนำใกล้ครบ ${stats.pawnDueSoon} ใบ`,
      desc: 'ภายใน 7 วัน',
      href: '/v3/pawn',
      color: '#ef4444',
    },
  ].filter(Boolean) as any[];

  return (
    <>
      {/* Greeting */}
      <div className="v3-page-header">
        <div>
          <h1 className="v3-page-title">
            สวัสดีครับ{userName ? `, ${userName}` : ''} 👋
          </h1>
          <p className="v3-page-subtitle">{todayStr}</p>
        </div>
        <Link href="/v3/stock/add" className="v3-btn v3-btn-primary" style={{ textDecoration: 'none' }}>
          <Plus size={16} strokeWidth={2.5} /> เพิ่มเครื่องใหม่
        </Link>
      </div>

      {/* KPI Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 12,
        marginBottom: 20,
      }}>
        {isAdmin && (
          <KpiCard
            label="ยอดขายวันนี้"
            value={loading ? '...' : `฿${stats.todayRevenue.toLocaleString()}`}
            sub={`${stats.todayOrders} บิล`}
            Icon={Wallet}
            color="#3b82f6"
          />
        )}
        {isAdmin && (
          <KpiCard
            label="กำไรวันนี้"
            value={loading ? '...' : `฿${stats.todayProfit.toLocaleString()}`}
            sub="หลังหักต้นทุน"
            Icon={TrendingUp}
            color="#22c55e"
          />
        )}
        <KpiCard
          label="เครื่องในสต๊อก"
          value={loading ? '...' : stats.stockCount.toString()}
          sub="เครื่อง"
          Icon={Smartphone}
          color="#06b6d4"
        />
        <KpiCard
          label="งานซ่อมค้าง"
          value={loading ? '...' : stats.repairPending.toString()}
          sub="งาน"
          Icon={Hammer}
          color="#f59e0b"
        />
        <KpiCard
          label="จำนำใกล้ครบ"
          value={loading ? '...' : stats.pawnDueSoon.toString()}
          sub="ภายใน 7 วัน"
          Icon={Coins}
          color="#ef4444"
        />
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="v3-card" style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <AlertTriangle size={16} /> แจ้งเตือนที่ต้องจัดการ
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {alerts.map((a, i) => {
              const AIcon = a.icon;
              return (
                <Link
                  key={i}
                  href={a.href}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: 12,
                    background: `${a.color}10`,
                    border: `1px solid ${a.color}30`,
                    borderRadius: 'var(--radius-sm)',
                    textDecoration: 'none',
                    color: 'var(--text)',
                  }}
                >
                  <div style={{
                    width: 36, height: 36,
                    borderRadius: 8,
                    background: `${a.color}20`,
                    color: a.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <AIcon size={18} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{a.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{a.desc}</div>
                  </div>
                  <ArrowRight size={16} style={{ color: 'var(--text-muted)' }} />
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="v3-card" style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
          ⚡ ทางลัด
        </h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
          gap: 8,
        }}>
          <QuickAction Icon={Plus} label="เพิ่มเครื่อง" href="/v3/stock/add" color="#3b82f6" />
          <QuickAction Icon={ShoppingCart} label="ขายอุปกรณ์" href="/v3/goods/sell" color="#22c55e" />
          <QuickAction Icon={Hammer} label="รับงานซ่อม" href="/v3/repair/new" color="#f59e0b" />
          <QuickAction Icon={Coins} label="รับจำนำ" href="/v3/pawn/new" color="#ef4444" />
          <QuickAction Icon={CreditCard} label="ผ่อนใหม่" href="/v3/installment/new" color="#8b5cf6" />
          <QuickAction Icon={Barcode} label="พิมพ์บาร์โค้ด" href="/v3/stock" color="#06b6d4" />
        </div>
      </div>

      {/* Modules Overview */}
      <div className="v3-card">
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>
          📊 ภาพรวมระบบ
        </h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 10,
        }}>
          <ModuleStat Icon={Smartphone} label="เครื่อง" value={stats.stockCount} href="/v3/stock" />
          <ModuleStat Icon={Coins} label="จำนำ" value={stats.pawnCount} href="/v3/pawn" />
          <ModuleStat Icon={CreditCard} label="ผ่อน" value={stats.installmentCount} href="/v3/installment" />
          <ModuleStat Icon={ShoppingBag} label="อุปกรณ์" value={stats.goodsCount} href="/v3/goods" />
          <ModuleStat Icon={Hammer} label="งานซ่อม" value={stats.repairPending} href="/v3/repair" />
        </div>
      </div>

      {/* Info banner */}
      <div style={{
        marginTop: 16,
        padding: 14,
        background: 'var(--accent-light)',
        border: '1px solid var(--accent)',
        borderRadius: 'var(--radius)',
        color: 'var(--accent-text)',
        fontSize: 12,
        lineHeight: 1.6,
      }}>
        <strong>✨ คุณกำลังใช้ระบบเวอร์ชั่นใหม่ (v3)</strong><br />
        ระบบเดิมยังใช้งานได้ที่ <Link href="/dashboard/home" style={{ color: 'var(--accent-strong)', fontWeight: 600 }}>/dashboard/home</Link> ระหว่างที่เรากำลังพัฒนาเวอร์ชั่นนี้
      </div>
    </>
  );
}

function KpiCard({ label, value, sub, Icon, color }: any) {
  return (
    <div className="v3-card" style={{ padding: 16 }}>
      <div style={{
        width: 38, height: 38,
        borderRadius: 10,
        background: `${color}15`,
        color: color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 10,
      }}>
        <Icon size={20} strokeWidth={2.2} />
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>
    </div>
  );
}

function QuickAction({ Icon, label, href, color }: any) {
  return (
    <Link
      href={href}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        padding: '14px 8px',
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        textDecoration: 'none',
        color: 'var(--text)',
        fontSize: 11,
        fontWeight: 600,
        transition: 'all 0.15s',
      }}
    >
      <div style={{
        width: 38, height: 38,
        borderRadius: 10,
        background: `${color}15`,
        color: color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <Icon size={20} strokeWidth={2.2} />
      </div>
      <span style={{ textAlign: 'center' }}>{label}</span>
    </Link>
  );
}

function ModuleStat({ Icon, label, value, href }: any) {
  return (
    <Link
      href={href}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: 12,
        background: 'var(--surface-2)',
        borderRadius: 'var(--radius-sm)',
        textDecoration: 'none',
        color: 'var(--text)',
      }}
    >
      <Icon size={20} style={{ color: 'var(--accent)' }} />
      <div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{label}</div>
        <div style={{ fontSize: 16, fontWeight: 700 }}>{value}</div>
      </div>
    </Link>
  );
}
