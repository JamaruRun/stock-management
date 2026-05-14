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

    const email = `${username.trim()}@example.com`;

    const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError('Username หรือ Password ไม่ถูกต้อง');
      setLoading(false);
      return;
    }

    // เช็คสถานะร้าน
    if (authData.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_super_admin, shops(name, status, package, expires_at)')
        .eq('id', authData.user.id)
        .single();

      const shop = (profile?.shops as any);
      const isSuperAdmin = profile?.is_super_admin;

      if (!isSuperAdmin && shop) {
        if (shop.status === 'suspended') {
          await supabase.auth.signOut();
          setError(`⛔ ร้าน "${shop.name}" ถูกระงับการใช้งาน - กรุณาติดต่อผู้ดูแลระบบ`);
          setLoading(false);
          return;
        }

        if (shop.package !== 'lifetime' && shop.expires_at) {
          const expires = new Date(shop.expires_at);
          if (expires < new Date()) {
            await supabase.auth.signOut();
            setError(`⏰ ร้าน "${shop.name}" หมดอายุการใช้งาน - กรุณาติดต่อผู้ดูแลระบบเพื่อต่ออายุ`);
            setLoading(false);
            return;
          }
        }
      }
    }

    router.push('/dashboard/stock');
    router.refresh();
  }

  return (
    <div className="login-screen">
      <div className="login-box">
        <div className="logo-text">SYS_v1.4 // STOCK MANAGEMENT</div>
        <h1 className="login-title">เข้าสู่ระบบ</h1>
        <p className="login-sub">ระบบจัดการสต๊อกมือถือ</p>

        <form onSubmit={handleLogin}>
          {error && <div className="error-box">{error}</div>}

          <div className="field">
            <label>USERNAME</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="ชื่อผู้ใช้"
              autoComplete="username"
              required
              disabled={loading}
            />
          </div>

          <div className="field">
            <label>PASSWORD</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="รหัสผ่าน"
              autoComplete="current-password"
              required
              disabled={loading}
            />
          </div>

          <button type="submit" className="btn" disabled={loading}>
            {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ →'}
          </button>
        </form>
      </div>
    </div>
  );
}
