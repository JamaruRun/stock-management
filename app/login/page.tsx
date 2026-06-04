'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';
import {
  Lock, User, Eye, EyeOff, Shield, ShoppingBag,
  AlertCircle, Loader2, Wrench, BarChart3,
} from 'lucide-react';

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
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (!signInError && data.user) {
        authData = data;
        break;
      }
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
    <div className="login-v3">
      {/* Desktop: split layout; Mobile: stack */}
      <div className="login-v3-container">
        {/* LEFT: Hero (desktop only) */}
        <div className="login-v3-hero login-v3-desktop">
          <div className="login-v3-hero-inner">
            {/* Logo + brand */}
            <div className="login-v3-brand">
              <div className="login-v3-brand-icon">
                <img src="/icon-192.png" alt="" style={{ width: 56, height: 56, borderRadius: 12 }} />
              </div>
              <div>
                <div className="login-v3-brand-title">STOCK <span style={{ color: '#3b82f6' }}>MANAGER</span></div>
                <div className="login-v3-brand-sub">Inventory & Stock Control System</div>
              </div>
            </div>

            <h1 className="login-v3-h1">
              จัดการสต็อกสินค้า<br />
              <span style={{ color: '#3b82f6' }}>ง่าย ครบ จบในระบบเดียว</span>
            </h1>
            <p className="login-v3-sub">
              ระบบบริหารจัดการสต็อกสินค้า + ร้านซ่อมมือถือ<br />
              ช่วยให้ธุรกิจของคุณทำงานได้อย่างมีประสิทธิภาพ
            </p>

            {/* Hero illustration SVG */}
            <div className="login-v3-illust">
              <HeroIllustration />
            </div>

            {/* Features 4 icons */}
            <div className="login-v3-features">
              <FeatureItem Icon={ShoppingBag} title="จัดการสต็อก" desc="แม่นยำ ทันสมัย" />
              <FeatureItem Icon={Wrench} title="ร้านซ่อมมือถือ" desc="ครบทุกฟังก์ชัน" />
              <FeatureItem Icon={BarChart3} title="รายงานละเอียด" desc="วิเคราะห์ธุรกิจ" />
              <FeatureItem Icon={Shield} title="ปลอดภัยสูง" desc="ข้อมูลไม่รั่วไหล" />
            </div>
          </div>
        </div>

        {/* RIGHT: Form */}
        <div className="login-v3-formwrap">
          <div className="login-v3-form">
            {/* Mobile hero (small) */}
            <div className="login-v3-mobile-hero login-v3-mobile">
              <div className="login-v3-beta-badge">
                🎁 Beta ฟรี 30 วัน
              </div>
              <div className="login-v3-mobile-illust">
                <HeroMobile />
              </div>
              <div className="login-v3-mobile-title">
                Stock Manager
              </div>
              <div className="login-v3-mobile-sub">
                ระบบจัดการร้านมือถือ + ร้านซ่อม<br />
                <strong style={{ color: '#3b82f6' }}>ครบ จบ ในระบบเดียว</strong>
              </div>
            </div>

            {/* Desktop title */}
            <div className="login-v3-desktop" style={{ textAlign: 'center', marginBottom: 24 }}>
              <div className="login-v3-form-logo">
                <img src="/icon-192.png" alt="" style={{ width: 72, height: 72, borderRadius: 16, boxShadow: '0 8px 20px rgba(59, 130, 246, 0.25)' }} />
              </div>
              <div className="login-v3-form-brand">STOCK <span style={{ color: '#3b82f6' }}>MANAGER</span></div>
              <div className="login-v3-form-brand-sub">Inventory & Stock Control System</div>
              <h2 className="login-v3-form-title">เข้าสู่ระบบ</h2>
              <div className="login-v3-form-subtitle">ระบบจัดการสต็อกร้านมือถือ + ร้านซ่อม</div>
            </div>

            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={loginLabelStyle}>ชื่อผู้ใช้</label>
                <div style={loginInputWrapStyle}>
                  <User size={18} style={loginInputIconStyle} />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="กรอกชื่อผู้ใช้"
                    autoComplete="username"
                    style={loginInputStyle}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#3b82f6';
                      e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#e2e8f0';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={loginLabelStyle}>รหัสผ่าน</label>
                <div style={loginInputWrapStyle}>
                  <Lock size={18} style={loginInputIconStyle} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="กรอกรหัสผ่าน"
                    autoComplete="current-password"
                    style={{ ...loginInputStyle, paddingRight: 44 }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#3b82f6';
                      e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#e2e8f0';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={loginEyeBtnStyle}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>

              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: 13,
              }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    style={{
                      width: 16, height: 16,
                      accentColor: '#3b82f6',
                      cursor: 'pointer',
                    }}
                  />
                  <span style={{ color: '#475569' }}>จดจำฉันไว้ในระบบ</span>
                </label>
                <Link href="/forgot-password" style={{ color: '#3b82f6', textDecoration: 'none', fontWeight: 600 }}>
                  ลืมรหัสผ่าน?
                </Link>
              </div>

              {error && (
                <div className="login-v3-error">
                  <AlertCircle size={15} /> {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="login-v3-btn-primary"
              >
                {loading ? (
                  <Loader2 size={17} className="v3-spin" />
                ) : (
                  <Shield size={17} strokeWidth={2.4} />
                )}
                {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
              </button>

              <div className="login-v3-divider">
                <span>หรือ</span>
              </div>

              <button
                type="button"
                onClick={() => alert('ฟีเจอร์ Google Login กำลังพัฒนา\n\nกรุณาเข้าสู่ระบบด้วยชื่อผู้ใช้และรหัสผ่านก่อน')}
                className="login-v3-btn-google"
              >
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                เข้าสู่ระบบด้วย Google
              </button>

              <div className="login-v3-bottom">
                ยังไม่มีบัญชี?{' '}
                <Link href="/register" style={{ color: '#3b82f6', textDecoration: 'none', fontWeight: 700 }}>
                  สมัครสมาชิก →
                </Link>
              </div>
            </form>

            {/* Desktop footer */}
            <div className="login-v3-desktop login-v3-foot">
              <Shield size={13} style={{ display: 'inline', marginRight: 5, verticalAlign: '-2px' }} />
              ปลอดภัยด้วยระบบเข้ารหัสข้อมูล SSL 256-bit
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        body { background: #f8fafc; }
      `}</style>

      <style jsx>{`
        .login-v3 {
          min-height: 100vh;
          display: flex;
          background: linear-gradient(180deg, #f0f9ff 0%, #ffffff 60%);
        }
        .login-v3-container {
          width: 100%;
          display: grid;
          grid-template-columns: 1fr;
        }
        .login-v3-hero { display: none; }
        .login-v3-formwrap {
          padding: 0;
          display: flex;
          align-items: stretch;
          justify-content: center;
        }
        .login-v3-form {
          width: 100%;
          max-width: 100%;
          background: #fff;
          padding: 24px 20px 40px;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }
        .login-v3-mobile { display: block; }
        .login-v3-desktop { display: none; }
        .login-v3-mobile-hero {
          text-align: center;
          margin-bottom: 24px;
          position: relative;
        }
        .login-v3-beta-badge {
          position: absolute;
          top: 0;
          right: 4px;
          background: linear-gradient(135deg, #fcd34d, #f59e0b);
          color: #78350f;
          padding: 6px 12px;
          border-radius: 100px;
          font-size: 11px;
          font-weight: 700;
          box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
          z-index: 2;
        }
        .login-v3-mobile-illust {
          width: 200px;
          height: 200px;
          margin: 0 auto 12px;
        }
        .login-v3-mobile-title {
          font-size: 32px;
          font-weight: 800;
          color: #1e40af;
          font-family: 'Prompt', sans-serif;
          letter-spacing: -0.5px;
          line-height: 1;
        }
        .login-v3-mobile-sub {
          font-size: 14px;
          color: #64748b;
          margin-top: 8px;
          line-height: 1.5;
        }
        .login-v3-label,
        .login-v3-input,
        .login-v3-input-icon,
        .login-v3-input-wrap,
        .login-v3-eye {
          /* deprecated - using inline styles now */
        }
        .login-v3-error {
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
        .login-v3-btn-primary {
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
          transition: transform 0.15s, box-shadow 0.15s;
        }
        .login-v3-btn-primary:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(59, 130, 246, 0.4);
        }
        .login-v3-btn-primary:disabled {
          opacity: 0.7;
          cursor: wait;
        }
        .login-v3-divider {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 11px;
          color: #94a3b8;
        }
        .login-v3-divider::before,
        .login-v3-divider::after {
          content: '';
          flex: 1;
          height: 1px;
          background: #e2e8f0;
        }
        .login-v3-btn-google {
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
        .login-v3-btn-google:hover {
          background: #f8fafc;
          border-color: #cbd5e1;
        }
        .login-v3-bottom {
          text-align: center;
          font-size: 13px;
          color: #64748b;
          margin-top: 6px;
        }
        .login-v3-foot {
          text-align: center;
          font-size: 11px;
          color: #94a3b8;
          margin-top: auto;
          padding-top: 30px;
        }

        @media (min-width: 1024px) {
          .login-v3-mobile { display: none; }
          .login-v3-desktop { display: block; }
          .login-v3-container {
            grid-template-columns: 1fr 1fr;
            max-width: 1400px;
            margin: 0 auto;
            min-height: 100vh;
            align-items: center;
            padding: 32px;
            gap: 32px;
          }
          .login-v3-hero {
            display: block;
            padding: 40px;
            background: linear-gradient(180deg, #eff6ff 0%, #f0f9ff 100%);
            border-radius: 24px;
            min-height: 600px;
            position: relative;
            overflow: hidden;
          }
          .login-v3-hero-inner {
            position: relative;
            z-index: 2;
          }
          .login-v3-brand {
            display: flex;
            align-items: center;
            gap: 14px;
            margin-bottom: 30px;
          }
          .login-v3-brand-icon {
            display: flex;
          }
          .login-v3-brand-title {
            font-size: 26px;
            font-weight: 800;
            color: #1e293b;
            font-family: 'Prompt', sans-serif;
            letter-spacing: -0.5px;
            line-height: 1;
          }
          .login-v3-brand-sub {
            font-size: 12px;
            color: #64748b;
            margin-top: 4px;
          }
          .login-v3-h1 {
            font-size: 36px;
            font-weight: 800;
            color: #1e293b;
            font-family: 'Prompt', sans-serif;
            letter-spacing: -0.5px;
            line-height: 1.2;
            margin-bottom: 14px;
          }
          .login-v3-sub {
            font-size: 14px;
            color: #64748b;
            line-height: 1.6;
            margin-bottom: 24px;
          }
          .login-v3-illust {
            width: 100%;
            max-width: 500px;
            margin: 0 auto 30px;
          }
          .login-v3-features {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 12px;
          }
          .login-v3-formwrap {
            padding: 0;
          }
          .login-v3-form {
            max-width: 460px;
            border-radius: 24px;
            min-height: auto;
            padding: 40px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.08);
            justify-content: center;
          }
          .login-v3-form-logo {
            display: flex;
            justify-content: center;
            margin-bottom: 12px;
          }
          .login-v3-form-brand {
            font-size: 22px;
            font-weight: 800;
            color: #1e293b;
            font-family: 'Prompt', sans-serif;
            letter-spacing: -0.5px;
          }
          .login-v3-form-brand-sub {
            font-size: 11px;
            color: #64748b;
            margin-top: 4px;
            margin-bottom: 20px;
          }
          .login-v3-form-title {
            font-size: 30px;
            font-weight: 800;
            font-family: 'Prompt', sans-serif;
            color: #1e293b;
            margin-bottom: 6px;
          }
          .login-v3-form-subtitle {
            font-size: 13px;
            color: #64748b;
          }
        }
      `}</style>
    </div>
  );
}

function FeatureItem({ Icon, title, desc }: any) {
  return (
    <div style={{
      textAlign: 'center',
      padding: 12,
      background: '#fff',
      borderRadius: 12,
      border: '1px solid #e0e7ff',
    }}>
      <div style={{
        width: 36, height: 36,
        margin: '0 auto 8px',
        borderRadius: 10,
        background: '#dbeafe',
        color: '#3b82f6',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <Icon size={18} />
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#1e293b', fontFamily: 'Prompt, sans-serif' }}>
        {title}
      </div>
      <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>
        {desc}
      </div>
    </div>
  );
}

/* Inline styles - guaranteed to work */
const loginLabelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 600,
  color: '#475569',
  marginBottom: 8,
};

const loginInputWrapStyle: React.CSSProperties = {
  position: 'relative',
};

const loginInputIconStyle: React.CSSProperties = {
  position: 'absolute',
  left: 14,
  top: '50%',
  transform: 'translateY(-50%)',
  color: '#94a3b8',
  pointerEvents: 'none',
};

const loginInputStyle: React.CSSProperties = {
  width: '100%',
  height: 48,
  padding: '0 12px 0 44px',
  background: '#fff',
  border: '1.5px solid #e2e8f0',
  borderRadius: 12,
  color: '#1e293b',
  fontSize: 14,
  fontFamily: 'inherit',
  outline: 'none',
  boxSizing: 'border-box',
};

const loginEyeBtnStyle: React.CSSProperties = {
  position: 'absolute',
  right: 12,
  top: '50%',
  transform: 'translateY(-50%)',
  width: 32,
  height: 32,
  background: 'transparent',
  border: 'none',
  color: '#94a3b8',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 6,
  padding: 0,
};

/* SVG Hero - Desktop (laptop + phone with charts) */
function HeroIllustration() {
  return (
    <svg viewBox="0 0 500 360" style={{ width: '100%', height: 'auto' }}>
      <defs>
        <linearGradient id="lap-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#1d4ed8" />
        </linearGradient>
        <linearGradient id="box-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#bfdbfe" />
          <stop offset="100%" stopColor="#60a5fa" />
        </linearGradient>
      </defs>
      
      {/* Laptop */}
      <g>
        {/* Screen */}
        <rect x="80" y="80" width="280" height="180" rx="12" fill="#1e293b" />
        <rect x="90" y="90" width="260" height="160" rx="6" fill="#f1f5f9" />
        {/* Top bar */}
        <rect x="90" y="90" width="260" height="20" fill="#fff" />
        <circle cx="100" cy="100" r="3" fill="#cbd5e1" />
        {/* Cards */}
        <rect x="100" y="120" width="60" height="30" rx="4" fill="#dcfce7" />
        <text x="105" y="135" fontSize="10" fill="#16a34a" fontWeight="700">12,500</text>
        <rect x="170" y="120" width="60" height="30" rx="4" fill="#dbeafe" />
        <text x="175" y="135" fontSize="10" fill="#2563eb" fontWeight="700">8,250</text>
        <rect x="240" y="120" width="60" height="30" rx="4" fill="#fef3c7" />
        <text x="245" y="135" fontSize="10" fill="#d97706" fontWeight="700">2,350</text>
        {/* Chart */}
        <rect x="100" y="160" width="200" height="80" rx="4" fill="#fff" />
        <polyline points="105,225 130,205 155,215 180,190 205,195 230,170 255,180 285,165" fill="none" stroke="#3b82f6" strokeWidth="2" />
        <polyline points="105,235 130,225 155,230 180,215 205,220 230,210 255,215 285,205" fill="none" stroke="#22c55e" strokeWidth="2" strokeDasharray="2 2" />
        
        {/* Laptop base */}
        <path d="M70 260 L370 260 L390 280 L50 280 Z" fill="#cbd5e1" />
      </g>

      {/* Phone */}
      <g transform="translate(330, 140)">
        <rect width="80" height="140" rx="10" fill="#0f172a" />
        <rect x="4" y="4" width="72" height="132" rx="8" fill="#fff" />
        <rect x="10" y="18" width="60" height="20" rx="3" fill="#dbeafe" />
        <text x="15" y="32" fontSize="9" fill="#2563eb" fontWeight="700">฿12,500</text>
        <rect x="10" y="44" width="60" height="20" rx="3" fill="#dcfce7" />
        <text x="15" y="58" fontSize="9" fill="#16a34a" fontWeight="700">฿8,250</text>
        <polyline points="10,90 25,80 40,85 55,70 70,75" fill="none" stroke="#3b82f6" strokeWidth="1.5" />
      </g>

      {/* Boxes (left) */}
      <g transform="translate(20, 200)">
        <rect x="0" y="20" width="60" height="60" rx="4" fill="url(#box-grad)" />
        <rect x="10" y="40" width="40" height="3" fill="#fff" opacity="0.6" />
        <rect x="20" y="0" width="50" height="50" rx="4" fill="url(#box-grad)" opacity="0.9" />
      </g>
      <g transform="translate(420, 240)">
        <rect width="50" height="50" rx="4" fill="url(#box-grad)" />
        <rect x="5" y="20" width="40" height="3" fill="#fff" opacity="0.6" />
      </g>

      {/* Scanner */}
      <g transform="translate(200, 280)">
        <rect x="0" y="0" width="40" height="40" rx="6" fill="#475569" />
        <rect x="6" y="6" width="28" height="20" rx="2" fill="#1e293b" />
        <line x1="10" y1="11" x2="30" y2="11" stroke="#ef4444" strokeWidth="1" />
        <line x1="10" y1="15" x2="30" y2="15" stroke="#ef4444" strokeWidth="1" />
        <line x1="10" y1="19" x2="30" y2="19" stroke="#ef4444" strokeWidth="1" />
      </g>

      {/* Decoration dots */}
      <circle cx="40" cy="50" r="3" fill="#dbeafe" />
      <circle cx="460" cy="80" r="3" fill="#bfdbfe" />
      <circle cx="450" cy="320" r="3" fill="#dbeafe" />
    </svg>
  );
}

/* SVG Hero - Mobile (mascot + boxes) */
function HeroMobile() {
  return (
    <svg viewBox="0 0 200 200" style={{ width: '100%', height: '100%' }}>
      <defs>
        <linearGradient id="mascot-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#60a5fa" />
          <stop offset="100%" stopColor="#1d4ed8" />
        </linearGradient>
        <linearGradient id="box-m" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#bfdbfe" />
          <stop offset="100%" stopColor="#60a5fa" />
        </linearGradient>
      </defs>

      {/* Mascot (cute box character) */}
      <g transform="translate(60, 50)">
        {/* Body */}
        <rect x="0" y="20" width="80" height="70" rx="8" fill="url(#mascot-grad)" />
        {/* Lid */}
        <rect x="-4" y="14" width="88" height="10" rx="4" fill="#1e40af" />
        {/* Handle */}
        <rect x="32" y="0" width="16" height="18" rx="3" fill="none" stroke="#1e40af" strokeWidth="3" />
        {/* Face */}
        <circle cx="22" cy="50" r="5" fill="#fff" />
        <circle cx="22" cy="51" r="2.5" fill="#1e293b" />
        <circle cx="58" cy="50" r="5" fill="#fff" />
        <circle cx="58" cy="51" r="2.5" fill="#1e293b" />
        {/* Smile */}
        <path d="M28 68 Q40 78, 52 68" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
        {/* Cheek */}
        <circle cx="15" cy="62" r="3" fill="#f87171" opacity="0.6" />
        <circle cx="65" cy="62" r="3" fill="#f87171" opacity="0.6" />
      </g>

      {/* Boxes around */}
      <g transform="translate(10, 130)">
        <rect width="40" height="40" rx="4" fill="url(#box-m)" />
        <rect x="0" y="18" width="40" height="3" fill="#fff" opacity="0.7" />
      </g>
      <g transform="translate(155, 140)">
        <rect width="35" height="35" rx="4" fill="url(#box-m)" />
      </g>

      {/* Sparkles */}
      <text x="35" y="50" fontSize="14" fill="#fbbf24">✨</text>
      <text x="160" y="60" fontSize="14" fill="#fbbf24">✨</text>
      
      {/* Plant */}
      <g transform="translate(155, 100)">
        <rect x="2" y="20" width="18" height="14" rx="2" fill="#92400e" />
        <ellipse cx="6" cy="18" rx="4" ry="8" fill="#22c55e" transform="rotate(-20 6 18)" />
        <ellipse cx="11" cy="14" rx="4" ry="9" fill="#16a34a" />
        <ellipse cx="16" cy="18" rx="4" ry="8" fill="#22c55e" transform="rotate(20 16 18)" />
      </g>
    </svg>
  );
}
