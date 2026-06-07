'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-client';
import {
  MessageSquare, ArrowLeft, Search, Loader2, Star, CheckCircle2, Circle, Store,
} from 'lucide-react';
import { Header, FilterTabs, SearchBar, LoadingCard, EmptyCard } from '../SAShared';

const TYPE_LABEL: Record<string, string> = { bug: '🐛 บั๊ก', idea: '💡 ไอเดีย', praise: '❤️ ชม', other: '💬 อื่นๆ' };

export default function V3SAFeedbackPage() {
  const supabase = createClient();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'new' | 'read'>('all');

  async function load() {
    const { data } = await supabase.from('feedback').select('*').order('created_at', { ascending: false }).limit(300);
    setItems(data || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function toggleRead(f: any) {
    const next = f.status === 'new' ? 'read' : 'new';
    await supabase.from('feedback').update({ status: next, updated_at: new Date().toISOString() }).eq('id', f.id);
    load();
  }

  const filtered = useMemo(() => {
    let list = items;
    if (filter !== 'all') list = list.filter(i => (i.status || 'new') === filter);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter(i => (i.subject || '').toLowerCase().includes(q) || (i.message || '').toLowerCase().includes(q) || (i.shop_name || '').toLowerCase().includes(q));
    return list;
  }, [items, search, filter]);

  const newCount = items.filter(i => (i.status || 'new') === 'new').length;

  return (
    <>
      <Header Icon={MessageSquare} title="Feedback" subtitle={`${newCount} รายการใหม่`} color="#f59e0b" />
      <FilterTabs tabs={[['all', `ทั้งหมด ${items.length}`], ['new', `ใหม่ ${newCount}`], ['read', 'อ่านแล้ว']]} active={filter} onChange={(v) => setFilter(v as any)} />
      <SearchBar value={search} onChange={setSearch} placeholder="ค้นหา หัวข้อ/ข้อความ/ร้าน..." />

      {loading ? <LoadingCard /> : filtered.length === 0 ? <EmptyCard Icon={MessageSquare} text="ไม่มี Feedback" /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(f => {
            const isNew = (f.status || 'new') === 'new';
            return (
              <div key={f.id} className="v3-card" style={{ padding: 14, borderLeft: isNew ? '4px solid #f59e0b' : '4px solid transparent' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-dim)' }}>{TYPE_LABEL[f.type] || f.type}</span>
                      {f.rating > 0 && <span style={{ fontSize: 11, color: '#f59e0b', display: 'inline-flex', alignItems: 'center', gap: 2 }}><Star size={11} fill="#f59e0b" /> {f.rating}</span>}
                    </div>
                    {f.subject && <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'Prompt, sans-serif', marginTop: 2 }}>{f.subject}</div>}
                    <p style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 2, whiteSpace: 'pre-wrap' }}>{f.message}</p>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      {f.shop_name && <span><Store size={10} style={{ display: 'inline', verticalAlign: '-1px' }} /> {f.shop_name}</span>}
                      <span>{new Date(f.created_at).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                  <button onClick={() => toggleRead(f)} title={isNew ? 'ทำเครื่องหมายอ่านแล้ว' : 'ทำเครื่องหมายใหม่'} style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--surface-2)', border: '1px solid var(--border)', color: isNew ? '#f59e0b' : '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                    {isNew ? <Circle size={16} /> : <CheckCircle2 size={16} />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

/* shared */
