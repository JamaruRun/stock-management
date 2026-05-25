import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase-server';
import DashboardClient from './dashboard-client';
import Heartbeat from '@/components/Heartbeat';
import BarcodeScannerPreload from '@/components/BarcodeScannerPreload';
import PWAInstallPrompt from '@/components/PWAInstallPrompt';
import FeedbackButton from '@/components/FeedbackButton';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();

  // ใช้ getUser() เพราะเรา trust cookie อย่างเดียวไม่ได้
  // (middleware ก็เรียกแล้ว แต่ data ไม่ส่งต่อมา → จำเป็นต้องเรียกซ้ำ)
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // ⚡ Select เฉพาะ field ที่ใช้จริงในหน้านี้ + sidebar
  // (เดิมใช้ '*' = ดึงทุก column + nested - ช้ามาก)
  const { data: profile } = await supabase
    .from('profiles')
    .select(`
      id, username, full_name, role, branch_id, shop_id, is_super_admin,
      branches(name),
      shops(id, name, status, package, expires_at)
    `)
    .eq('id', user.id)
    .single();

  if (!profile) {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="login-logo-text">ERROR</div>
          <h1 className="login-title">ไม่พบโปรไฟล์</h1>
          <p className="login-sub" style={{ marginBottom: 24 }}>
            บัญชีของคุณยังไม่ถูกตั้งค่า กรุณาติดต่อเจ้าของร้านเพื่อสร้างโปรไฟล์
          </p>
          <form action="/auth/signout" method="post">
            <button className="btn btn-sec" type="submit">ออกจากระบบ</button>
          </form>
        </div>
      </div>
    );
  }

  // เช็คสถานะร้าน (ยกเว้น super admin)
  const shop = profile.shops as any;
  const isSuperAdmin = profile.is_super_admin;
  
  if (!isSuperAdmin && shop) {
    // ระงับ
    if (shop.status === 'suspended') {
      return (
        <div className="login-page">
          <div className="login-card" style={{ maxWidth: 480, borderColor: '#ff4757' }}>
            <div className="login-logo-text" style={{ color: '#ff4757' }}>SUSPENDED</div>
            <h1 className="login-title">⛔ ระบบถูกระงับ</h1>
            <p className="login-sub" style={{ marginBottom: 24, lineHeight: 1.6 }}>
              ร้าน <strong>{shop.name}</strong> ถูกระงับการใช้งานชั่วคราว<br />
              กรุณาติดต่อผู้ดูแลระบบเพื่อเปิดใช้งานอีกครั้ง
            </p>
            <div style={{ 
              background: 'var(--surface-2)', 
              padding: 14, 
              marginBottom: 16,
              fontSize: 12,
              color: 'var(--text-dim)',
              fontFamily: 'JetBrains Mono, monospace',
            }}>
              <div>ติดต่อ: ผู้ดูแลระบบ</div>
            </div>
            <form action="/auth/signout" method="post">
              <button className="btn btn-sec" type="submit" style={{ width: '100%' }}>
                ออกจากระบบ
              </button>
            </form>
          </div>
        </div>
      );
    }
    
    // หมดอายุ
    if (shop.package !== 'lifetime' && shop.expires_at) {
      const expires = new Date(shop.expires_at);
      const now = new Date();
      if (expires < now) {
        return (
          <div className="login-page">
            <div className="login-card" style={{ maxWidth: 480, borderColor: '#ffa502' }}>
              <div className="login-logo-text" style={{ color: '#ffa502' }}>EXPIRED</div>
              <h1 className="login-title">⏰ หมดอายุการใช้งาน</h1>
              <p className="login-sub" style={{ marginBottom: 24, lineHeight: 1.6 }}>
                ร้าน <strong>{shop.name}</strong> หมดอายุการใช้งานแล้ว<br />
                กรุณาติดต่อผู้ดูแลระบบเพื่อต่ออายุการใช้งาน
              </p>
              <div style={{ 
                background: 'var(--surface-2)', 
                padding: 14, 
                marginBottom: 16,
                fontSize: 12,
                color: 'var(--text-dim)',
                fontFamily: 'JetBrains Mono, monospace',
              }}>
                <div>หมดอายุเมื่อ: {expires.toLocaleDateString('th-TH')}</div>
                <div>แพ็คเกจ: {shop.package === 'trial' ? 'Trial' : shop.package === 'monthly' ? 'รายเดือน' : 'รายปี'}</div>
              </div>
              <form action="/auth/signout" method="post">
                <button className="btn btn-sec" type="submit" style={{ width: '100%' }}>
                  ออกจากระบบ
                </button>
              </form>
            </div>
          </div>
        );
      }
    }
  }

  return (
    <DashboardClient profile={profile}>
      <Heartbeat />
      <BarcodeScannerPreload />
      <PWAInstallPrompt />
      <FeedbackButton />
      {children}
    </DashboardClient>
  );
}
