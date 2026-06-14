'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase-client';
import { X, Save, Loader2, CheckCircle2, AlertCircle, Smartphone } from 'lucide-react';

interface Props {
  item: any;
  onClose: () => void;
  onSuccess: () => void;
}

const CONDITIONS = [
  { value: 'new', label: 'เครื่องใหม่ / มือ 1' },
  { value: 'used', label: 'เครื่องมือสอง' },
  { value: 'good', label: 'สภาพดี' },
  { value: 'defect', label: 'มีตำหนิ' },
  { value: 'trade', label: 'เครื่องเทิร์น' },
];

export default function StockEditModal({ item, onClose, onSuccess }: Props) {
  const supabase = createClient();
  const [form, setForm] = useState({
    imei: item.imei || '',
    model: item.model || '',
    color: item.color || '',
    spec: item.spec || '',
    device_condition: item.device_condition || '',
    price: String(item.price ?? ''),
    cost_price: String(item.cost_price ?? ''),
    branch_id: item.branch_id || '',
  });
  const [branches, setBranches] = useState<any[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  function notify(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 2600);
  }

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, is_super_admin')
        .eq('id', user.id)
        .single();

      const admin = profile?.role === 'admin' || profile?.is_super_admin;
      setIsAdmin(!!admin);

      if (admin) {
        const { data } = await supabase.from('branches').select('id, name').order('name');
        setBranches(data || []);
      }
    })();
  }, []);

  async function save() {
    if (!isAdmin) return notify('เฉพาะเจ้าของร้านหรือแอดมินเท่านั้นที่แก้ไขข้อมูลเครื่องได้', false);
    if (!form.model.trim()) return notify('กรุณากรอกรุ่นเครื่อง', false);
    if (!form.price || parseFloat(form.price) <= 0) return notify('กรุณากรอกราคาขายให้ถูกต้อง', false);
    if (form.imei && form.imei.length !== 15) return notify('IMEI ต้องมี 15 หลัก หรือเว้นว่าง', false);

    setSaving(true);
    const { error } = await supabase.from('stock').update({
      imei: form.imei.trim(),
      model: form.model.trim(),
      color: form.color.trim() || null,
      spec: form.spec.trim() || null,
      device_condition: form.device_condition.trim() || null,
      price: parseFloat(form.price),
      cost_price: form.cost_price ? parseFloat(form.cost_price) : null,
      branch_id: form.branch_id || item.branch_id || null,
    }).eq('id', item.id);
    setSaving(false);

    if (error) return notify('บันทึกไม่สำเร็จ: ' + error.message, false);
    notify('บันทึกแล้ว');
    setTimeout(() => onSuccess(), 600);
  }

  return (
    <div onClick={onClose} style={ov}>
      <div onClick={(e) => e.stopPropagation()} className="v3-card" style={{ maxWidth: 460, width: '100%', padding: 0, maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={headerSt}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#dbeafe', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Smartphone size={18} /></div>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, fontFamily: 'Prompt, sans-serif' }}>แก้ไขข้อมูลเครื่อง</h2>
              <p style={{ fontSize: 11, color: 'var(--text-dim)' }}>{item.model}</p>
            </div>
          </div>
          <button onClick={onClose} style={closeBtn}><X size={16} /></button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <F label="IMEI"><Inp value={form.imei} onChange={(v: string) => setForm({ ...form, imei: v.replace(/\D/g, '').substring(0, 15) })} placeholder="15 หลัก" mono /></F>
          <F label="รุ่น *"><Inp value={form.model} onChange={(v: string) => setForm({ ...form, model: v })} placeholder="เช่น iPhone 13" /></F>

          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}><F label="สี"><Inp value={form.color} onChange={(v: string) => setForm({ ...form, color: v })} placeholder="ดำ" /></F></div>
            <div style={{ flex: 1 }}><F label="ความจุ/สเปก"><Inp value={form.spec} onChange={(v: string) => setForm({ ...form, spec: v })} placeholder="128GB" /></F></div>
          </div>

          <F label="สภาพเครื่อง">
            <select value={form.device_condition} onChange={(e) => setForm({ ...form, device_condition: e.target.value })} style={inputSt}>
              <option value="">-- เลือก --</option>
              {CONDITIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </F>

          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}><F label="ราคาขาย *"><Inp value={form.price} onChange={(v: string) => setForm({ ...form, price: v.replace(/[^\d.]/g, '') })} placeholder="0" type="number" /></F></div>
            <div style={{ flex: 1 }}><F label="ต้นทุน"><Inp value={form.cost_price} onChange={(v: string) => setForm({ ...form, cost_price: v.replace(/[^\d.]/g, '') })} placeholder="0" type="number" /></F></div>
          </div>

          <F label="สาขา">
            <select value={form.branch_id} onChange={(e) => setForm({ ...form, branch_id: e.target.value })} style={inputSt}>
              <option value="">-- เลือกสาขา --</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </F>
        </div>

        <div style={{ padding: 16, borderTop: '1px solid var(--border)', display: 'flex', gap: 8, flexShrink: 0 }}>
          <button onClick={onClose} style={secBtn}>ยกเลิก</button>
          <button onClick={save} disabled={saving || !isAdmin} style={{ ...priBtn, background: saving || !isAdmin ? 'var(--surface-2)' : 'linear-gradient(135deg,#2563eb,#1d4ed8)' }}>
            {saving ? <Loader2 size={16} className="v3-spin" /> : <Save size={16} />} {saving ? 'กำลังบันทึก...' : 'บันทึก'}
          </button>
        </div>
      </div>
      {toast && (
        <div style={{ position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)', background: toast.ok ? '#16a34a' : '#dc2626', color: '#fff', padding: '12px 20px', borderRadius: 12, fontSize: 13, fontWeight: 600, zIndex: 300, display: 'flex', alignItems: 'center', gap: 8 }}>
          {toast.ok ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />} {toast.msg}
        </div>
      )}
    </div>
  );
}

function F({ label, children }: any) {
  return <div><label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-dim)', display: 'block', marginBottom: 6 }}>{label}</label>{children}</div>;
}

function Inp({ value, onChange, placeholder, type, mono }: any) {
  return <input type="text" inputMode={type === 'number' ? 'decimal' : undefined} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
    style={{ ...inputSt, fontFamily: mono ? 'monospace' : 'inherit' }}
    onFocus={(e) => e.target.style.borderColor = 'var(--accent)'} onBlur={(e) => e.target.style.borderColor = 'var(--border)'} />;
}

const ov: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 };
const headerSt: React.CSSProperties = { padding: '16px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 };
const closeBtn: React.CSSProperties = { width: 32, height: 32, background: 'var(--surface-2)', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const inputSt: React.CSSProperties = { width: '100%', height: 46, padding: '0 12px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' };
const secBtn: React.CSSProperties = { flex: 1, padding: 12, background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
const priBtn: React.CSSProperties = { flex: 2, padding: 12, color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 };
