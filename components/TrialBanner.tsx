'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase-client';

interface Shop {
  id: string;
  name: string;
  package: 'trial' | 'monthly' | 'yearly' | 'lifetime';
  expires_at?: string;
  status: 'active' | 'suspended' | 'expired';
}

export default function TrialBanner() {
  const supabase = createClient();
  const [shop, setShop] = useState<Shop | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    loadShop();
  }, []);

  async function loadShop() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from('profiles').select('shop_id').eq('id', user.id).single();
    if (!profile?.shop_id) return;

    const { data: shopData } = await supabase
      .from('shops').select('*').eq('id', profile.shop_id).single();
    if (shopData) setShop(shopData as Shop);
  }

  if (!shop || dismissed) return null;
  if (shop.package === 'lifetime') return null;
  if (!shop.expires_at) return null;

  const now = new Date();
  const expires = new Date(shop.expires_at);
  const daysLeft = Math.ceil((expires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  // ไม่แสดงถ้ายังเหลือเยอะ
  if (daysLeft > 14 && shop.package !== 'trial') return null;

  let bgColor = 'var(--surface-2)';
  let borderColor = 'var(--accent)';
  let icon = '🎁';
  let title = '';
  let message = '';

  if (daysLeft <= 0) {
    bgColor = 'rgba(255, 71, 87, 0.1)';
    borderColor = '#ff4757';
    icon = '⛔';
    title = 'หมดอายุการใช้งานแล้ว';
    message = 'กรุณาติดต่อผู้ดูแลระบบเพื่อต่ออายุ';
  } else if (daysLeft <= 3) {
    bgColor = 'rgba(255, 71, 87, 0.1)';
    borderColor = '#ff4757';
    icon = '⚠️';
    title = `เหลือ ${daysLeft} วัน!`;
    message = 'ระบบจะปิดเร็วๆ นี้ กรุณาติดต่อผู้ดูแลระบบ';
  } else if (daysLeft <= 7) {
    bgColor = 'rgba(255, 165, 2, 0.1)';
    borderColor = '#ffa502';
    icon = '⏰';
    title = `เหลือ ${daysLeft} วัน`;
    message = shop.package === 'trial' 
      ? 'ทดลองใช้งานจะหมดเร็วๆ นี้ — ติดต่อเพื่อใช้งานต่อ'
      : 'แพ็คเกจจะหมดอายุเร็วๆ นี้';
  } else {
    icon = '🎁';
    title = `${shop.package === 'trial' ? 'ทดลองใช้งาน' : 'แพ็คเกจ'} เหลือ ${daysLeft} วัน`;
    message = '';
  }

  return (
    <div style={{
      background: bgColor,
      borderLeft: `3px solid ${borderColor}`,
      padding: '12px 16px',
      margin: '0 0 16px 0',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
    }}>
      <span style={{ fontSize: 20 }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: borderColor }}>
          {title}
        </div>
        {message && (
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>
            {message}
          </div>
        )}
      </div>
      {daysLeft > 7 && (
        <button
          onClick={() => setDismissed(true)}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-dim)',
            cursor: 'pointer',
            fontSize: 18,
            padding: '0 4px',
          }}
          title="ซ่อน"
        >
          ×
        </button>
      )}
    </div>
  );
}
