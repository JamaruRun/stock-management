'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';
import * as XLSX from 'xlsx';
import {
  Database, Download, Upload, FileSpreadsheet, FileJson,
  CheckCircle2, AlertCircle, Loader2, Lock, Calendar,
  Smartphone, ShoppingBag, Coins, CreditCard, Hammer,
  Receipt, Wrench, Building2, Users, Truck, Shield,
  Sparkles, Info, Clock, XCircle, AlertTriangle,
} from 'lucide-react';

type ExportFormat = 'xlsx' | 'json';

interface TableInfo {
  key: string;
  table: string;
  label: string;
  Icon: any;
  color: string;
  count?: number;
}

const TABLES: TableInfo[] = [
  { key: 'stock', table: 'stock', label: 'สต๊อกเครื่อง', Icon: Smartphone, color: '#3b82f6' },
  { key: 'sales_history', table: 'sales_history', label: 'ประวัติขายเครื่อง', Icon: Receipt, color: '#22c55e' },
  { key: 'pawn_stock', table: 'pawn_stock', label: 'จำนำปัจจุบัน', Icon: Coins, color: '#f59e0b' },
  { key: 'pawn_history', table: 'pawn_history', label: 'ประวัติจำนำ', Icon: Coins, color: '#f59e0b' },
  { key: 'pawn_renewals', table: 'pawn_renewals', label: 'ต่อดอกจำนำ', Icon: Coins, color: '#f59e0b' },
  { key: 'installment_stock', table: 'installment_stock', label: 'ผ่อนปัจจุบัน', Icon: CreditCard, color: '#8b5cf6' },
  { key: 'installment_history', table: 'installment_history', label: 'ประวัติผ่อน', Icon: CreditCard, color: '#8b5cf6' },
  { key: 'installment_payments', table: 'installment_payments', label: 'งวดที่ชำระ', Icon: CreditCard, color: '#8b5cf6' },
  { key: 'goods', table: 'goods', label: 'อุปกรณ์เสริม', Icon: ShoppingBag, color: '#06b6d4' },
  { key: 'goods_sales', table: 'goods_sales', label: 'ประวัติขายของ', Icon: ShoppingBag, color: '#06b6d4' },
  { key: 'parts', table: 'parts', label: 'อะไหล่ซ่อม', Icon: Wrench, color: '#ef4444' },
  { key: 'repair_jobs', table: 'repair_jobs', label: 'งานซ่อม', Icon: Hammer, color: '#a855f7' },
  { key: 'suppliers', table: 'suppliers', label: 'Supplier', Icon: Truck, color: '#0ea5e9' },
  { key: 'supplier_transactions', table: 'supplier_transactions', label: 'Supplier Tx', Icon: Truck, color: '#0ea5e9' },
  { key: 'expenses', table: 'expenses', label: 'รายจ่าย', Icon: Receipt, color: '#dc2626' },
  { key: 'branches', table: 'branches', label: 'สาขา', Icon: Building2, color: '#16a34a' },
  { key: 'profiles', table: 'profiles', label: 'ผู้ใช้', Icon: Users, color: '#0369a1' },
  { key: 'shops', table: 'shops', label: 'ข้อมูลร้าน', Icon: Building2, color: '#16a34a' },
];

export default function V3BackupPage() {
  const supabase = createClient();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [accessChecked, setAccessChecked] = useState(false);

  const [counts, setCounts] = useState<Record<string, number>>({});
  const [backingUp, setBackingUp] = useState(false);
  const [progress, setProgress] = useState('');
  const [lastBackup, setLastBackup] = useState<string | null>(null);

  async function loadData() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }

      const { data: p } = await supabase
        .from('profiles')
        .select('id, full_name, role, shop_id, is_super_admin')
        .eq('id', user.id)
        .single();
      setProfile(p);

      const admin = p?.role === 'admin' || p?.is_super_admin;
      setIsAdmin(!!admin);
      setAccessChecked(true);

      if (!admin) {
        setLoading(false);
        return;
      }

      // Load counts for each table
      const countResults = await Promise.all(
        TABLES.filter(t => t.table !== 'shops').map(async (t) => {
          try {
            const { count } = await supabase
              .from(t.table as any)
              .select('id', { count: 'exact', head: true });
            return { key: t.key, count: count || 0 };
          } catch {
            return { key: t.key, count: 0 };
          }
        })
      );

      const map: Record<string, number> = {};
      countResults.forEach(r => { map[r.key] = r.count; });
      setCounts(map);

      // Last backup from localStorage
      const last = localStorage.getItem('v3-last-backup');
      if (last) setLastBackup(last);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  async function fetchAllData() {
    const results = await Promise.all(
      TABLES.map(async (t) => {
        try {
          if (t.table === 'shops' && profile?.shop_id) {
            const { data } = await supabase.from('shops').select('*').eq('id', profile.shop_id);
            return { key: t.key, data: data || [] };
          }
          if (t.table === 'profiles') {
            const { data } = await supabase.from('profiles')
              .select('id, username, full_name, role, branch_id, created_at');
            return { key: t.key, data: data || [] };
          }
          const { data } = await supabase.from(t.table as any).select('*');
          return { key: t.key, data: data || [] };
        } catch (e) {
          console.warn(`Failed to fetch ${t.table}:`, e);
          return { key: t.key, data: [] };
        }
      })
    );

    const map: Record<string, any[]> = {};
    results.forEach(r => { map[r.key] = r.data; });
    return map;
  }

  async function handleBackup(format: ExportFormat) {
    if (!profile) return;
    setBackingUp(true);
    setProgress('กำลังโหลดข้อมูลจากทุกตาราง...');

    try {
      const allData = await fetchAllData();
      setProgress(`กำลังสร้างไฟล์ ${format.toUpperCase()}...`);

      const date = new Date().toISOString().split('T')[0];
      const time = new Date().toTimeString().split(' ')[0].replace(/:/g, '-');
      const shopName = (profile.shop_id || 'shop').slice(0, 8);

      if (format === 'xlsx') {
        const wb = XLSX.utils.book_new();
        TABLES.forEach(t => {
          const arr = allData[t.key] || [];
          const ws = arr.length === 0
            ? XLSX.utils.aoa_to_sheet([['(ไม่มีข้อมูล)']])
            : XLSX.utils.json_to_sheet(arr);
          // Sheet name max 31 chars
          const sheetName = t.label.slice(0, 31);
          XLSX.utils.book_append_sheet(wb, ws, sheetName);
        });

        const filename = `StockCare_Backup_${shopName}_${date}_${time}.xlsx`;
        // ใช้ write→Blob→download แทน writeFile (เสถียรกว่าบนมือถือ/Android Chrome
        // ที่ writeFile มักได้ไฟล์ว่าง/ไม่สมบูรณ์)
        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        // JSON
        const exportData = {
          metadata: {
            version: 'v3.9.55',
            exported_at: new Date().toISOString(),
            shop_id: profile.shop_id,
            user: profile.full_name,
          },
          tables: allData,
        };
        const blob = new Blob([JSON.stringify(exportData, null, 2)], {
          type: 'application/json',
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `StockCare_Backup_${shopName}_${date}_${time}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }

      const now = new Date().toISOString();
      localStorage.setItem('v3-last-backup', now);
      setLastBackup(now);
      setProgress('สำเร็จ! ตรวจสอบไฟล์ในโฟลเดอร์ดาวน์โหลด');
      setTimeout(() => setProgress(''), 5000);
    } catch (e: any) {
      console.error(e);
      alert('สำรองข้อมูลไม่สำเร็จ: ' + (e?.message || 'unknown'));
      setProgress('');
    } finally {
      setBackingUp(false);
    }
  }

  if (accessChecked && !isAdmin) {
    return (
      <div className="v3-card" style={{ padding: 40, textAlign: 'center' }}>
        <Lock size={48} strokeWidth={1.2} style={{ margin: '0 auto 12px', color: 'var(--text-muted)' }} />
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>เฉพาะแอดมิน</h2>
        <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>หน้าสำรองข้อมูลจำกัดให้แอดมินเท่านั้น</p>
      </div>
    );
  }

  const totalRecords = Object.values(counts).reduce((s, c) => s + c, 0);

  return (
    <>
      <div className="v3-page-header v3-desktop-only">
        <div>
          <h1 className="v3-page-title">สำรองข้อมูล</h1>
          <p className="v3-page-subtitle">ดาวน์โหลดข้อมูลทั้งหมดของร้านเก็บไว้</p>
        </div>
      </div>

      <div className="v3-mobile-only" style={{ marginBottom: 12 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, fontFamily: 'Prompt, sans-serif' }}>
          สำรองข้อมูล
        </h1>
        <p style={{ fontSize: 11, color: 'var(--text-dim)' }}>
          ดาวน์โหลดข้อมูลทั้งหมดเก็บไว้
        </p>
      </div>

      {loading ? (
        <div className="v3-card" style={{ padding: 60, textAlign: 'center', color: 'var(--text-dim)' }}>
          <Loader2 size={24} className="v3-spin" style={{ marginBottom: 10 }} />
          <div>กำลังโหลด...</div>
        </div>
      ) : (
        <>
          {/* Hero Card */}
          <div style={{
            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
            borderRadius: 18,
            padding: 18,
            marginBottom: 14,
            color: '#fff',
            boxShadow: '0 8px 24px rgba(59, 130, 246, 0.25)',
            display: 'flex',
            alignItems: 'center',
            gap: 16,
          }}>
            <div style={{
              width: 56, height: 56,
              borderRadius: 16,
              background: 'rgba(255,255,255,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Database size={28} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, opacity: 0.9, marginBottom: 4 }}>
                ข้อมูลทั้งหมดในระบบ
              </div>
              <div style={{
                fontSize: 28, fontWeight: 800,
                fontFamily: 'Prompt, sans-serif',
                lineHeight: 1,
              }}>
                {totalRecords.toLocaleString()} <span style={{ fontSize: 14, fontWeight: 500 }}>รายการ</span>
              </div>
              {lastBackup && (
                <div style={{
                  fontSize: 11,
                  opacity: 0.85,
                  marginTop: 6,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}>
                  <Clock size={11} /> สำรองล่าสุด: {new Date(lastBackup).toLocaleString('th-TH', {
                    day: 'numeric', month: 'short', year: '2-digit',
                    hour: '2-digit', minute: '2-digit'
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Download Buttons */}
          <div className="v3-card" style={{ padding: 18, marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{
                width: 30, height: 30,
                borderRadius: 8,
                background: '#dbeafe',
                color: '#3b82f6',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Download size={16} />
              </div>
              <h3 style={{ fontSize: 14, fontWeight: 700, fontFamily: 'Prompt, sans-serif' }}>
                เลือกรูปแบบไฟล์
              </h3>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 10,
            }}>
              <DownloadBtn
                Icon={FileSpreadsheet}
                color="#16a34a"
                bg="#dcfce7"
                title="Excel"
                desc=".xlsx - เปิดด้วย Microsoft Excel / Google Sheets"
                onClick={() => handleBackup('xlsx')}
                disabled={backingUp}
              />
              <DownloadBtn
                Icon={FileJson}
                color="#f59e0b"
                bg="#fef3c7"
                title="JSON"
                desc=".json - สำหรับ developer / import กลับได้"
                onClick={() => handleBackup('json')}
                disabled={backingUp}
              />
            </div>

            {/* Progress */}
            {progress && (
              <div style={{
                marginTop: 14,
                padding: 12,
                background: backingUp ? '#dbeafe' : '#dcfce7',
                borderRadius: 10,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                fontSize: 12,
                color: backingUp ? '#1e40af' : '#166534',
                fontWeight: 600,
              }}>
                {backingUp ? (
                  <Loader2 size={16} className="v3-spin" />
                ) : (
                  <CheckCircle2 size={16} />
                )}
                {progress}
              </div>
            )}
          </div>

          {/* Import / Restore */}
          <ImportSection supabase={supabase} profile={profile} onDone={loadData} />

          {/* Tables list */}
          <div className="v3-card" style={{ padding: 16, marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{
                width: 30, height: 30,
                borderRadius: 8,
                background: '#fef3c7',
                color: '#f59e0b',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Database size={16} />
              </div>
              <h3 style={{ fontSize: 14, fontWeight: 700, fontFamily: 'Prompt, sans-serif' }}>
                ข้อมูลที่จะ Backup ({TABLES.length} ตาราง)
              </h3>
            </div>

            <div className="v3-tables-grid" style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 8,
            }}>
              {TABLES.map(t => {
                const Icon = t.Icon;
                const c = counts[t.key] ?? 0;
                return (
                  <div key={t.key} style={{
                    padding: 10,
                    background: 'var(--surface-2)',
                    borderRadius: 10,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}>
                    <div style={{
                      width: 28, height: 28,
                      borderRadius: 8,
                      background: `${t.color}15`,
                      color: t.color,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <Icon size={14} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 11,
                        fontWeight: 600,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {t.label}
                      </div>
                      <div style={{
                        fontSize: 10,
                        color: 'var(--text-dim)',
                        fontFamily: 'Prompt, sans-serif',
                        fontWeight: 700,
                      }}>
                        {c.toLocaleString()}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Info card */}
          <div style={{
            background: '#fef3c7',
            border: '1px solid #fcd34d',
            borderRadius: 14,
            padding: 14,
            display: 'flex',
            gap: 12,
          }}>
            <div style={{
              width: 32, height: 32,
              borderRadius: 8,
              background: '#fbbf24',
              color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Info size={16} />
            </div>
            <div style={{ flex: 1, fontSize: 12, color: '#78350f', lineHeight: 1.6 }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>
                <Sparkles size={11} style={{ display: 'inline', marginRight: 4, verticalAlign: '-1px' }} />
                แนะนำ
              </div>
              <div>
                สำรองข้อมูลเป็นประจำ <strong>เดือนละ 1 ครั้ง</strong> เพื่อความปลอดภัย<br />
                <strong>Excel</strong> เปิดดูได้ง่าย · <strong>JSON</strong> สำหรับ developer / กู้คืน
              </div>
            </div>
          </div>
        </>
      )}

      <style jsx>{`
        @media (max-width: 640px) {
          :global(.v3-tables-grid) {
            grid-template-columns: 1fr 1fr !important;
          }
        }
        @media (max-width: 400px) {
          :global(.v3-tables-grid) {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </>
  );
}

function DownloadBtn({ Icon, color, bg, title, desc, onClick, disabled }: any) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: 16,
        background: 'var(--surface)',
        border: '2px solid var(--border)',
        borderRadius: 14,
        cursor: disabled ? 'wait' : 'pointer',
        fontFamily: 'inherit',
        textAlign: 'left',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        opacity: disabled ? 0.5 : 1,
        transition: 'all 0.15s',
      }}
    >
      <div style={{
        width: 44, height: 44,
        borderRadius: 12,
        background: bg,
        color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={22} />
      </div>
      <div>
        <div style={{
          fontSize: 16,
          fontWeight: 800,
          fontFamily: 'Prompt, sans-serif',
          color: 'var(--text)',
        }}>
          {title}
        </div>
        <div style={{
          fontSize: 10,
          color: 'var(--text-dim)',
          marginTop: 2,
          lineHeight: 1.4,
        }}>
          {desc}
        </div>
      </div>
    </button>
  );
}

/* =========================
   Import / Restore
========================= */

// ลำดับ FK-safe: ตารางแม่ (branches, suppliers) ก่อน แล้วค่อยตารางลูก
// ข้าม profiles / shops (ตัวตน + ผูก auth — ห้าม import)
const IMPORT_ORDER = [
  'branches', 'suppliers',
  'stock', 'goods', 'parts', 'repair_jobs', 'expenses',
  'sales_history', 'goods_sales', 'supplier_transactions',
  'pawn_stock', 'pawn_history', 'pawn_renewals',
  'installment_stock', 'installment_history', 'installment_payments',
];

function ImportSection({ supabase, profile, onDone }: any) {
  const [parsed, setParsed] = useState<Record<string, any[]> | null>(null);
  const [fileName, setFileName] = useState('');
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<{ table: string; label: string; ok: boolean; n: number; msg?: string }[] | null>(null);
  const [err, setErr] = useState('');

  const labelOf = (key: string) => TABLES.find(t => t.key === key)?.label || key;

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setErr(''); setResults(null); setParsed(null);
    setParsing(true);
    setFileName(file.name);
    try {
      const lower = file.name.toLowerCase();
      let tables: Record<string, any[]> = {};

      if (lower.endsWith('.json')) {
        const json = JSON.parse(await file.text());
        const src = json.tables && typeof json.tables === 'object' ? json.tables : json;
        TABLES.forEach(t => { if (Array.isArray(src[t.key])) tables[t.key] = src[t.key]; });
      } else if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
        const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
        const byLabel: Record<string, string> = {};
        TABLES.forEach(t => { byLabel[t.label.slice(0, 31)] = t.key; });
        wb.SheetNames.forEach(name => {
          const key = byLabel[name];
          if (!key) return;
          const rows = XLSX.utils.sheet_to_json(wb.Sheets[name]) as any[];
          const clean = rows.filter(r => r && Object.keys(r).length > 0 && !('(ไม่มีข้อมูล)' in r));
          if (clean.length) tables[key] = clean;
        });
      } else {
        throw new Error('รองรับเฉพาะไฟล์ .json หรือ .xlsx');
      }

      // เก็บเฉพาะตารางที่ import ได้ + มี id + มีข้อมูล
      const filtered: Record<string, any[]> = {};
      IMPORT_ORDER.forEach(key => {
        const rows = tables[key];
        if (Array.isArray(rows) && rows.length > 0) filtered[key] = rows;
      });

      if (Object.keys(filtered).length === 0) {
        throw new Error('ไม่พบข้อมูลที่นำเข้าได้ในไฟล์นี้');
      }
      setParsed(filtered);
    } catch (e: any) {
      setErr('อ่านไฟล์ไม่สำเร็จ: ' + (e?.message || 'unknown'));
    } finally {
      setParsing(false);
    }
  }

  async function runImport() {
    if (!parsed || !profile?.shop_id) return;
    if (!confirm(
      'ยืนยันนำเข้าข้อมูล?\n\n' +
      '• เขียนทับรายการที่ id ตรงกัน (upsert) เฉพาะร้านของคุณ\n' +
      '• ระบบกันไม่ให้แตะข้อมูลร้านอื่นอัตโนมัติ\n' +
      '• แนะนำใช้กับไฟล์สำรองของร้านตัวเองเท่านั้น'
    )) return;

    setImporting(true);
    setResults(null);
    const out: { table: string; label: string; ok: boolean; n: number; msg?: string }[] = [];

    for (const table of IMPORT_ORDER) {
      const rows = parsed[table];
      if (!rows || rows.length === 0) continue;
      try {
        // บังคับ shop_id เป็นร้านตัวเอง กัน inject ข้ามร้าน
        const payload = rows.map((r: any) => ({ ...r, shop_id: profile.shop_id }));
        const { error } = await supabase.from(table).upsert(payload, { onConflict: 'id' });
        if (error) out.push({ table, label: labelOf(table), ok: false, n: rows.length, msg: error.message });
        else out.push({ table, label: labelOf(table), ok: true, n: rows.length });
      } catch (e: any) {
        out.push({ table, label: labelOf(table), ok: false, n: rows.length, msg: e?.message });
      }
    }

    setResults(out);
    setImporting(false);
    onDone?.();
  }

  const totalRows = parsed ? Object.values(parsed).reduce((s, r) => s + r.length, 0) : 0;

  return (
    <div className="v3-card" style={{ padding: 18, marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 8,
          background: '#ede9fe', color: '#8b5cf6',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Upload size={16} />
        </div>
        <h3 style={{ fontSize: 14, fontWeight: 700, fontFamily: 'Prompt, sans-serif' }}>
          นำเข้า / กู้คืนข้อมูล
        </h3>
      </div>
      <p style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 14, lineHeight: 1.6 }}>
        เลือกไฟล์สำรอง (.json หรือ .xlsx) ที่เคยดาวน์โหลดไว้ — ระบบจะ <strong>กู้คืนทับรายการที่ id ตรงกัน</strong> เฉพาะร้านคุณ
      </p>

      {/* คำเตือน */}
      <div style={{
        background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10,
        padding: 12, marginBottom: 14, display: 'flex', gap: 10,
      }}>
        <AlertTriangle size={16} style={{ color: '#dc2626', flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontSize: 11, color: '#991b1b', lineHeight: 1.6 }}>
          ใช้กับ<strong>ไฟล์สำรองของร้านตัวเอง</strong>เท่านั้น · <strong>JSON</strong> แม่นยำกว่า (ชนิดข้อมูลตรง) · Excel เป็นแบบ best-effort · ไม่นำเข้าผู้ใช้/ข้อมูลร้าน
        </div>
      </div>

      {/* ปุ่มเลือกไฟล์ */}
      {!parsed && (
        <label style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          padding: '13px', borderRadius: 12, cursor: parsing ? 'wait' : 'pointer',
          background: 'linear-gradient(135deg,#8b5cf6,#6d28d9)', color: '#fff',
          fontSize: 14, fontWeight: 700, fontFamily: 'inherit',
        }}>
          {parsing ? <Loader2 size={17} className="v3-spin" /> : <Upload size={17} />}
          {parsing ? 'กำลังอ่านไฟล์...' : 'เลือกไฟล์ (.json / .xlsx)'}
          <input type="file" accept=".json,.xlsx,.xls" onChange={handleFile} disabled={parsing} style={{ display: 'none' }} />
        </label>
      )}

      {err && (
        <div style={{ marginTop: 12, padding: 10, background: '#fef2f2', borderRadius: 8, fontSize: 12, color: '#b91c1c', fontWeight: 600 }}>
          {err}
        </div>
      )}

      {/* preview ก่อนยืนยัน */}
      {parsed && !results && (
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8 }}>
            ไฟล์: <strong style={{ color: 'var(--text)' }}>{fileName}</strong> · รวม {totalRows.toLocaleString()} รายการ
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14, maxHeight: 200, overflowY: 'auto' }}>
            {Object.entries(parsed).map(([key, rows]) => (
              <div key={key} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '8px 10px', background: 'var(--surface-2)', borderRadius: 8, fontSize: 12,
              }}>
                <span style={{ fontWeight: 600 }}>{labelOf(key)}</span>
                <span style={{ color: 'var(--text-dim)', fontWeight: 700 }}>{rows.length.toLocaleString()}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <button onClick={() => { setParsed(null); setFileName(''); }} disabled={importing} style={{
              padding: '12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface-2)',
              color: 'var(--text)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}>ยกเลิก</button>
            <button onClick={runImport} disabled={importing} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '12px', borderRadius: 10, border: 'none',
              background: importing ? 'var(--surface-2)' : 'linear-gradient(135deg,#8b5cf6,#6d28d9)',
              color: '#fff', fontSize: 13, fontWeight: 700, cursor: importing ? 'wait' : 'pointer', fontFamily: 'inherit',
            }}>
              {importing ? <Loader2 size={15} className="v3-spin" /> : <Upload size={15} />}
              {importing ? 'กำลังนำเข้า...' : 'เริ่มนำเข้า'}
            </button>
          </div>
        </div>
      )}

      {/* ผลลัพธ์ */}
      {results && (
        <div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
            {results.map(r => (
              <div key={r.table} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 10px', borderRadius: 8, fontSize: 12,
                background: r.ok ? '#dcfce7' : '#fef2f2',
              }}>
                {r.ok ? <CheckCircle2 size={14} style={{ color: '#16a34a', flexShrink: 0 }} /> : <XCircle size={14} style={{ color: '#dc2626', flexShrink: 0 }} />}
                <span style={{ fontWeight: 600, color: r.ok ? '#166534' : '#991b1b' }}>{r.label}</span>
                <span style={{ marginLeft: 'auto', color: r.ok ? '#166534' : '#991b1b' }}>
                  {r.ok ? `${r.n.toLocaleString()} รายการ` : (r.msg || 'ไม่สำเร็จ')}
                </span>
              </div>
            ))}
          </div>
          <button onClick={() => { setParsed(null); setResults(null); setFileName(''); }} style={{
            width: '100%', padding: '12px', borderRadius: 10, border: '1px solid var(--border)',
            background: 'var(--surface-2)', color: 'var(--text)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
          }}>เสร็จสิ้น — นำเข้าไฟล์อื่น</button>
        </div>
      )}
    </div>
  );
}
