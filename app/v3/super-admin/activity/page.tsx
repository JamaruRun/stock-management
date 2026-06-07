'use client';

import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase-client';
import { TrendingUp, Store, Smartphone, ShoppingCart, Hammer, Coins, Users as UsersIcon } from 'lucide-react';
import { Header, FilterTabs, SearchBar, LoadingCard, EmptyCard } from '../SAShared';

export default function V3SAActivityPage() {
  const supabase = createClient();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'quiet'>('all');

  useEffect(() => {
    async function load() {
      const { data: shops, error: shopErr } = await supabase.from('shops').select('*').order('name');
      if (shopErr || !shops) { setLoading(false); return; }

      async function cnt(table: string, shopId: string) {
        const { count } = await supabase.from(table).select('id', { count: 'exact', head: true }).eq('shop_id', shopId);
        return count || 0;
      }
      const result = await Promise.all(shops.map(async (s: any) => {
        const [stock, sales, repair, pawn, inst, users] = await Promise.all([
          cnt('stock', s.id), cnt('sales_history', s.id), cnt('repair_jobs', s.id),
          cnt('pawn_stock', s.id), cnt('installment_stock', s.id), cnt('profiles', s.id),
        ]);
        const total = stock + sales + repair + pawn + inst;
        return { ...s, stock, sales, repair, pawn, inst, users, total };
      }));
      result.sort((a, b) => b.total - a.total);
      setRows(result);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = useMemo(() => {
    let list = rows;
    if (filter === 'active') list = list.filter(r => r.total >= 10);
    else if (filter === 'quiet') list = list.filter(r => r.total < 10);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter(r => (r.name || '').toLowerCase().includes(q) || (r.owner_name || '').toLowerCase().includes(q));
    return list;
  }, [rows, search, filter]);

  return (
    <>
      <Header Icon={TrendingUp} title="กิจกรรมร้าน" subtitle={`${rows.length} ร้าน · เรียงตามกิจกรรม`} color="#3b82f6" />
      <FilterTabs tabs={[['all', `ทั้งหมด ${rows.length}`], ['active', 'คึกคัก (10+)'], ['quiet', 'เงียบ']]} active={filter} onChange={(v) => setFilter(v as any)} />
      <SearchBar value={search} onChange={setSearch} placeholder="ค้นหาร้าน/เจ้าของ..." />

      {loading ? <LoadingCard /> : filtered.length === 0 ? <EmptyCard Icon={TrendingUp} text="ไม่มีข้อมูล" /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(r => (
            <div key={r.id} className="v3-card" style={{ padding: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: '#dbeafe', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Store size={18} /></div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'Prompt, sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{r.owner_name || '—'} · {r.users} ผู้ใช้</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'Prompt, sans-serif', color: '#3b82f6' }}>{r.total}</div>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>รายการรวม</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
                <Stat Icon={Smartphone} label="เครื่อง" value={r.stock} color="#3b82f6" />
                <Stat Icon={ShoppingCart} label="ขาย" value={r.sales} color="#22c55e" />
                <Stat Icon={Hammer} label="ซ่อม" value={r.repair} color="#f59e0b" />
                <Stat Icon={Coins} label="จำนำ" value={r.pawn} color="#eab308" />
                <Stat Icon={UsersIcon} label="ผ่อน" value={r.inst} color="#8b5cf6" />
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function Stat({ Icon, label, value, color }: any) {
  return (
    <div style={{ background: 'var(--surface-2)', borderRadius: 8, padding: '8px 4px', textAlign: 'center' }}>
      <Icon size={14} style={{ color, margin: '0 auto 2px' }} />
      <div style={{ fontSize: 14, fontWeight: 700 }}>{value}</div>
      <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>{label}</div>
    </div>
  );
}
