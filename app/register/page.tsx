'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  User, Phone, Mail, Lock, Eye, EyeOff, Building2, Users as UsersIcon,
  Smartphone, FileSpreadsheet, AlertCircle, Loader2, UserPlus, Shield,
  CheckCircle2, Sparkles, ArrowLeft,
} from 'lucide-react';

export default function RegisterPage() {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);

  const [form, setForm] = useState({
    shop_name: '', contact_name: '', phone: '', email: '',
    password: '', confirm_password: '',
    business_type: 'mobile_shop', shop_size: 'small', branch_count: '1', current_system: 'excel',
  });
  function update(k: string, v: any) { setForm({ ...form, [k]: v }); if (error) setError(''); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!form.shop_name.trim()) return setError('กรุณาใส่ชื่อร้าน');
    if (!form.contact_name.trim()) return setError('กรุณาใส่ชื่อผู้ติดต่อ');
    if (!/^[0-9]{9,10}$/.test(form.phone.replace(/[-\s]/g, ''))) return setError('เบอร์โทรไม่ถูกต้อง (9-10 หลัก)');
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return setError('รูปแบบอีเมลไม่ถูกต้อง');
    if (form.password.length < 6) return setError('รหัสผ่านต้องมีอย่างน้อย 6 ตัว');
    if (form.password !== form.confirm_password) return setError('รหัสผ่านไม่ตรงกัน');
    if (!acceptTerms) return setError('กรุณายอมรับข้อกำหนดการให้บริการ');

    const phoneClean = form.phone.replace(/[-\s]/g, '');
    const username = `user${phoneClean.slice(-9)}`;
    setSubmitting(true);
    try {
      const res = await fetch('/api/beta-signup', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shop_name: form.shop_name.trim(), contact_name: form.contact_name.trim(),
          phone: form.phone, line_id: '', province: '',
          business_type: form.business_type, shop_size: form.shop_size,
          branch_count: parseInt(form.branch_count) || 1, current_system: form.current_system,
          username, password: form.password, note: form.email ? `อีเมล: ${form.email}` : '',
        }),
      });
      const data = await res.json();
      setSubmitting(false);
      if (!res.ok) return setError(data.error || 'เกิดข้อผิดพลาด');
      setSubmitted(true);
    } catch (e: any) {
      setSubmitting(false);
      setError('เกิดข้อผิดพลาด: ' + (e?.message || 'unknown'));
    }
  }

  if (submitted) {
    return (
      <div style={page}>
        <div style={{ ...card, textAlign: 'center' }}>
          <div style={{ width: 84, height: 84, margin: '0 auto 16px', background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: '#fff', borderRadius: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 12px 32px rgba(34,197,94,0.3)' }}>
            <CheckCircle2 size={52} strokeWidth={2.2} />
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 800, fontFamily: 'Prompt, sans-serif', margin: '0 0 8px' }}>สมัครสมาชิกสำเร็จ! 🎉</h2>
          <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.7, margin: '0 0 16px' }}>
            ทีมงานจะติดต่อกลับเพื่อยืนยันบัญชีภายใน <strong>24 ชั่วโมง</strong> ผ่านเบอร์ {form.phone}
          </p>
          <div style={{ padding: '10px 14px', background: '#fef3c7', borderRadius: 100, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#78350f' }}>
            <Sparkles size={14} style={{ color: '#f59e0b' }} /> ทดลองใช้ฟรี 30 วัน
          </div>
          <Link href="/login" style={{ ...primaryBtn, textDecoration: 'none', marginTop: 20 }}>
            <Shield size={16} /> กลับไปหน้าเข้าสู่ระบบ
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={page}>
      <div style={{ ...card, maxWidth: 460 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <Link href="/login" style={{ width: 38, height: 38, borderRadius: 10, background: '#f1f5f9', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', flexShrink: 0 }}>
            <ArrowLeft size={20} />
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 46, height: 46, borderRadius: 12, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
              <img src="/assets/auth/logo.webp" alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 800, fontFamily: 'Prompt, sans-serif', margin: 0 }}>สมัครสมาชิก</h2>
              <p style={{ fontSize: 11, color: '#64748b', margin: '2px 0 0' }}>เริ่มใช้งานฟรี 30 วัน</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
          <Field label="ชื่อร้าน / ชื่อธุรกิจ" req>
            <Inp Icon={Building2} value={form.shop_name} onChange={(v: string) => update('shop_name', v)} placeholder="เช่น ร้านเอกโมบาย" />
          </Field>
          <Field label="ชื่อผู้ติดต่อ" req>
            <Inp Icon={User} value={form.contact_name} onChange={(v: string) => update('contact_name', v)} placeholder="ชื่อ-นามสกุล" />
          </Field>
          <Field label="เบอร์โทรศัพท์" req>
            <Inp Icon={Phone} type="tel" value={form.phone} onChange={(v: string) => update('phone', v.replace(/[^\d-]/g, ''))} placeholder="09xxxxxxxx" />
          </Field>
          <Field label="อีเมล" req>
            <Inp Icon={Mail} type="email" value={form.email} onChange={(v: string) => update('email', v)} placeholder="example@mail.com" />
          </Field>
          <Field label="รหัสผ่าน" req>
            <Pwd value={form.password} onChange={(v: string) => update('password', v)} placeholder="อย่างน้อย 6 ตัวอักษร" show={showPassword} onToggle={() => setShowPassword(!showPassword)} />
          </Field>
          <Field label="ยืนยันรหัสผ่าน" req>
            <Pwd value={form.confirm_password} onChange={(v: string) => update('confirm_password', v)} placeholder="ยืนยันอีกครั้ง" show={showConfirm} onToggle={() => setShowConfirm(!showConfirm)} />
          </Field>
          <Field label="ประเภทธุรกิจ" req>
            <Sel Icon={Building2} value={form.business_type} onChange={(v: string) => update('business_type', v)}>
              <option value="mobile_shop">ร้านขายมือถือ</option>
              <option value="repair_shop">ร้านซ่อมมือถือ</option>
              <option value="both">ขาย + ซ่อม</option>
              <option value="other">อื่นๆ</option>
            </Sel>
          </Field>
          <Field label="ขนาดร้าน">
            <Sel Icon={UsersIcon} value={form.shop_size} onChange={(v: string) => update('shop_size', v)}>
              <option value="solo">เดี่ยว (1 คน)</option>
              <option value="small">เล็ก (2-4 คน)</option>
              <option value="medium">กลาง (5-10 คน)</option>
              <option value="large">ใหญ่ (10+ คน)</option>
            </Sel>
          </Field>
          <Field label="จำนวนสาขา">
            <Sel Icon={Smartphone} value={form.branch_count} onChange={(v: string) => update('branch_count', v)}>
              <option value="1">1 สาขา</option>
              <option value="2">2 สาขา</option>
              <option value="3">3 สาขา</option>
              <option value="5">5 สาขา</option>
              <option value="10">10 สาขาขึ้นไป</option>
            </Sel>
          </Field>
          <Field label="ระบบที่ใช้อยู่ปัจจุบัน">
            <Sel Icon={FileSpreadsheet} value={form.current_system} onChange={(v: string) => update('current_system', v)}>
              <option value="excel">Excel / Google Sheet</option>
              <option value="paper">สมุดจด / กระดาษ</option>
              <option value="line">LINE Note</option>
              <option value="other_app">แอปอื่น</option>
              <option value="none">ยังไม่มี</option>
            </Sel>
          </Field>

          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: '#475569', cursor: 'pointer' }}>
            <input type="checkbox" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} style={{ width: 16, height: 16, accentColor: '#3b82f6', marginTop: 2, flexShrink: 0 }} />
            <span>ฉันยอมรับ <span style={{ color: '#3b82f6', fontWeight: 600 }}>ข้อกำหนดการให้บริการ</span> และ <span style={{ color: '#3b82f6', fontWeight: 600 }}>นโยบายความเป็นส่วนตัว</span></span>
          </label>

          {error && <div style={errBox}><AlertCircle size={15} /> {error}</div>}

          <button type="submit" disabled={submitting} style={primaryBtn}>
            {submitting ? <Loader2 size={17} className="v3-spin" /> : <UserPlus size={17} strokeWidth={2.4} />}
            {submitting ? 'กำลังสมัคร...' : 'สมัครสมาชิก'}
          </button>

          <div style={{ textAlign: 'center', fontSize: 13, color: '#64748b' }}>
            มีบัญชีอยู่แล้ว?{' '}
            <Link href="/login" style={{ color: '#3b82f6', textDecoration: 'none', fontWeight: 700 }}>เข้าสู่ระบบ →</Link>
          </div>
        </form>

        <div style={{ textAlign: 'center', fontSize: 10, color: '#cbd5e1', marginTop: 16 }}>StockCare v3.9.72</div>
      </div>
    </div>
  );
}

/* ===== Components ===== */
function Field({ label, req, children }: any) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
        {label} {req && <span style={{ color: '#ef4444' }}>*</span>}
      </label>
      {children}
    </div>
  );
}
function Inp({ Icon, value, onChange, placeholder, type = 'text' }: any) {
  return (
    <div style={{ position: 'relative' }}>
      <Icon size={17} style={iconSt} />
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={inputSt}
        onFocus={fOn} onBlur={fOff} />
    </div>
  );
}
function Pwd({ value, onChange, placeholder, show, onToggle }: any) {
  return (
    <div style={{ position: 'relative' }}>
      <Lock size={17} style={iconSt} />
      <input type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={{ ...inputSt, paddingRight: 44 }}
        onFocus={fOn} onBlur={fOff} />
      <button type="button" onClick={onToggle} tabIndex={-1} style={eyeSt}>
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}
function Sel({ Icon, value, onChange, children }: any) {
  return (
    <div style={{ position: 'relative' }}>
      <Icon size={16} style={iconSt} />
      <select value={value} onChange={(e) => onChange(e.target.value)} style={{
        ...inputSt, cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none',
        backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2.5'><polyline points='6 9 12 15 18 9'/></svg>")`,
        backgroundRepeat: 'no-repeat', backgroundPosition: 'right 14px center',
      }}>
        {children}
      </select>
    </div>
  );
}
function fOn(e: React.FocusEvent<any>) { e.target.style.borderColor = '#3b82f6'; e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.12)'; }
function fOff(e: React.FocusEvent<any>) { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none'; }

/* ===== Styles ===== */
const page: React.CSSProperties = {
  minHeight: '100vh', width: '100%', maxWidth: '100vw', overflowX: 'hidden',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
  background: 'linear-gradient(160deg, #eff6ff 0%, #f8fafc 100%)', boxSizing: 'border-box',
};
const card: React.CSSProperties = {
  width: '100%', maxWidth: 400, background: '#fff', borderRadius: 22, padding: '24px 22px',
  boxShadow: '0 16px 48px rgba(15,23,42,0.10)', boxSizing: 'border-box', margin: '20px 0',
};
const iconSt: React.CSSProperties = { position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' };
const inputSt: React.CSSProperties = {
  width: '100%', height: 46, padding: '0 12px 0 42px', background: '#fff', border: '1.5px solid #e2e8f0',
  borderRadius: 12, color: '#1e293b', fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
};
const eyeSt: React.CSSProperties = {
  position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', width: 30, height: 30,
  background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex',
  alignItems: 'center', justifyContent: 'center', borderRadius: 6, padding: 0,
};
const errBox: React.CSSProperties = {
  padding: '10px 12px', background: '#fee2e2', color: '#991b1b', borderRadius: 10,
  fontSize: 12, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6,
};
const primaryBtn: React.CSSProperties = {
  width: '100%', padding: 13, background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: '#fff',
  border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 4px 16px rgba(59,130,246,0.3)', boxSizing: 'border-box',
};
