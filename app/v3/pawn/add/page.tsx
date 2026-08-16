'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-client';
import { sendLineNotify } from '@/lib/line-notify';
import {
  Coins, ArrowLeft, Smartphone, User, Phone, Calendar,
  DollarSign, Percent, FileText, MapPin, Loader2, CheckCircle2, AlertCircle, Eye, EyeOff, Lock,
  RefreshCw, Plus, Trash2,
} from 'lucide-react';

export default function V3PawnAddPage() {
  const supabase = createClient();
  const router = useRouter();
  const [form, setForm] = useState({
    model: '', color: '', spec: '', devicePassword: '',
    pawnPrice: '', pawnDate: new Date().toISOString().split('T')[0],
    interestDays: '30', interestAmount: '',
    customerName: '', customerPhone: '', customerNote: '',
    branchId: '',
  });
  const [profile, setProfile] = useState<any>(null);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [priorRenewals, setPriorRenewals] = useState<{ date: string; interestPaid: string }[]>([]);

  function notify(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 2600);
  }

  function addPriorRenewal() {
    setPriorRenewals([...priorRenewals, { date: '', interestPaid: '' }]);
  }
  function updatePriorRenewal(i: number, field: 'date' | 'interestPaid', value: string) {
    setPriorRenewals(priorRenewals.map((r, idx) => idx === i ? { ...r, [field]: value } : r));
  }
  function removePriorRenewal(i: number) {
    setPriorRenewals(priorRenewals.filter((_, idx) => idx !== i));
  }

  function addDays(dateStr: string, days: number) {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  }

  // คำนวณ due_date ปัจจุบัน + สร้าง record ต่อดอกย้อนหลัง จากรายการที่กรอก (นับต่อรอบ ไม่สนวันที่จริงที่กรอก)
  function computeRenewalChain() {
    const interestDays = parseInt(form.interestDays) || 30;
    const sorted = [...priorRenewals].filter(r => r.date).sort((a, b) => a.date.localeCompare(b.date));
    let runningDue = addDays(form.pawnDate, interestDays);
    const records = sorted.map(r => {
      const oldDue = runningDue;
      const newDue = addDays(oldDue, interestDays);
      runningDue = newDue;
      return { old_due_date: oldDue, new_due_date: newDue, renewal_date: r.date, interest_paid: parseFloat(r.interestPaid) || 0 };
    });
    return { finalDueDate: runningDue, records };
  }

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
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

  // due date preview
  const dueDatePreview = (() => {
    const { finalDueDate } = computeRenewalChain();
    return new Date(finalDueDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
  })();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.model || !form.pawnPrice || !form.customerName || !form.branchId) {
      return notify('กรอก รุ่น, ราคา, ชื่อลูกค้า, สาขา ให้ครบ', false);
    }

    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data: profileWithShop } = await supabase
      .from('profiles').select('shop_id').eq('id', user.id).single();

    const interestDays = parseInt(form.interestDays) || 30;
    const { finalDueDate: dueDateStr, records: renewalRecords } = computeRenewalChain();

    const { data: newItem, error } = await supabase.from('pawn_stock').insert({
      model: form.model,
      color: form.color || null, spec: form.spec || null,
      device_password: form.devicePassword || null,
      pawn_price: parseFloat(form.pawnPrice), pawn_date: form.pawnDate,
      interest_days: interestDays,
      interest_amount: parseFloat(form.interestAmount) || 0,
      due_date: dueDateStr, status: 'active', renew_count: renewalRecords.length,
      customer_name: form.customerName,
      customer_phone: form.customerPhone || null,
      customer_note: form.customerNote || null,
      added_by: user.id, added_by_name: profile.full_name,
      branch_id: form.branchId, shop_id: profileWithShop?.shop_id,
    }).select('id').single();

    if (error) { setLoading(false); notify('เกิดข้อผิดพลาด: ' + error.message, false); return; }

    if (renewalRecords.length > 0) {
      const { error: renewalsError } = await supabase.from('pawn_renewals').insert(
        renewalRecords.map(r => ({
          pawn_id: newItem.id,
          renewal_date: r.renewal_date,
          interest_paid: r.interest_paid,
          old_due_date: r.old_due_date,
          new_due_date: r.new_due_date,
          note: 'นำเข้าประวัติเก่า',
          renewed_by: user.id,
          renewed_by_name: profile.full_name,
          branch_id: form.branchId, shop_id: profileWithShop?.shop_id,
        }))
      );
      if (renewalsError) {
        setLoading(false);
        notify('บันทึกเครื่องสำเร็จ แต่บันทึกประวัติต่อดอกเก่าไม่สำเร็จ: ' + renewalsError.message, false);
        return;
      }
    }

    setLoading(false);
    notify(`รับจำนำสำเร็จ • ${form.model}`);
    const phoneTxt = form.customerPhone ? `\n📞 ${form.customerPhone}` : '';
    const lineMsg = `💰 รับจำนำเครื่องใหม่\n━━━━━━━━━━━━━\n📦 ${form.model}\n━━━━━━━━━━━━━\n👤 ลูกค้า: ${form.customerName}${phoneTxt}\n💵 ราคารับจำนำ: ฿${parseFloat(form.pawnPrice).toLocaleString()}\n📅 ครบกำหนด: ${dueDateStr}\n👨‍💼 รับโดย: ${profile.full_name}`;
    sendLineNotify(lineMsg, 'pawn').catch(() => {});

    setTimeout(() => router.push('/v3/pawn'), 1100);
  }

  return (
    <>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <Link href="/v3/pawn" style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--surface-2)', color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', flexShrink: 0 }}>
          <ArrowLeft size={20} />
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: '#fef3c7', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Coins size={20} />
          </div>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700, fontFamily: 'Prompt, sans-serif' }}>รับจำนำใหม่</h1>
            <p style={{ fontSize: 11, color: 'var(--text-dim)' }}>บันทึกเครื่องที่รับจำนำเข้าระบบ</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 560 }}>
        {/* เครื่อง */}
        <div className="v3-card" style={{ padding: 16 }}>
          <SectionTitle Icon={Smartphone} color="#3b82f6" label="ข้อมูลเครื่อง" />
          <F label="รุ่น" req><Inp value={form.model} onChange={(v) => setForm({ ...form, model: v })} placeholder="iPhone 13 Pro Max" /></F>
          <div style={g2}>
            <F label="สี"><Inp value={form.color} onChange={(v) => setForm({ ...form, color: v })} placeholder="Midnight" /></F>
            <F label="ความจุ/สเปก"><Inp value={form.spec} onChange={(v) => setForm({ ...form, spec: v })} placeholder="256GB" /></F>
          </div>
          <F label="รหัสผ่านเครื่อง (ถ้ามี)">
            <div style={{ position: 'relative' }}>
              <Lock size={17} style={iconSt} />
              <input type={showPassword ? 'text' : 'password'} value={form.devicePassword}
                onChange={(e) => setForm({ ...form, devicePassword: e.target.value })}
                placeholder="รหัสปลดล็อกเครื่อง" style={{ ...inputSt, paddingRight: 40 }} onFocus={fOn} onBlur={fOff} />
              <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}>
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </F>
        </div>

        {/* การจำนำ */}
        <div className="v3-card" style={{ padding: 16 }}>
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

        {/* ประวัติต่อดอกเก่า */}
        <div className="v3-card" style={{ padding: 16 }}>
          <SectionTitle Icon={RefreshCw} color="#0ea5e9" label="ประวัติต่อดอกเก่า (ถ้ามี)" />
          <p style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: -6, marginBottom: 10 }}>
            ถ้าเครื่องนี้เคยต่อดอกมาก่อนจะนำเข้าระบบ ใส่แต่ละครั้งไว้ตรงนี้ ระบบจะคำนวณวันครบกำหนดปัจจุบันให้เอง
          </p>
          {priorRenewals.map((r, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <input type="date" value={r.date}
                onChange={(e) => updatePriorRenewal(i, 'date', e.target.value)}
                style={{ ...inputSt, flex: 2 }} onFocus={fOn} onBlur={fOff} />
              <input type="number" inputMode="decimal" value={r.interestPaid}
                onChange={(e) => updatePriorRenewal(i, 'interestPaid', e.target.value)}
                placeholder="ดอกที่จ่าย" style={{ ...inputSt, flex: 1 }} onFocus={fOn} onBlur={fOff} />
              <button type="button" onClick={() => removePriorRenewal(i)} style={{ width: 46, height: 46, borderRadius: 12, background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          <button type="button" onClick={addPriorRenewal} style={{
            width: '100%', padding: 10, background: 'var(--surface-2)', border: '1px dashed var(--border)', borderRadius: 10,
            color: 'var(--text-dim)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            <Plus size={14} /> เพิ่มรายการต่อดอกเก่า
          </button>
        </div>

        {/* ลูกค้า */}
        <div className="v3-card" style={{ padding: 16 }}>
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

        <button type="submit" disabled={loading} style={{
          width: '100%', padding: 14, background: loading ? 'var(--surface-2)' : 'linear-gradient(135deg, #f59e0b, #d97706)',
          color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: loading ? 'wait' : 'pointer',
          fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          {loading ? <Loader2 size={17} className="v3-spin" /> : <Coins size={17} strokeWidth={2.4} />}
          {loading ? 'กำลังบันทึก...' : 'รับจำนำ'}
        </button>
      </form>

      {toast && (
        <div style={{ position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)', background: toast.ok ? '#16a34a' : '#dc2626', color: '#fff', padding: '12px 20px', borderRadius: 12, fontSize: 13, fontWeight: 600, boxShadow: '0 8px 24px rgba(0,0,0,0.2)', zIndex: 200, maxWidth: '90vw', display: 'flex', alignItems: 'center', gap: 8 }}>
          {toast.ok ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />} {toast.msg}
        </div>
      )}
    </>
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
