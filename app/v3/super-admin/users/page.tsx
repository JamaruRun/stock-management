'use client';

import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase-client';
import { Shield, Store, Crown, User } from 'lucide-react';
import { Header, FilterTabs, SearchBar, LoadingCard, EmptyCard } from '../SAShared';

function shopName(p: any) { return p.shops?.[0]?.name || p.shops?.name || '—'; }

export default function V3SAUsersPage() {
  const supabase = createClient();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'admin' | 'staff'>('all');

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('profiles')
        .select('id, username, full_name, role, is_super_admin, last_seen_at, shop_id, shops(name)')
        .order('last_seen_at', { ascending: false, nullsFirst: false })
        .limit(500);
      setItems(data || []);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = useMemo(() => {
    let list = items;
    if (filter === 'admin') list = list.filter(i => i.role === 'admin' || i.is_super_admin);
    else if (filter === 'staff') list = list.filter(i => i.role !== 'admin' && !i.is_super_admin);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter(i => (i.full_name || '').toLowerCase().includes(q) || (i.username || '').toLowerCase().includes(q) || shopName(i).toLowerCase().includes(q));
    return list;
  }, [items, search, filter]);

  return (
    <>
      <Header Icon={Shield} title="ผู้ใช้ทั้งหมด" subtitle={`${items.length} บัญชีในระบบ`} color="#8b5cf6" />
      <FilterTabs tabs={[['all', `ทั้งหมด ${items.length}`], ['admin', 'แอดมิน'], ['staff', 'พนักงาน']]} active={filter} onChange={(v) => setFilter(v as any)} />
      <SearchBar value={search} onChange={setSearch} placeholder="ค้นหา ชื่อ/username/ร้าน..." />

      {loading ? <LoadingCard /> : filtered.length === 0 ? <EmptyCard Icon={Shield} text="ไม่พบผู้ใช้" /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(u => {
            const isAdmin = u.role === 'admin' || u.is_super_admin;
            return (
              <div key={u.id} className="v3-card" style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 11, background: isAdmin ? '#ede9fe' : 'var(--surface-2)', color: isAdmin ? '#8b5cf6' : 'var(--text-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {u.is_super_admin ? <Crown size={18} /> : isAdmin ? <Shield size={18} /> : <User size={18} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{u.full_name || u.username} {u.is_super_admin && <span style={{ fontSize: 10, color: '#8b5cf6', fontWeight: 700 }}>· SUPER</span>}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <span>@{u.username}</span>
                    <span><Store size={10} style={{ display: 'inline', verticalAlign: '-1px' }} /> {shopName(u)}</span>
                    <span style={{ color: isAdmin ? '#8b5cf6' : 'var(--text-muted)' }}>{isAdmin ? 'แอดมิน' : 'พนักงาน'}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
