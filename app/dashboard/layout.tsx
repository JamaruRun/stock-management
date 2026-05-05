import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase-server';
import DashboardClient from './dashboard-client';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // ดึงข้อมูล profile + branch
  const { data: profile } = await supabase
    .from('profiles')
    .select('*, branches(name)')
    .eq('id', user.id)
    .single();

  if (!profile) {
    // ยังไม่มี profile (admin ต้องสร้างให้)
    return (
      <div className="login-screen">
        <div className="login-box">
          <div className="logo-text">ERROR</div>
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

  return (
    <DashboardClient profile={profile}>
      {children}
    </DashboardClient>
  );
}
