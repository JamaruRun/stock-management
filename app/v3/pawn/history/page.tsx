'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-client';
import {
  Coins, ArrowLeft, Search, Smartphone, User, Calendar, RotateCcw, TrendingUp, Loader2,
} from 'lucide-react';

export default function V3PawnHistoryPage() {
  const supabase = createClient();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('pawn_history')
        .select('*')
        .order('redeem_date', { ascending: false })
        .limit(500);
      setItems(data || []);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(i =>
      (i.model || '').toLowerCase().includes(q) ||
      (i.imei || '').toLowerCase().includes(q) ||
      (i.customer_name || '').toLowerCase().includes(q)
    );
  }, [items, search]);

  const summary = useMemo(() => {
    const count = items.length;
    const interest = items.reduce((s, i) => s + Number(i.total_interest_paid || 0), 0);
    return { count, interest };
  }, [items]);

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <Link href="/v3/pawn" style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--surface-2)', color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', flexShrink: 0 }}>
          <ArrowLeft size={20} />
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: '#fef3c7', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <RotateCcw size={20} />
          </div>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700, fontFamily: 'Prompt, sans-serif' }}>ประวัติจำนำ</h1>
            <p style={{ fontSize: 11, color: 'var(--text-dim)' }}>เครื่องที่ไถ่คืนแล้ว</p>
          </div>
        </div>
      </div>

      {/* summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        <div className="v3-card" style={{ padding: 14 }}>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>ไถ่คืนแล้วทั้งหมด</div>
          <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'Prompt, sans-serif' }}>{summary.count} <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>เครื่อง</span></div>
        </div>
        <div className="v3-card" style={{ padding: 14 }}>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>ดอกเบี้ยที่ได้รับ</div>
          <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'Prompt, sans-serif', color: '#16a34a' }}>฿{summary.interest.toLocaleString()}</div>
        </div>
      </div>

      <div className="v3-card" style={{ padding: 10, marginBottom: 12 }}>
        <div style={{ position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหา รุ่น / IMEI / ลูกค้า..."
            style={{ width: '100%', height: 38, padding: '0 12px 0 36px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
        </div>
      </div>

      {loading ? (
        <div className="v3-card" style={{ padding: 60, textAlign: 'center', color: 'var(--text-dim)' }}>
          <Loader2 size={24} className="v3-spin" style={{ marginBottom: 10 }} /><div>กำลังโหลด...</div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="v3-card" style={{ textAlign: 'center', padding: 40 }}>
          <Coins size={48} strokeWidth={1.2} style={{ margin: '0 auto 12px', color: 'var(--text-muted)' }} />
          <div style={{ fontSize: 14, fontWeight: 600 }}>{search ? 'ไม่พบรายการ' : 'ยังไม่มีประวัติไถ่คืน'}</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(item => (
            <div key={item.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderLeft: '4px solid #22c55e', borderRadius: 14, padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: '#dcfce7', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Smartphone size={19} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'Prompt, Sarabun, sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.model}</div>
                {item.imei && <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'monospace' }}>{item.imei}</div>}
                <div style={{ display: 'flex', gap: 10, fontSize: 11, color: 'var(--text-dim)', marginTop: 3, flexWrap: 'wrap' }}>
                  <span><User size={10} style={{ display: 'inline', verticalAlign: '-1px' }} /> {item.customer_name}</span>
                  <span><Calendar size={10} style={{ display: 'inline', verticalAlign: '-1px' }} /> {item.redeem_date ? new Date(item.redeem_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) : '-'}</span>
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>฿{Number(item.pawn_price).toLocaleString()}</div>
                {Number(item.total_interest_paid) > 0 && (
                  <div style={{ fontSize: 10, color: '#16a34a', fontWeight: 600 }}>+ดอก ฿{Number(item.total_interest_paid).toLocaleString()}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
