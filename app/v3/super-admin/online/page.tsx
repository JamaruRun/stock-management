'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase-client';
import { Users, Store, Clock } from 'lucide-react';
import { Header, LoadingCard, EmptyCard } from '../SAShared';

function shopName(p: any) { return p.shops?.[0]?.name || p.shops?.name || '—'; }
function ago(ts: string) {
  const m = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
  if (m < 1) return 'เมื่อกี้';
  if (m < 60) return `${m} นาทีที่แล้ว`;
  const h = Math.floor(m / 60);
  return `${h} ชม.ที่แล้ว`;
}

export default function V3SAOnlinePage() {
  const supabase = createClient();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const fiveMinAgo = new Date(Date.now() - 5 * 60000).toISOString();
      const { data } = await supabase.from('profiles')
        .select('id, username, full_name, role, last_seen_at, shop_id, shops(name), branches(name)')
        .gte('last_seen_at', fiveMinAgo)
        .order('last_seen_at', { ascending: false });
      setItems(data || []);
      setLoading(false);
    }
    load();
  }, []);

  return (
    <>
      <Header Icon={Users} title="ออนไลน์ตอนนี้" subtitle={`${items.length} คนใช้งานใน 5 นาที`} color="#22c55e" />
      {loading ? <LoadingCard /> : items.length === 0 ? <EmptyCard Icon={Users} text="ไม่มีใครออนไลน์ตอนนี้" /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map(u => (
            <div key={u.id} className="v3-card" style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <div style={{ width: 40, height: 40, borderRadius: 11, background: '#dcfce7', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontFamily: 'Prompt, sans-serif' }}>{(u.full_name || u.username || '?')[0]?.toUpperCase()}</div>
                <span style={{ position: 'absolute', bottom: -1, right: -1, width: 11, height: 11, borderRadius: 100, background: '#22c55e', border: '2px solid var(--surface)' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{u.full_name || u.username}</div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <span><Store size={10} style={{ display: 'inline', verticalAlign: '-1px' }} /> {shopName(u)}</span>
                  <span style={{ color: u.role === 'admin' ? '#8b5cf6' : 'var(--text-muted)' }}>{u.role === 'admin' ? 'แอดมิน' : 'พนักงาน'}</span>
                </div>
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 3 }}><Clock size={10} /> {u.last_seen_at ? ago(u.last_seen_at) : ''}</div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
