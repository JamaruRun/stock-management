'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';

export default function SignupBetaPage() {
  const router = useRouter();
  const supabase = createClient();
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    shop_name: '',
    contact_name: '',
    phone: '',
    line_id: '',
    province: '',
    business_type: 'mobile_shop',
    shop_size: 'small',
    branch_count: 1,
    current_system: 'excel',
    username: '',
    password: '',
    note: '',
  });

  function update(key: string, value: any) {
    setForm({ ...form, [key]: value });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (form.username.length < 3) {
      setError('Username ต้องมีอย่างน้อย 3 ตัวอักษร');
      return;
    }
    if (!/^[a-z0-9_]+$/.test(form.username)) {
      setError('Username ใช้ได้แค่ a-z, 0-9, _ เท่านั้น (ตัวเล็ก)');
      return;
    }
    if (form.password.length < 6) {
      setError('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
      return;
    }
    if (!/^[0-9]{9,10}$/.test(form.phone.replace(/[-\s]/g, ''))) {
      setError('เบอร์โทรไม่ถูกต้อง (9-10 หลัก)');
      return;
    }

    setSubmitting(true);
    const { error: insertError } = await supabase
      .from('beta_signups')
      .insert({
        shop_name: form.shop_name.trim(),
        contact_name: form.contact_name.trim(),
        phone: form.phone.replace(/[-\s]/g, ''),
        line_id: form.line_id.trim() || null,
        province: form.province.trim() || null,
        business_type: form.business_type,
        shop_size: form.shop_size,
        branch_count: form.branch_count,
        current_system: form.current_system,
        username: form.username.trim().toLowerCase(),
        password_hash: form.password,
        note: form.note.trim() || null,
        status: 'pending',
      });

    setSubmitting(false);
    if (insertError) {
      setError('เกิดข้อผิดพลาด: ' + insertError.message);
      return;
    }
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="signup-page">
        <div className="signup-bg" />
        <div className="signup-container" style={{ maxWidth: 520 }}>
          <div className="signup-card" style={{ textAlign: 'center', padding: 40 }}>
            <div style={{
              width: 90, height: 90,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
              fontSize: 44,
              color: '#fff',
              boxShadow: '0 8px 24px rgba(16,185,129,0.3)',
            }}>✓</div>
            <h1 style={{ fontSize: 26, margin: '0 0 8px', color: '#111827', fontWeight: 700 }}>
              ส่งคำขอเรียบร้อย!
            </h1>
            <p style={{ color: '#6b7280', marginBottom: 24, lineHeight: 1.6 }}>
              เราจะติดต่อกลับภายใน <strong style={{ color: '#3b82f6' }}>24 ชั่วโมง</strong> ผ่านเบอร์ที่ให้ไว้<br />
              ขอบคุณที่สนใจระบบ Stock Manager
            </p>
            <div style={{
              padding: 14,
              background: '#f0f9ff',
              borderRadius: 10,
              fontSize: 13,
              color: '#1e40af',
              textAlign: 'left',
              marginBottom: 20,
            }}>
              <strong>💡 ขั้นตอนต่อไป:</strong>
              <ul style={{ margin: '8px 0 0', paddingLeft: 18, lineHeight: 1.7 }}>
                <li>เราจะโทรหาคุณภายใน 24 ชั่วโมง</li>
                <li>เซ็ตอัพระบบให้ + สอนการใช้งานเบื้องต้น</li>
                <li>ทดลองใช้ฟรี 30 วัน ไม่มีค่าใช้จ่ายล่วงหน้า</li>
              </ul>
            </div>
            <button
              onClick={() => router.push('/login')}
              className="signup-btn-primary"
            >ไปหน้า Login</button>
          </div>
        </div>
        <style>{styles}</style>
      </div>
    );
  }

  return (
    <div className="signup-page">
      <div className="signup-bg" />
      
      <div className="signup-container">
        {/* Hero */}
        <div className="signup-hero">
          <img src="/icon-192.png" alt="Stock Manager" className="signup-logo" />
          <div className="signup-badge">🎁 BETA — ฟรี 30 วัน</div>
          <h1 className="signup-title">Stock Manager</h1>
          <p className="signup-subtitle">
            ระบบจัดการร้านมือถือ + ร้านซ่อม <br/>
            <span style={{ color: '#3b82f6', fontWeight: 600 }}>ครบวงจร ใช้งานง่าย</span>
          </p>

          {/* Features */}
          <div className="signup-features">
            <Feature icon="📱" label="สต๊อกเครื่อง" />
            <Feature icon="💰" label="จำนำ" />
            <Feature icon="💳" label="ผ่อน" />
            <Feature icon="🎒" label="ขายของ" />
            <Feature icon="🔧" label="อะไหล่ซ่อม" />
            <Feature icon="🛠️" label="ใบงานซ่อม" />
            <Feature icon="📊" label="รายงาน" />
            <Feature icon="💬" label="LINE Notify" />
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="signup-card">
          <div className="signup-card-header">
            <h2 style={{ margin: 0, fontSize: 22, color: '#111827' }}>
              📝 สมัครทดลองใช้
            </h2>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: '#6b7280' }}>
              กรอกข้อมูลด้านล่าง — เราจะติดต่อกลับใน 24 ชม.
            </p>
          </div>

          {error && (
            <div className="signup-error">
              <span>⚠️</span> {error}
            </div>
          )}

          {/* Section: ข้อมูลร้าน */}
          <Section title="🏪 ข้อมูลร้าน">
            <Field label="ชื่อร้าน" required>
              <input
                type="text"
                value={form.shop_name}
                onChange={(e) => update('shop_name', e.target.value)}
                placeholder="เช่น โฟนช็อปสยาม"
                required
              />
            </Field>

            <div className="signup-row">
              <Field label="ประเภทธุรกิจ">
                <select
                  value={form.business_type}
                  onChange={(e) => update('business_type', e.target.value)}
                >
                  <option value="mobile_shop">ร้านขายมือถือ</option>
                  <option value="repair_shop">ร้านซ่อมมือถือ</option>
                  <option value="both">ขาย + ซ่อม</option>
                  <option value="other">อื่นๆ</option>
                </select>
              </Field>

              <Field label="ขนาดร้าน">
                <select
                  value={form.shop_size}
                  onChange={(e) => update('shop_size', e.target.value)}
                >
                  <option value="solo">เจ้าของคนเดียว</option>
                  <option value="small">เล็ก (2-4 คน)</option>
                  <option value="medium">กลาง (5-10 คน)</option>
                  <option value="large">ใหญ่ (10+ คน)</option>
                </select>
              </Field>
            </div>

            <div className="signup-row">
              <Field label="จำนวนสาขา">
                <input
                  type="number"
                  value={form.branch_count}
                  onChange={(e) => update('branch_count', parseInt(e.target.value) || 1)}
                  min="1"
                />
              </Field>

              <Field label="ระบบที่ใช้ปัจจุบัน">
                <select
                  value={form.current_system}
                  onChange={(e) => update('current_system', e.target.value)}
                >
                  <option value="none">ยังไม่มี / จดมือ</option>
                  <option value="excel">Excel / Google Sheet</option>
                  <option value="other_app">แอปอื่น</option>
                  <option value="other">อื่นๆ</option>
                </select>
              </Field>
            </div>

            <Field label="จังหวัด">
              <input
                type="text"
                value={form.province}
                onChange={(e) => update('province', e.target.value)}
                placeholder="กรุงเทพ, เชียงใหม่, ..."
              />
            </Field>
          </Section>

          {/* Section: ติดต่อ */}
          <Section title="📞 ข้อมูลผู้ติดต่อ">
            <Field label="ชื่อ-นามสกุล" required>
              <input
                type="text"
                value={form.contact_name}
                onChange={(e) => update('contact_name', e.target.value)}
                placeholder="ชื่อจริง นามสกุล"
                required
              />
            </Field>

            <div className="signup-row">
              <Field label="เบอร์โทร" required>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => update('phone', e.target.value)}
                  placeholder="0812345678"
                  inputMode="numeric"
                  required
                />
              </Field>

              <Field label="LINE ID (ถ้ามี)">
                <input
                  type="text"
                  value={form.line_id}
                  onChange={(e) => update('line_id', e.target.value)}
                  placeholder="@yourline"
                />
              </Field>
            </div>
          </Section>

          {/* Section: บัญชี */}
          <Section title="🔐 บัญชีเข้าระบบ">
            <Field label="Username" required hint="a-z, 0-9, _ — อย่างน้อย 3 ตัว">
              <input
                type="text"
                value={form.username}
                onChange={(e) => update('username', e.target.value.toLowerCase())}
                placeholder="myusername"
                required
                style={{ textTransform: 'lowercase' }}
              />
            </Field>

            <Field label="รหัสผ่าน" required hint="อย่างน้อย 6 ตัวอักษร">
              <input
                type="password"
                value={form.password}
                onChange={(e) => update('password', e.target.value)}
                placeholder="••••••••"
                required
              />
            </Field>
          </Section>

          {/* Note */}
          <Section title="💬 ข้อความเพิ่มเติม (ไม่บังคับ)">
            <textarea
              value={form.note}
              onChange={(e) => update('note', e.target.value)}
              placeholder="อะไรที่อยากให้รู้ก่อน เช่น: เปิดร้านมา 5 ปี ใช้ Excel มีปัญหา"
              rows={3}
            />
          </Section>

          {/* Trust */}
          <div className="signup-trust">
            <TrustItem icon="🎁" text="ฟรี 30 วัน — ไม่ใช้บัตรเครดิต" />
            <TrustItem icon="⚡" text="เริ่มใช้งานได้ใน 24 ชม." />
            <TrustItem icon="🇹🇭" text="ทีมไทย — ช่วยตั้งระบบให้" />
          </div>

          <button type="submit" disabled={submitting} className="signup-btn-primary">
            {submitting ? '⏳ กำลังส่ง...' : '🚀 สมัครทดลองใช้ฟรี'}
          </button>

          <div style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: '#9ca3af' }}>
            มีบัญชีอยู่แล้ว? <a href="/login" style={{ color: '#3b82f6', fontWeight: 600 }}>เข้าสู่ระบบ</a>
          </div>
        </form>

        {/* Footer */}
        <div className="signup-footer">
          <img src="/icon-192.png" alt="" style={{ width: 28, height: 28, borderRadius: 6, opacity: 0.8 }} />
          <div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>Stock Manager</div>
            <div style={{ fontSize: 11, opacity: 0.7 }}>© 2026 • Made in 🇹🇭 with ❤️</div>
          </div>
        </div>
      </div>

      <style>{styles}</style>
    </div>
  );
}

function Feature({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="signup-feature">
      <div className="signup-feature-icon">{icon}</div>
      <div className="signup-feature-label">{label}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="signup-section">
      <h3 className="signup-section-title">{title}</h3>
      <div className="signup-section-body">{children}</div>
    </div>
  );
}

function Field({ 
  label, 
  required, 
  hint, 
  children 
}: { 
  label: string; 
  required?: boolean; 
  hint?: string; 
  children: React.ReactNode;
}) {
  return (
    <div className="signup-field">
      <label>
        {label}
        {required && <span style={{ color: '#ef4444' }}> *</span>}
      </label>
      {children}
      {hint && <small>{hint}</small>}
    </div>
  );
}

function TrustItem({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="signup-trust-item">
      <span style={{ fontSize: 18 }}>{icon}</span>
      <span>{text}</span>
    </div>
  );
}

const styles = `
.signup-page {
  min-height: 100vh;
  position: relative;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans Thai', sans-serif;
  background: #f8fafc;
  padding: 16px 12px 40px;
  color: #111827;
}

.signup-bg {
  position: fixed;
  inset: 0;
  background: 
    radial-gradient(ellipse at top, rgba(59, 130, 246, 0.08) 0%, transparent 50%),
    radial-gradient(ellipse at bottom right, rgba(139, 92, 246, 0.06) 0%, transparent 50%);
  pointer-events: none;
  z-index: 0;
}

.signup-container {
  position: relative;
  z-index: 1;
  max-width: 580px;
  margin: 0 auto;
}

.signup-hero {
  text-align: center;
  padding: 24px 12px 28px;
}

.signup-logo {
  width: 96px;
  height: 96px;
  border-radius: 22px;
  box-shadow: 0 12px 28px rgba(59, 130, 246, 0.25);
  animation: float 3s ease-in-out infinite;
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
}

.signup-badge {
  display: inline-block;
  padding: 6px 14px;
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  color: #92400e;
  border-radius: 100px;
  font-size: 11px;
  font-weight: 700;
  margin: 18px 0 12px;
  letter-spacing: 0.5px;
  box-shadow: 0 2px 8px rgba(251, 191, 36, 0.25);
}

.signup-title {
  font-size: 36px;
  font-weight: 800;
  margin: 0 0 8px;
  background: linear-gradient(135deg, #3b82f6 0%, #6d28d9 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  letter-spacing: -0.5px;
}

.signup-subtitle {
  font-size: 15px;
  color: #6b7280;
  margin: 0 0 24px;
  line-height: 1.6;
}

.signup-features {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin: 8px 0;
}

@media (max-width: 480px) {
  .signup-features {
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
  }
}

.signup-feature {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 12px 6px;
  text-align: center;
  transition: all 0.2s;
}

.signup-feature:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0,0,0,0.06);
  border-color: #3b82f6;
}

.signup-feature-icon {
  font-size: 22px;
  margin-bottom: 4px;
}

.signup-feature-label {
  font-size: 10px;
  color: #6b7280;
  font-weight: 500;
}

.signup-card {
  background: white;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 4px 24px rgba(0,0,0,0.06);
  border: 1px solid #e5e7eb;
}

.signup-card-header {
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid #f3f4f6;
}

.signup-error {
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #991b1b;
  padding: 12px 14px;
  border-radius: 8px;
  margin-bottom: 16px;
  font-size: 13px;
  display: flex;
  gap: 8px;
  align-items: flex-start;
}

.signup-section {
  margin-bottom: 22px;
}

.signup-section-title {
  font-size: 13px;
  font-weight: 700;
  color: #6b7280;
  margin: 0 0 10px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.signup-section-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.signup-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

@media (max-width: 480px) {
  .signup-row { grid-template-columns: 1fr; }
}

.signup-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.signup-field label {
  font-size: 12px;
  color: #374151;
  font-weight: 600;
}

.signup-field input,
.signup-field select,
.signup-field textarea,
.signup-section-body textarea {
  width: 100%;
  padding: 11px 12px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 14px;
  font-family: inherit;
  color: #111827;
  transition: all 0.15s;
  box-sizing: border-box;
}

.signup-field input:focus,
.signup-field select:focus,
.signup-field textarea:focus,
.signup-section-body textarea:focus {
  outline: none;
  border-color: #3b82f6;
  background: white;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.signup-section-body textarea {
  resize: vertical;
  font-family: inherit;
}

.signup-field small {
  font-size: 11px;
  color: #9ca3af;
  margin-top: 2px;
}

.signup-trust {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px;
  background: #f0f9ff;
  border-radius: 10px;
  margin: 16px 0;
}

.signup-trust-item {
  display: flex;
  gap: 10px;
  align-items: center;
  font-size: 13px;
  color: #1e40af;
}

.signup-btn-primary {
  width: 100%;
  padding: 14px;
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.2s;
  box-shadow: 0 4px 14px rgba(59, 130, 246, 0.3);
}

.signup-btn-primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(59, 130, 246, 0.4);
}

.signup-btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.signup-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-top: 28px;
  padding: 16px;
  color: #6b7280;
  text-align: left;
}
`;
