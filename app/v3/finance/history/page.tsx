'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-client';
import { deleteLedgerEntryWithAudit } from '@/lib/ledger-sync';
import {
  Wallet, ArrowLeft, Search, Loader2, ArrowDownRight, ArrowUpRight,
  Lock, Trash2, CheckCircle2, AlertCircle,
} from 'lucide-react';
import {
  type LedgerEntry, todayStr, EntryRow, LedgerEntryModal,
  overlayStyle, secBtnStyle, priBtnStyle, fieldInputStyle,
} from '../LedgerComponents';

type RangeId = '30days' | '90days' | '180days' | 'all' | 'custom';
type TypeFilter = 'all' | 'income' | 'expense';
type SourceFilter = 'all' | 'auto' | 'manual';

function daysAgoStr(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}

export default function V3FinanceHistoryPage() {
  const supabase = createClient();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [branches, setBranches] = useState<any[]>([]);
  const [branchFilter, setBranchFilter] = useState('');
  const [range, setRange] = useState<RangeId>('90days');
  const [customFrom, setCustomFrom] = useState(daysAgoStr(90));
  const [customTo, setCustomTo] = useState(todayStr());
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [search, setSearch] = useState('');

  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [editEntry, setEditEntry] = useState<LedgerEntry | null>(null);
  const [deleteEntry, setDeleteEntry] = useState<LedgerEntry | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  function notify(msg: string, ok = true) { setToast({ msg, ok }); setTimeout(() => setToast(null), 2600); }

  const { from, to } = useMemo(() => {
    if (range === 'custom') return { from: customFrom, to: customTo };
    if (range === 'all') return { from: '2000-01-01', to: todayStr() };
    const days = range === '30days' ? 30 : range === '90days' ? 90 : 180;
    return { from: daysAgoStr(days), to: todayStr() };
  }, [range, customFrom, customTo]);

  async function load() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: p } = await supabase
        .from('profiles').select('id, full_name, role, is_super_admin, shop_id, branch_id').eq('id', user.id).single();
      setProfile(p);
      if (!p?.shop_id) { setLoading(false); return; }

      const { data: br } = await supabase.from('branches').select('id, name').order('name');
      setBranches(br || []);

      let q = supabase.from('ledger_entries').select('*')
        .eq('shop_id', p.shop_id).is('deleted_at', null)
        .gte('business_date', from).lte('business_date', to)
        .order('business_date', { ascending: false }).order('created_at', { ascending: false })
        .limit(1000);
      if (branchFilter) q = q.eq('branch_id', branchFilter);

      const { data } = await q;
      setEntries((data || []) as LedgerEntry[]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [from, to, branchFilter]);

  const isAdmin = profile?.role === 'admin' || profile?.is_super_admin;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter((e) => {
      if (typeFilter !== 'all' && e.entry_type !== typeFilter) return false;
      if (sourceFilter === 'auto' && !e.is_auto_synced) return false;
      if (sourceFilter === 'manual' && e.is_auto_synced) return false;
      if (q && !e.description.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [entries, typeFilter, sourceFilter, search]);

  const totalIncome = useMemo(() => filtered.filter((e) => e.entry_type === 'income').reduce((s, e) => s + Number(e.amount), 0), [filtered]);
  const totalExpense = useMemo(() => filtered.filter((e) => e.entry_type === 'expense').reduce((s, e) => s + Number(e.amount), 0), [filtered]);

  async function handleDelete() {
    if (!deleteEntry || !profile) return;
    const { error } = await deleteLedgerEntryWithAudit(supabase, deleteEntry.id, profile.id, profile.full_name);
    if (error) { notify('ลบไม่สำเร็จ: ' + error, false); return; }
    notify('ลบรายการแล้ว');
    setDeleteEntry(null);
    setMenuOpenId(null);
    load();
  }

  if (!loading && profile && !isAdmin) {
    return (
      <div className="v3-card" style={{ padding: 40, textAlign: 'center' }}>
        <Lock size={48} strokeWidth={1.2} style={{ margin: '0 auto 12px', color: 'var(--text-muted)' }} />
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>เฉพาะแอดมิน</h2>
      </div>
    );
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <Link href="/v3/finance" style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--surface-2)', color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', flexShrink: 0 }}>
          <ArrowLeft size={20} />
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: '#dcfce7', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Wallet size={20} />
          </div>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700, fontFamily: 'Prompt, sans-serif' }}>ประวัติรายรับ-รายจ่าย</h1>
            <p style={{ fontSize: 11, color: 'var(--text-dim)' }}>ดูย้อนหลังทั้งหมด ค้นหา/กรองได้</p>
          </div>
        </div>
      </div>

      {/* สรุปตามที่กรอง */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        <div className="v3-card" style={{ padding: 14 }}>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>รายรับรวม ({filtered.filter(e => e.entry_type === 'income').length} รายการ)</div>
          <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'Prompt, sans-serif', color: '#16a34a' }}>฿{totalIncome.toLocaleString()}</div>
        </div>
        <div className="v3-card" style={{ padding: 14 }}>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>รายจ่ายรวม ({filtered.filter(e => e.entry_type === 'expense').length} รายการ)</div>
          <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'Prompt, sans-serif', color: '#ef4444' }}>฿{totalExpense.toLocaleString()}</div>
        </div>
      </div>

      {/* ตัวกรอง */}
      <div className="v3-card" style={{ padding: 10, marginBottom: 12 }}>
        <div style={{ position: 'relative', marginBottom: 10 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหารายละเอียด..."
            style={{ width: '100%', height: 38, padding: '0 12px 0 36px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
        </div>

        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, marginBottom: 8 }}>
          {([['30days', '30 วัน'], ['90days', '90 วัน'], ['180days', '180 วัน'], ['all', 'ทั้งหมด'], ['custom', 'กำหนดเอง']] as [RangeId, string][]).map(([id, label]) => (
            <button key={id} onClick={() => setRange(id)} style={{ flexShrink: 0, padding: '7px 12px', borderRadius: 100, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, background: range === id ? 'var(--accent)' : 'var(--surface-2)', color: range === id ? '#fff' : 'var(--text)' }}>
              {label}
            </button>
          ))}
        </div>

        {range === 'custom' && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} style={{ ...fieldInputStyle, flex: 1 }} />
            <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} style={{ ...fieldInputStyle, flex: 1 }} />
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as TypeFilter)} style={{ ...fieldInputStyle, flex: 1, minWidth: 110 }}>
            <option value="all">ทุกประเภท</option>
            <option value="income">รายรับ</option>
            <option value="expense">รายจ่าย</option>
          </select>
          <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value as SourceFilter)} style={{ ...fieldInputStyle, flex: 1, minWidth: 110 }}>
            <option value="all">ทุกที่มา</option>
            <option value="auto">Auto sync</option>
            <option value="manual">บันทึกมือ</option>
          </select>
          {branches.length > 0 && (
            <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} style={{ ...fieldInputStyle, flex: 1, minWidth: 110 }}>
              <option value="">ทุกสาขา</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
        </div>
      </div>

      {loading ? (
        <div className="v3-card" style={{ padding: 60, textAlign: 'center', color: 'var(--text-dim)' }}>
          <Loader2 size={24} className="v3-spin" style={{ marginBottom: 10 }} /><div>กำลังโหลด...</div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="v3-card" style={{ textAlign: 'center', padding: 40 }}>
          <Wallet size={48} strokeWidth={1.2} style={{ margin: '0 auto 12px', color: 'var(--text-muted)' }} />
          <div style={{ fontSize: 14, fontWeight: 600 }}>{search || typeFilter !== 'all' || sourceFilter !== 'all' ? 'ไม่พบรายการที่ค้นหา' : 'ไม่มีรายการในช่วงนี้'}</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filtered.map((entry) => (
            <EntryRow
              key={entry.id}
              entry={entry}
              menuOpen={menuOpenId === entry.id}
              onToggleMenu={() => setMenuOpenId(menuOpenId === entry.id ? null : entry.id)}
              onClose={() => setMenuOpenId(null)}
              onEdit={() => { setMenuOpenId(null); setEditEntry(entry); }}
              onDelete={() => { setMenuOpenId(null); setDeleteEntry(entry); }}
            />
          ))}
        </div>
      )}

      {editEntry && (
        <LedgerEntryModal
          profile={profile}
          entry={editEntry}
          onClose={() => setEditEntry(null)}
          onSuccess={() => { setEditEntry(null); load(); }}
        />
      )}
      {deleteEntry && (
        <div onClick={() => setDeleteEntry(null)} style={overlayStyle}>
          <div onClick={(e) => e.stopPropagation()} className="v3-card" style={{ maxWidth: 380, width: '100%', padding: 24, textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, margin: '0 auto 12px', background: '#fee2e2', color: '#dc2626', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Trash2 size={26} /></div>
            <h2 style={{ fontSize: 16, fontWeight: 700, fontFamily: 'Prompt, sans-serif', marginBottom: 6 }}>ยืนยันการลบ</h2>
            <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 18 }}>จะลบ &quot;{deleteEntry.description}&quot; — ระบบเก็บ audit log ไว้ ตรวจสอบย้อนหลังได้</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setDeleteEntry(null)} style={secBtnStyle}>ยกเลิก</button>
              <button onClick={handleDelete} style={{ ...priBtnStyle, background: 'linear-gradient(135deg, #ef4444, #dc2626)' }}>ลบ</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)', background: toast.ok ? '#16a34a' : '#dc2626', color: '#fff', padding: '12px 20px', borderRadius: 12, fontSize: 13, fontWeight: 600, boxShadow: '0 8px 24px rgba(0,0,0,0.2)', zIndex: 300, maxWidth: '90vw', display: 'flex', alignItems: 'center', gap: 8 }}>
          {toast.ok ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />} {toast.msg}
        </div>
      )}
    </>
  );
}
