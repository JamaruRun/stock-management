'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase-client';
import BarcodeScanner from '@/components/BarcodeScanner';
import { sendLineNotify } from '@/lib/line-notify';
import {
  Coins, X, ScanLine, Smartphone, User, Phone, Calendar,
  DollarSign, Percent, MapPin, Loader2, CheckCircle2, AlertCircle,
} from 'lucide-react';

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

export default function PawnAddModal({ onClose, onSuccess }: Props) {
  const supabase = createClient();
  const [form, setForm] = useState({
    imei: '', model: '', color: '', spec: '',
    pawnPrice: '', pawnDate: new Date().toISOString().split('T')[0],
    interestDays: '30', interestAmount: '',
    customerName: '', customerPhone: '', customerNote: '',
    branchId: '',
  });
  const [profile, setProfile] = useState<any>(null);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  function notify(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 2600);
  }

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: p } = await supabase
        .from('profiles').select('*, branches(name)').eq('id', user.id).single();
      setProfile(p);
      if (p?.role === 'admin' || p?.is_super_admin) {
        const { data: bs } = await supabase.from('branches').select('*').order('name');
        setBranches(bs || []);
      }
      setForm(f => ({ ...f, branchId: p?.branch_id || '' }));
    }
    load();
  }, []);

  const dueDatePreview = (() => {
    const days = parseInt(form.interestDays) || 30;
    const d = new Date(form.pawnDate);
    d.setDate(d.getDate() + days);
    return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
  })();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.imei || !form.model || !form.pawnPrice || !form.customerName || !form.branchId) {
      return notify('กรอก IMEI, รุ่น, ราคา, ชื่อลูกค้า, สาขา ให้ครบ', false);
    }
    if (form.imei.length !== 15) return notify('IMEI ต้องมี 15 หลัก', false);
    if (!profile) return notify('กำลังโหลดข้อมูล กรุณารอสักครู่', false);

    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data: existing } = await supabase
      .from('pawn_stock').select('id').eq('imei', form.imei).maybeSingle();
    if (existing) { notify('IMEI ซ้ำ — เครื่องนี้กำลังจำนำอยู่', false); setLoading(false); return; }

    const { data: profileWithShop } = await supabase
      .from('profiles').select('shop_id').eq('id', user.id).single();

    const interestDays = parseInt(form.interestDays) || 30;
    const pawnDate = new Date(form.pawnDate);
    const dueDate = new Date(pawnDate);
    dueDate.setDate(dueDate.getDate() + interestDays);
    const dueDateStr = dueDate.toISOString().split('T')[0];

    const { error } = await supabase.from('pawn_stock').insert({
      imei: form.imei, model: form.model,
      color: form.color || null, spec: form.spec || null,
      pawn_price: parseFloat(form.pawnPrice), pawn_date: form.pawnDate,
      interest_days: interestDays,
      interest_amount: parseFloat(form.interestAmount) || 0,
      due_date: dueDateStr, status: 'active', renew_count: 0,
      customer_name: form.customerName,
      customer_phone: form.customerPhone || null,
      customer_note: form.customerNote || null,
      added_by: user.id, added_by_name: profile.full_name,
      branch_id: form.branchId, shop_id: profileWithShop?.shop_id,
    });

    setLoading(false);
    if (error) { notify('เกิดข้อผิดพลาด: ' + error.message, false); return; }

    const phoneTxt = form.customerPhone ? `\n📞 ${form.customerPhone}` : '';
    const lineMsg = `💰 รับจำนำเครื่องใหม่\n━━━━━━━━━━━━━\n📦 ${form.model}\n🔢 IMEI: ${form.imei}\n━━━━━━━━━━━━━\n👤 ลูกค้า: ${form.customerName}${phoneTxt}\n💵 ราคารับจำนำ: ฿${parseFloat(form.pawnPrice).toLocaleString()}\n📅 ครบกำหนด: ${dueDateStr}\n👨‍💼 รับโดย: ${profile.full_name}`;
    sendLineNotify(lineMsg, 'pawn').catch(() => {});

    notify(`รับจำนำสำเร็จ • ${form.model}`);
    setTimeout(() => onSuccess(), 900);
  }

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
      zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div onClick={(e) => e.stopPropagation()} className="v3-card" style={{
        maxWidth: 520, width: '100%', padding: 0, maxHeight: '92vh',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 18px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#fef3c7', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Coins size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, fontFamily: 'Prompt, sans-serif' }}>รับจำนำใหม่</h2>
              <p style={{ fontSize: 11, color: 'var(--text-dim)' }}>บันทึกเครื่องที่รับจำนำ</p>
            </div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, background: 'var(--surface-2)', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={16} />
          </button>
        </div>

        {/* Body (scroll) */}
        <form onSubmit={handleSubmit} style={{ overflowY: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* เครื่อง */}
          <div>
            <SectionTitle Icon={Smartphone} color="#3b82f6" label="ข้อมูลเครื่อง" />
            <F label="IMEI (15 หลัก)" req>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <Smartphone size={16} style={iconSt} />
                  <input value={form.imei} onChange={(e) => setForm({ ...form, imei: e.target.value.replace(/\D/g, '').substring(0, 15) })}
                    placeholder="กรอก/สแกน IMEI" style={inputSt} inputMode="numeric" onFocus={fOn} onBlur={fOff} />
                </div>
                <button type="button" onClick={() => setShowScanner(true)} style={{ width: 46, height: 46, borderRadius: 12, background: 'var(--accent)', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                  <ScanLine size={20} />
                </button>
              </div>
              {form.imei && <span style={{ fontSize: 10, color: form.imei.length === 15 ? '#16a34a' : '#f59e0b', fontWeight: 600 }}>{form.imei.length}/15 หลัก</span>}
            </F>
            <F label="รุ่น" req><Inp value={form.model} onChange={(v) => setForm({ ...form, model: v })} placeholder="iPhone 13 Pro Max" /></F>
            <div style={g2}>
              <F label="สี"><Inp value={form.color} onChange={(v) => setForm({ ...form, color: v })} placeholder="Midnight" /></F>
              <F label="ความจุ/สเปก"><Inp value={form.spec} onChange={(v) => setForm({ ...form, spec: v })} placeholder="256GB" /></F>
            </div>
          </div>

          {/* จำนำ */}
          <div>
            <SectionTitle Icon={DollarSign} color="#f59e0b" label="เงื่อนไขจำนำ" />
            <div style={g2}>
              <F label="ราคารับจำนำ (฿)" req><Inp Icon={DollarSign} type="number" value={form.pawnPrice} onChange={(v) => setForm({ ...form, pawnPrice: v })} placeholder="0" /></F>
              <F label="วันที่รับจำนำ" req><Inp Icon={Calendar} type="date" value={form.pawnDate} onChange={(v) => setForm({ ...form, pawnDate: v })} /></F>
            </div>
            <div style={g2}>
              <F label="ระยะเวลา (วัน)"><Inp Icon={Calendar} type="number" value={form.interestDays} onChange={(v) => setForm({ ...form, interestDays: v })} placeholder="30" /></F>
              <F label="ดอกเบี้ย (฿)"><Inp Icon={Percent} type="number" value={form.interestAmount} onChange={(v) => setForm({ ...form, interestAmount: v })} placeholder="0" /></F>
            </div>
            <div style={{ padding: '8px 12px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, fontSize: 12, color: '#78350f', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Calendar size={13} /> ครบกำหนด: <strong>{dueDatePreview}</strong>
            </div>
          </div>

          {/* ลูกค้า */}
          <div>
            <SectionTitle Icon={User} color="#8b5cf6" label="ข้อมูลลูกค้า" />
            <F label="ชื่อลูกค้า" req><Inp Icon={User} value={form.customerName} onChange={(v) => setForm({ ...form, customerName: v })} placeholder="ชื่อ-นามสกุล" /></F>
            <F label="เบอร์โทร"><Inp Icon={Phone} type="tel" value={form.customerPhone} onChange={(v) => setForm({ ...form, customerPhone: v })} placeholder="08x-xxx-xxxx" /></F>
            <F label="หมายเหตุ">
              <textarea value={form.customerNote} onChange={(e) => setForm({ ...form, customerNote: e.target.value })} placeholder="เช่น บัตรประชาชน, ที่อยู่ ฯลฯ" rows={2}
                style={{ ...inputSt, height: 'auto', minHeight: 56, padding: '10px 12px', resize: 'vertical' }} onFocus={fOn} onBlur={fOff} />
            </F>
            {(profile?.role === 'admin' || profile?.is_super_admin) && branches.length > 0 && (
              <F label="สาขา" req>
                <div style={{ position: 'relative' }}>
                  <MapPin size={16} style={iconSt} />
                  <select value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })} style={{ ...inputSt, cursor: 'pointer' }}>
                    <option value="">เลือกสาขา</option>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              </F>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={onClose} style={{ flex: 1, padding: 13, background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              ยกเลิก
            </button>
            <button type="submit" disabled={loading} style={{
              flex: 2, padding: 13, background: loading ? 'var(--surface-2)' : 'linear-gradient(135deg, #f59e0b, #d97706)',
              color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: loading ? 'wait' : 'pointer',
              fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              {loading ? <Loader2 size={17} className="v3-spin" /> : <Coins size={17} strokeWidth={2.4} />}
              {loading ? 'กำลังบันทึก...' : 'รับจำนำ'}
            </button>
          </div>
        </form>
      </div>

      {showScanner && <BarcodeScanner onScan={(code) => { setForm(f => ({ ...f, imei: code.replace(/\D/g, '').substring(0, 15) })); setShowScanner(false); notify('สแกนสำเร็จ'); }} onClose={() => setShowScanner(false)} mode="imei" />}

      {toast && (
        <div style={{ position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)', background: toast.ok ? '#16a34a' : '#dc2626', color: '#fff', padding: '12px 20px', borderRadius: 12, fontSize: 13, fontWeight: 600, boxShadow: '0 8px 24px rgba(0,0,0,0.2)', zIndex: 300, maxWidth: '90vw', display: 'flex', alignItems: 'center', gap: 8 }}>
          {toast.ok ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />} {toast.msg}
        </div>
      )}
    </div>
  );
}

function SectionTitle({ Icon, color, label }: any) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
      <div style={{ width: 28, height: 28, borderRadius: 8, background: `${color}15`, color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={15} />
      </div>
      <h3 style={{ fontSize: 13, fontWeight: 700, fontFamily: 'Prompt, sans-serif' }}>{label}</h3>
    </div>
  );
}
function F({ label, req, children }: any) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
        {label} {req && <span style={{ color: '#ef4444' }}>*</span>}
      </label>
      {children}
    </div>
  );
}
function Inp({ Icon, value, onChange, placeholder, type = 'text' }: any) {
  return (
    <div style={{ position: 'relative' }}>
      {Icon && <Icon size={16} style={iconSt} />}
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        style={{ ...inputSt, paddingLeft: Icon ? 40 : 12 }} onFocus={fOn} onBlur={fOff} inputMode={type === 'number' ? 'decimal' : undefined} />
    </div>
  );
}
function fOn(e: React.FocusEvent<any>) { e.target.style.borderColor = 'var(--accent)'; }
function fOff(e: React.FocusEvent<any>) { e.target.style.borderColor = 'var(--border)'; }

const iconSt: React.CSSProperties = { position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' };
const inputSt: React.CSSProperties = {
  width: '100%', height: 46, padding: '0 12px', background: 'var(--surface-2)', border: '1px solid var(--border)',
  borderRadius: 12, color: 'var(--text)', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
};
const g2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 };
