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

    // Validate
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
        password_hash: form.password, // เก็บ plain - admin จะใช้สร้าง account
        note: form.note.trim() || null,
        status: 'pending',
      });

    setSubmitting(false);

    if (insertError) {
      setError('เกิดข้อผิดพลาด: ' + insertError.message);
      return;
    }

    setSubmitted(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (submitted) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}>
        <div style={{
          maxWidth: 480,
          width: '100%',
          background: 'var(--surface)',
          borderRadius: 16,
          padding: 32,
          textAlign: 'center',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}>
          <div style={{ fontSize: 72, marginBottom: 16 }}>🎉</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>
            สมัครสำเร็จแล้ว!
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-dim)', lineHeight: 1.7, marginBottom: 20 }}>
            ทีมงานจะตรวจสอบและติดต่อกลับภายใน <strong style={{ color: 'var(--accent)' }}>24-48 ชั่วโมง</strong>
            <br/>ทาง:
          </p>
          <div style={{
            padding: 16,
            background: 'var(--surface-2)',
            borderRadius: 8,
            marginBottom: 20,
            textAlign: 'left',
            fontSize: 13,
          }}>
            📞 <strong>โทรศัพท์:</strong> {form.phone}<br/>
            {form.line_id && <>💬 <strong>LINE:</strong> {form.line_id}<br/></>}
            👤 <strong>Username:</strong> {form.username}
          </div>
          <div style={{
            padding: 12,
            background: 'rgba(16, 185, 129, 0.08)',
            borderLeft: '3px solid #10b981',
            borderRadius: 4,
            fontSize: 12,
            color: 'var(--text-dim)',
            marginBottom: 20,
            textAlign: 'left',
            lineHeight: 1.6,
          }}>
            💡 <strong>ขั้นต่อไป:</strong>
            <ol style={{ marginLeft: 18, marginTop: 6 }}>
              <li>รอทีมงานตรวจสอบ (24-48 ชม.)</li>
              <li>ทีมจะติดต่อกลับเพื่อยืนยันตัวตน</li>
              <li>เมื่อ approve แล้ว → เข้าใช้งานได้ทันที</li>
              <li>ใช้ฟรี 30 วัน ไม่มีค่าใช้จ่าย</li>
            </ol>
          </div>
          <button
            onClick={() => router.push('/login')}
            style={{
              width: '100%',
              padding: 14,
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            ไปหน้า Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '20px 12px',
    }}>
      <div style={{ maxWidth: 540, margin: '0 auto' }}>
        {/* Header Hero */}
        <div style={{ textAlign: 'center', marginBottom: 24, color: '#fff' }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🏪</div>
          <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 6 }}>
            Stock Manager - Beta
          </h1>
          <p style={{ fontSize: 14, opacity: 0.9 }}>
            ระบบจัดการร้านมือถือ • <strong>ทดลองฟรี 30 วัน</strong>
          </p>
        </div>

        {/* Benefits */}
        <div style={{
          background: 'rgba(255,255,255,0.95)',
          backdropFilter: 'blur(10px)',
          borderRadius: 12,
          padding: 16,
          marginBottom: 16,
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
            <div>✅ สต๊อกเครื่อง + IMEI</div>
            <div>✅ จำนำ + ต่อดอก</div>
            <div>✅ ผ่อนเครื่อง</div>
            <div>✅ ใบเสร็จ PDF</div>
            <div>✅ รายงานยอดขาย</div>
            <div>✅ LINE แจ้งเตือน</div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{
          background: 'var(--surface)',
          borderRadius: 12,
          padding: 20,
          boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
        }}>
          {error && (
            <div style={{
              padding: 12,
              background: 'rgba(255, 71, 87, 0.1)',
              border: '1px solid #ff4757',
              borderRadius: 6,
              color: '#ff4757',
              fontSize: 13,
              marginBottom: 14,
            }}>
              ⚠️ {error}
            </div>
          )}

          {/* Section: ข้อมูลร้าน */}
          <div style={{ marginBottom: 18 }}>
            <h3 style={{ fontSize: 14, marginBottom: 10, color: 'var(--accent)' }}>
              🏪 ข้อมูลร้าน
            </h3>

            <Field label="ชื่อร้าน" required>
              <input
                type="text"
                value={form.shop_name}
                onChange={(e) => update('shop_name', e.target.value)}
                required
                placeholder="เช่น มือถือนายเอ"
                style={inputStyle}
              />
            </Field>

            <Field label="จังหวัด">
              <input
                type="text"
                value={form.province}
                onChange={(e) => update('province', e.target.value)}
                placeholder="เช่น เชียงใหม่"
                style={inputStyle}
              />
            </Field>

            <Field label="ขนาดร้าน">
              <select
                value={form.shop_size}
                onChange={(e) => update('shop_size', e.target.value)}
                style={inputStyle}
              >
                <option value="small">เล็ก (1-50 เครื่อง/เดือน)</option>
                <option value="medium">กลาง (50-200 เครื่อง/เดือน)</option>
                <option value="large">ใหญ่ (200+ เครื่อง/เดือน)</option>
              </select>
            </Field>

            <Field label="จำนวนสาขา">
              <select
                value={form.branch_count}
                onChange={(e) => update('branch_count', parseInt(e.target.value))}
                style={inputStyle}
              >
                <option value={1}>1 สาขา</option>
                <option value={2}>2 สาขา</option>
                <option value={3}>3 สาขา</option>
                <option value={5}>4-5 สาขา</option>
                <option value={10}>มากกว่า 5 สาขา</option>
              </select>
            </Field>

            <Field label="ปัจจุบันใช้อะไรจัดการสต๊อก">
              <select
                value={form.current_system}
                onChange={(e) => update('current_system', e.target.value)}
                style={inputStyle}
              >
                <option value="paper">📝 สมุดจด/กระดาษ</option>
                <option value="excel">📊 Excel / Google Sheets</option>
                <option value="other_software">💻 ระบบอื่น</option>
                <option value="none">❌ ยังไม่มีระบบ</option>
              </select>
            </Field>
          </div>

          {/* Section: ติดต่อ */}
          <div style={{ marginBottom: 18 }}>
            <h3 style={{ fontSize: 14, marginBottom: 10, color: 'var(--accent)' }}>
              📞 ข้อมูลติดต่อ
            </h3>

            <Field label="ชื่อ-นามสกุล (เจ้าของร้าน)" required>
              <input
                type="text"
                value={form.contact_name}
                onChange={(e) => update('contact_name', e.target.value)}
                required
                placeholder="ชื่อจริง นามสกุลจริง"
                style={inputStyle}
              />
            </Field>

            <Field label="เบอร์โทร" required>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => update('phone', e.target.value)}
                required
                placeholder="0812345678"
                inputMode="numeric"
                style={inputStyle}
              />
            </Field>

            <Field label="LINE ID (ถ้ามี)">
              <input
                type="text"
                value={form.line_id}
                onChange={(e) => update('line_id', e.target.value)}
                placeholder="@yourlineid"
                style={inputStyle}
              />
            </Field>
          </div>

          {/* Section: สร้าง account */}
          <div style={{ marginBottom: 18 }}>
            <h3 style={{ fontSize: 14, marginBottom: 10, color: 'var(--accent)' }}>
              🔐 สร้างบัญชี
            </h3>

            <Field label="Username (สำหรับ login)" required>
              <input
                type="text"
                value={form.username}
                onChange={(e) => update('username', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                required
                placeholder="ใช้ a-z, 0-9, _ เท่านั้น"
                style={{ ...inputStyle, fontFamily: 'JetBrains Mono, monospace' }}
                minLength={3}
                maxLength={20}
              />
              <small style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                💡 จำให้ดี - ใช้ login เข้าระบบ
              </small>
            </Field>

            <Field label="Password" required>
              <input
                type="password"
                value={form.password}
                onChange={(e) => update('password', e.target.value)}
                required
                placeholder="อย่างน้อย 6 ตัวอักษร"
                style={inputStyle}
                minLength={6}
              />
            </Field>
          </div>

          {/* Note */}
          <Field label="หมายเหตุ (ถ้ามี)">
            <textarea
              value={form.note}
              onChange={(e) => update('note', e.target.value)}
              placeholder="คำถาม / ความต้องการพิเศษ"
              rows={3}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </Field>

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            style={{
              width: '100%',
              padding: 14,
              background: submitting ? 'var(--text-dim)' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              cursor: submitting ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
              fontSize: 15,
              fontWeight: 700,
              marginTop: 8,
            }}
          >
            {submitting ? 'กำลังส่งคำขอ...' : '🚀 สมัคร Beta ฟรี 30 วัน'}
          </button>

          <p style={{ 
            fontSize: 11, 
            color: 'var(--text-dim)', 
            textAlign: 'center', 
            marginTop: 12,
            lineHeight: 1.6,
          }}>
            💡 ทีมงานจะตรวจสอบและติดต่อกลับใน 24-48 ชม.
            <br/>
            <a 
              href="/login" 
              style={{ color: 'var(--accent)', textDecoration: 'none' }}
            >
              มีบัญชีอยู่แล้ว? เข้าสู่ระบบ
            </a>
          </p>
        </form>

        <div style={{ 
          textAlign: 'center', 
          marginTop: 16, 
          fontSize: 11, 
          color: 'rgba(255,255,255,0.7)',
        }}>
          © 2026 Stock Manager
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: 12,
  fontSize: 14,
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  color: 'var(--text)',
  fontFamily: 'inherit',
};

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ 
        display: 'block', 
        fontSize: 12, 
        fontWeight: 600, 
        marginBottom: 4, 
        color: 'var(--text)',
      }}>
        {label} {required && <span style={{ color: '#ff4757' }}>*</span>}
      </label>
      {children}
    </div>
  );
}
