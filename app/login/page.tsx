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

    // 🆕 เช็ค shop status - ถ้า suspended → แสดงหมายเหตุ + logout
    const { data: profileData } = await supabase
      .from('profiles')
      .select('shop_id, is_super_admin')
      .eq('id', authData.user.id)
      .single();

    // super admin ข้าม check ไป
    if (profileData && !profileData.is_super_admin && profileData.shop_id) {
      const { data: shopData } = await supabase
        .from('shops')
        .select('status, suspension_note, name')
        .eq('id', profileData.shop_id)
        .single();

      if (shopData?.status === 'suspended') {
        // Logout เพราะ shop suspended
        await supabase.auth.signOut();
        
        const note = shopData.suspension_note || 'ติดต่อทีมงานเพื่อสอบถามรายละเอียด';
        setError(`⛔ ร้าน "${shopData.name}" ถูกระงับการใช้งาน\n\n${note}`);
        setLoading(false);
        return;
      }
    }

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
          {error && (
            <div className="login-error" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
              {error}
              {error.includes('ถูกระงับ') && (
                <div style={{
                  marginTop: 12,
                  paddingTop: 12,
                  borderTop: '1px solid rgba(239, 68, 68, 0.3)',
                  textAlign: 'center',
                }}>
                  <a
                    href="https://www.facebook.com/share/1DNJt1sNyY/"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-block',
                      padding: '8px 16px',
                      background: '#1877f2',
                      color: '#fff',
                      borderRadius: 6,
                      textDecoration: 'none',
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    📘 ติดต่อทีมงานบน Facebook
                  </a>
                </div>
              )}
            </div>
          )}

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

        {/* 🆕 Facebook contact */}
        <div style={{
          textAlign: 'center',
          marginTop: 14,
          fontSize: 11,
          color: 'var(--text-dim)',
        }}>
          มีปัญหา? <a 
            href="https://www.facebook.com/share/1DNJt1sNyY/"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: '#1877f2',
              textDecoration: 'none',
              fontWeight: 600,
            }}
          >
            📘 ติดต่อทีมงานบน Facebook
          </a>
        </div>
      </div>
    </div>
  );
}
