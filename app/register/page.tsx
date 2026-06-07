'use client';

import { useState } from 'react';
import Link from 'next/link';
// import Image from 'next/image'; // เปิดใช้เมื่อมีไฟล์ asset จริง
import {
  User, Phone, Mail, Lock, Eye, EyeOff, Building2, Users as UsersIcon,
  Smartphone, FileSpreadsheet, AlertCircle, Loader2, CheckCircle2, Sparkles, Shield, Check,
  AtSign, MessageSquare,
} from 'lucide-react';

export default function RegisterPage() {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);

  const [form, setForm] = useState({
    shop_name: '', contact_name: '', username: '', phone: '', email: '', contact_channel: '',
    password: '', confirm_password: '',
    business_type: 'mobile_shop', shop_size: 'small', branch_count: '1', current_system: 'excel',
  });
  function update(k: string, v: any) { setForm({ ...form, [k]: v }); if (error) setError(''); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!form.shop_name.trim()) return setError('กรุณาใส่ชื่อร้าน');
    if (!form.contact_name.trim()) return setError('กรุณาใส่ชื่อผู้ติดต่อ');
    if (!form.username.trim()) return setError('กรุณาตั้งชื่อผู้ใช้ (username)');
    if (!/^[a-z0-9_]{3,20}$/.test(form.username.trim())) return setError('username ใช้ a-z, 0-9, _ เท่านั้น (3-20 ตัว)');
    if (!/^[0-9]{9,10}$/.test(form.phone.replace(/[-\s]/g, ''))) return setError('เบอร์โทรไม่ถูกต้อง (9-10 หลัก)');
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return setError('รูปแบบอีเมลไม่ถูกต้อง');
    if (form.password.length < 6) return setError('รหัสผ่านต้องมีอย่างน้อย 6 ตัว');
    if (form.password !== form.confirm_password) return setError('รหัสผ่านไม่ตรงกัน');
    if (!acceptTerms) return setError('กรุณายอมรับข้อกำหนดการให้บริการ');

    const username = form.username.trim().toLowerCase();
    const noteParts = [
      form.email ? `อีเมล: ${form.email}` : '',
      form.contact_channel ? `ติดต่อ: ${form.contact_channel}` : '',
    ].filter(Boolean);
    setSubmitting(true);
    try {
      const res = await fetch('/api/beta-signup', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shop_name: form.shop_name.trim(), contact_name: form.contact_name.trim(),
          phone: form.phone, line_id: form.contact_channel.trim() || '', province: '',
          business_type: form.business_type, shop_size: form.shop_size,
          branch_count: parseInt(form.branch_count) || 1, current_system: form.current_system,
          username, password: form.password, note: noteParts.join(' · '),
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

  /* ===================== SUCCESS ===================== */
  if (submitted) {
    return (
      <div className="auth-wrap">
        <div className="auth-card success-card">
          <div className="suc-ico"><CheckCircle2 size={52} strokeWidth={2.2} /></div>
          <h2 className="suc-title">สมัครสมาชิกสำเร็จ! 🎉</h2>
          <p className="suc-desc">ทีมงานจะติดต่อกลับเพื่อยืนยันบัญชีภายใน <strong>24 ชั่วโมง</strong> ผ่านเบอร์ {form.phone}</p>
          <div className="suc-badge"><Sparkles size={14} /> ทดลองใช้ฟรี 30 วัน</div>
          <Link href="/login" className="btn-primary suc-btn"><Shield size={16} /> กลับไปหน้าเข้าสู่ระบบ</Link>
        </div>
        <style dangerouslySetInnerHTML={{ __html: wrapCss + successCss }} />
      </div>
    );
  }

  const benefits = [
    'จัดการสต๊อก / IMEI ไม่จำกัด',
    'ระบบซ่อม • จำนำ • ผ่อน ครบ',
    'แจ้งเตือนผ่าน LINE อัตโนมัติ',
    'รายงานกำไร–ขาดทุน เรียลไทม์',
  ];

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        {/* ===================== MARKETING (ซ้าย) ===================== */}
        <aside className="mkt">
          <div className="mkt-pattern" aria-hidden />
          <div className="mkt-glow mkt-glow-1" aria-hidden />
          <div className="mkt-glow mkt-glow-2" aria-hidden />
          <div className="mkt-inner">
            <div className="mkt-brand">
              {/* <Image src="/assets/logo.png" alt="StockCare" width={40} height={40} /> */}
              <div className="mkt-logo">S</div>
              <div>
                <div className="mkt-logo-name">StockCare</div>
                <div className="mkt-logo-sub">POS & MANAGEMENT</div>
              </div>
            </div>

            <h2 className="mkt-title">เริ่มต้นใช้งาน<br /><b>ฟรี 30 วัน</b></h2>
            <p className="mkt-desc">สมัครวันนี้ ใช้ครบทุกฟีเจอร์<br />ไม่ต้องผูกบัตรเครดิต</p>

            {/* mockup */}
            <div className="mockup">
              {/* <Image src="/assets/login-dashboard-mockup.webp" alt="" fill style={{objectFit:'contain'}} /> */}
              <div className="laptop">
                <div className="laptop-screen">
                  <div className="ls-row"><span /><span /><span /></div>
                  <div className="ls-bars"><i style={{ height: '60%' }} /><i style={{ height: '85%' }} /><i style={{ height: '45%' }} /><i style={{ height: '95%' }} /><i style={{ height: '70%' }} /></div>
                </div>
                <div className="laptop-base" />
              </div>
              <div className="phone">
                <div className="phone-notch" />
                <div className="phone-card" /><div className="phone-card short" /><div className="phone-card" />
              </div>
              <div className="float float-spark"><Sparkles size={20} /></div>
            </div>

            {/* benefits checklist */}
            <div className="benefits">
              {benefits.map((b) => (
                <div className="benefit" key={b}><span className="bcheck"><Check size={13} strokeWidth={3} /></span>{b}</div>
              ))}
            </div>
          </div>
        </aside>

        {/* ===================== FORM (ขวา) ===================== */}
        <main className="formside">
          <div className="form-inner">
            <div className="form-logo"><div className="form-logo-badge">S</div></div>
            <h1 className="form-title">สมัครสมาชิก</h1>
            <p className="form-sub">เริ่มใช้งาน StockCare ฟรี 30 วัน</p>

            {error && <div className="alert" role="alert"><AlertCircle size={16} /> <span>{error}</span></div>}

            <form onSubmit={handleSubmit} className="form">
              <div className="field">
                <label>ชื่อร้าน / ชื่อธุรกิจ <i>*</i></label>
                <div className="input-wrap"><Building2 size={18} className="input-ico" />
                  <input value={form.shop_name} onChange={(e) => update('shop_name', e.target.value)} placeholder="เช่น ร้านเอกโมบาย" /></div>
              </div>

              <div className="field">
                <label>ชื่อผู้ติดต่อ <i>*</i></label>
                <div className="input-wrap"><User size={18} className="input-ico" />
                  <input value={form.contact_name} onChange={(e) => update('contact_name', e.target.value)} placeholder="ชื่อ-นามสกุล" /></div>
              </div>

              <div className="field">
                <label>ตั้งชื่อผู้ใช้ (Username) <i>*</i></label>
                <div className="input-wrap"><AtSign size={18} className="input-ico" />
                  <input value={form.username} onChange={(e) => update('username', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} placeholder="เช่น ake_mobile (ใช้เข้าสู่ระบบ)" maxLength={20} autoCapitalize="none" /></div>
                <div style={{ fontSize: 10.5, color: 'var(--text-dim, #94a3b8)', marginTop: 4 }}>ใช้ a-z, 0-9, _ เท่านั้น (3-20 ตัว) · ใช้ตอนเข้าสู่ระบบ</div>
              </div>

              <div className="grid2">
                <div className="field">
                  <label>เบอร์โทรศัพท์ <i>*</i></label>
                  <div className="input-wrap"><Phone size={18} className="input-ico" />
                    <input type="tel" value={form.phone} onChange={(e) => update('phone', e.target.value.replace(/[^\d-]/g, ''))} placeholder="09xxxxxxxx" /></div>
                </div>
                <div className="field">
                  <label>อีเมล</label>
                  <div className="input-wrap"><Mail size={18} className="input-ico" />
                    <input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} placeholder="example@mail.com" /></div>
                </div>
              </div>

              <div className="field">
                <label>ช่องทางติดต่อ (Facebook / LINE)</label>
                <div className="input-wrap"><MessageSquare size={18} className="input-ico" />
                  <input value={form.contact_channel} onChange={(e) => update('contact_channel', e.target.value)} placeholder="เช่น LINE: @akemobile หรือ ลิงก์ Facebook" /></div>
              </div>

              <div className="grid2">
                <div className="field">
                  <label>รหัสผ่าน <i>*</i></label>
                  <div className="input-wrap"><Lock size={18} className="input-ico" />
                    <input type={showPassword ? 'text' : 'password'} value={form.password} onChange={(e) => update('password', e.target.value)} placeholder="อย่างน้อย 6 ตัว" />
                    <button type="button" className="eye" onClick={() => setShowPassword(!showPassword)} tabIndex={-1}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
                </div>
                <div className="field">
                  <label>ยืนยันรหัสผ่าน <i>*</i></label>
                  <div className="input-wrap"><Lock size={18} className="input-ico" />
                    <input type={showConfirm ? 'text' : 'password'} value={form.confirm_password} onChange={(e) => update('confirm_password', e.target.value)} placeholder="อีกครั้ง" />
                    <button type="button" className="eye" onClick={() => setShowConfirm(!showConfirm)} tabIndex={-1}>{showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
                </div>
              </div>

              <div className="grid2">
                <div className="field">
                  <label>ประเภทธุรกิจ <i>*</i></label>
                  <div className="input-wrap"><Building2 size={18} className="input-ico" />
                    <select value={form.business_type} onChange={(e) => update('business_type', e.target.value)}>
                      <option value="mobile_shop">ร้านขายมือถือ</option><option value="repair_shop">ร้านซ่อมมือถือ</option>
                      <option value="both">ขาย + ซ่อม</option><option value="other">อื่นๆ</option>
                    </select></div>
                </div>
                <div className="field">
                  <label>ขนาดร้าน</label>
                  <div className="input-wrap"><UsersIcon size={18} className="input-ico" />
                    <select value={form.shop_size} onChange={(e) => update('shop_size', e.target.value)}>
                      <option value="solo">เดี่ยว (1 คน)</option><option value="small">เล็ก (2-4)</option>
                      <option value="medium">กลาง (5-10)</option><option value="large">ใหญ่ (10+)</option>
                    </select></div>
                </div>
              </div>

              <div className="grid2">
                <div className="field">
                  <label>จำนวนสาขา</label>
                  <div className="input-wrap"><Smartphone size={18} className="input-ico" />
                    <select value={form.branch_count} onChange={(e) => update('branch_count', e.target.value)}>
                      <option value="1">1 สาขา</option><option value="2">2 สาขา</option><option value="3">3 สาขา</option>
                      <option value="5">5 สาขา</option><option value="10">10+ สาขา</option>
                    </select></div>
                </div>
                <div className="field">
                  <label>ระบบที่ใช้ปัจจุบัน</label>
                  <div className="input-wrap"><FileSpreadsheet size={18} className="input-ico" />
                    <select value={form.current_system} onChange={(e) => update('current_system', e.target.value)}>
                      <option value="excel">Excel / Sheet</option><option value="paper">สมุดจด</option>
                      <option value="line">LINE Note</option><option value="other_app">แอปอื่น</option><option value="none">ยังไม่มี</option>
                    </select></div>
                </div>
              </div>

              <label className="terms">
                <input type="checkbox" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} />
                <span>ฉันยอมรับ <b>ข้อกำหนดการให้บริการ</b> และ <b>นโยบายความเป็นส่วนตัว</b></span>
              </label>

              <button type="submit" className="btn-primary" disabled={submitting}>
                {submitting ? <><Loader2 size={18} className="spin" /> กำลังสมัคร...</> : 'สมัครสมาชิก ฟรี 30 วัน'}
              </button>
            </form>

            <p className="signup">มีบัญชีอยู่แล้ว? <Link href="/login">เข้าสู่ระบบ →</Link></p>
            <p className="ver">StockCare v3.9.94</p>
          </div>
        </main>
      </div>

      <style dangerouslySetInnerHTML={{ __html: wrapCss + formCss }} />
    </div>
  );
}

/* ===================== STYLES ===================== */
const wrapCss = `
  .auth-wrap{min-height:100vh;min-height:100dvh;width:100%;max-width:100vw;display:flex;align-items:center;justify-content:center;
    padding:20px;box-sizing:border-box;overflow-x:hidden;font-family:'Sarabun',system-ui,sans-serif;
    background:radial-gradient(1100px 700px at 12% 0%,#eaf2ff 0%,transparent 55%),radial-gradient(900px 600px at 100% 100%,#e6f0ff 0%,transparent 50%),linear-gradient(160deg,#f7faff,#eef4ff 70%,#e7eefc);}
  .auth-card{width:100%;max-width:1000px;display:grid;grid-template-columns:.92fr 1.08fr;background:#fff;border-radius:26px;overflow:hidden;box-sizing:border-box;
    max-height:calc(100dvh - 40px);box-shadow:0 30px 80px -28px rgba(37,99,235,.35),0 4px 16px rgba(15,23,42,.06);}
  .mkt{position:relative;overflow:hidden;padding:40px 36px;background:linear-gradient(160deg,#eaf2ff 0%,#dbeafe 45%,#eff6ff 100%);}
  .mkt-pattern{position:absolute;inset:0;opacity:.5;background-image:radial-gradient(rgba(37,99,235,.18) 1.3px,transparent 1.3px);background-size:20px 20px;}
  .mkt-glow{position:absolute;border-radius:50%;filter:blur(60px);opacity:.45;}
  .mkt-glow-1{width:240px;height:240px;background:#60a5fa;top:-50px;left:-40px;}
  .mkt-glow-2{width:260px;height:260px;background:#a5b4fc;bottom:-70px;right:-50px;}
  .mkt-inner{position:relative;z-index:1;display:flex;flex-direction:column;justify-content:center;height:100%;}
  .mkt-brand{display:flex;align-items:center;gap:11px;margin-bottom:22px;}
  .mkt-logo{width:42px;height:42px;border-radius:13px;display:flex;align-items:center;justify-content:center;font-family:'Prompt';font-weight:800;font-size:21px;color:#fff;background:linear-gradient(135deg,#2563eb,#1d4ed8);box-shadow:0 8px 18px -4px rgba(37,99,235,.6),inset 0 1px 0 rgba(255,255,255,.5);}
  .mkt-logo-name{font-family:'Prompt';font-weight:800;font-size:19px;color:#0f2a5e;}
  .mkt-logo-sub{font-size:10px;letter-spacing:2px;color:#3b6fb5;font-weight:600;margin-top:-2px;}
  .mkt-title{font-family:'Prompt';font-weight:700;font-size:26px;line-height:1.25;color:#0f2a5e;margin:0 0 8px;}
  .mkt-title b{background:linear-gradient(120deg,#2563eb,#1d4ed8);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;}
  .mkt-desc{font-size:13px;color:#3b6fb5;line-height:1.7;margin:0 0 18px;}
  .mockup{position:relative;height:140px;margin:0 0 18px;}
  .laptop{position:absolute;left:6%;top:8px;width:62%;animation:floaty 6s ease-in-out infinite;}
  .laptop-screen{background:#0f2a5e;border-radius:10px 10px 4px 4px;padding:9px;border:2px solid #1e3a8a;}
  .ls-row{display:flex;gap:4px;margin-bottom:7px;} .ls-row span{width:6px;height:6px;border-radius:50%;background:#3b82f6;opacity:.7;}
  .ls-bars{display:flex;align-items:flex-end;gap:5px;height:50px;} .ls-bars i{flex:1;border-radius:3px;background:linear-gradient(180deg,#60a5fa,#2563eb);}
  .laptop-base{height:7px;background:linear-gradient(180deg,#cbd5e1,#94a3b8);border-radius:0 0 8px 8px;margin:0 -6px;}
  .phone{position:absolute;right:4%;bottom:0;width:78px;padding:7px 7px 12px;background:#fff;border-radius:15px;border:2px solid #dbeafe;box-shadow:0 14px 30px -10px rgba(37,99,235,.4);animation:floaty 6s ease-in-out infinite;animation-delay:-3s;}
  .phone-notch{width:26px;height:4px;border-radius:3px;background:#cbd5e1;margin:0 auto 7px;}
  .phone-card{height:12px;border-radius:5px;background:linear-gradient(90deg,#dbeafe,#eff6ff);margin-bottom:5px;} .phone-card.short{width:60%;background:linear-gradient(90deg,#bfdbfe,#dbeafe);}
  .float{position:absolute;border-radius:13px;display:flex;align-items:center;justify-content:center;background:#fff;box-shadow:0 10px 22px -6px rgba(37,99,235,.45);}
  .float-spark{width:40px;height:40px;top:-4px;right:16%;color:#f59e0b;animation:floaty 5s ease-in-out infinite;}
  @keyframes floaty{0%,100%{transform:translateY(0)}50%{transform:translateY(-9px)}}
  .benefits{display:flex;flex-direction:column;gap:10px;margin-top:6px;}
  .benefit{display:flex;align-items:center;gap:10px;font-size:13px;font-weight:500;color:#0f2a5e;}
  .bcheck{width:22px;height:22px;border-radius:7px;background:#2563eb;color:#fff;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 4px 10px -2px rgba(37,99,235,.5);}
  .spin{animation:spin 1s linear infinite;} @keyframes spin{to{transform:rotate(360deg)}}
`;

const formCss = `
  .formside{display:flex;align-items:center;justify-content:center;padding:34px 38px;box-sizing:border-box;overflow-y:auto;}
  .form-inner{width:100%;max-width:420px;}
  .form-logo{display:none;} .form-logo-badge{width:52px;height:52px;border-radius:15px;display:flex;align-items:center;justify-content:center;font-family:'Prompt';font-weight:800;font-size:24px;color:#fff;margin-bottom:16px;background:linear-gradient(135deg,#2563eb,#1d4ed8);box-shadow:0 10px 22px -6px rgba(37,99,235,.6);}
  .form-title{font-family:'Prompt';font-weight:700;font-size:25px;color:#0f172a;margin:0 0 5px;}
  .form-sub{font-size:13px;color:#64748b;margin:0 0 18px;}
  .alert{display:flex;align-items:center;gap:8px;padding:11px 13px;border-radius:12px;background:#fef2f2;border:1px solid #fecaca;color:#dc2626;font-size:13px;font-weight:500;margin-bottom:14px;}
  .form{display:flex;flex-direction:column;gap:13px;}
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:13px;}
  .field label{display:block;font-size:12.5px;font-weight:600;color:#334155;margin-bottom:6px;} .field label i{color:#dc2626;font-style:normal;}
  .input-wrap{position:relative;}
  .input-ico{position:absolute;left:13px;top:50%;transform:translateY(-50%);color:#94a3b8;pointer-events:none;}
  .input-wrap input,.input-wrap select{width:100%;height:48px;padding:0 14px 0 42px;box-sizing:border-box;border:1.5px solid #e2e8f0;border-radius:12px;font-size:14.5px;font-family:'Sarabun';color:#0f172a;background:#f8fafc;outline:none;transition:.2s;}
  .input-wrap select{appearance:none;cursor:pointer;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' fill='none' stroke='%2394a3b8' stroke-width='2.5'%3E%3Cpath d='M3 5l4 4 4-4'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 14px center;padding-right:34px;}
  .input-wrap input::placeholder{color:#94a3b8;}
  .input-wrap input:focus,.input-wrap select:focus{border-color:#2563eb;background:#fff;box-shadow:0 0 0 4px rgba(37,99,235,.13);}
  .eye{position:absolute;right:6px;top:50%;transform:translateY(-50%);width:34px;height:34px;border:none;background:transparent;color:#94a3b8;cursor:pointer;display:flex;align-items:center;justify-content:center;border-radius:9px;transition:.2s;}
  .eye:hover{color:#2563eb;background:#eff6ff;}
  .terms{display:flex;align-items:flex-start;gap:9px;font-size:12.5px;color:#475569;cursor:pointer;line-height:1.5;margin-top:2px;}
  .terms input{width:17px;height:17px;accent-color:#2563eb;margin-top:1px;flex-shrink:0;cursor:pointer;}
  .terms b{color:#2563eb;font-weight:600;}
  .btn-primary{width:100%;height:54px;flex-shrink:0;border:none;border-radius:13px;cursor:pointer;margin-top:4px;font-family:'Prompt';font-weight:700;font-size:16px;color:#fff;background:linear-gradient(135deg,#2563eb,#1d4ed8);box-shadow:0 12px 26px -8px rgba(37,99,235,.6);transition:transform .2s,box-shadow .2s,opacity .2s;display:flex;align-items:center;justify-content:center;gap:9px;text-decoration:none;box-sizing:border-box;}
  .btn-primary:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 18px 34px -10px rgba(37,99,235,.7);}
  .btn-primary:disabled{opacity:.7;cursor:not-allowed;}
  .signup{text-align:center;font-size:13.5px;color:#64748b;margin:18px 0 0;}
  .signup :global(a){color:#2563eb;font-weight:700;text-decoration:none;}
  .ver{text-align:center;font-size:10px;color:#cbd5e1;letter-spacing:1px;margin:12px 0 0;}
  @media (max-width:900px){.auth-card{grid-template-columns:1fr;max-width:480px;max-height:none;}.mkt{display:none;}.form-logo{display:flex;}}
  @media (max-width:480px){.auth-wrap{padding:0;align-items:stretch;background:#fff;}.auth-card{border-radius:0;box-shadow:none;min-height:100dvh;}.formside{padding:40px 20px 30px;align-items:flex-start;}.form-inner{max-width:100%;}.grid2{grid-template-columns:1fr;}}
`;

const successCss = `
  .success-card{display:flex;flex-direction:column;align-items:center;text-align:center;max-width:420px;padding:48px 36px;}
  .suc-ico{width:84px;height:84px;margin:0 auto 18px;background:linear-gradient(135deg,#22c55e,#16a34a);color:#fff;border-radius:22px;display:flex;align-items:center;justify-content:center;box-shadow:0 14px 34px -8px rgba(34,197,94,.5);}
  .suc-title{font-family:'Prompt';font-weight:800;font-size:23px;color:#0f172a;margin:0 0 8px;}
  .suc-desc{font-size:13.5px;color:#64748b;line-height:1.7;margin:0 0 16px;}
  .suc-badge{padding:9px 16px;background:#fef3c7;border-radius:100px;display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:700;color:#78350f;}
  .suc-badge :global(svg){color:#f59e0b;}
  .suc-btn{margin-top:22px;width:100%;max-width:300px;}
  @media (max-width:480px){.auth-wrap{padding:18px;}.success-card{border-radius:24px;min-height:auto;}}
`;
