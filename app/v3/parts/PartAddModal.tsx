'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase-client';
import { PART_CATEGORIES, PART_GRADES, COMMON_PHONE_MODELS } from '@/lib/parts-constants';
import {
  Wrench, X, Smartphone, DollarSign, Boxes, Bell, Tag, Truck,
  Loader2, CheckCircle2, AlertCircle, Layers,
} from 'lucide-react';

interface Props { onClose: () => void; onSuccess: () => void; }

export default function PartAddModal({ onClose, onSuccess }: Props) {
  const supabase = createClient();
  const [form, setForm] = useState({
    name: '', category: 'battery', phone_model: '', grade: 'oem',
    cost_price: '', sell_price: '', stock_qty: '1', low_stock_alert: '2',
    supplier_id: '', sku: '', note: '',
  });
  const [profile, setProfile] = useState<any>(null);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  function notify(msg: string, ok = true) { setToast({ msg, ok }); setTimeout(() => setToast(null), 2600); }

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      setProfile(p);
      const { data: sup } = await supabase.from('suppliers').select('id, name').order('name');
      setSuppliers(sup || []);
    }
    load();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.sell_price) return notify('กรอกชื่ออะไหล่ + ราคาขาย', false);
    if (!profile) return notify('กำลังโหลดข้อมูล กรุณารอสักครู่', false);
    setLoading(true);
    const stockQty = parseInt(form.stock_qty) || 0;
    const costPrice = parseFloat(form.cost_price) || 0;

    const { data: newPart, error } = await supabase.from('parts').insert({
      shop_id: profile.shop_id, branch_id: profile.branch_id,
      name: form.name.trim(), category: form.category, phone_model: form.phone_model.trim(),
      grade: form.grade || null, cost_price: costPrice, sell_price: parseFloat(form.sell_price) || 0,
      stock_qty: stockQty, low_stock_alert: parseInt(form.low_stock_alert) || 2,
      supplier_id: form.supplier_id || null, sku: form.sku.trim() || null, note: form.note.trim() || null,
      added_by: profile.id, added_by_name: profile.full_name,
    }).select().single();

    if (error || !newPart) { notify('บันทึกไม่สำเร็จ: ' + (error?.message || ''), false); setLoading(false); return; }

    if (stockQty > 0) {
      await supabase.from('part_transactions').insert({
        shop_id: profile.shop_id, part_id: newPart.id, type: 'in', qty_change: stockQty,
        cost_at_transaction: costPrice, reference_type: 'purchase', note: 'รับเข้าครั้งแรก',
        done_by: profile.id, done_by_name: profile.full_name,
      });
    }
    setLoading(false);
    notify('เพิ่มอะไหล่สำเร็จ • ' + form.name);
    setTimeout(() => onSuccess(), 900);
  }

  return (
    <div onClick={onClose} style={ov}>
      <div onClick={(e) => e.stopPropagation()} className="v3-card" style={card}>
        <div style={headerSt}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#fce7f3', color: '#ec4899', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Wrench size={18} /></div>
            <div><h2 style={{ fontSize: 16, fontWeight: 700, fontFamily: 'Prompt, sans-serif' }}>เพิ่มอะไหล่</h2><p style={{ fontSize: 11, color: 'var(--text-dim)' }}>อะไหล่สำหรับงานซ่อม</p></div>
          </div>
          <button onClick={onClose} style={closeBtn}><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ overflowY: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <SectionTitle Icon={Wrench} color="#ec4899" label="ข้อมูลอะไหล่" />
            <F label="ชื่ออะไหล่" req><Inp value={form.name} onChange={(v: string) => setForm({ ...form, name: v })} placeholder="เช่น แบต iPhone 13" /></F>
            <div style={g2}>
              <F label="ประเภท" req>
                <Sel Icon={Layers} value={form.category} onChange={(v: string) => setForm({ ...form, category: v })}>
                  {PART_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </Sel>
              </F>
              <F label="เกรด">
                <Sel Icon={Tag} value={form.grade} onChange={(v: string) => setForm({ ...form, grade: v })}>
                  {PART_GRADES.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
                </Sel>
              </F>
            </div>
            <F label="รุ่นมือถือที่ใช้ได้">
              <Inp Icon={Smartphone} value={form.phone_model} onChange={(v: string) => setForm({ ...form, phone_model: v })} placeholder="iPhone 13 Pro Max" list="phone-models" />
              <datalist id="phone-models">{COMMON_PHONE_MODELS.map(m => <option key={m} value={m} />)}</datalist>
            </F>
          </div>

          <div>
            <SectionTitle Icon={DollarSign} color="#3b82f6" label="ราคา + สต๊อก" />
            <div style={g2}>
              <F label="ราคาทุน (฿)"><Inp Icon={DollarSign} type="number" value={form.cost_price} onChange={(v: string) => setForm({ ...form, cost_price: v })} placeholder="0" /></F>
              <F label="ราคาขาย (฿)" req><Inp Icon={DollarSign} type="number" value={form.sell_price} onChange={(v: string) => setForm({ ...form, sell_price: v })} placeholder="0" /></F>
            </div>
            <div style={g2}>
              <F label="จำนวน"><Inp Icon={Boxes} type="number" value={form.stock_qty} onChange={(v: string) => setForm({ ...form, stock_qty: v })} placeholder="1" /></F>
              <F label="เตือนเมื่อเหลือ"><Inp Icon={Bell} type="number" value={form.low_stock_alert} onChange={(v: string) => setForm({ ...form, low_stock_alert: v })} placeholder="2" /></F>
            </div>
          </div>

          <div>
            <SectionTitle Icon={Truck} color="#22c55e" label="เพิ่มเติม" />
            {suppliers.length > 0 && (
              <F label="ซัพพลายเออร์">
                <Sel Icon={Truck} value={form.supplier_id} onChange={(v: string) => setForm({ ...form, supplier_id: v })}>
                  <option value="">— ไม่ระบุ —</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </Sel>
              </F>
            )}
            <div style={g2}>
              <F label="SKU / บาร์โค้ด"><Inp Icon={Tag} value={form.sku} onChange={(v: string) => setForm({ ...form, sku: v })} placeholder="(ไม่บังคับ)" /></F>
            </div>
            <F label="หมายเหตุ"><textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="(ไม่บังคับ)" rows={2} style={{ ...inputSt, height: 'auto', minHeight: 52, padding: '10px 12px', resize: 'vertical' }} onFocus={fOn} onBlur={fOff} /></F>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={onClose} style={secBtn}>ยกเลิก</button>
            <button type="submit" disabled={loading} style={{ ...priBtn, background: loading ? 'var(--surface-2)' : 'linear-gradient(135deg, #ec4899, #db2777)' }}>
              {loading ? <Loader2 size={17} className="v3-spin" /> : <Wrench size={17} strokeWidth={2.4} />}
              {loading ? 'กำลังบันทึก...' : 'เพิ่มอะไหล่'}
            </button>
          </div>
        </form>
      </div>
      {toast && <Toast toast={toast} />}
    </div>
  );
}

export function Toast({ toast }: any) {
  return (
    <div style={{ position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)', background: toast.ok ? '#16a34a' : '#dc2626', color: '#fff', padding: '12px 20px', borderRadius: 12, fontSize: 13, fontWeight: 600, boxShadow: '0 8px 24px rgba(0,0,0,0.2)', zIndex: 300, maxWidth: '90vw', display: 'flex', alignItems: 'center', gap: 8 }}>
      {toast.ok ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />} {toast.msg}
    </div>
  );
}
function SectionTitle({ Icon, color, label }: any) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
      <div style={{ width: 28, height: 28, borderRadius: 8, background: `${color}15`, color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon size={15} /></div>
      <h3 style={{ fontSize: 13, fontWeight: 700, fontFamily: 'Prompt, sans-serif' }}>{label}</h3>
    </div>
  );
}
function F({ label, req, children }: any) {
  return (
    <div style={{ marginBottom: 10 }}>
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
function Sel({ Icon, value, onChange, children }: any) {
  return (
    <div style={{ position: 'relative' }}>
      {Icon && <Icon size={16} style={iconSt} />}
      <select value={value} onChange={(e) => onChange(e.target.value)} style={{ ...inputSt, paddingLeft: Icon ? 40 : 12, cursor: 'pointer' }}>{children}</select>
    </div>
  );
}
function fOn(e: React.FocusEvent<any>) { e.target.style.borderColor = 'var(--accent)'; }
function fOff(e: React.FocusEvent<any>) { e.target.style.borderColor = 'var(--border)'; }

const ov: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 };
const card: React.CSSProperties = { maxWidth: 480, width: '100%', padding: 0, maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' };
const headerSt: React.CSSProperties = { padding: '16px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 };
const closeBtn: React.CSSProperties = { width: 32, height: 32, background: 'var(--surface-2)', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const iconSt: React.CSSProperties = { position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' };
const inputSt: React.CSSProperties = { width: '100%', height: 46, padding: '0 12px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text)', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' };
const g2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 };
const secBtn: React.CSSProperties = { flex: 1, padding: 13, background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
const priBtn: React.CSSProperties = { flex: 2, padding: 13, color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 };
