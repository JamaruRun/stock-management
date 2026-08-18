'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-client';
import { deleteLedgerEntryWithAudit } from '@/lib/ledger-sync';
import {
  Wallet, Plus, Loader2, ArrowDownRight, ArrowUpRight,
  PiggyBank, TrendingDown, Trash2, Lock, History,
  CheckCircle2, AlertCircle,
} from 'lucide-react';
import {
  type LedgerEntry, todayStr, FinCard, EntryRow, LedgerEntryModal,
  overlayStyle, secBtnStyle, priBtnStyle, fieldInputStyle,
} from './LedgerComponents';

function thisMonthStr() {
  return new Date().toISOString().slice(0, 7);
}
function lastDayOfMonth(monthStr: string) {
  const [y, m] = monthStr.split('-').map(Number);
  const d = new Date(y, m, 0);
  return d.toISOString().split('T')[0];
}
function modeBtnStyle(active: boolean): React.CSSProperties {
  return {
    flex: 1, padding: '8px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
    background: active ? 'var(--accent)' : 'var(--surface-2)', color: active ? '#fff' : 'var(--text)',
  };
}

export default function V3FinancePage() {
  const supabase = createClient();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'day' | 'month'>('day');
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [selectedMonth, setSelectedMonth] = useState(thisMonthStr());
  const [branches, setBranches] = useState<any[]>([]);
  const [branchFilter, setBranchFilter] = useState('');

  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [salesProfit, setSalesProfit] = useState(0);
  const [goodsRevenue, setGoodsRevenue] = useState(0);

  const [showAddModal, setShowAddModal] = useState(false);
  const [editEntry, setEditEntry] = useState<LedgerEntry | null>(null);
  const [deleteEntry, setDeleteEntry] = useState<LedgerEntry | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  function notify(msg: string, ok = true) { setToast({ msg, ok }); setTimeout(() => setToast(null), 2600); }

  const { from, to } = useMemo(() => {
    if (viewMode === 'day') return { from: selectedDate, to: selectedDate };
    return { from: `${selectedMonth}-01`, to: lastDayOfMonth(selectedMonth) };
  }, [viewMode, selectedDate, selectedMonth]);

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

      let ledgerQ = supabase.from('ledger_entries').select('*')
        .eq('shop_id', p.shop_id).is('deleted_at', null)
        .gte('business_date', from).lte('business_date', to)
        .order('business_date', { ascending: false }).order('created_at', { ascending: false });
      let salesQ = supabase.from('sales_history').select('profit, branch_id')
        .eq('shop_id', p.shop_id).gte('business_date', from).lte('business_date', to);
      let goodsQ = supabase.from('goods_sales').select('subtotal, branch_id')
        .eq('shop_id', p.shop_id).gte('business_date', from).lte('business_date', to);

      if (branchFilter) {
        ledgerQ = ledgerQ.eq('branch_id', branchFilter);
        salesQ = salesQ.eq('branch_id', branchFilter);
        goodsQ = goodsQ.eq('branch_id', branchFilter);
      }

      const [ledgerRes, salesRes, goodsRes] = await Promise.all([ledgerQ, salesQ, goodsQ]);
      setEntries((ledgerRes.data || []) as LedgerEntry[]);
      setSalesProfit((salesRes.data || []).reduce((s: number, r: any) => s + Number(r.profit || 0), 0));
      setGoodsRevenue((goodsRes.data || []).reduce((s: number, r: any) => s + Number(r.subtotal || 0), 0));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [from, to, branchFilter]);

  const isAdmin = profile?.role === 'admin' || profile?.is_super_admin;

  const ledgerIncome = useMemo(() => entries.filter(e => e.entry_type === 'income').reduce((s, e) => s + Number(e.amount), 0), [entries]);
  const ledgerExpense = useMemo(() => entries.filter(e => e.entry_type === 'expense').reduce((s, e) => s + Number(e.amount), 0), [entries]);
  const totalIncome = ledgerIncome + salesProfit + goodsRevenue;
  const totalExpense = ledgerExpense;
  const netProfit = totalIncome - totalExpense;

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
        <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>หน้ารายรับ-รายจ่ายจำกัดให้แอดมินเท่านั้น</p>
      </div>
    );
  }

  return (
    <>
      <div className="v3-page-header v3-desktop-only">
        <div>
          <h1 className="v3-page-title">รายรับ-รายจ่าย</h1>
          <p className="v3-page-subtitle">สรุปตามวันบัญชี (business date)</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href="/v3/finance/history" className="v3-btn v3-btn-secondary" style={{ textDecoration: 'none' }}>
            <History size={16} /> ประวัติ
          </Link>
          <button onClick={() => setShowAddModal(true)} className="v3-btn v3-btn-primary">
            <Plus size={16} strokeWidth={2.5} /> เพิ่มรายการ
          </button>
        </div>
      </div>

      <div className="v3-mobile-only" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, fontFamily: 'Prompt, sans-serif' }}>รายรับ-รายจ่าย</h1>
          <p style={{ fontSize: 11, color: 'var(--text-dim)' }}>สรุปตามวันบัญชี</p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <Link href="/v3/finance/history" style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>
            <History size={18} />
          </Link>
          <button onClick={() => setShowAddModal(true)} style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--accent)', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <Plus size={20} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {/* ตัวกรอง: รายวัน/รายเดือน + สาขา */}
      <div className="v3-card" style={{ padding: 10, marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          <button onClick={() => setViewMode('day')} style={modeBtnStyle(viewMode === 'day')}>รายวัน</button>
          <button onClick={() => setViewMode('month')} style={modeBtnStyle(viewMode === 'month')}>รายเดือน</button>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {viewMode === 'day' ? (
            <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} style={{ ...fieldInputStyle, flex: 1, minWidth: 140 }} />
          ) : (
            <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} style={{ ...fieldInputStyle, flex: 1, minWidth: 140 }} />
          )}
          {branches.length > 0 && (
            <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} style={{ ...fieldInputStyle, flex: 1, minWidth: 140 }}>
              <option value="">ทุกสาขา</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
        </div>
      </div>

      {loading ? (
        <div className="v3-card" style={{ padding: 60, textAlign: 'center', color: 'var(--text-dim)' }}>
          <Loader2 size={24} className="v3-spin" style={{ marginBottom: 10 }} />
          <div>กำลังคำนวณ...</div>
        </div>
      ) : (
        <>
          <div style={{
            background: netProfit >= 0 ? 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)' : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
            borderRadius: 18, padding: 18, marginBottom: 14, color: '#fff',
            boxShadow: netProfit >= 0 ? '0 8px 24px rgba(34, 197, 94, 0.25)' : '0 8px 24px rgba(239, 68, 68, 0.25)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 4 }}>{netProfit >= 0 ? '💰 กำไรสุทธิ' : '⚠️ ขาดทุนสุทธิ'}</div>
                <div style={{ fontSize: 32, fontWeight: 800, fontFamily: 'Prompt, sans-serif', letterSpacing: '-0.5px', lineHeight: 1 }}>
                  ฿{Math.abs(netProfit).toLocaleString()}
                </div>
                <div style={{ fontSize: 11, opacity: 0.85, marginTop: 6 }}>
                  รายรับ ฿{totalIncome.toLocaleString()} − รายจ่าย ฿{totalExpense.toLocaleString()}
                </div>
              </div>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {netProfit >= 0 ? <PiggyBank size={28} /> : <TrendingDown size={28} />}
              </div>
            </div>
          </div>

          <div className="v3-fin-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 14 }}>
            <FinCard label="รายรับรวม" value={`฿${totalIncome.toLocaleString()}`} sub={`สมุด ฿${ledgerIncome.toLocaleString()} · กำไรขายเครื่อง ฿${salesProfit.toLocaleString()} · ของแถม ฿${goodsRevenue.toLocaleString()}`} color="#22c55e" Icon={ArrowUpRight} />
            <FinCard label="รายจ่ายรวม" value={`฿${totalExpense.toLocaleString()}`} sub={`${entries.filter(e => e.entry_type === 'expense').length} รายการ`} color="#ef4444" Icon={ArrowDownRight} />
            <FinCard label="รายการในสมุด" value={String(entries.length)} sub={`Auto ${entries.filter(e => e.is_auto_synced).length} · มือ ${entries.filter(e => !e.is_auto_synced).length}`} color="#3b82f6" Icon={Wallet} />
          </div>

          <div className="v3-card" style={{ padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: '#dbeafe', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Wallet size={16} /></div>
              <h3 style={{ fontSize: 14, fontWeight: 700, fontFamily: 'Prompt, sans-serif' }}>สมุดรายรับ-รายจ่าย ({entries.length})</h3>
            </div>

            {entries.length === 0 ? (
              <div style={{ padding: 30, textAlign: 'center' }}>
                <Wallet size={36} strokeWidth={1.5} style={{ margin: '0 auto 8px', color: 'var(--text-muted)' }} />
                <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 12 }}>ยังไม่มีรายการในช่วงนี้</div>
                <button onClick={() => setShowAddModal(true)} style={{ padding: '8px 16px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit' }}>+ เพิ่มรายการแรก</button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {entries.map((entry) => (
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
          </div>
        </>
      )}

      {showAddModal && (
        <LedgerEntryModal
          profile={profile}
          defaultDate={viewMode === 'day' ? selectedDate : todayStr()}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => { setShowAddModal(false); load(); }}
        />
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

      <style jsx>{`
        @media (max-width: 640px) {
          :global(.v3-fin-stats) { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </>
  );
}
