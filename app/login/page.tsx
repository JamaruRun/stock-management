'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const cleanUsername = username.trim().toLowerCase();

    // 1. หา emails ที่เป็นไปได้จาก API
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
    } catch (e) {
      // fallback - ใช้ format เดิม
    }

    // ถ้าไม่เจอ emails จาก API ให้ลอง format มาตรฐาน
    if (emails.length === 0) {
      emails = [`${cleanUsername}@example.com`];
    }

    // 2. ลอง login แต่ละ email จนเจอ
    let authData: any = null;
    let lastError: any = null;

    for (const email of emails) {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (!signInError && data.user) {
        authData = data;
        break;
      }
      lastError = signInError;
    }

    if (!authData) {
      setError('Username หรือ Password ไม่ถูกต้อง');
      setLoading(false);
      return;
    }

    // ไม่ต้องเช็ค shop ที่นี่ - dashboard/layout.tsx จะเช็คให้
    // (กัน query ซ้ำ + redirect ทันที = login เร็วขึ้น 800-1500ms)
    router.push('/dashboard/home');
    router.refresh();
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <img 
            src="/icon-192.png" 
            alt="Stock Manager"
            style={{
              width: 72,
              height: 72,
              borderRadius: 16,
              boxShadow: '0 8px 20px rgba(59, 130, 246, 0.25)',
              animation: 'login-logo-float 3s ease-in-out infinite',
            }}
          />
          <div className="login-logo-text">STOCK MANAGER</div>
          <style>{`@keyframes login-logo-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }`}</style>
        </div>
        
        <h1 className="login-title">เข้าสู่ระบบ</h1>
        <p className="login-sub">ระบบจัดการสต๊อกร้านมือถือ + ร้านซ่อม</p>

        <form onSubmit={handleLogin}>
          {error && <div className="login-error">{error}</div>}

          <div className="field" style={{ marginBottom: 14 }}>
            <label>ชื่อผู้ใช้</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="username"
              autoComplete="username"
              required
              disabled={loading}
            />
          </div>

          <div className="field" style={{ marginBottom: 20 }}>
            <label>รหัสผ่าน</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
              disabled={loading}
            />
          </div>

          <button type="submit" className="btn" disabled={loading}>
            {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
          </button>
        </form>

        {/* Link ไปหน้าสมัคร Beta */}
        <div style={{ 
          textAlign: 'center', 
          marginTop: 20,
          paddingTop: 20,
          borderTop: '1px solid var(--border)',
          fontSize: 13,
          color: 'var(--text-dim)',
        }}>
          ยังไม่มีบัญชี?
          <a 
            href="/signup-beta" 
            style={{ 
              color: 'var(--accent)', 
              textDecoration: 'none', 
              fontWeight: 600,
              marginLeft: 6,
            }}
          >
            สมัคร Beta ฟรี 30 วัน →
          </a>
        </div>
      </div>
    </div>
  );
}
