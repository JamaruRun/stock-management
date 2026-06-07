'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase-client';
import {
  Package, X, Tag, DollarSign, Boxes, Bell, Loader2, CheckCircle2, AlertCircle, Save,
} from 'lucide-react';

interface Props { item: any; onClose: () => void; onSuccess: () => void; }

export default function GoodsEditModal({ item, onClose, onSuccess }: Props) {
  const supabase = createClient();
  const [form, setForm] = useState({
    name: item.name || '', category: item.category || '',
    cost_price: String(item.cost_price ?? ''), sell_price: String(item.sell_price ?? ''),
    stock_qty: String(item.stock_qty ?? ''), low_stock_alert: String(item.low_stock_alert ?? '5'),
    note: item.note || '',
  });
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  function notify(msg: string, ok = true) { setToast({ msg, ok }); setTimeout(() => setToast(null), 2400); }

  useEffect(() => {
    supabase.from('goods').select('category').then(({ data }) => {
      setCategories(Array.from(new Set((data || []).map((g: any) => g.category).filter(Boolean))) as string[]);
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.sell_price) return notify('กรอก ชื่อ + ราคาขาย', false);
    setLoading(true);
    const { error } = await supabase.from('goods').update({
      name: form.name, category: form.category || null,
      cost_price: parseFloat(form.cost_price) || 0, sell_price: parseFloat(form.sell_price),
      stock_qty: parseInt(form.stock_qty) || 0, low_stock_alert: parseInt(form.low_stock_alert) || 5,
      note: form.note || null,
    }).eq('id', item.id);
    setLoading(false);
    if (error) return notify('บันทึกไม่สำเร็จ: ' + error.message, false);
    notify('บันทึกแล้ว');
    setTimeout(() => onSuccess(), 800);
  }

  return (
    <div onClick={onClose} style={ov}>
      <div onClick={(e) => e.stopPropagation()} className="v3-card" style={card}>
        <div style={headerSt}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#dbeafe', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Package size={18} /></div>
            <div><h2 style={{ fontSize: 16, fontWeight: 700, fontFamily: 'Prompt, sans-serif' }}>แก้ไขสินค้า</h2><p style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'monospace' }}>{item.sku}</p></div>
          </div>
          <button onClick={onClose} style={closeBtn}><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ overflowY: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <F label="ชื่อสินค้า" req><Inp value={form.name} onChange={(v: string) => setForm({ ...form, name: v })} placeholder="ชื่อสินค้า" /></F>
          <F label="หมวดหมู่">
            <Inp Icon={Tag} value={form.category} onChange={(v: string) => setForm({ ...form, category: v })} placeholder="เช่น ฟิล์ม, เคส" list="goods-cats-edit" />
            <datalist id="goods-cats-edit">{categories.map(c => <option key={c} value={c} />)}</datalist>
          </F>
          <div style={g2}>
            <F label="ราคาทุน (฿)"><Inp Icon={DollarSign} type="number" value={form.cost_price} onChange={(v: string) => setForm({ ...form, cost_price: v })} placeholder="0" /></F>
            <F label="ราคาขาย (฿)" req><Inp Icon={DollarSign} type="number" value={form.sell_price} onChange={(v: string) => setForm({ ...form, sell_price: v })} placeholder="0" /></F>
          </div>
          <div style={g2}>
            <F label="คงเหลือ"><Inp Icon={Boxes} type="number" value={form.stock_qty} onChange={(v: string) => setForm({ ...form, stock_qty: v })} placeholder="0" /></F>
            <F label="เตือนเมื่อเหลือ"><Inp Icon={Bell} type="number" value={form.low_stock_alert} onChange={(v: string) => setForm({ ...form, low_stock_alert: v })} placeholder="5" /></F>
          </div>
          <F label="หมายเหตุ"><textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="(ไม่บังคับ)" rows={2} style={{ ...inputSt, height: 'auto', minHeight: 52, padding: '10px 12px', resize: 'vertical' }} onFocus={fOn} onBlur={fOff} /></F>

          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button type="button" onClick={onClose} style={secBtn}>ยกเลิก</button>
            <button type="submit" disabled={loading} style={{ ...priBtn, background: loading ? 'var(--surface-2)' : 'linear-gradient(135deg, #3b82f6, #2563eb)' }}>
              {loading ? <Loader2 size={17} className="v3-spin" /> : <Save size={17} strokeWidth={2.4} />}
              {loading ? 'กำลังบันทึก...' : 'บันทึก'}
            </button>
          </div>
        </form>
      </div>
      {toast && <Toast toast={toast} />}
    </div>
  );
}

function Toast({ toast }: any) {
  return (
    <div style={{ position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)', background: toast.ok ? '#16a34a' : '#dc2626', color: '#fff', padding: '12px 20px', borderRadius: 12, fontSize: 13, fontWeight: 600, boxShadow: '0 8px 24px rgba(0,0,0,0.2)', zIndex: 300, maxWidth: '90vw', display: 'flex', alignItems: 'center', gap: 8 }}>
      {toast.ok ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />} {toast.msg}
    </div>
  );
}
function F({ label, req, children }: any) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{label} {req && <span style={{ color: '#ef4444' }}>*</span>}</label>
      {children}
    </div>
  );
}
function Inp({ Icon, value, onChange, placeholder, type = 'text', list }: any) {
  return (
    <div style={{ position: 'relative' }}>
      {Icon && <Icon size={16} style={iconSt} />}
      <input type={type} list={list} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={{ ...inputSt, paddingLeft: Icon ? 40 : 12 }} onFocus={fOn} onBlur={fOff} inputMode={type === 'number' ? 'decimal' : undefined} />
    </div>
  );
}
function fOn(e: React.FocusEvent<any>) { e.target.style.borderColor = 'var(--accent)'; }
function fOff(e: React.FocusEvent<any>) { e.target.style.borderColor = 'var(--border)'; }

const ov: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 };
const card: React.CSSProperties = { maxWidth: 460, width: '100%', padding: 0, maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' };
const headerSt: React.CSSProperties = { padding: '16px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 };
const closeBtn: React.CSSProperties = { width: 32, height: 32, background: 'var(--surface-2)', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const iconSt: React.CSSProperties = { position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' };
const inputSt: React.CSSProperties = { width: '100%', height: 46, padding: '0 12px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text)', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' };
const g2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 };
const secBtn: React.CSSProperties = { flex: 1, padding: 13, background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
const priBtn: React.CSSProperties = { flex: 2, padding: 13, color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 };
