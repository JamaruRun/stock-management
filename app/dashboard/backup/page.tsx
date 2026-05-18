'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase-client';
import Toast from '@/components/Toast';
import * as XLSX from 'xlsx';

export default function BackupPage() {
  const supabase = createClient();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [backingUp, setBackingUp] = useState(false);
  const [progress, setProgress] = useState('');
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [toast, setToast] = useState<{ title: string; msg: string; type: string } | null>(null);

  function showToast(title: string, msg: string, type: 'success' | 'danger' = 'success') {
    setToast({ title, msg, type });
    setTimeout(() => setToast(null), 2500);
  }

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data: p } = await supabase
        .from('profiles').select('*').eq('id', user.id).single();
      setProfile(p);

      const lastBackupStr = localStorage.getItem(`last_backup_${p?.shop_id}`);
      if (lastBackupStr) setLastBackup(lastBackupStr);

      if (p?.role === 'admin') {
        const [stockRes, pawnRes, installRes, goodsRes, salesRes] = await Promise.all([
          supabase.from('stock').select('id', { count: 'exact', head: true }),
          supabase.from('pawn_stock').select('id', { count: 'exact', head: true }),
          supabase.from('installment_stock').select('id', { count: 'exact', head: true }),
          supabase.from('goods').select('id', { count: 'exact', head: true }),
          supabase.from('sales_history').select('id', { count: 'exact', head: true }),
        ]);
        setStats({
          stock: stockRes.count || 0,
          pawn: pawnRes.count || 0,
          installment: installRes.count || 0,
          goods: goodsRes.count || 0,
          sales: salesRes.count || 0,
        });
      }

      setLoading(false);
    }
    load();
  }, []);

  async function fetchAllData() {
    return Promise.all([
      supabase.from('stock').select('*'),
      supabase.from('pawn_stock').select('*'),
      supabase.from('installment_stock').select('*'),
      supabase.from('goods').select('*'),
      supabase.from('sales_history').select('*'),
      supabase.from('pawn_history').select('*'),
      supabase.from('installment_history').select('*'),
      supabase.from('goods_sales').select('*'),
      supabase.from('suppliers').select('*'),
      supabase.from('supplier_transactions').select('*'),
      supabase.from('pawn_renewals').select('*'),
      supabase.from('installment_payments').select('*'),
      supabase.from('branches').select('*'),
      supabase.from('profiles').select('id, username, full_name, role, branch_id'),
      supabase.from('shops').select('*').eq('id', profile.shop_id).single(),
    ]);
  }

  async function handleBackupExcel() {
    if (!profile) return;
    setBackingUp(true);

    try {
      setProgress('กำลังโหลดข้อมูล...');
      const [
        stock, pawnStock, installStock, goods,
        salesHistory, pawnHistory, installHistory, goodsSales,
        suppliers, supplierTx, pawnRenewals, installPayments,
        branches, users, shop,
      ] = await fetchAllData();

      setProgress('กำลังสร้าง Excel...');
      const wb = XLSX.utils.book_new();

      function addSheet(name: string, data: any[] | null) {
        const arr = data || [];
        const ws = arr.length === 0 
          ? XLSX.utils.aoa_to_sheet([['ไม่มีข้อมูล']])
          : XLSX.utils.json_to_sheet(arr);
        XLSX.utils.book_append_sheet(wb, ws, name);
      }

      addSheet('ข้อมูลร้าน', shop.data ? [shop.data] : []);
      addSheet('สาขา', branches.data);
      addSheet('ผู้ใช้', users.data);
      addSheet('Supplier', suppliers.data);
      addSheet('สต๊อกเครื่อง', stock.data);
      addSheet('สต๊อกจำนำ', pawnStock.data);
      addSheet('สต๊อกผ่อน', installStock.data);
      addSheet('สต๊อกของ', goods.data);
      addSheet('ประวัติขายเครื่อง', salesHistory.data);
      addSheet('ประวัติจำนำ', pawnHistory.data);
      addSheet('ประวัติผ่อน', installHistory.data);
      addSheet('ประวัติขายของ', goodsSales.data);
      addSheet('การต่อดอกจำนำ', pawnRenewals.data);
      addSheet('การชำระงวดผ่อน', installPayments.data);
      addSheet('ธุรกรรม Supplier', supplierTx.data);

      setProgress('กำลังดาวน์โหลด...');
      const dateStr = new Date().toISOString().split('T')[0];
      const shopName = (shop.data?.name || 'shop').replace(/[^a-zA-Z0-9ก-๙]/g, '_');
      const filename = `backup_${shopName}_${dateStr}.xlsx`;
      
      XLSX.writeFile(wb, filename);

      const now = new Date().toLocaleString('th-TH');
      localStorage.setItem(`last_backup_${profile.shop_id}`, now);
      setLastBackup(now);

      showToast('Backup สำเร็จ', filename);
    } catch (e: any) {
      showToast('Backup ไม่สำเร็จ', e.message, 'danger');
    } finally {
      setBackingUp(false);
      setProgress('');
    }
  }

  async function handleBackupJSON() {
    if (!profile) return;
    setBackingUp(true);

    try {
      setProgress('กำลังโหลดข้อมูล...');
      const [
        stock, pawnStock, installStock, goods,
        salesHistory, pawnHistory, installHistory, goodsSales,
        suppliers, supplierTx, pawnRenewals, installPayments,
        branches, users, shop,
      ] = await fetchAllData();

      const backupData = {
        version: '3.3.0',
        backup_date: new Date().toISOString(),
        shop: shop.data,
        data: {
          branches: branches.data,
          users: users.data,
          suppliers: suppliers.data,
          stock: stock.data,
          pawn_stock: pawnStock.data,
          installment_stock: installStock.data,
          goods: goods.data,
          sales_history: salesHistory.data,
          pawn_history: pawnHistory.data,
          installment_history: installHistory.data,
          goods_sales: goodsSales.data,
          pawn_renewals: pawnRenewals.data,
          installment_payments: installPayments.data,
          supplier_transactions: supplierTx.data,
        },
      };

      const json = JSON.stringify(backupData, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const dateStr = new Date().toISOString().split('T')[0];
      const shopName = (shop.data?.name || 'shop').replace(/[^a-zA-Z0-9ก-๙]/g, '_');
      const filename = `backup_${shopName}_${dateStr}.json`;
      
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);

      const now = new Date().toLocaleString('th-TH');
      localStorage.setItem(`last_backup_${profile.shop_id}`, now);
      setLastBackup(now);

      showToast('Backup สำเร็จ', filename);
    } catch (e: any) {
      showToast('Backup ไม่สำเร็จ', e.message, 'danger');
    } finally {
      setBackingUp(false);
      setProgress('');
    }
  }

  const isAdmin = profile?.role === 'admin';
  const totalItems = stats ? (stats.stock + stats.pawn + stats.installment + stats.goods + stats.sales) : 0;

  if (loading) {
    return (
      <>
        <div className="page-header">
          <h1>Backup ข้อมูล</h1>
          <div className="desc">กำลังโหลด...</div>
        </div>
        <div className="skeleton" style={{ height: 80 }}></div>
      </>
    );
  }

  if (!isAdmin) {
    return (
      <>
        <div className="page-header"><h1>Backup ข้อมูล</h1></div>
        <div className="form-card">
          <div className="empty">
            <div className="empty-icon">🔒</div>
            <div className="empty-title">เฉพาะเจ้าของร้าน</div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-header">
        <h1>Backup ข้อมูล</h1>
        <div className="desc">สำรองข้อมูลทั้งหมดเพื่อความปลอดภัย</div>
      </div>

      {/* Status Banner - บางเรียบ */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '14px 16px',
        background: lastBackup ? 'rgba(16, 185, 129, 0.08)' : 'rgba(245, 158, 11, 0.08)',
        border: `1px solid ${lastBackup ? 'var(--success)' : 'var(--warning)'}`,
        borderRadius: 'var(--radius-sm)',
        marginBottom: 20,
      }}>
        <div style={{ fontSize: 24 }}>
          {lastBackup ? '✓' : '!'}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>
            {lastBackup ? 'มี Backup ล่าสุด' : 'ยังไม่เคย Backup'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
            {lastBackup || 'แนะนำให้ Backup เพื่อความปลอดภัย'}
          </div>
        </div>
      </div>

      {/* Stats - clean grid */}
      {stats && (
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: 20,
          marginBottom: 20,
        }}>
          <div style={{ 
            fontSize: 11, 
            color: 'var(--text-dim)', 
            letterSpacing: 0.5, 
            marginBottom: 14,
            textTransform: 'uppercase',
          }}>
            ข้อมูลที่จะ Backup ({totalItems.toLocaleString()} รายการ)
          </div>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', 
            gap: 12,
          }}>
            <StatItem icon="📱" label="เครื่อง" count={stats.stock} />
            <StatItem icon="💰" label="จำนำ" count={stats.pawn} />
            <StatItem icon="💳" label="ผ่อน" count={stats.installment} />
            <StatItem icon="🎒" label="ของ" count={stats.goods} />
            <StatItem icon="📜" label="ประวัติขาย" count={stats.sales} />
          </div>
        </div>
      )}

      {/* Action Card */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: 20,
        marginBottom: 16,
      }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>ดาวน์โหลด Backup</div>
        <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 16 }}>
          เลือกรูปแบบไฟล์ที่ต้องการ
        </div>

        {progress && (
          <div style={{
            padding: 10,
            background: 'var(--accent-light)',
            color: 'var(--accent-text)',
            borderRadius: 'var(--radius-sm)',
            fontSize: 12,
            marginBottom: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }}></div>
            {progress}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
          <button 
            onClick={handleBackupExcel} 
            disabled={backingUp}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: 14,
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              cursor: backingUp ? 'not-allowed' : 'pointer',
              opacity: backingUp ? 0.6 : 1,
              fontFamily: 'inherit',
              textAlign: 'left',
            }}
          >
            <div style={{ fontSize: 26 }}>📊</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Excel</div>
              <div style={{ fontSize: 11, opacity: 0.9 }}>เปิดดูได้ทันที (15 sheets)</div>
            </div>
          </button>

          <button 
            onClick={handleBackupJSON} 
            disabled={backingUp}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: 14,
              background: 'var(--surface-2)',
              color: 'var(--text)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              cursor: backingUp ? 'not-allowed' : 'pointer',
              opacity: backingUp ? 0.6 : 1,
              fontFamily: 'inherit',
              textAlign: 'left',
            }}
          >
            <div style={{ fontSize: 26 }}>📄</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>JSON</div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>สำหรับ restore ในอนาคต</div>
            </div>
          </button>
        </div>
      </div>

      {/* Tips - บางๆ */}
      <div style={{
        padding: '12px 14px',
        background: 'var(--surface-2)',
        borderRadius: 'var(--radius-sm)',
        fontSize: 12,
        color: 'var(--text-dim)',
        lineHeight: 1.6,
      }}>
        💡 <strong style={{ color: 'var(--text)' }}>แนะนำ:</strong> Backup อย่างน้อย <strong style={{ color: 'var(--text)' }}>เดือนละครั้ง</strong> หรือเมื่อมีการเปลี่ยนแปลงสำคัญ
      </div>

      {toast && <Toast {...toast} />}
    </>
  );
}

function StatItem({ icon, label, count }: { icon: string; label: string; count: number }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-start',
      padding: '10px 12px',
      background: 'var(--surface-2)',
      borderRadius: 'var(--radius-sm)',
    }}>
      <div style={{ fontSize: 18, marginBottom: 4 }}>{icon}</div>
      <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>{count.toLocaleString()}</div>
    </div>
  );
}
