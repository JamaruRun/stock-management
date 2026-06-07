'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';
import { Lock, User, Eye, EyeOff, Shield, AlertCircle, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const cleanUsername = username.trim().toLowerCase();
    if (!cleanUsername || !password) {
      setError('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน');
      setLoading(false);
      return;
    }

    let emails: string[] = [];
    try {
      const res = await fetch('/api/auth/find-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cleanUsername }),
      });
      if (res.ok) {
        const data = await res.json();
        emails = data.emails || [];
      }
    } catch {}

    if (emails.length === 0) {
      emails = [`${cleanUsername}@example.com`, `${cleanUsername}@stock.local`];
    }

    let authData: any = null;
    for (const email of emails) {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (!signInError && data.user) { authData = data; break; }
    }

    if (!authData) {
      setError('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
      setLoading(false);
      return;
    }

    router.push('/v3/home');
    router.refresh();
  }

  return (
    <div style={page}>
      <div style={card}>
        {/* Logo */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14, position: 'relative' }}>
          <div style={{
            width: 84, height: 84, borderRadius: 20, background: '#eff6ff',
            display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
            boxShadow: '0 8px 20px rgba(59,130,246,0.18)',
          }}>
            <img src="/assets/auth/logo.webp" alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
          <div style={beta}>🎁 Beta ฟรี 30 วัน</div>
        </div>

        {/* Title */}
        <h1 style={{ textAlign: 'center', fontSize: 26, fontWeight: 800, fontFamily: 'Prompt, sans-serif', color: '#1e40af', letterSpacing: '-0.5px', margin: 0 }}>
          Stock Manager
        </h1>
        <p style={{ textAlign: 'center', fontSize: 13, color: '#64748b', margin: '6px 0 22px', lineHeight: 1.5 }}>
          ระบบจัดการร้านมือถือ + ร้านซ่อม<br />
          <strong style={{ color: '#3b82f6' }}>ครบ จบ ในระบบเดียว</strong>
        </p>

        {/* Form */}
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={label}>ชื่อผู้ใช้</label>
            <div style={{ position: 'relative' }}>
              <User size={18} style={icon} />
              <input
                type="text" value={username} autoComplete="username"
                onChange={(e) => setUsername(e.target.value)}
                placeholder="กรอกชื่อผู้ใช้" style={input}
                onFocus={(e) => focusOn(e)} onBlur={(e) => focusOff(e)}
              />
            </div>
          </div>

          <div>
            <label style={label}>รหัสผ่าน</label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} style={icon} />
              <input
                type={showPassword ? 'text' : 'password'} value={password} autoComplete="current-password"
                onChange={(e) => setPassword(e.target.value)}
                placeholder="กรอกรหัสผ่าน" style={{ ...input, paddingRight: 44 }}
                onFocus={(e) => focusOn(e)} onBlur={(e) => focusOff(e)}
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} style={eyeBtn} tabIndex={-1}>
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', color: '#475569' }}>
              <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} style={{ width: 15, height: 15, accentColor: '#3b82f6' }} />
              จดจำฉันไว้
            </label>
            <Link href="/forgot-password" style={{ color: '#3b82f6', textDecoration: 'none', fontWeight: 600 }}>ลืมรหัสผ่าน?</Link>
          </div>

          {error && (
            <div style={errBox}><AlertCircle size={15} /> {error}</div>
          )}

          <button type="submit" disabled={loading} style={primaryBtn}>
            {loading ? <Loader2 size={17} className="v3-spin" /> : <Shield size={17} strokeWidth={2.4} />}
            {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, color: '#94a3b8' }}>
            <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
            หรือ
            <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
          </div>

          <button type="button" onClick={() => alert('ฟีเจอร์ Google Login กำลังพัฒนา')} style={googleBtn}>
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            เข้าสู่ระบบด้วย Google
          </button>

          <div style={{ textAlign: 'center', fontSize: 13, color: '#64748b' }}>
            ยังไม่มีบัญชี?{' '}
            <Link href="/register" style={{ color: '#3b82f6', textDecoration: 'none', fontWeight: 700 }}>สมัครสมาชิก →</Link>
          </div>
        </form>

        <div style={{ textAlign: 'center', fontSize: 10, color: '#cbd5e1', marginTop: 18 }}>
          StockCare v3.9.79
        </div>
      </div>
    </div>
  );
}

function focusOn(e: React.FocusEvent<HTMLInputElement>) {
  e.target.style.borderColor = '#3b82f6';
  e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.12)';
}
function focusOff(e: React.FocusEvent<HTMLInputElement>) {
  e.target.style.borderColor = '#e2e8f0';
  e.target.style.boxShadow = 'none';
}

const page: React.CSSProperties = {
  minHeight: '100vh',
  width: '100%',
  maxWidth: '100vw',
  overflowX: 'hidden',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 16,
  background: 'linear-gradient(160deg, #eff6ff 0%, #f8fafc 100%)',
  boxSizing: 'border-box',
};
const card: React.CSSProperties = {
  width: '100%',
  maxWidth: 400,
  background: '#fff',
  borderRadius: 22,
  padding: '28px 22px',
  boxShadow: '0 16px 48px rgba(15,23,42,0.10)',
  boxSizing: 'border-box',
};
const beta: React.CSSProperties = {
  position: 'absolute',
  top: -4, right: 0,
  background: 'linear-gradient(135deg, #fcd34d, #f59e0b)',
  color: '#78350f',
  padding: '5px 11px',
  borderRadius: 100,
  fontSize: 10,
  fontWeight: 700,
  boxShadow: '0 4px 12px rgba(245,158,11,0.3)',
  whiteSpace: 'nowrap',
};
const label: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 7 };
const icon: React.CSSProperties = { position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' };
const input: React.CSSProperties = {
  width: '100%', height: 48, padding: '0 12px 0 44px', background: '#fff',
  border: '1.5px solid #e2e8f0', borderRadius: 12, color: '#1e293b',
  fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
};
const eyeBtn: React.CSSProperties = {
  position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
  width: 32, height: 32, background: 'transparent', border: 'none', color: '#94a3b8',
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, padding: 0,
};
const errBox: React.CSSProperties = {
  padding: '10px 12px', background: '#fee2e2', color: '#991b1b', borderRadius: 10,
  fontSize: 12, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6,
};
const primaryBtn: React.CSSProperties = {
  width: '100%', padding: 14, background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: '#fff',
  border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer',
  fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  boxShadow: '0 4px 16px rgba(59,130,246,0.3)', boxSizing: 'border-box',
};
const googleBtn: React.CSSProperties = {
  width: '100%', padding: 12, background: '#fff', color: '#1e293b', border: '1.5px solid #e2e8f0',
  borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, boxSizing: 'border-box',
};
