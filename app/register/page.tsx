'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, ShoppingBag, User, Phone, Mail, Lock, Eye, EyeOff,
  Building2, Users as UsersIcon, Smartphone, FileSpreadsheet,
  AlertCircle, Loader2, UserPlus, Shield, CheckCircle2,
  Sparkles, Wrench, BarChart3, MessageSquare,
} from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);

  const [form, setForm] = useState({
    shop_name: '',
    contact_name: '',
    phone: '',
    email: '',
    password: '',
    confirm_password: '',
    business_type: 'mobile_shop',
    shop_size: 'small',
    branch_count: '1',
    current_system: 'excel',
  });

  function update(key: string, value: any) {
    setForm({ ...form, [key]: value });
    if (error) setError('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    // Validation
    if (!form.shop_name.trim()) return setError('กรุณาใส่ชื่อร้าน');
    if (!form.contact_name.trim()) return setError('กรุณาใส่ชื่อผู้ติดต่อ');
    if (!/^[0-9]{9,10}$/.test(form.phone.replace(/[-\s]/g, ''))) {
      return setError('เบอร์โทรไม่ถูกต้อง (9-10 หลัก)');
    }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      return setError('รูปแบบอีเมลไม่ถูกต้อง');
    }
    if (form.password.length < 6) return setError('รหัสผ่านต้องมีอย่างน้อย 6 ตัว');
    if (form.password !== form.confirm_password) {
      return setError('รหัสผ่านไม่ตรงกัน');
    }
    if (!acceptTerms) return setError('กรุณายอมรับข้อกำหนดการให้บริการ');

    // สร้าง username อัตโนมัติจาก phone (เลข 9-10 ตัว)
    const phoneClean = form.phone.replace(/[-\s]/g, '');
    const username = `user${phoneClean.slice(-9)}`;

    setSubmitting(true);
    try {
      const res = await fetch('/api/beta-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shop_name: form.shop_name.trim(),
          contact_name: form.contact_name.trim(),
          phone: form.phone,
          line_id: '',
          province: '',
          business_type: form.business_type,
          shop_size: form.shop_size,
          branch_count: parseInt(form.branch_count) || 1,
          current_system: form.current_system,
          username,
          password: form.password,
          note: form.email ? `อีเมล: ${form.email}` : '',
        }),
      });
      const data = await res.json();
      setSubmitting(false);

      if (!res.ok) {
        setError(data.error || 'เกิดข้อผิดพลาด');
        return;
      }
      setSubmitted(true);
    } catch (e: any) {
      setSubmitting(false);
      setError('เกิดข้อผิดพลาด: ' + (e?.message || 'unknown'));
    }
  }

  if (submitted) {
    return (
      <div className="reg-v3" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div className="reg-v3-success">
          <div className="reg-v3-success-icon">
            <CheckCircle2 size={56} strokeWidth={2.2} />
          </div>
          <h2 className="reg-v3-success-title">สมัครสมาชิกสำเร็จ! 🎉</h2>
          <p className="reg-v3-success-text">
            ทีมงานจะติดต่อกลับเพื่อยืนยันบัญชีและส่งข้อมูลเข้าสู่ระบบให้คุณภายใน <strong>24 ชั่วโมง</strong> ผ่านเบอร์โทร {form.phone}
          </p>
          <div className="reg-v3-success-features">
            <Sparkles size={14} style={{ color: '#f59e0b' }} />
            <span>ทดลองใช้ฟรี 30 วัน · ไม่มีค่าใช้จ่าย</span>
          </div>
          <Link href="/login" className="reg-v3-btn-primary" style={{ textDecoration: 'none', marginTop: 20 }}>
            <Shield size={16} /> กลับไปหน้าเข้าสู่ระบบ
          </Link>
        </div>
        <style jsx>{styles}</style>
      </div>
    );
  }

  return (
    <div className="reg-v3">
      <div className="reg-v3-container">
        {/* LEFT (desktop): Hero with features */}
        <div className="reg-v3-hero reg-v3-desktop">
          <div className="reg-v3-brand">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <img src="/icon-192.png" alt="" style={{ width: 52, height: 52, borderRadius: 12 }} />
              <div>
                <div className="reg-v3-brand-title">STOCK <span style={{ color: '#3b82f6' }}>MANAGER</span></div>
                <div className="reg-v3-brand-sub">ระบบจัดการร้านมือถือ + ร้านซ่อม</div>
              </div>
            </div>
          </div>

          <div className="reg-v3-badge">
            <Sparkles size={14} /> เริ่มต้นใช้งานฟรี 30 วัน
          </div>

          <h1 className="reg-v3-h1">
            จัดการร้านมือถือ<br />
            <span style={{ color: '#3b82f6' }}>ง่าย ครบ จบในระบบเดียว</span>
          </h1>
          <p className="reg-v3-sub">
            ดูแลสต็อกสินค้า จัดการงานซ่อม รายงานยอดขาย<br />
            และเชื่อมต่อ LINE Notify ได้ที่เดียว
          </p>

          {/* Feature list */}
          <div className="reg-v3-features">
            <FeatureRow Icon={ShoppingBag} title="จัดการสต็อกสินค้า" desc="อัปเดตสต็อกแบบเรียลไทม์" color="#3b82f6" />
            <FeatureRow Icon={Wrench} title="บริหารงานซ่อม" desc="ติดตามสถานะงานซ่อมได้ง่าย" color="#22c55e" />
            <FeatureRow Icon={BarChart3} title="รายงาน & วิเคราะห์" desc="สรุปยอดขาย กำไร ขาดทุน" color="#f59e0b" />
            <FeatureRow Icon={MessageSquare} title="แจ้งเตือนผ่าน LINE" desc="รับการแจ้งเตือนอัตโนมัติ" color="#8b5cf6" />
          </div>

          {/* Illustration */}
          <div className="reg-v3-illust">
            <RegIllustration />
          </div>

          <div className="reg-v3-trust">
            <Shield size={14} color="#3b82f6" />
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>ปลอดภัย มั่นใจได้</div>
              <div style={{ fontSize: 10, color: '#64748b' }}>ข้อมูลของคุณจะถูกเข้ารหัสและเก็บรักษาอย่างปลอดภัย</div>
            </div>
          </div>
        </div>

        {/* RIGHT: Form */}
        <div className="reg-v3-formwrap">
          <div className="reg-v3-form">
            {/* Mobile header */}
            <div className="reg-v3-mobile-header reg-v3-mobile">
              <Link href="/login" className="reg-v3-back">
                <ArrowLeft size={20} />
              </Link>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h2 style={{ fontSize: 22, fontWeight: 800, fontFamily: 'Prompt, sans-serif', lineHeight: 1.1 }}>
                  สมัครสมาชิก
                </h2>
                <p style={{ fontSize: 11, color: '#64748b', marginTop: 4, lineHeight: 1.4 }}>
                  สร้างบัญชีเพื่อเริ่มใช้งาน<br />Stock Manager
                </p>
              </div>
              <div className="reg-v3-mobile-illust">
                <RegMobileIllust />
              </div>
            </div>

            {/* Desktop header */}
            <div className="reg-v3-desktop reg-v3-form-header">
              <div>
                <h2 style={{ fontSize: 28, fontWeight: 800, fontFamily: 'Prompt, sans-serif' }}>
                  สมัครสมาชิก
                </h2>
                <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
                  สร้างบัญชีเพื่อเริ่มใช้งาน Stock Manager
                </p>
              </div>
              <div style={{ fontSize: 12, color: '#64748b' }}>
                มีบัญชีอยู่แล้ว?{' '}
                <Link href="/login" style={{ color: '#3b82f6', fontWeight: 700, textDecoration: 'underline' }}>
                  เข้าสู่ระบบ
                </Link>
              </div>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Shop name */}
              <Field label="ชื่อร้าน / ชื่อธุรกิจ" required>
                <Input
                  Icon={Building2}
                  value={form.shop_name}
                  onChange={(v) => update('shop_name', v)}
                  placeholder="เช่น ร้านเอกโมบาย"
                />
              </Field>

              {/* Contact name */}
              <Field label="ชื่อผู้ติดต่อ" required>
                <Input
                  Icon={User}
                  value={form.contact_name}
                  onChange={(v) => update('contact_name', v)}
                  placeholder="ชื่อ-นามสกุล"
                />
              </Field>

              {/* Phone + Email */}
              <div className="reg-v3-grid-2">
                <Field label="เบอร์โทรศัพท์" required>
                  <Input
                    Icon={Phone}
                    value={form.phone}
                    onChange={(v) => update('phone', v.replace(/[^\d-]/g, ''))}
                    placeholder="09x-xxx-xxxx"
                    type="tel"
                  />
                </Field>
                <Field label="อีเมล" required>
                  <Input
                    Icon={Mail}
                    value={form.email}
                    onChange={(v) => update('email', v)}
                    placeholder="email@mail.com"
                    type="email"
                  />
                </Field>
              </div>

              {/* Password + Confirm */}
              <div className="reg-v3-grid-2">
                <Field label="รหัสผ่าน" required>
                  <PasswordInput
                    value={form.password}
                    onChange={(v) => update('password', v)}
                    placeholder="อย่างน้อย 6 ตัว"
                    show={showPassword}
                    onToggle={() => setShowPassword(!showPassword)}
                  />
                </Field>
                <Field label="ยืนยันรหัสผ่าน" required>
                  <PasswordInput
                    value={form.confirm_password}
                    onChange={(v) => update('confirm_password', v)}
                    placeholder="ยืนยันอีกครั้ง"
                    show={showConfirmPassword}
                    onToggle={() => setShowConfirmPassword(!showConfirmPassword)}
                  />
                </Field>
              </div>

              {/* Business type + Shop size */}
              <div className="reg-v3-grid-2">
                <Field label="ประเภทธุรกิจ" required>
                  <SelectInput
                    Icon={Building2}
                    value={form.business_type}
                    onChange={(v) => update('business_type', v)}
                  >
                    <option value="mobile_shop">ร้านขายมือถือ</option>
                    <option value="repair_shop">ร้านซ่อมมือถือ</option>
                    <option value="both">ขาย + ซ่อม</option>
                    <option value="other">อื่นๆ</option>
                  </SelectInput>
                </Field>
                <Field label="ขนาดร้าน">
                  <SelectInput
                    Icon={UsersIcon}
                    value={form.shop_size}
                    onChange={(v) => update('shop_size', v)}
                  >
                    <option value="solo">เดี่ยว (1 คน)</option>
                    <option value="small">เล็ก (2-4 คน)</option>
                    <option value="medium">กลาง (5-10 คน)</option>
                    <option value="large">ใหญ่ (10+ คน)</option>
                  </SelectInput>
                </Field>
              </div>

              {/* Branch + Current system */}
              <div className="reg-v3-grid-2">
                <Field label="จำนวนสาขา" required>
                  <SelectInput
                    Icon={Smartphone}
                    value={form.branch_count}
                    onChange={(v) => update('branch_count', v)}
                  >
                    <option value="1">1 สาขา</option>
                    <option value="2">2 สาขา</option>
                    <option value="3">3 สาขา</option>
                    <option value="5">5 สาขา</option>
                    <option value="10">10 สาขาขึ้นไป</option>
                  </SelectInput>
                </Field>
                <Field label="ระบบที่ใช้อยู่ปัจจุบัน">
                  <SelectInput
                    Icon={FileSpreadsheet}
                    value={form.current_system}
                    onChange={(v) => update('current_system', v)}
                  >
                    <option value="excel">Excel / Google Sheet</option>
                    <option value="paper">สมุดจด / กระดาษ</option>
                    <option value="line">LINE Note</option>
                    <option value="other_app">แอปอื่น</option>
                    <option value="none">ยังไม่มี</option>
                  </SelectInput>
                </Field>
              </div>

              {/* Terms */}
              <label style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                fontSize: 12,
                color: '#475569',
                cursor: 'pointer',
                marginTop: 4,
              }}>
                <input
                  type="checkbox"
                  checked={acceptTerms}
                  onChange={(e) => setAcceptTerms(e.target.checked)}
                  style={{
                    width: 16, height: 16,
                    accentColor: '#3b82f6',
                    cursor: 'pointer',
                    marginTop: 2,
                    flexShrink: 0,
                  }}
                />
                <span>
                  ฉันยอมรับ <a href="#" style={{ color: '#3b82f6', fontWeight: 600 }}>ข้อกำหนดการให้บริการ</a> และ <a href="#" style={{ color: '#3b82f6', fontWeight: 600 }}>นโยบายความเป็นส่วนตัว</a>
                </span>
              </label>

              {error && (
                <div className="reg-v3-error">
                  <AlertCircle size={15} /> {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="reg-v3-btn-primary"
              >
                {submitting ? (
                  <Loader2 size={17} className="v3-spin" />
                ) : (
                  <UserPlus size={17} strokeWidth={2.4} />
                )}
                {submitting ? 'กำลังสมัคร...' : 'สมัครสมาชิก'}
              </button>

              <div className="reg-v3-divider">
                <span>หรือ</span>
              </div>

              <button
                type="button"
                onClick={() => alert('ฟีเจอร์ Google Signup กำลังพัฒนา')}
                className="reg-v3-btn-google"
              >
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                สมัครด้วย Google
              </button>

              <div className="reg-v3-bottom reg-v3-mobile">
                มีบัญชีอยู่แล้ว?{' '}
                <Link href="/login" style={{ color: '#3b82f6', textDecoration: 'none', fontWeight: 700 }}>
                  เข้าสู่ระบบ →
                </Link>
              </div>

              <div className="reg-v3-trial reg-v3-desktop">
                <Shield size={14} color="#3b82f6" />
                <span>สมัครวันนี้ <strong>รับสิทธิ์ทดลองใช้งานฟรี 30 วัน</strong></span>
              </div>
            </form>
          </div>
        </div>
      </div>

      <style jsx>{styles}</style>
    </div>
  );
}

/* ===== styles ===== */
const styles = `
        .reg-v3 {
          min-height: 100vh;
          display: flex;
          background: linear-gradient(180deg, #f0f9ff 0%, #ffffff 60%);
        }
        .reg-v3-container {
          width: 100%;
          display: grid;
          grid-template-columns: 1fr;
        }
        .reg-v3-hero { display: none; }
        .reg-v3-mobile { display: block; }
        .reg-v3-desktop { display: none; }
        .reg-v3-formwrap {
          padding: 0;
          display: flex;
          justify-content: center;
        }
        .reg-v3-form {
          width: 100%;
          max-width: 100%;
          background: #fff;
          padding: 20px 20px 40px;
          min-height: 100vh;
        }
        .reg-v3-mobile-header {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          margin-bottom: 20px;
          padding-bottom: 16px;
          border-bottom: 1px solid #e2e8f0;
        }
        .reg-v3-back {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          background: #f1f5f9;
          color: #475569;
          display: flex;
          align-items: center;
          justify-content: center;
          text-decoration: none;
          flex-shrink: 0;
        }
        .reg-v3-mobile-illust {
          width: 78px;
          height: 78px;
          flex-shrink: 0;
        }
        .reg-v3-grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        .reg-v3-error {
          padding: 10px 12px;
          background: #fee2e2;
          color: #991b1b;
          border-radius: 10px;
          font-size: 12px;
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .reg-v3-btn-primary {
          padding: 14px;
          background: linear-gradient(135deg, #3b82f6, #2563eb);
          color: #fff;
          border: none;
          border-radius: 12px;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          font-family: inherit;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          box-shadow: 0 4px 16px rgba(59, 130, 246, 0.3);
        }
        .reg-v3-btn-primary:disabled {
          opacity: 0.7;
          cursor: wait;
        }
        .reg-v3-divider {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 11px;
          color: #94a3b8;
        }
        .reg-v3-divider::before,
        .reg-v3-divider::after {
          content: '';
          flex: 1;
          height: 1px;
          background: #e2e8f0;
        }
        .reg-v3-btn-google {
          padding: 12px;
          background: #fff;
          color: #1e293b;
          border: 1.5px solid #e2e8f0;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          font-family: inherit;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
        }
        .reg-v3-bottom {
          text-align: center;
          font-size: 13px;
          color: #64748b;
        }
        .reg-v3-trial {
          padding: 12px;
          background: #dbeafe;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-size: 12px;
          color: #1e40af;
          margin-top: 4px;
        }

        /* Success page */
        .reg-v3-success {
          max-width: 460px;
          background: #fff;
          padding: 40px 30px;
          border-radius: 24px;
          text-align: center;
          margin: 20px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.08);
        }
        .reg-v3-success-icon {
          width: 88px;
          height: 88px;
          margin: 0 auto 18px;
          background: linear-gradient(135deg, #22c55e, #16a34a);
          color: #fff;
          border-radius: 22px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 12px 32px rgba(34, 197, 94, 0.3);
        }
        .reg-v3-success-title {
          font-size: 22px;
          font-weight: 800;
          font-family: 'Prompt', sans-serif;
          margin-bottom: 8px;
        }
        .reg-v3-success-text {
          font-size: 13px;
          color: #64748b;
          line-height: 1.7;
          margin-bottom: 16px;
        }
        .reg-v3-success-features {
          padding: 10px 14px;
          background: #fef3c7;
          border-radius: 100px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-weight: 700;
          color: #78350f;
        }

        @media (min-width: 1024px) {
          .reg-v3-mobile { display: none; }
          .reg-v3-desktop { display: block; }
          .reg-v3-container {
            grid-template-columns: 1fr 1.2fr;
            max-width: 1280px;
            margin: 0 auto;
            min-height: 100vh;
            align-items: stretch;
            padding: 24px;
            gap: 20px;
          }
          .reg-v3-hero {
            display: flex !important;
            flex-direction: column;
            padding: 32px;
            background: linear-gradient(180deg, #eff6ff 0%, #f0f9ff 100%);
            border-radius: 24px;
            overflow: hidden;
          }
          .reg-v3-brand-title {
            font-size: 24px;
            font-weight: 800;
            color: #1e293b;
            font-family: 'Prompt', sans-serif;
            letter-spacing: -0.5px;
            line-height: 1;
          }
          .reg-v3-brand-sub {
            font-size: 11px;
            color: #64748b;
            margin-top: 4px;
          }
          .reg-v3-badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 6px 12px;
            background: #dbeafe;
            color: #1e40af;
            border-radius: 100px;
            font-size: 12px;
            font-weight: 700;
            margin-bottom: 20px;
            margin-top: 24px;
            align-self: flex-start;
          }
          .reg-v3-h1 {
            font-size: 30px;
            font-weight: 800;
            color: #1e293b;
            font-family: 'Prompt', sans-serif;
            letter-spacing: -0.5px;
            line-height: 1.2;
            margin-bottom: 12px;
          }
          .reg-v3-sub {
            font-size: 13px;
            color: #64748b;
            line-height: 1.6;
            margin-bottom: 24px;
          }
          .reg-v3-features {
            display: flex;
            flex-direction: column;
            gap: 12px;
            margin-bottom: 24px;
          }
          .reg-v3-illust {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 12px 0;
            max-height: 260px;
          }
          .reg-v3-trust {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 12px;
            background: rgba(255,255,255,0.7);
            border-radius: 12px;
            margin-top: auto;
          }
          .reg-v3-form {
            max-width: 100%;
            width: 100%;
            border-radius: 24px;
            min-height: auto;
            padding: 32px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.08);
            align-self: center;
          }
          .reg-v3-form-header {
            display: flex !important;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 20px;
          }
        }
`;

/* ===== Components ===== */

function Field({ label, required, children }: any) {
  return (
    <div>
      <label style={{
        display: 'block',
        fontSize: 11,
        fontWeight: 600,
        color: '#475569',
        marginBottom: 5,
      }}>
        {label} {required && <span style={{ color: '#ef4444' }}>*</span>}
      </label>
      {children}
    </div>
  );
}

function Input({ Icon, value, onChange, placeholder, type = 'text' }: any) {
  return (
    <div style={{ position: 'relative' }}>
      <Icon size={16} style={{
        position: 'absolute',
        left: 12, top: '50%',
        transform: 'translateY(-50%)',
        color: '#94a3b8',
        pointerEvents: 'none',
      }} />
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%',
          height: 44,
          padding: '0 10px 0 38px',
          background: '#fff',
          border: '1.5px solid #e2e8f0',
          borderRadius: 10,
          color: '#1e293b',
          fontSize: 13,
          fontFamily: 'inherit',
          outline: 'none',
          boxSizing: 'border-box',
        }}
        onFocus={(e) => { e.target.style.borderColor = '#3b82f6'; e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)'; }}
        onBlur={(e) => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none'; }}
      />
    </div>
  );
}

function PasswordInput({ value, onChange, placeholder, show, onToggle }: any) {
  return (
    <div style={{ position: 'relative' }}>
      <Lock size={16} style={{
        position: 'absolute',
        left: 12, top: '50%',
        transform: 'translateY(-50%)',
        color: '#94a3b8',
        pointerEvents: 'none',
      }} />
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%',
          height: 44,
          padding: '0 38px 0 38px',
          background: '#fff',
          border: '1.5px solid #e2e8f0',
          borderRadius: 10,
          color: '#1e293b',
          fontSize: 13,
          fontFamily: 'inherit',
          outline: 'none',
          boxSizing: 'border-box',
        }}
        onFocus={(e) => { e.target.style.borderColor = '#3b82f6'; e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)'; }}
        onBlur={(e) => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none'; }}
      />
      <button
        type="button"
        onClick={onToggle}
        tabIndex={-1}
        style={{
          position: 'absolute',
          right: 6, top: '50%',
          transform: 'translateY(-50%)',
          width: 28, height: 28,
          background: 'transparent',
          border: 'none',
          color: '#94a3b8',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 6,
          padding: 0,
        }}
      >
        {show ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  );
}

function SelectInput({ Icon, value, onChange, children }: any) {
  return (
    <div style={{ position: 'relative' }}>
      <Icon size={15} style={{
        position: 'absolute',
        left: 12, top: '50%',
        transform: 'translateY(-50%)',
        color: '#94a3b8',
        pointerEvents: 'none',
      }} />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%',
          height: 44,
          padding: '0 28px 0 38px',
          background: '#fff',
          border: '1.5px solid #e2e8f0',
          borderRadius: 10,
          color: '#1e293b',
          fontSize: 13,
          fontFamily: 'inherit',
          outline: 'none',
          cursor: 'pointer',
          appearance: 'none',
          WebkitAppearance: 'none',
          backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2.5'><polyline points='6 9 12 15 18 9'/></svg>")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 10px center',
          boxSizing: 'border-box',
        }}
      >
        {children}
      </select>
    </div>
  );
}

function FeatureRow({ Icon, title, desc, color }: any) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
    }}>
      <div style={{
        width: 40, height: 40,
        borderRadius: 10,
        background: `${color}15`,
        color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Icon size={18} strokeWidth={2.2} />
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', fontFamily: 'Prompt, sans-serif' }}>
          {title}
        </div>
        <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
          {desc}
        </div>
      </div>
    </div>
  );
}

/* ===== Illustrations ===== */

function RegIllustration() {
  return (
    <svg viewBox="0 0 320 240" style={{ width: '100%', height: 'auto', maxHeight: 240 }}>
      <defs>
        <linearGradient id="r-box" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#60a5fa" />
          <stop offset="100%" stopColor="#1d4ed8" />
        </linearGradient>
      </defs>
      
      {/* Box with phone & tools */}
      <g transform="translate(60, 60)">
        <rect x="0" y="60" width="200" height="120" rx="10" fill="url(#r-box)" />
        <rect x="-5" y="55" width="210" height="10" rx="3" fill="#1e40af" />
        
        {/* Phone in box */}
        <rect x="40" y="20" width="60" height="100" rx="8" fill="#fff" stroke="#cbd5e1" strokeWidth="1.5" />
        <rect x="44" y="24" width="52" height="86" rx="4" fill="#0f172a" />
        <rect x="48" y="32" width="44" height="6" rx="2" fill="#3b82f6" opacity="0.7" />
        <circle cx="50" cy="50" r="6" fill="#3b82f6" />
        <rect x="60" y="46" width="32" height="3" rx="1" fill="#cbd5e1" />
        <rect x="60" y="52" width="20" height="2" rx="1" fill="#64748b" />
        
        {/* Tools */}
        <g transform="translate(115, 25)">
          {/* Wrench */}
          <path d="M0 0 L30 30 L36 24 L40 28 L34 34 L40 40 L34 46 L28 40 L24 36 L30 30" fill="#475569" />
          <path d="M-2 -8 L8 2 L4 6 L-6 -4 Z" fill="#64748b" />
          
          {/* Screwdriver */}
          <rect x="20" y="50" width="6" height="40" rx="1" fill="#3b82f6" />
          <rect x="18" y="86" width="10" height="14" rx="2" fill="#fbbf24" />
        </g>
      </g>

      {/* Small boxes */}
      <g transform="translate(40, 180)">
        <rect width="50" height="40" rx="3" fill="#fbbf24" />
        <rect y="18" width="50" height="3" fill="#fff" opacity="0.5" />
      </g>
      <g transform="translate(220, 180)">
        <rect width="40" height="30" rx="3" fill="#f97316" />
      </g>

      {/* Plant */}
      <g transform="translate(150, 200)">
        <rect x="0" y="20" width="20" height="16" rx="2" fill="#92400e" />
        <ellipse cx="5" cy="14" rx="4" ry="10" fill="#22c55e" transform="rotate(-20 5 14)" />
        <ellipse cx="10" cy="8" rx="5" ry="14" fill="#16a34a" />
        <ellipse cx="15" cy="14" rx="4" ry="10" fill="#22c55e" transform="rotate(20 15 14)" />
      </g>

      {/* Dots */}
      <circle cx="20" cy="40" r="3" fill="#dbeafe" />
      <circle cx="300" cy="60" r="3" fill="#bfdbfe" />
      <circle cx="290" cy="200" r="3" fill="#dbeafe" />
    </svg>
  );
}

function RegMobileIllust() {
  return (
    <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%' }}>
      <defs>
        <linearGradient id="rm-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#60a5fa" />
          <stop offset="100%" stopColor="#1d4ed8" />
        </linearGradient>
      </defs>
      <rect x="20" y="35" width="60" height="50" rx="6" fill="url(#rm-grad)" />
      <rect x="18" y="33" width="64" height="6" rx="2" fill="#1e40af" />
      <rect x="35" y="15" width="30" height="32" rx="4" fill="#fff" stroke="#cbd5e1" />
      <rect x="38" y="18" width="24" height="26" rx="2" fill="#0f172a" />
      <circle cx="50" cy="29" r="3" fill="#3b82f6" />
      <text x="68" y="20" fontSize="14" fill="#fbbf24">✨</text>
    </svg>
  );
}
