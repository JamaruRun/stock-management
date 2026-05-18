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

      // โหลด last backup
      const lastBackupStr = localStorage.getItem(`last_backup_${p?.shop_id}`);
      if (lastBackupStr) setLastBackup(lastBackupStr);

      // นับจำนวนรายการ
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

  async function handleBackup() {
    if (!profile) return;
    setBackingUp(true);

    try {
      setProgress('กำลังโหลดข้อมูล...');

      // ดึงข้อมูลทุกตาราง
      const [
        stock, pawnStock, installStock, goods,
        salesHistory, pawnHistory, installHistory, goodsSales,
        suppliers, supplierTx, pawnRenewals, installPayments,
        branches, users, shop,
      ] = await Promise.all([
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

      setProgress('กำลังสร้าง Excel...');

      // สร้าง workbook
      const wb = XLSX.utils.book_new();

      function addSheet(name: string, data: any[]) {
        if (!data || data.length === 0) {
          const ws = XLSX.utils.aoa_to_sheet([['ไม่มีข้อมูล']]);
          XLSX.utils.book_append_sheet(wb, ws, name);
          return;
        }
        const ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, name);
      }

      // เพิ่ม sheets
      addSheet('ข้อมูลร้าน', shop.data ? [shop.data] : []);
      addSheet('สาขา', branches.data || []);
      addSheet('ผู้ใช้', users.data || []);
      addSheet('Supplier', suppliers.data || []);
      addSheet('สต๊อกเครื่อง', stock.data || []);
      addSheet('สต๊อกจำนำ', pawnStock.data || []);
      addSheet('สต๊อกผ่อน', installStock.data || []);
      addSheet('สต๊อกของ', goods.data || []);
      addSheet('ประวัติขายเครื่อง', salesHistory.data || []);
      addSheet('ประวัติจำนำ', pawnHistory.data || []);
      addSheet('ประวัติผ่อน', installHistory.data || []);
      addSheet('ประวัติขายของ', goodsSales.data || []);
      addSheet('การต่อดอกจำนำ', pawnRenewals.data || []);
      addSheet('การชำระงวดผ่อน', installPayments.data || []);
      addSheet('ธุรกรรม Supplier', supplierTx.data || []);

      setProgress('กำลังดาวน์โหลด...');

      // ดาวน์โหลด
      const dateStr = new Date().toISOString().split('T')[0];
      const shopName = (shop.data?.name || 'shop').replace(/[^a-zA-Z0-9ก-๙]/g, '_');
      const filename = `backup_${shopName}_${dateStr}.xlsx`;
      
      XLSX.writeFile(wb, filename);

      // บันทึก last backup
      const now = new Date().toLocaleString('th-TH');
      localStorage.setItem(`last_backup_${profile.shop_id}`, now);
      setLastBackup(now);

      showToast('Backup สำเร็จ', `ดาวน์โหลดแล้ว: ${filename}`);
    } catch (e: any) {
      console.error(e);
      showToast('Backup ไม่สำเร็จ', e.message || 'unknown error', 'danger');
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
      ] = await Promise.all([
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

      const backupData = {
        version: '3.1.0',
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

      showToast('Backup สำเร็จ', `ดาวน์โหลดแล้ว: ${filename}`);
    } catch (e: any) {
      showToast('Backup ไม่สำเร็จ', e.message, 'danger');
    } finally {
      setBackingUp(false);
      setProgress('');
    }
  }

  const isAdmin = profile?.role === 'admin';

  if (loading) {
    return (
      <>
        <div className="page-header">
          <h1>💾 Backup ข้อมูล</h1>
          <div className="desc">กำลังโหลด...</div>
        </div>
        <div className="skeleton skeleton-card"></div>
      </>
    );
  }

  if (!isAdmin) {
    return (
      <>
        <div className="page-header">
          <h1>💾 Backup ข้อมูล</h1>
        </div>
        <div className="form-card">
          <div className="empty">
            <div className="empty-icon">🔒</div>
            <div className="empty-title">เฉพาะเจ้าของร้าน</div>
            <div className="empty-sub">หน้า Backup สำหรับ Admin เท่านั้น</div>
          </div>
        </div>
      </>
    );
  }

  const totalItems = stats ? (stats.stock + stats.pawn + stats.installment + stats.goods + stats.sales) : 0;

  return (
    <>
      <div className="page-header">
        <h1>💾 Backup ข้อมูล <span className="badge-admin">ADMIN</span></h1>
        <div className="desc">สำรองข้อมูลทุกอย่างเพื่อความปลอดภัย</div>
      </div>

      {/* Last Backup */}
      <div className="form-card" style={{
        background: lastBackup ? 'rgba(46, 213, 115, 0.08)' : 'rgba(245, 158, 11, 0.08)',
        borderLeft: `3px solid ${lastBackup ? 'var(--success)' : 'var(--warning)'}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 32 }}>{lastBackup ? '✅' : '⚠️'}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>
              {lastBackup ? 'Backup ครั้งล่าสุด' : 'ยังไม่เคย Backup!'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>
              {lastBackup || 'กดปุ่มด้านล่างเพื่อดาวน์โหลดข้อมูลทั้งหมด'}
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="stats">
          <div className="stat">
            <div className="label">เครื่อง</div>
            <div className="value accent">{stats.stock}</div>
          </div>
          <div className="stat">
            <div className="label">จำนำ</div>
            <div className="value">{stats.pawn}</div>
          </div>
          <div className="stat">
            <div className="label">ผ่อน</div>
            <div className="value">{stats.installment}</div>
          </div>
          <div className="stat">
            <div className="label">อุปกรณ์เสริม</div>
            <div className="value">{stats.goods}</div>
          </div>
          <div className="stat">
            <div className="label">ประวัติขาย</div>
            <div className="value">{stats.sales}</div>
          </div>
        </div>
      )}

      {/* Backup Options */}
      <div className="form-card">
        <h3>📥 สำรองข้อมูล</h3>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 16 }}>
          ดาวน์โหลดข้อมูลทุกอย่างของร้านคุณ ({totalItems.toLocaleString()} รายการ)
        </p>

        {progress && (
          <div style={{
            padding: 12,
            background: 'var(--surface-2)',
            borderLeft: '3px solid var(--accent)',
            fontSize: 13,
            marginBottom: 16,
          }}>
            ⏳ {progress}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button 
            className="btn" 
            onClick={handleBackup} 
            disabled={backingUp}
            style={{ width: 'auto', flex: '1 1 200px' }}
          >
            {backingUp ? 'กำลัง Backup...' : '📊 ดาวน์โหลด Excel'}
          </button>
          <button 
            className="btn btn-sec" 
            onClick={handleBackupJSON} 
            disabled={backingUp}
            style={{ width: 'auto', flex: '1 1 200px' }}
          >
            {backingUp ? 'กำลัง Backup...' : '📄 ดาวน์โหลด JSON'}
          </button>
        </div>
      </div>

      {/* คำแนะนำ */}
      <div className="form-card">
        <h3>💡 ทำไมต้อง Backup?</h3>
        <div style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text-dim)' }}>
          <div style={{ marginBottom: 8 }}>
            ✅ <strong style={{ color: 'var(--text)' }}>ความปลอดภัย</strong> - ป้องกันข้อมูลสูญหายจากเหตุไม่คาดคิด
          </div>
          <div style={{ marginBottom: 8 }}>
            ✅ <strong style={{ color: 'var(--text)' }}>เก็บประวัติ</strong> - มีเอกสารย้อนหลังสำหรับภาษี/งานบัญชี
          </div>
          <div style={{ marginBottom: 8 }}>
            ✅ <strong style={{ color: 'var(--text)' }}>วิเคราะห์ข้อมูล</strong> - เปิดใน Excel ทำกราฟ/วิเคราะห์ได้
          </div>
          <div>
            ✅ <strong style={{ color: 'var(--text)' }}>ความสบายใจ</strong> - มี backup ก็หลับสบาย
          </div>
        </div>

        <div style={{ 
          marginTop: 16, 
          padding: 12, 
          background: 'rgba(59, 130, 246, 0.08)',
          borderLeft: '3px solid var(--accent)',
          fontSize: 12,
        }}>
          <strong style={{ color: 'var(--accent)' }}>📌 แนะนำ:</strong> Backup อย่างน้อย <strong>เดือนละครั้ง</strong> หรือเมื่อมีการเปลี่ยนแปลงเยอะๆ
        </div>
      </div>

      <div className="form-card">
        <h3>📋 ข้อมูลที่ Backup ครอบคลุม</h3>
        <div style={{ fontSize: 13, lineHeight: 1.8 }}>
          <div>📱 สต๊อกเครื่องทั้งหมด</div>
          <div>💰 รายการจำนำ + การต่อดอก</div>
          <div>💳 รายการผ่อน + การชำระงวด</div>
          <div>🎒 อุปกรณ์เสริม</div>
          <div>📜 ประวัติทุกประเภท (ขาย/ไถ่/หลุดจำนำ/ปิดยอด)</div>
          <div>📋 Supplier + ธุรกรรม</div>
          <div>👥 ผู้ใช้ + สาขา + ข้อมูลร้าน</div>
        </div>
      </div>

      {toast && <Toast {...toast} />}
    </>
  );
}
