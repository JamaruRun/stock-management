'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase-client';
import BarcodeScanner from '@/components/BarcodeScanner';
import { sendLineNotify } from '@/lib/line-notify';
import {
  CreditCard, DollarSign, X, ScanLine, Smartphone, User, Phone, Calendar,
  CreditCard as IdCard, MapPin, Loader2, CheckCircle2, AlertCircle,
} from 'lucide-react';

/* shared */
function Overlay({ onClose, max = 520, children }: any) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} className="v3-card" style={{ maxWidth: max, width: '100%', padding: 0, maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  );
}
const headerSt: React.CSSProperties = { padding: '16px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 };
const closeBtn: React.CSSProperties = { width: 32, height: 32, background: 'var(--surface-2)', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const iconSt: React.CSSProperties = { position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' };
const inputSt: React.CSSProperties = { width: '100%', height: 46, padding: '0 12px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text)', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' };
const g2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 };
function fOn(e: React.FocusEvent<any>) { e.target.style.borderColor = 'var(--accent)'; }
function fOff(e: React.FocusEvent<any>) { e.target.style.borderColor = 'var(--border)'; }
function Toast({ toast }: any) {
  if (!toast) return null;
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
function Inp({ Icon, value, onChange, placeholder, type = 'text' }: any) {
  return (
    <div style={{ position: 'relative' }}>
      {Icon && <Icon size={16} style={iconSt} />}
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={{ ...inputSt, paddingLeft: Icon ? 40 : 12 }} onFocus={fOn} onBlur={fOff} inputMode={type === 'number' ? 'decimal' : undefined} />
    </div>
  );
}

/* ============ เพิ่มเครื่องผ่อน ============ */
export function InstallmentAddModal({ onClose, onSuccess }: any) {
  const supabase = createClient();
  const [form, setForm] = useState({
    imei: '', model: '', color: '', spec: '',
    fullPrice: '', downPayment: '', installmentAmount: '', totalPeriods: '',
    startDate: new Date().toISOString().split('T')[0],
    customerName: '', customerPhone: '', customerIdCard: '', customerAddress: '', customerNote: '',
    branchId: '',
  });
  const [profile, setProfile] = useState<any>(null);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  function notify(msg: string, ok = true) { setToast({ msg, ok }); setTimeout(() => setToast(null), 2600); }

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      setProfile(p);
      if (p?.role === 'admin' || p?.is_super_admin) {
        const { data: bs } = await supabase.from('branches').select('*').order('name');
        setBranches(bs || []);
      }
      setForm(f => ({ ...f, branchId: p?.branch_id || '' }));
    }
    load();
  }, []);

  const totalInstallment = (parseFloat(form.installmentAmount) || 0) * (parseInt(form.totalPeriods) || 0);
  const totalWithDown = (parseFloat(form.downPayment) || 0) + totalInstallment;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.imei || !form.model || !form.fullPrice || !form.downPayment || !form.installmentAmount || !form.totalPeriods || !form.customerName || !form.customerPhone || !form.customerIdCard || !form.branchId) {
      return notify('กรอกข้อมูลที่จำเป็น (*) ให้ครบ', false);
    }
    if (form.imei.length !== 15) return notify('IMEI ต้องมี 15 หลัก', false);
    if (form.customerIdCard.length !== 13) return notify('เลขบัตรประชาชนต้องมี 13 หลัก', false);

    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data: existing } = await supabase.from('installment_stock').select('id').eq('imei', form.imei).maybeSingle();
    if (existing) { notify('IMEI ซ้ำ — เครื่องนี้กำลังผ่อนอยู่', false); setLoading(false); return; }

    const { error } = await supabase.from('installment_stock').insert({
      imei: form.imei, model: form.model, color: form.color || null, spec: form.spec || null,
      full_price: parseFloat(form.fullPrice), down_payment: parseFloat(form.downPayment),
      installment_amount: parseFloat(form.installmentAmount), total_periods: parseInt(form.totalPeriods),
      start_date: form.startDate, customer_name: form.customerName, customer_phone: form.customerPhone,
      customer_id_card: form.customerIdCard, customer_address: form.customerAddress || null, customer_note: form.customerNote || null,
      added_by: user.id, added_by_name: profile.full_name, branch_id: form.branchId, shop_id: profile.shop_id,
    });
    setLoading(false);
    if (error) { notify('เกิดข้อผิดพลาด: ' + error.message, false); return; }

    const phoneTxt = form.customerPhone ? `\n📞 ${form.customerPhone}` : '';
    const remaining = parseFloat(form.fullPrice) - (parseFloat(form.downPayment) || 0);
    const lineMsg = `💳 เพิ่มเครื่องผ่อนใหม่\n━━━━━━━━━━━━━\n📦 ${form.model}\n🔢 IMEI: ${form.imei}\n━━━━━━━━━━━━━\n👤 ลูกค้า: ${form.customerName}${phoneTxt}\n💵 ราคาเต็ม: ฿${parseFloat(form.fullPrice).toLocaleString()}\n💰 ดาวน์: ฿${(parseFloat(form.downPayment) || 0).toLocaleString()}\n📊 ผ่อน ${form.totalPeriods} งวด × ฿${parseFloat(form.installmentAmount).toLocaleString()}\n📅 ค้างชำระ: ฿${remaining.toLocaleString()}`;
    sendLineNotify(lineMsg, 'installment').catch(() => {});

    notify(`เพิ่มผ่อนสำเร็จ • ${form.model}`);
    setTimeout(() => onSuccess(), 900);
  }

  return (
    <Overlay onClose={onClose}>
      <div style={headerSt}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: '#ede9fe', color: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CreditCard size={18} /></div>
          <div><h2 style={{ fontSize: 16, fontWeight: 700, fontFamily: 'Prompt, sans-serif' }}>เพิ่มเครื่องผ่อน</h2><p style={{ fontSize: 11, color: 'var(--text-dim)' }}>บันทึกเครื่องที่ลูกค้าผ่อน</p></div>
        </div>
        <button onClick={onClose} style={closeBtn}><X size={16} /></button>
      </div>
      <form onSubmit={handleSubmit} style={{ overflowY: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <SectionTitle Icon={Smartphone} color="#3b82f6" label="ข้อมูลเครื่อง" />
          <F label="IMEI (15 หลัก)" req>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Smartphone size={16} style={iconSt} />
                <input value={form.imei} onChange={(e) => setForm({ ...form, imei: e.target.value.replace(/\D/g, '').substring(0, 15) })} placeholder="กรอก/สแกน IMEI" style={{ ...inputSt, paddingLeft: 40 }} inputMode="numeric" onFocus={fOn} onBlur={fOff} />
              </div>
              <button type="button" onClick={() => setShowScanner(true)} style={{ width: 46, height: 46, borderRadius: 12, background: 'var(--accent)', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}><ScanLine size={20} /></button>
            </div>
            {form.imei && <span style={{ fontSize: 10, color: form.imei.length === 15 ? '#16a34a' : '#f59e0b', fontWeight: 600 }}>{form.imei.length}/15 หลัก</span>}
          </F>
          <F label="รุ่น" req><Inp value={form.model} onChange={(v: string) => setForm({ ...form, model: v })} placeholder="iPhone 13 Pro Max" /></F>
          <div style={g2}>
            <F label="สี"><Inp value={form.color} onChange={(v: string) => setForm({ ...form, color: v })} placeholder="Midnight" /></F>
            <F label="สเปก"><Inp value={form.spec} onChange={(v: string) => setForm({ ...form, spec: v })} placeholder="256GB" /></F>
          </div>
        </div>

        <div>
          <SectionTitle Icon={DollarSign} color="#8b5cf6" label="เงื่อนไขผ่อน" />
          <div style={g2}>
            <F label="ราคาเต็ม (฿)" req><Inp Icon={DollarSign} type="number" value={form.fullPrice} onChange={(v: string) => setForm({ ...form, fullPrice: v })} placeholder="0" /></F>
            <F label="เงินดาวน์ (฿)" req><Inp Icon={DollarSign} type="number" value={form.downPayment} onChange={(v: string) => setForm({ ...form, downPayment: v })} placeholder="0" /></F>
          </div>
          <div style={g2}>
            <F label="ค่างวด/เดือน (฿)" req><Inp Icon={DollarSign} type="number" value={form.installmentAmount} onChange={(v: string) => setForm({ ...form, installmentAmount: v })} placeholder="0" /></F>
            <F label="จำนวนงวด" req><Inp Icon={Calendar} type="number" value={form.totalPeriods} onChange={(v: string) => setForm({ ...form, totalPeriods: v })} placeholder="0" /></F>
          </div>
          <F label="วันเริ่มผ่อน" req><Inp Icon={Calendar} type="date" value={form.startDate} onChange={(v: string) => setForm({ ...form, startDate: v })} /></F>
          {totalInstallment > 0 && (
            <div style={{ padding: '10px 12px', background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 10, fontSize: 12, color: '#6d28d9' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>ยอดผ่อนรวม ({form.totalPeriods} งวด)</span><strong>฿{totalInstallment.toLocaleString()}</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}><span>รวมกับดาวน์ทั้งหมด</span><strong>฿{totalWithDown.toLocaleString()}</strong></div>
            </div>
          )}
        </div>

        <div>
          <SectionTitle Icon={User} color="#22c55e" label="ข้อมูลลูกค้า" />
          <F label="ชื่อลูกค้า" req><Inp Icon={User} value={form.customerName} onChange={(v: string) => setForm({ ...form, customerName: v })} placeholder="ชื่อ-นามสกุล" /></F>
          <div style={g2}>
            <F label="เบอร์โทร" req><Inp Icon={Phone} type="tel" value={form.customerPhone} onChange={(v: string) => setForm({ ...form, customerPhone: v })} placeholder="08x-xxx-xxxx" /></F>
            <F label="เลขบัตร ปชช (13)" req><Inp Icon={IdCard} value={form.customerIdCard} onChange={(v: string) => setForm({ ...form, customerIdCard: v.replace(/\D/g, '').substring(0, 13) })} placeholder="x-xxxx-xxxxx-xx-x" /></F>
          </div>
          <F label="ที่อยู่"><Inp Icon={MapPin} value={form.customerAddress} onChange={(v: string) => setForm({ ...form, customerAddress: v })} placeholder="ที่อยู่ลูกค้า" /></F>
          <F label="หมายเหตุ"><textarea value={form.customerNote} onChange={(e) => setForm({ ...form, customerNote: e.target.value })} placeholder="(ไม่บังคับ)" rows={2} style={{ ...inputSt, height: 'auto', minHeight: 52, padding: '10px 12px', resize: 'vertical' }} onFocus={fOn} onBlur={fOff} /></F>
          {(profile?.role === 'admin' || profile?.is_super_admin) && branches.length > 0 && (
            <F label="สาขา" req>
              <div style={{ position: 'relative' }}>
                <MapPin size={16} style={iconSt} />
                <select value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })} style={{ ...inputSt, paddingLeft: 40, cursor: 'pointer' }}>
                  <option value="">เลือกสาขา</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
            </F>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={onClose} style={{ flex: 1, padding: 13, background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>ยกเลิก</button>
          <button type="submit" disabled={loading} style={{ flex: 2, padding: 13, background: loading ? 'var(--surface-2)' : 'linear-gradient(135deg, #8b5cf6, #7c3aed)', color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: loading ? 'wait' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {loading ? <Loader2 size={17} className="v3-spin" /> : <CreditCard size={17} strokeWidth={2.4} />}
            {loading ? 'กำลังบันทึก...' : 'เพิ่มเครื่องผ่อน'}
          </button>
        </div>
      </form>
      {showScanner && <BarcodeScanner onScan={(code) => { setForm(f => ({ ...f, imei: code.replace(/\D/g, '').substring(0, 15) })); setShowScanner(false); notify('สแกนสำเร็จ'); }} onClose={() => setShowScanner(false)} mode="imei" />}
      <Toast toast={toast} />
    </Overlay>
  );
}

/* ============ รับชำระงวด ============ */
export function InstallmentPayModal({ item, onClose, onSuccess }: any) {
  const supabase = createClient();
  const [paidPeriods, setPaidPeriods] = useState(item.paid_periods || 0);
  const [amount, setAmount] = useState(String(item.installment_amount || ''));
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  function notify(msg: string, ok = true) { setToast({ msg, ok }); setTimeout(() => setToast(null), 2600); }

  useEffect(() => {
    async function loadPayments() {
      const { data } = await supabase.from('installment_payments').select('id').eq('installment_id', item.id);
      setPaidPeriods(data?.length || 0);
    }
    loadPayments();
  }, [item.id]);

  const periodNumber = paidPeriods + 1;
  const remaining = item.total_periods - paidPeriods;
  const progress = Math.min(100, (paidPeriods / item.total_periods) * 100);

  async function confirm() {
    if (!amount || parseFloat(amount) <= 0) return notify('ใส่จำนวนเงินที่ถูกต้อง', false);
    if (paidPeriods >= item.total_periods) return notify('ผ่อนครบทุกงวดแล้ว', false);
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single();

    const startDate = new Date(item.start_date);
    const dueDate = new Date(startDate);
    dueDate.setMonth(dueDate.getMonth() + periodNumber);

    const { error } = await supabase.from('installment_payments').insert({
      installment_id: item.id, period_number: periodNumber, amount: parseFloat(amount),
      payment_date: paymentDate, due_date: dueDate.toISOString().split('T')[0],
      paid_by: user.id, paid_by_name: profile?.full_name, note: note || null, shop_id: item.shop_id,
    });
    setLoading(false);
    if (error) { notify('เกิดข้อผิดพลาด: ' + error.message, false); return; }

    const lineMsg = `💳 รับชำระงวดผ่อน\n━━━━━━━━━━━━━\n📦 ${item.model}\n👤 ลูกค้า: ${item.customer_name}\n━━━━━━━━━━━━━\n💰 จำนวน: ฿${parseFloat(amount).toLocaleString()}\n📊 งวดที่: ${periodNumber}/${item.total_periods}\n👨‍💼 รับโดย: ${profile?.full_name || '-'}`;
    sendLineNotify(lineMsg, 'installment').catch(() => {});

    notify(`รับชำระงวดที่ ${periodNumber} สำเร็จ`);
    setTimeout(() => onSuccess(), 800);
  }

  return (
    <Overlay onClose={onClose} max={440}>
      <div style={headerSt}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: '#dcfce7', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><DollarSign size={18} /></div>
          <div><h2 style={{ fontSize: 16, fontWeight: 700, fontFamily: 'Prompt, sans-serif' }}>รับชำระงวด</h2><p style={{ fontSize: 11, color: 'var(--text-dim)' }}>{item.model} • {item.customer_name}</p></div>
        </div>
        <button onClick={onClose} style={closeBtn}><X size={16} /></button>
      </div>
      <div style={{ padding: 18, overflowY: 'auto' }}>
        {/* progress */}
        <div style={{ padding: 14, background: 'var(--surface-2)', borderRadius: 12, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
            <span style={{ color: 'var(--text-dim)' }}>ชำระแล้ว {paidPeriods}/{item.total_periods} งวด</span>
            <span style={{ fontWeight: 700, color: remaining > 0 ? '#8b5cf6' : '#16a34a' }}>{remaining > 0 ? `เหลือ ${remaining} งวด` : 'ครบแล้ว'}</span>
          </div>
          <div style={{ height: 6, background: 'var(--surface)', borderRadius: 100, overflow: 'hidden' }}>
            <div style={{ width: `${progress}%`, height: '100%', background: 'linear-gradient(90deg, #8b5cf6, #7c3aed)', borderRadius: 100 }} />
          </div>
        </div>

        <div style={{ textAlign: 'center', marginBottom: 14, padding: 12, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12 }}>
          <div style={{ fontSize: 11, color: '#166534' }}>กำลังรับชำระ</div>
          <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'Prompt, sans-serif', color: '#16a34a' }}>งวดที่ {periodNumber}</div>
        </div>

        <F label="จำนวนเงิน (฿)" req>
          <Inp Icon={DollarSign} type="number" value={amount} onChange={setAmount} placeholder="0" />
        </F>
        <F label="วันที่ชำระ" req>
          <Inp Icon={Calendar} type="date" value={paymentDate} onChange={setPaymentDate} />
        </F>
        <F label="หมายเหตุ">
          <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="(ไม่บังคับ)" rows={2} style={{ ...inputSt, height: 'auto', minHeight: 52, padding: '10px 12px', resize: 'vertical' }} onFocus={fOn} onBlur={fOff} />
        </F>

        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 13, background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>ยกเลิก</button>
          <button onClick={confirm} disabled={loading} style={{ flex: 2, padding: 13, background: loading ? 'var(--surface-2)' : 'linear-gradient(135deg, #22c55e, #16a34a)', color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: loading ? 'wait' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {loading ? <Loader2 size={17} className="v3-spin" /> : <DollarSign size={17} strokeWidth={2.4} />}
            {loading ? 'กำลังบันทึก...' : 'รับชำระ'}
          </button>
        </div>
      </div>
      <Toast toast={toast} />
    </Overlay>
  );
}
