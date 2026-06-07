'use client';

import { useState } from 'react';
import Link from 'next/link';
// import Image from 'next/image'; // เปิดใช้เมื่อมีไฟล์ asset จริง
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';
import ContactBlock from '@/components/ContactBlock';
import {
  Lock, User, Eye, EyeOff, AlertCircle, Loader2,
  Smartphone, Wrench, Coins, BarChart3, Box, ScanLine, CheckCircle2,
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
  const [googleMsg, setGoogleMsg] = useState('');

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

  async function handleGoogle() {
    // เปิดใช้งานเมื่อตั้งค่า Google OAuth ใน Supabase แล้ว:
    // await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + '/v3/home' } });
    setGoogleMsg('การเข้าสู่ระบบด้วย Google จะเปิดให้บริการเร็วๆ นี้');
    setTimeout(() => setGoogleMsg(''), 3000);
  }

  const features = [
    { Icon: Smartphone, label: 'จัดการ IMEI', color: '#2563eb' },
    { Icon: Wrench, label: 'งานซ่อม', color: '#f59e0b' },
    { Icon: Coins, label: 'จำนำและผ่อน', color: '#eab308' },
    { Icon: BarChart3, label: 'รายงานกำไร', color: '#8b5cf6' },
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

            <h2 className="mkt-title">ระบบจัดการร้านมือถือ<br />แบบครบวงจร</h2>
            <p className="mkt-desc">ขายเครื่อง • ซ่อม • จำนำ • ผ่อน • อะไหล่ • สต๊อก<br />ในระบบเดียว</p>

            {/* ===== mockup dashboard (laptop + mobile) ===== */}
            <div className="mockup">
              {/* แทนที่ด้วย: <Image src="/assets/login-dashboard-mockup.webp" alt="" fill style={{objectFit:'contain'}} /> */}
              <div className="laptop">
                <div className="laptop-screen">
                  <div className="ls-row"><span /><span /><span /></div>
                  <div className="ls-bars"><i style={{ height: '60%' }} /><i style={{ height: '85%' }} /><i style={{ height: '45%' }} /><i style={{ height: '95%' }} /><i style={{ height: '70%' }} /></div>
                </div>
                <div className="laptop-base" />
              </div>
              <div className="phone">
                <div className="phone-notch" />
                <div className="phone-card" />
                <div className="phone-card short" />
                <div className="phone-card" />
              </div>

              {/* floating illustrations */}
              <div className="float float-box"><Box size={22} /></div>
              <div className="float float-scan"><ScanLine size={20} /></div>
              <div className="float float-check"><CheckCircle2 size={18} /></div>
            </div>

            {/* ===== feature cards 4 ใบ ===== */}
            <div className="feat-grid">
              {features.map((f) => (
                <div className="feat" key={f.label}>
                  <div className="feat-ico" style={{ background: `${f.color}1a`, color: f.color }}><f.Icon size={18} /></div>
                  <span>{f.label}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* ===================== LOGIN FORM (ขวา) ===================== */}
        <main className="formside">
          <div className="form-inner">
            <div className="form-logo">
              {/* <Image src="/assets/logo.png" alt="StockCare" width={52} height={52} /> */}
              <div className="form-logo-badge">S</div>
            </div>

            <h1 className="form-title">เข้าสู่ระบบ</h1>
            <p className="form-sub">ระบบจัดการร้านมือถือสำหรับเจ้าของร้าน</p>

            {error && (
              <div className="alert" role="alert">
                <AlertCircle size={16} /> <span>{error}</span>
              </div>
            )}
            {googleMsg && (
              <div className="alert info">
                <AlertCircle size={16} /> <span>{googleMsg}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="form">
              <div className="field">
                <label htmlFor="username">ชื่อผู้ใช้ / อีเมล</label>
                <div className="input-wrap">
                  <User size={18} className="input-ico" />
                  <input
                    id="username" type="text" autoComplete="username"
                    value={username} onChange={(e) => setUsername(e.target.value)}
                    placeholder="กรอกชื่อผู้ใช้หรืออีเมล" disabled={loading}
                  />
                </div>
              </div>

              <div className="field">
                <label htmlFor="password">รหัสผ่าน</label>
                <div className="input-wrap">
                  <Lock size={18} className="input-ico" />
                  <input
                    id="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password"
                    value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••" disabled={loading}
                  />
                  <button type="button" className="eye" onClick={() => setShowPassword((s) => !s)} aria-label="แสดง/ซ่อนรหัสผ่าน" tabIndex={-1}>
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="row">
                <label className="remember">
                  <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
                  <span>จดจำฉันไว้ในระบบ</span>
                </label>
                <Link href="/forgot-password" className="forgot">ลืมรหัสผ่าน?</Link>
              </div>

              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? <><Loader2 size={18} className="spin" /> กำลังเข้าสู่ระบบ...</> : 'เข้าสู่ระบบ'}
              </button>

              <div className="divider"><span>หรือ</span></div>

              <button type="button" className="btn-google" onClick={handleGoogle} disabled={loading}>
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
                  <path fill="#EA4335" d="M12 4.75c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.46 14.97.5 12 .5A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 4.75 12 4.75z" />
                </svg>
                เข้าสู่ระบบด้วย Google
              </button>
            </form>

            <p className="signup">ยังไม่มีบัญชี? <Link href="/register">สมัคร Beta ฟรี 30 วัน →</Link></p>
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid #eef2f7' }}>
              <ContactBlock variant="compact" />
            </div>
            <p className="ver">StockCare v3.9.89</p>
          </div>
        </main>
      </div>

      <style jsx>{`
        .auth-wrap{
          min-height:100vh; min-height:100dvh; width:100%; max-width:100vw;
          display:flex; align-items:center; justify-content:center;
          padding:20px; box-sizing:border-box; overflow-x:hidden;
          background:
            radial-gradient(1100px 700px at 12% 0%, #eaf2ff 0%, transparent 55%),
            radial-gradient(900px 600px at 100% 100%, #e6f0ff 0%, transparent 50%),
            linear-gradient(160deg,#f7faff,#eef4ff 70%,#e7eefc);
          font-family:'Sarabun',system-ui,sans-serif;
        }
        .auth-card{
          width:100%; max-width:980px;
          display:grid; grid-template-columns:1.05fr .95fr;
          background:#fff; border-radius:26px; overflow:hidden;
          box-shadow:0 30px 80px -28px rgba(37,99,235,.35), 0 4px 16px rgba(15,23,42,.06);
          box-sizing:border-box;
        }

        /* ===== Marketing ===== */
        .mkt{ position:relative; overflow:hidden;
          background:linear-gradient(160deg,#eaf2ff 0%,#dbeafe 45%,#eff6ff 100%);
          padding:40px 38px; }
        .mkt-pattern{ position:absolute; inset:0; opacity:.5;
          background-image:radial-gradient(rgba(37,99,235,.18) 1.3px, transparent 1.3px);
          background-size:20px 20px; }
        .mkt-glow{ position:absolute; border-radius:50%; filter:blur(60px); opacity:.45; }
        .mkt-glow-1{ width:240px;height:240px; background:#60a5fa; top:-50px; left:-40px; }
        .mkt-glow-2{ width:260px;height:260px; background:#a5b4fc; bottom:-70px; right:-50px; }
        .mkt-inner{ position:relative; z-index:1; display:flex; flex-direction:column; height:100%; }
        .mkt-brand{ display:flex; align-items:center; gap:11px; margin-bottom:26px; }
        .mkt-logo{ width:42px;height:42px;border-radius:13px; display:flex;align-items:center;justify-content:center;
          font-family:'Prompt';font-weight:800;font-size:21px;color:#fff;
          background:linear-gradient(135deg,#2563eb,#1d4ed8);
          box-shadow:0 8px 18px -4px rgba(37,99,235,.6), inset 0 1px 0 rgba(255,255,255,.5); }
        .mkt-logo-name{ font-family:'Prompt';font-weight:800;font-size:19px;color:#0f2a5e; }
        .mkt-logo-sub{ font-size:10px;letter-spacing:2px;color:#3b6fb5;font-weight:600;margin-top:-2px; }
        .mkt-title{ font-family:'Prompt';font-weight:700;font-size:27px;line-height:1.25;color:#0f2a5e; margin:0 0 8px; }
        .mkt-desc{ font-size:13.5px;color:#3b6fb5;line-height:1.7; margin:0 0 22px; }

        .mockup{ position:relative; height:170px; margin:4px 0 22px; }
        .laptop{ position:absolute; left:6%; top:8px; width:64%; animation:floaty 6s ease-in-out infinite; }
        .laptop-screen{ background:#0f2a5e; border-radius:10px 10px 4px 4px; padding:10px; border:2px solid #1e3a8a; }
        .ls-row{ display:flex; gap:4px; margin-bottom:8px; }
        .ls-row span{ width:7px;height:7px;border-radius:50%;background:#3b82f6; opacity:.7; }
        .ls-bars{ display:flex; align-items:flex-end; gap:6px; height:62px; }
        .ls-bars i{ flex:1; border-radius:3px; background:linear-gradient(180deg,#60a5fa,#2563eb); }
        .laptop-base{ height:8px; background:linear-gradient(180deg,#cbd5e1,#94a3b8); border-radius:0 0 8px 8px; margin:0 -6px; }
        .phone{ position:absolute; right:4%; bottom:0; width:86px; padding:8px 8px 14px;
          background:#fff; border-radius:16px; border:2px solid #dbeafe;
          box-shadow:0 14px 30px -10px rgba(37,99,235,.4); animation:floaty 6s ease-in-out infinite; animation-delay:-3s; }
        .phone-notch{ width:30px;height:4px;border-radius:3px;background:#cbd5e1;margin:0 auto 8px; }
        .phone-card{ height:14px;border-radius:5px;background:linear-gradient(90deg,#dbeafe,#eff6ff);margin-bottom:6px; }
        .phone-card.short{ width:60%; background:linear-gradient(90deg,#bfdbfe,#dbeafe); }
        .float{ position:absolute; border-radius:13px; display:flex;align-items:center;justify-content:center;
          background:#fff; color:#2563eb; box-shadow:0 10px 22px -6px rgba(37,99,235,.45); }
        .float-box{ width:42px;height:42px; top:-6px; right:18%; color:#2563eb; animation:floaty 5s ease-in-out infinite; }
        .float-scan{ width:38px;height:38px; bottom:24px; left:-2%; color:#f59e0b; animation:floaty 5.5s ease-in-out infinite; animation-delay:-2s; }
        .float-check{ width:34px;height:34px; top:40%; right:-2%; color:#16a34a; animation:floaty 4.6s ease-in-out infinite; animation-delay:-1s; }
        @keyframes floaty{ 0%,100%{ transform:translateY(0) } 50%{ transform:translateY(-9px) } }

        .feat-grid{ display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:auto; }
        .feat{ display:flex; align-items:center; gap:9px; padding:11px 12px; border-radius:13px;
          background:rgba(255,255,255,.7); border:1px solid rgba(37,99,235,.12);
          backdrop-filter:blur(6px); transition:transform .2s, box-shadow .2s; }
        .feat:hover{ transform:translateY(-3px); box-shadow:0 12px 24px -10px rgba(37,99,235,.35); }
        .feat-ico{ width:34px;height:34px;border-radius:10px; display:flex;align-items:center;justify-content:center; flex-shrink:0; }
        .feat span{ font-size:13px;font-weight:600;color:#0f2a5e; }

        /* ===== Form ===== */
        .formside{ display:flex; align-items:center; justify-content:center; padding:44px 40px; box-sizing:border-box; }
        .form-inner{ width:100%; max-width:360px; }
        .form-logo{ display:none; }
        .form-logo-badge{ width:52px;height:52px;border-radius:15px; display:flex;align-items:center;justify-content:center;
          font-family:'Prompt';font-weight:800;font-size:24px;color:#fff; margin-bottom:18px;
          background:linear-gradient(135deg,#2563eb,#1d4ed8); box-shadow:0 10px 22px -6px rgba(37,99,235,.6); }
        .form-title{ font-family:'Prompt';font-weight:700;font-size:26px;color:#0f172a; margin:0 0 5px; }
        .form-sub{ font-size:13.5px;color:#64748b; margin:0 0 22px; }

        .alert{ display:flex;align-items:center;gap:8px; padding:11px 13px;border-radius:12px;
          background:#fef2f2;border:1px solid #fecaca;color:#dc2626;font-size:13px;font-weight:500; margin-bottom:16px; }
        .alert.info{ background:#eff6ff;border-color:#bfdbfe;color:#2563eb; }

        .form{ display:flex; flex-direction:column; gap:15px; }
        .field label{ display:block; font-size:13px; font-weight:600; color:#334155; margin-bottom:7px; }
        .input-wrap{ position:relative; }
        .input-ico{ position:absolute; left:14px; top:50%; transform:translateY(-50%); color:#94a3b8; pointer-events:none; }
        .input-wrap input{ width:100%; height:52px; padding:0 46px 0 44px; box-sizing:border-box;
          border:1.5px solid #e2e8f0; border-radius:13px; font-size:15px; font-family:'Sarabun'; color:#0f172a;
          background:#f8fafc; outline:none; transition:border-color .2s, box-shadow .2s, background .2s; }
        .input-wrap input::placeholder{ color:#94a3b8; }
        .input-wrap input:focus{ border-color:#2563eb; background:#fff; box-shadow:0 0 0 4px rgba(37,99,235,.13); }
        .eye{ position:absolute; right:8px; top:50%; transform:translateY(-50%); width:36px;height:36px;
          border:none;background:transparent;color:#94a3b8;cursor:pointer; display:flex;align-items:center;justify-content:center;border-radius:9px; transition:.2s; }
        .eye:hover{ color:#2563eb; background:#eff6ff; }

        .row{ display:flex; align-items:center; justify-content:space-between; margin-top:-3px; }
        .remember{ display:flex; align-items:center; gap:8px; font-size:13px; color:#475569; cursor:pointer; }
        .remember input{ width:16px;height:16px; accent-color:#2563eb; cursor:pointer; }
        .forgot{ font-size:13px; color:#2563eb; font-weight:600; text-decoration:none; }
        .forgot:hover{ text-decoration:underline; }

        .btn-primary{ height:54px; border:none; border-radius:13px; cursor:pointer; margin-top:4px;
          font-family:'Prompt'; font-weight:700; font-size:16px; color:#fff;
          background:linear-gradient(135deg,#2563eb,#1d4ed8);
          box-shadow:0 12px 26px -8px rgba(37,99,235,.6); transition:transform .2s, box-shadow .2s, opacity .2s;
          display:flex; align-items:center; justify-content:center; gap:9px; }
        .btn-primary:hover:not(:disabled){ transform:translateY(-2px); box-shadow:0 18px 34px -10px rgba(37,99,235,.7); }
        .btn-primary:active:not(:disabled){ transform:translateY(0); }
        .btn-primary:disabled{ opacity:.7; cursor:not-allowed; }

        .divider{ display:flex; align-items:center; gap:12px; color:#94a3b8; font-size:12px; margin:2px 0; }
        .divider::before,.divider::after{ content:""; flex:1; height:1px; background:#e2e8f0; }

        .btn-google{ height:52px; border:1.5px solid #e2e8f0; border-radius:13px; cursor:pointer;
          background:#fff; color:#334155; font-family:'Sarabun'; font-weight:600; font-size:14.5px;
          display:flex; align-items:center; justify-content:center; gap:10px; transition:.2s; }
        .btn-google:hover:not(:disabled){ background:#f8fafc; border-color:#cbd5e1; }

        .signup{ text-align:center; font-size:13.5px; color:#64748b; margin:20px 0 0; }
        .signup :global(a){ color:#2563eb; font-weight:700; text-decoration:none; }
        .signup :global(a):hover{ text-decoration:underline; }
        .ver{ text-align:center; font-size:10px; color:#cbd5e1; letter-spacing:1px; margin:14px 0 0; }

        .spin{ animation:spin 1s linear infinite; }
        @keyframes spin{ to{ transform:rotate(360deg) } }

        /* ===== TABLET ===== */
        @media (max-width:900px){
          .auth-card{ grid-template-columns:1fr; max-width:440px; }
          .mkt{ display:none; }
          .form-logo{ display:flex; }
        }
        /* ===== MOBILE ===== */
        @media (max-width:480px){
          .auth-wrap{ padding:0; align-items:stretch; background:#fff; }
          .auth-card{ border-radius:0; box-shadow:none; min-height:100dvh; }
          .formside{ padding:30px 22px; align-items:flex-start; padding-top:48px; }
          .form-inner{ max-width:100%; }
          .form-title{ font-size:24px; }
        }
      `}</style>
    </div>
  );
}
