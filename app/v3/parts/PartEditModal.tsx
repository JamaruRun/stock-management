'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase-client';
import { PART_CATEGORIES, PART_GRADES } from '@/lib/parts-constants';
import { loadCompatibilityRows, saveCompatibilityRows, type CompatRow } from '@/lib/part-compatibility';
import PartModelCompatibilityEditor from '@/components/PartModelCompatibilityEditor';
import PartCustomPriceEditor, { type CustomPriceRow } from '@/components/PartCustomPriceEditor';
import {
  Wrench, X, DollarSign, Bell, Tag, Truck, Layers,
  Loader2, CheckCircle2, AlertCircle, Save,
} from 'lucide-react';

interface Props { item: any; onClose: () => void; onSuccess: () => void; }

export default function PartEditModal({ item, onClose, onSuccess }: Props) {
  const supabase = createClient();
  const [form, setForm] = useState({
    name: item.name || '', category: item.category || 'battery',
    grade: item.grade || 'oem',
    cost_price: String(item.cost_price ?? ''), wholesale_price: String(item.wholesale_price ?? ''),
    sell_price: String(item.sell_price ?? ''),
    low_stock_alert: String(item.low_stock_alert ?? '2'),
    supplier_id: item.supplier_id || '', sku: item.sku || '', note: item.note || '',
    battery_model: item.battery_model || '',
  });
  const [compatRows, setCompatRows] = useState<CompatRow[]>([]);
  const [customPrices, setCustomPrices] = useState<CustomPriceRow[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  function notify(msg: string, ok = true) { setToast({ msg, ok }); setTimeout(() => setToast(null), 2400); }

  useEffect(() => {
    supabase.from('suppliers').select('id, name').order('name').then(({ data }) => setSuppliers(data || []));
    loadCompatibilityRows(supabase, item.id).then(setCompatRows);
    supabase.from('part_custom_prices').select('id, label, price').eq('part_id', item.id).order('sort_order')
      .then(({ data }) => setCustomPrices((data || []).map((r: any) => ({ id: r.id, label: r.label, price: String(r.price ?? '') }))));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return notify('กรอกชื่ออะไหล่', false);
    setLoading(true);

    const { resolved, errors: compatErrors } = await saveCompatibilityRows(supabase, item.id, compatRows);
    const first = resolved[0];

    const { error } = await supabase.from('parts').update({
      name: form.name.trim(), category: form.category,
      phone_model: first?.model_name || '',
      grade: form.grade || null,
      cost_price: first ? (parseFloat(first.cost_price) || 0) : (parseFloat(form.cost_price) || 0),
      wholesale_price: parseFloat(form.wholesale_price) || 0,
      sell_price: first ? (parseFloat(first.sell_price) || 0) : (parseFloat(form.sell_price) || 0),
      low_stock_alert: parseInt(form.low_stock_alert) || 2,
      supplier_id: form.supplier_id || null, sku: form.sku.trim() || null, note: form.note.trim() || null,
      battery_model: form.category === 'battery' ? (form.battery_model.trim() || null) : null,
    }).eq('id', item.id);

    // sync ราคาเพิ่มเติมแบบกำหนดเอง - ลบของเดิมแล้วใส่ชุดปัจจุบันใหม่ทั้งหมด (จำนวนแถวน้อย ไม่ต้อง diff ให้ซับซ้อน)
    await supabase.from('part_custom_prices').delete().eq('part_id', item.id);
    const validCustomPrices = customPrices.filter((r) => r.label.trim() !== '');
    if (validCustomPrices.length > 0) {
      await supabase.from('part_custom_prices').insert(
        validCustomPrices.map((r, i) => ({ part_id: item.id, label: r.label.trim(), price: parseFloat(r.price) || 0, sort_order: i }))
      );
    }

    setLoading(false);
    if (error) return notify('บันทึกไม่สำเร็จ: ' + error.message, false);
    if (compatErrors.length > 0) notify('บันทึกแล้ว แต่ ' + compatErrors.join('; '), false);
    else notify('บันทึกแล้ว');
    setTimeout(() => onSuccess(), 800);
  }

  return (
    <div onClick={onClose} style={ov}>
      <div onClick={(e) => e.stopPropagation()} className="v3-card" style={card}>
        <div style={headerSt}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#fce7f3', color: '#ec4899', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Wrench size={18} /></div>
            <div><h2 style={{ fontSize: 16, fontWeight: 700, fontFamily: 'Prompt, sans-serif' }}>แก้ไขอะไหล่</h2><p style={{ fontSize: 11, color: 'var(--text-dim)' }}>คงเหลือ {item.stock_qty} ชิ้น (ปรับสต๊อกที่หน้าอะไหล่)</p></div>
          </div>
          <button onClick={onClose} style={closeBtn}><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ overflowY: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
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
          {form.category === 'battery' && (
            <F label="รุ่น/รหัสแบตเตอรี่"><Inp Icon={Tag} value={form.battery_model} onChange={(v: string) => setForm({ ...form, battery_model: v })} placeholder="เช่น APN 616-00259 (ไม่บังคับ ช่วยให้ AI ค้นหาเจอ)" /></F>
          )}
          <div style={g3}>
            <F label="ราคาทุน (฿)"><Inp Icon={DollarSign} type="number" value={form.cost_price} onChange={(v: string) => setForm({ ...form, cost_price: v })} placeholder="0" /></F>
            <F label="ราคาส่ง (฿)"><Inp Icon={DollarSign} type="number" value={form.wholesale_price} onChange={(v: string) => setForm({ ...form, wholesale_price: v })} placeholder="0" /></F>
            <F label="ราคาหน้าร้าน (฿)"><Inp Icon={DollarSign} type="number" value={form.sell_price} onChange={(v: string) => setForm({ ...form, sell_price: v })} placeholder="0" /></F>
          </div>
          <F label="ราคาเพิ่มเติม (กำหนดหัวข้อเอง)">
            <PartCustomPriceEditor rows={customPrices} onChange={setCustomPrices} />
          </F>
          <F label="รุ่นมือถือที่ใช้ได้ (เลือกได้หลายรุ่น)">
            <PartModelCompatibilityEditor
              rows={compatRows}
              onChange={setCompatRows}
              defaultCostPrice={form.cost_price}
              defaultSellPrice={form.sell_price}
            />
          </F>
          <div style={g2}>
            <F label="เตือนเมื่อเหลือ"><Inp Icon={Bell} type="number" value={form.low_stock_alert} onChange={(v: string) => setForm({ ...form, low_stock_alert: v })} placeholder="2" /></F>
            <F label="SKU"><Inp Icon={Tag} value={form.sku} onChange={(v: string) => setForm({ ...form, sku: v })} placeholder="(ไม่บังคับ)" /></F>
          </div>
          {suppliers.length > 0 && (
            <F label="ซัพพลายเออร์">
              <Sel Icon={Truck} value={form.supplier_id} onChange={(v: string) => setForm({ ...form, supplier_id: v })}>
                <option value="">— ไม่ระบุ —</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Sel>
            </F>
          )}
          <F label="หมายเหตุ"><textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="(ไม่บังคับ)" rows={2} style={{ ...inputSt, height: 'auto', minHeight: 52, padding: '10px 12px', resize: 'vertical' }} onFocus={fOn} onBlur={fOff} /></F>

          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button type="button" onClick={onClose} style={secBtn}>ยกเลิก</button>
            <button type="submit" disabled={loading} style={{ ...priBtn, background: loading ? 'var(--surface-2)' : 'linear-gradient(135deg, #ec4899, #db2777)' }}>
              {loading ? <Loader2 size={17} className="v3-spin" /> : <Save size={17} strokeWidth={2.4} />}
              {loading ? 'กำลังบันทึก...' : 'บันทึก'}
            </button>
          </div>
        </form>
      </div>
      {toast && (
        <div style={{ position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)', background: toast.ok ? '#16a34a' : '#dc2626', color: '#fff', padding: '12px 20px', borderRadius: 12, fontSize: 13, fontWeight: 600, boxShadow: '0 8px 24px rgba(0,0,0,0.2)', zIndex: 300, maxWidth: '90vw', display: 'flex', alignItems: 'center', gap: 8 }}>
          {toast.ok ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />} {toast.msg}
        </div>
      )}
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
const g3: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 };
const secBtn: React.CSSProperties = { flex: 1, padding: 13, background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
const priBtn: React.CSSProperties = { flex: 2, padding: 13, color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 };
