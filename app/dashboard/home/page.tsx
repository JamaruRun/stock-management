'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-client';

interface Stats {
  todayRevenue: number;
  todayOrders: number;
  stockCount: number;
  stockValue: number;
  pawnCount: number;
  pawnValue: number;
  pawnOverdue: number;
  installmentCount: number;
  installmentValue: number;
  installmentOverdue: number;
  goodsCount: number;
  goodsItems: number;
  goodsLowStock: number;
}

export default function DashboardHomePage() {
  const supabase = createClient();
  const [stats, setStats] = useState<Stats | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: p } = await supabase
        .from('profiles')
        .select('*, shops(name)')
        .eq('id', user.id)
        .single();
      setProfile(p);

      const today = new Date().toISOString().split('T')[0];
      const isAdmin = p?.role === 'admin';

      // Parallel fetches
      const [
        salesRes,
        stockRes,
        pawnRes,
        installRes,
        goodsRes,
        paymentsRes,
      ] = await Promise.all([
        // Today revenue (admin only - sales)
        isAdmin
          ? supabase.from('sales_history').select('final_price').eq('sold_date', today)
          : Promise.resolve({ data: [], error: null }),
        // Stock - ใช้ field "price" ตามตาราง stock จริง
        supabase.from('stock').select('price'),
        // Pawn - ดึง due_date + status ด้วย
        supabase.from('pawn_stock').select('pawn_price, due_date, pawn_date, status'),
        // Installment - เลือกเฉพาะ field ที่ใช้
        supabase.from('installment_stock').select('id, installment_amount, total_periods, start_date'),
        // Goods
        supabase.from('goods').select('stock_qty, sell_price, low_stock_alert'),
        // Installment payments (สำหรับนับงวดที่จ่ายแล้ว)
        supabase.from('installment_payments').select('installment_id'),
      ]);

      // Log errors เพื่อ debug
      if ((installRes as any).error) console.error('Installment query error:', (installRes as any).error);
      if ((pawnRes as any).error) console.error('Pawn query error:', (pawnRes as any).error);
      if ((stockRes as any).error) console.error('Stock query error:', (stockRes as any).error);
      if ((goodsRes as any).error) console.error('Goods query error:', (goodsRes as any).error);

      // Calculate
      const todayRevenue = (salesRes.data || []).reduce((s: number, r: any) => s + Number(r.final_price || 0), 0);
      const todayOrders = (salesRes.data || []).length;
      const stockCount = (stockRes.data || []).length;
      const stockValue = (stockRes.data || []).reduce((s: number, r: any) => s + Number(r.price || 0), 0);
      const pawnCount = (pawnRes.data || []).length;
      const pawnValue = (pawnRes.data || []).reduce((s: number, r: any) => s + Number(r.pawn_price || 0), 0);
      
      // คำนวณ pawn overdue
      const pawnOverdue = (pawnRes.data || []).filter((r: any) => {
        if (r.status === 'forfeited') return false;
        const due = r.due_date 
          ? new Date(r.due_date) 
          : new Date(new Date(r.pawn_date).getTime() + 30 * 86400000);
        return due < new Date();
      }).length;
      
      // นับงวดที่จ่ายแล้วของแต่ละ installment
      const paidPeriodsMap: { [id: string]: number } = {};
      (paymentsRes.data || []).forEach((p: any) => {
        paidPeriodsMap[p.installment_id] = (paidPeriodsMap[p.installment_id] || 0) + 1;
      });

      // installment_stock ทุก row คือกำลังผ่อนอยู่ (ปิดยอดแล้วย้ายไป installment_history)
      const activeInstallments = (installRes.data || []);
      const installmentCount = activeInstallments.length;
      const installmentValue = activeInstallments.reduce((s: number, r: any) => {
        const paidPeriods = paidPeriodsMap[r.id] || 0;
        const remaining = (r.total_periods - paidPeriods) * Number(r.installment_amount || 0);
        return s + Math.max(0, remaining);
      }, 0);
      
      // คำนวณค้างชำระ
      const installmentOverdue = activeInstallments.filter((r: any) => {
        if (!r.start_date) return false;
        const start = new Date(r.start_date);
        const now = new Date();
        const monthsSince = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30));
        const paidPeriods = paidPeriodsMap[r.id] || 0;
        return monthsSince > paidPeriods && paidPeriods < (r.total_periods || 0);
      }).length;
      
      const goodsCount = (goodsRes.data || []).length;
      const goodsItems = (goodsRes.data || []).reduce((s: number, r: any) => s + Number(r.stock_qty || 0), 0);
      const goodsLowStock = (goodsRes.data || []).filter((r: any) => 
        Number(r.stock_qty || 0) <= Number(r.low_stock_alert || 5)
      ).length;

      setStats({
        todayRevenue, todayOrders,
        stockCount, stockValue,
        pawnCount, pawnValue, pawnOverdue,
        installmentCount, installmentValue, installmentOverdue,
        goodsCount, goodsItems, goodsLowStock,
      });
      setLoading(false);
    }
    load();
  }, []);

  if (loading || !stats) {
    return (
      <>
        <div className="page-header">
          <h1>หน้าหลัก</h1>
          <div className="desc">กำลังโหลดข้อมูล...</div>
        </div>
        <div className="skeleton skeleton-hero"></div>
        <div className="skeleton-module-grid">
          <div className="skeleton skeleton-module"></div>
          <div className="skeleton skeleton-module"></div>
          <div className="skeleton skeleton-module"></div>
          <div className="skeleton skeleton-module"></div>
        </div>
      </>
    );
  }

  const isAdmin = profile?.role === 'admin';
  const today = new Date().toLocaleDateString('th-TH', { 
    day: 'numeric', month: 'long', year: 'numeric' 
  });

  return (
    <>
      <div className="page-header">
        <h1>หน้าหลัก</h1>
        <div className="desc">วันนี้ · {today}</div>
      </div>

      {/* Hero - ยอดขายวันนี้ (Admin เท่านั้น) */}
      {isAdmin && (
        <div className="hero-card">
          <div className="hero-card-header">
            <div>
              <div className="hero-card-label">ยอดขายวันนี้</div>
              <div className="hero-card-value">฿{stats.todayRevenue.toLocaleString()}</div>
            </div>
            {stats.todayOrders > 0 && (
              <div className="hero-card-trend">
                {stats.todayOrders} ออเดอร์
              </div>
            )}
          </div>
          <div className="hero-card-stats">
            <div className="hero-card-stat">
              <span>📱</span>
              <span>{stats.stockCount + stats.pawnCount + stats.installmentCount} เครื่อง</span>
            </div>
            <div className="hero-card-stat">
              <span>🎒</span>
              <span>{stats.goodsItems} ของ</span>
            </div>
          </div>
        </div>
      )}

      {/* Alert: จำนำเลยกำหนด */}
      {stats.pawnOverdue > 0 && (
        <Link href="/dashboard/pawn/stock" className="alert-card">
          <div className="alert-card-icon">💰</div>
          <div className="alert-card-content">
            <strong>{stats.pawnOverdue} เครื่องจำนำ</strong> เลยกำหนดต่อดอก
          </div>
          <div className="alert-card-action">ดู →</div>
        </Link>
      )}

      {/* Alert: ค้างชำระ */}
      {stats.installmentOverdue > 0 && (
        <Link href="/dashboard/installment/stock" className="alert-card">
          <div className="alert-card-icon">⚠️</div>
          <div className="alert-card-content">
            <strong>{stats.installmentOverdue} ลูกค้าผ่อน</strong> เลยกำหนดชำระ
          </div>
          <div className="alert-card-action">ดู →</div>
        </Link>
      )}

      {/* Alert: สินค้าใกล้หมด */}
      {stats.goodsLowStock > 0 && (
        <Link href="/dashboard/goods/stock" className="alert-card">
          <div className="alert-card-icon">📦</div>
          <div className="alert-card-content">
            <strong>{stats.goodsLowStock} รายการ</strong> ใกล้หมดสต๊อก
          </div>
          <div className="alert-card-action">ดู →</div>
        </Link>
      )}

      {/* Module Cards Grid */}
      <div className="section-title">
        <span>โมดูลหลัก</span>
      </div>

      <div className="module-grid">
        <Link href="/dashboard/stock" className="module-card purple">
          <div className="module-card-header">
            <div className="module-card-icon">📱</div>
          </div>
          <div className="module-card-title">สต๊อกเครื่อง</div>
          <div className="module-card-count">{stats.stockCount}</div>
          <div className="module-card-sub">฿{(stats.stockValue / 1000).toFixed(0)}K</div>
        </Link>

        <Link href="/dashboard/pawn/stock" className="module-card amber">
          <div className="module-card-header">
            <div className="module-card-icon">💰</div>
            {stats.pawnOverdue > 0 && (
              <div className="module-card-badge">{stats.pawnOverdue} เลย</div>
            )}
          </div>
          <div className="module-card-title">จำนำเครื่อง</div>
          <div className="module-card-count">{stats.pawnCount}</div>
          <div className="module-card-sub">฿{(stats.pawnValue / 1000).toFixed(0)}K</div>
        </Link>

        <Link href="/dashboard/installment/stock" className="module-card pink">
          <div className="module-card-header">
            <div className="module-card-icon">💳</div>
            {stats.installmentOverdue > 0 && (
              <div className="module-card-badge">{stats.installmentOverdue} เลย</div>
            )}
          </div>
          <div className="module-card-title">ผ่อนเครื่อง</div>
          <div className="module-card-count">{stats.installmentCount}</div>
          <div className="module-card-sub">฿{(stats.installmentValue / 1000).toFixed(0)}K</div>
        </Link>

        <Link href="/dashboard/goods/stock" className="module-card teal">
          <div className="module-card-header">
            <div className="module-card-icon">🎒</div>
            {stats.goodsLowStock > 0 && (
              <div className="module-card-badge warn">{stats.goodsLowStock} ใกล้หมด</div>
            )}
          </div>
          <div className="module-card-title">สต๊อกของ</div>
          <div className="module-card-count">{stats.goodsItems}</div>
          <div className="module-card-sub">{stats.goodsCount} รายการ</div>
        </Link>
      </div>

      {/* Quick Actions */}
      <div className="section-title">
        <span>การทำงานด่วน</span>
      </div>

      <div className="quick-actions">
        <Link href="/dashboard/add" className="quick-action">
          <div className="quick-action-icon" style={{ background: 'var(--purple-light)', color: 'var(--purple-text)' }}>📱</div>
          <div>
            <div className="quick-action-text">เพิ่มเครื่อง</div>
            <div className="quick-action-sub">รับเข้าสต๊อก</div>
          </div>
        </Link>

        <Link href="/dashboard/pawn/add" className="quick-action">
          <div className="quick-action-icon" style={{ background: 'var(--amber-light)', color: 'var(--amber-text)' }}>💰</div>
          <div>
            <div className="quick-action-text">รับจำนำ</div>
            <div className="quick-action-sub">รับเครื่องจำนำ</div>
          </div>
        </Link>

        <Link href="/dashboard/installment/add" className="quick-action">
          <div className="quick-action-icon" style={{ background: 'var(--pink-light)', color: 'var(--pink-text)' }}>💳</div>
          <div>
            <div className="quick-action-text">เพิ่มผ่อน</div>
            <div className="quick-action-sub">ลูกค้าผ่อนใหม่</div>
          </div>
        </Link>

        <Link href="/dashboard/goods/sell" className="quick-action">
          <div className="quick-action-icon" style={{ background: 'var(--teal-light)', color: 'var(--teal-text)' }}>📷</div>
          <div>
            <div className="quick-action-text">สแกนขาย</div>
            <div className="quick-action-sub">อุปกรณ์เสริม</div>
          </div>
        </Link>
      </div>

      {/* Admin: ประวัติ */}
      {isAdmin && (
        <>
          <div className="section-title">
            <span>ประวัติ (เฉพาะเจ้าของร้าน)</span>
          </div>

          <div className="quick-actions">
            <Link href="/dashboard/history" className="quick-action">
              <div className="quick-action-icon" style={{ background: 'var(--purple-light)', color: 'var(--purple-text)' }}>📱</div>
              <div>
                <div className="quick-action-text">ขายเครื่อง</div>
                <div className="quick-action-sub">รายการที่ขายไป</div>
              </div>
            </Link>

            <Link href="/dashboard/pawn/history" className="quick-action">
              <div className="quick-action-icon" style={{ background: 'var(--amber-light)', color: 'var(--amber-text)' }}>💰</div>
              <div>
                <div className="quick-action-text">จำนำ</div>
                <div className="quick-action-sub">ไถ่คืน/หลุดจำนำ</div>
              </div>
            </Link>

            <Link href="/dashboard/installment/history" className="quick-action">
              <div className="quick-action-icon" style={{ background: 'var(--pink-light)', color: 'var(--pink-text)' }}>💳</div>
              <div>
                <div className="quick-action-text">ผ่อน</div>
                <div className="quick-action-sub">ปิดยอดแล้ว</div>
              </div>
            </Link>

            <Link href="/dashboard/goods/history" className="quick-action">
              <div className="quick-action-icon" style={{ background: 'var(--teal-light)', color: 'var(--teal-text)' }}>🎒</div>
              <div>
                <div className="quick-action-text">ขายของ</div>
                <div className="quick-action-sub">ใบเสร็จที่ขาย</div>
              </div>
            </Link>
          </div>
        </>
      )}
    </>
  );
}
