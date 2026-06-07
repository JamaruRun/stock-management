'use client';

import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase-client';
import { Sparkles, Store, Phone, MapPin, Check, X, Clock } from 'lucide-react';
import { Header, FilterTabs, SearchBar, LoadingCard, EmptyCard } from '../SAShared';

const STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: 'รอดำเนินการ', color: '#f59e0b' },
  approved: { label: 'อนุมัติแล้ว', color: '#16a34a' },
  rejected: { label: 'ปฏิเสธ', color: '#ef4444' },
};

export default function V3SABetaPage() {
  const supabase = createClient();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  async function load() {
    const { data } = await supabase.from('beta_signups').select('*').order('created_at', { ascending: false }).limit(300);
    setItems(data || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function setStatus(b: any, status: string) {
    await supabase.from('beta_signups').update({ status }).eq('id', b.id);
    load();
  }

  const filtered = useMemo(() => {
    let list = items;
    if (filter !== 'all') list = list.filter(i => (i.status || 'pending') === filter);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter(i => (i.shop_name || '').toLowerCase().includes(q) || (i.contact_name || '').toLowerCase().includes(q) || (i.phone || '').includes(q));
    return list;
  }, [items, search, filter]);

  const pending = items.filter(i => (i.status || 'pending') === 'pending').length;

  return (
    <>
      <Header Icon={Sparkles} title="Beta Signups" subtitle={`${pending} รอดำเนินการ`} color="#8b5cf6" />
      <FilterTabs tabs={[['all', `ทั้งหมด ${items.length}`], ['pending', `รอ ${pending}`], ['approved', 'อนุมัติ'], ['rejected', 'ปฏิเสธ']]} active={filter} onChange={(v) => setFilter(v as any)} />
      <SearchBar value={search} onChange={setSearch} placeholder="ค้นหา ร้าน/ชื่อ/เบอร์..." />

      {loading ? <LoadingCard /> : filtered.length === 0 ? <EmptyCard Icon={Sparkles} text="ไม่มีรายการ" /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(b => {
            const st = STATUS[b.status || 'pending'];
            return (
              <div key={b.id} className="v3-card" style={{ padding: 14, borderLeft: `4px solid ${st.color}` }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'Prompt, sans-serif', display: 'flex', alignItems: 'center', gap: 6 }}><Store size={14} style={{ color: '#8b5cf6' }} /> {b.shop_name || '(ไม่ระบุชื่อร้าน)'}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      {b.contact_name && <span>{b.contact_name}</span>}
                      {b.phone && <a href={`tel:${b.phone}`} style={{ color: '#16a34a' }}><Phone size={11} style={{ display: 'inline', verticalAlign: '-1px' }} /> {b.phone}</a>}
                      {b.province && <span><MapPin size={11} style={{ display: 'inline', verticalAlign: '-1px' }} /> {b.province}</span>}
                    </div>
                    {b.message && <p style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 6, whiteSpace: 'pre-wrap' }}>{b.message}</p>}
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ color: st.color, fontWeight: 600 }}>● {st.label}</span>
                      <span>· {new Date(b.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}</span>
                    </div>
                  </div>
                </div>
                {(b.status || 'pending') === 'pending' && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <button onClick={() => setStatus(b, 'approved')} style={{ flex: 1, padding: 9, background: '#16a34a', color: '#fff', border: 'none', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><Check size={14} /> อนุมัติ</button>
                    <button onClick={() => setStatus(b, 'rejected')} style={{ flex: 1, padding: 9, background: 'var(--surface-2)', color: '#ef4444', border: '1px solid var(--border)', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><X size={14} /> ปฏิเสธ</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
