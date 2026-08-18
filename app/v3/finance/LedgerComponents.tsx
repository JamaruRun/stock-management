'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase-client';
import { updateLedgerEntryWithAudit } from '@/lib/ledger-sync';
import {
  Wallet, X, Loader2, ArrowDownRight, ArrowUpRight,
  MoreVertical, Trash2, Edit2, Save,
} from 'lucide-react';

export interface LedgerEntry {
  id: string;
  business_date: string;
  description: string;
  entry_type: 'income' | 'expense';
  amount: number;
  payment_method?: string | null;
  is_auto_synced: boolean;
  source_event?: string | null;
  created_by_name?: string | null;
  branch_id?: string | null;
}

export function todayStr() {
  return new Date().toISOString().split('T')[0];
}

export function FinCard({ label, value, sub, color, Icon }: any) {
  return (
    <div className="v3-card" style={{ padding: 14 }}>
      <div style={{ width: 34, height: 34, borderRadius: 10, background: `${color}15`, color, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
        <Icon size={18} strokeWidth={2.2} />
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'Prompt, sans-serif', lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 9.5, color: 'var(--text-muted)', marginTop: 3 }}>{sub}</div>
    </div>
  );
}

export function EntryRow({ entry, menuOpen, onToggleMenu, onClose, onEdit, onDelete }: any) {
  const isIncome = entry.entry_type === 'income';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, background: 'var(--surface-2)', borderRadius: 10, borderLeft: `3px solid ${isIncome ? '#22c55e' : '#ef4444'}` }}>
      <div style={{ width: 36, height: 36, borderRadius: 8, background: isIncome ? '#dcfce7' : '#fee2e2', color: isIncome ? '#16a34a' : '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {isIncome ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, fontFamily: 'Prompt, Sarabun, sans-serif', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.description}</div>
        <div style={{ fontSize: 10, color: 'var(--text-dim)', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <span>{new Date(entry.business_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}</span>
          {entry.payment_method && <span>• {entry.payment_method === 'cash' ? 'เงินสด' : entry.payment_method === 'transfer' ? 'โอน' : entry.payment_method}</span>}
          {entry.is_auto_synced ? (
            <span style={{ background: '#dbeafe', color: '#1e40af', padding: '1px 6px', borderRadius: 100, fontWeight: 700, fontSize: 9 }}>AUTO</span>
          ) : (
            <span style={{ background: 'var(--surface)', color: 'var(--text-dim)', padding: '1px 6px', borderRadius: 100, fontWeight: 700, fontSize: 9, border: '1px solid var(--border)' }}>มือ</span>
          )}
          {entry.created_by_name && <span>• {entry.created_by_name}</span>}
        </div>
      </div>
      <div style={{ fontSize: 14, fontWeight: 800, fontFamily: 'Prompt, sans-serif', color: isIncome ? '#16a34a' : '#ef4444', whiteSpace: 'nowrap' }}>
        {isIncome ? '+' : '-'}฿{Number(entry.amount).toLocaleString()}
      </div>
      <div style={{ position: 'relative' }}>
        <button onClick={(e) => { e.stopPropagation(); onToggleMenu(); }} style={{ width: 26, height: 26, background: 'transparent', border: 'none', borderRadius: 6, cursor: 'pointer', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <MoreVertical size={13} />
        </button>
        {menuOpen && (
          <>
            <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 19 }} />
            <div style={{ position: 'absolute', top: 28, right: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: 'var(--shadow-lg)', minWidth: 120, padding: 4, zIndex: 20 }}>
              <button onClick={onEdit} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 6, fontSize: 12, border: 'none', background: 'transparent', width: '100%', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--text)' }}>
                <Edit2 size={13} /> แก้ไข
              </button>
              <button onClick={onDelete} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 6, color: 'var(--danger)', fontSize: 12, border: 'none', background: 'transparent', width: '100%', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}>
                <Trash2 size={13} /> ลบ
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function LedgerEntryModal({ profile, entry, defaultDate, onClose, onSuccess }: any) {
  const supabase = createClient();
  const isEdit = !!entry;
  const [submitting, setSubmitting] = useState(false);
  const knownMethods = ['', 'cash', 'transfer'];
  const [form, setForm] = useState({
    entry_type: entry?.entry_type || 'income',
    description: entry?.description || '',
    amount: entry ? String(entry.amount) : '',
    business_date: entry?.business_date || defaultDate || todayStr(),
    payment_method: entry?.payment_method || '',
  });
  const [customPayment, setCustomPayment] = useState(!!entry?.payment_method && !knownMethods.includes(entry.payment_method));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.description.trim()) return alert('กรอกรายละเอียด');
    if (!form.amount || parseFloat(form.amount) <= 0) return alert('กรุณาใส่จำนวนเงินที่มากกว่า 0');
    if (!profile?.shop_id) return alert('ไม่พบ shop_id');
    setSubmitting(true);

    if (isEdit) {
      const { error } = await updateLedgerEntryWithAudit(supabase, entry.id, {
        entry_type: form.entry_type,
        description: form.description.trim(),
        amount: parseFloat(form.amount),
        business_date: form.business_date,
        payment_method: form.payment_method || null,
      }, profile.id, profile.full_name);
      setSubmitting(false);
      if (error) return alert('บันทึกไม่สำเร็จ: ' + error);
      onSuccess();
      return;
    }

    const { error } = await supabase.from('ledger_entries').insert({
      shop_id: profile.shop_id,
      branch_id: profile.branch_id || null,
      business_date: form.business_date,
      description: form.description.trim(),
      entry_type: form.entry_type,
      amount: parseFloat(form.amount),
      payment_method: form.payment_method || null,
      is_auto_synced: false,
      created_by: profile.id,
      created_by_name: profile.full_name,
    });
    setSubmitting(false);
    if (error) return alert('บันทึกไม่สำเร็จ: ' + error.message);
    onSuccess();
  }

  return (
    <div onClick={onClose} style={overlayStyle}>
      <div onClick={(e) => e.stopPropagation()} className="v3-card" style={{ maxWidth: 440, width: '100%', padding: 18, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, fontFamily: 'Prompt, sans-serif', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Wallet size={18} color="var(--accent)" /> {isEdit ? 'แก้ไขรายการ' : 'เพิ่มรายการ'}
          </h2>
          <button onClick={onClose} style={{ width: 32, height: 32, background: 'var(--surface-2)', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={16} /></button>
        </div>

        {isEdit && entry.is_auto_synced && (
          <div style={{ marginBottom: 12, padding: 10, background: '#fef3c7', color: '#92400e', borderRadius: 8, fontSize: 11 }}>
            รายการนี้บันทึกอัตโนมัติจากระบบ ({entry.source_event}) — แก้ไขได้ แต่จะไม่ย้อนกลับไปแก้ธุรกรรมต้นทางให้
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={labelStyle}>ประเภท *</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => setForm({ ...form, entry_type: 'income' })} style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, background: form.entry_type === 'income' ? '#16a34a' : 'var(--surface-2)', color: form.entry_type === 'income' ? '#fff' : 'var(--text)' }}>รายรับ</button>
              <button type="button" onClick={() => setForm({ ...form, entry_type: 'expense' })} style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, background: form.entry_type === 'expense' ? '#dc2626' : 'var(--surface-2)', color: form.entry_type === 'expense' ? '#fff' : 'var(--text)' }}>รายจ่าย</button>
            </div>
          </div>

          <div>
            <label style={labelStyle}>รายละเอียด *</label>
            <input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder='เช่น "กาแฟ", "ลูกค้าเติมเน็ต true เงินสด"' style={inputStyle} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle}>จำนวนเงิน *</label>
              <input type="number" inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0" style={inputStyle} step="0.01" min="0.01" />
            </div>
            <div>
              <label style={labelStyle}>วันบัญชี *</label>
              <input type="date" value={form.business_date} onChange={(e) => setForm({ ...form, business_date: e.target.value })} style={inputStyle} />
            </div>
          </div>

          <div>
            <label style={labelStyle}>ช่องทางชำระ (ไม่บังคับ)</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6 }}>
              {[{ id: '', label: 'ไม่ระบุ' }, { id: 'cash', label: '💵 เงินสด' }, { id: 'transfer', label: '🔄 โอน' }].map((p) => (
                <button key={p.id} type="button" onClick={() => { setCustomPayment(false); setForm({ ...form, payment_method: p.id }); }} style={{ padding: '8px', background: !customPayment && form.payment_method === p.id ? 'var(--accent)' : 'var(--surface-2)', color: !customPayment && form.payment_method === p.id ? '#fff' : 'var(--text)', border: '1px solid', borderColor: !customPayment && form.payment_method === p.id ? 'var(--accent)' : 'var(--border)', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>{p.label}</button>
              ))}
              <button type="button" onClick={() => { setCustomPayment(true); setForm({ ...form, payment_method: knownMethods.includes(form.payment_method) ? '' : form.payment_method }); }} style={{ padding: '8px', background: customPayment ? 'var(--accent)' : 'var(--surface-2)', color: customPayment ? '#fff' : 'var(--text)', border: '1px solid', borderColor: customPayment ? 'var(--accent)' : 'var(--border)', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>✏️ อื่นๆ</button>
            </div>
            {customPayment && (
              <input
                type="text"
                value={form.payment_method}
                onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
                placeholder="พิมพ์ช่องทางชำระเอง เช่น เช็ค, พร้อมเพย์"
                style={{ ...inputStyle, marginTop: 6 }}
              />
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button type="button" onClick={onClose} style={secBtnStyle}>ยกเลิก</button>
            <button type="submit" disabled={submitting} style={{ ...priBtnStyle, background: submitting ? 'var(--surface-2)' : 'linear-gradient(135deg, #16a34a, #15803d)' }}>
              {submitting ? <Loader2 size={16} className="v3-spin" /> : <Save size={16} />} {submitting ? 'กำลังบันทึก...' : 'บันทึก'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export const overlayStyle: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 };
export const secBtnStyle: React.CSSProperties = { flex: 1, padding: 11, background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
export const priBtnStyle: React.CSSProperties = { flex: 1, padding: 11, color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 };
export const inputStyle: React.CSSProperties = { width: '100%', height: 38, padding: '0 12px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' };
export const fieldInputStyle: React.CSSProperties = { height: 38, padding: '0 12px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', outline: 'none' };
export const labelStyle: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4, color: 'var(--text)' };
