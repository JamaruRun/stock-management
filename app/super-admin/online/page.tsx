'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-client';

interface OnlineUser {
  id: string;
  username: string;
  full_name: string;
  role: string;
  last_seen_at: string;
  shop_id: string;
  shops: { name: string } | null;
  branches: { name: string } | null;
}

export default function OnlineUsersPage() {
  const supabase = createClient();
  const [users, setUsers] = useState<OnlineUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  async function load() {
    // ดึงคนที่ active ใน 5 นาทีล่าสุด
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    
    const { data } = await supabase
      .from('profiles')
      .select('id, username, full_name, role, last_seen_at, shop_id, shops(name), branches(name)')
      .gte('last_seen_at', fiveMinAgo)
      .order('last_seen_at', { ascending: false });

    setUsers((data || []) as any);
    setLoading(false);
    setLastRefresh(new Date());
  }

  useEffect(() => {
    load();
    // auto-refresh ทุก 30 วินาที
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, []);

  function timeAgo(dateStr: string) {
    const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (seconds < 60) return `เมื่อสักครู่`;
    if (seconds < 120) return `1 นาทีที่แล้ว`;
    return `${Math.floor(seconds / 60)} นาทีที่แล้ว`;
  }

  function statusDot(dateStr: string) {
    const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (seconds < 90) return '#10b981'; // เขียว = active
    if (seconds < 240) return '#f59e0b'; // เหลือง = idle
    return '#6b7280'; // เทา = กำลังจะหลุด
  }

  // Group by shop
  const groupedByShop: Record<string, { shopName: string; users: OnlineUser[] }> = {};
  users.forEach(u => {
    const key = u.shop_id;
    if (!groupedByShop[key]) {
      groupedByShop[key] = { 
        shopName: u.shops?.name || 'ไม่ระบุร้าน', 
        users: [] 
      };
    }
    groupedByShop[key].users.push(u);
  });

  return (
    <>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div>
          <h1>🟢 Online Users</h1>
          <div className="desc">
            ผู้ใช้ active ใน 5 นาทีล่าสุด • auto refresh 30 วินาที
          </div>
        </div>
        <Link href="/super-admin" style={{
          padding: '8px 14px',
          background: 'var(--surface-2)',
          color: 'var(--text)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          fontSize: 12,
          textDecoration: 'none',
        }}>← กลับ</Link>
      </div>

      {/* Summary */}
      <div style={{
        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
        borderRadius: 'var(--radius)',
        padding: 20,
        marginBottom: 20,
        color: '#fff',
      }}>
        <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 6 }}>กำลังออนไลน์</div>
        <div style={{ fontSize: 36, fontWeight: 700, letterSpacing: -1 }}>
          {users.length} <span style={{ fontSize: 16, opacity: 0.9 }}>คน</span>
        </div>
        <div style={{ 
          marginTop: 10, 
          paddingTop: 10, 
          borderTop: '1px solid rgba(255,255,255,0.2)',
          fontSize: 12, 
          display: 'flex', 
          gap: 16,
          flexWrap: 'wrap',
        }}>
          <div>🏪 {Object.keys(groupedByShop).length} ร้าน</div>
          <div>🕐 อัพเดทล่าสุด: {lastRefresh.toLocaleTimeString('th-TH')}</div>
          <button 
            onClick={load}
            style={{
              marginLeft: 'auto',
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              color: '#fff',
              padding: '4px 10px',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 11,
              fontFamily: 'inherit',
            }}
          >🔄 Refresh</button>
        </div>
      </div>

      {/* Status legend */}
      <div style={{ 
        display: 'flex', 
        gap: 16, 
        fontSize: 11, 
        color: 'var(--text-dim)', 
        marginBottom: 14,
        padding: '0 4px',
      }}>
        <span><span style={{ display: 'inline-block', width: 8, height: 8, background: '#10b981', borderRadius: '50%', marginRight: 4 }}/>Active (1.5 นาที)</span>
        <span><span style={{ display: 'inline-block', width: 8, height: 8, background: '#f59e0b', borderRadius: '50%', marginRight: 4 }}/>Idle (4 นาที)</span>
        <span><span style={{ display: 'inline-block', width: 8, height: 8, background: '#6b7280', borderRadius: '50%', marginRight: 4 }}/>Away (5 นาที)</span>
      </div>

      {/* List */}
      {loading ? (
        <div className="skeleton" style={{ height: 80 }}></div>
      ) : users.length === 0 ? (
        <div className="form-card">
          <div className="empty">
            <div className="empty-icon" style={{ opacity: 0.3 }}>😴</div>
            <div className="empty-title">ยังไม่มีคนออนไลน์</div>
            <div className="empty-sub">รอ user เข้าใช้งาน (อัพเดททุก 30 วินาที)</div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {Object.entries(groupedByShop).map(([shopId, group]) => (
            <div key={shopId} style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              padding: 14,
            }}>
              <div style={{ 
                fontSize: 13, 
                fontWeight: 700, 
                marginBottom: 10,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}>
                🏪 {group.shopName}
                <span style={{
                  fontSize: 10,
                  padding: '2px 8px',
                  background: 'rgba(16, 185, 129, 0.15)',
                  color: '#10b981',
                  borderRadius: 10,
                  fontWeight: 600,
                }}>
                  {group.users.length} ออนไลน์
                </span>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {group.users.map(u => (
                  <div
                    key={u.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: 10,
                      background: 'var(--surface-2)',
                      borderRadius: 6,
                    }}
                  >
                    {/* Status dot */}
                    <div style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: statusDot(u.last_seen_at),
                      flexShrink: 0,
                      boxShadow: `0 0 8px ${statusDot(u.last_seen_at)}`,
                    }}/>
                    
                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>
                        {u.full_name || u.username}
                        <span style={{ 
                          fontSize: 10, 
                          marginLeft: 6,
                          padding: '1px 6px',
                          background: u.role === 'admin' ? 'rgba(59,130,246,0.15)' : 'rgba(107,114,128,0.15)',
                          color: u.role === 'admin' ? 'var(--accent)' : 'var(--text-dim)',
                          borderRadius: 3,
                          fontWeight: 700,
                          textTransform: 'uppercase',
                        }}>
                          {u.role}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
                        @{u.username}
                        {u.branches?.name && ` • 📍 ${u.branches.name}`}
                      </div>
                    </div>
                    
                    {/* Last seen */}
                    <div style={{ fontSize: 10, color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>
                      {timeAgo(u.last_seen_at)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
