'use client';

import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase-client';
import { Shield, Store, Crown, User, LogIn, Clock, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Header, FilterTabs, SearchBar, LoadingCard, EmptyCard } from '../SAShared';

function shopName(p: any) { return p.shops?.[0]?.name || p.shops?.name || '—'; }

function isOnline(ts: string | null) {
  if (!ts) return false;
  return (Date.now() - new Date(ts).getTime()) < 2 * 60 * 1000; // ออนไลน์ = active ใน 2 นาที
}
function timeAgo(ts: string | null) {
  if (!ts) return 'ยังไม่เคยเข้า';
  const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (s < 60) return 'ออนไลน์อยู่';
  if (s < 3600) return `${Math.floor(s / 60)} นาทีที่แล้ว`;
  if (s < 86400) return `${Math.floor(s / 3600)} ชม.ที่แล้ว`;
  if (s < 2592000) return `${Math.floor(s / 86400)} วันที่แล้ว`;
  return new Date(ts).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
}

export default function V3SAUsersPage() {
  const supabase = createClient();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'online' | 'admin' | 'staff'>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  function notify(msg: string, ok = true) { setToast({ msg, ok }); setTimeout(() => setToast(null), 2800); }

  async function load() {
    const { data } = await supabase.from('profiles')
      .select('id, username, full_name, role, is_super_admin, last_seen_at, shop_id, shops(name)')
      .order('last_seen_at', { ascending: false, nullsFirst: false })
      .limit(500);
    setItems(data || []);
    setLoading(false);
  }
  useEffect(() => {
    load();
    const t = setInterval(load, 30000); // refresh สถานะออนไลน์ทุก 30 วิ
    return () => clearInterval(t);
  }, []);

  async function handleImpersonate(u: any) {
    if (u.is_super_admin) return notify('เข้าสู่ระบบเป็น super admin ไม่ได้', false);
    const ok = confirm(
      `🔐 เข้าสู่ระบบเป็น ${u.full_name || u.username}?\n\n` +
      `🏪 ร้าน: ${shopName(u)}\n👤 สิทธิ์: ${u.role}\n\n` +
      `⚠️ คุณจะออกจากบัญชี super admin\nทุกอย่างจะเกิดในชื่อผู้ใช้นี้\nเสร็จแล้วต้องเข้าสู่ระบบกลับเป็น super admin\n\nดำเนินการต่อ?`
    );
    if (!ok) return;
    setBusyId(u.id);
    notify('กำลังเข้าสู่ระบบ...');
    try {
      const res = await fetch('/api/super-admin/impersonate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: u.id }),
      });
      const data = await res.json();
      if (!res.ok) { setBusyId(null); return notify('ไม่สำเร็จ: ' + (data.error || ''), false); }
      await supabase.auth.signOut();
      await new Promise(r => setTimeout(r, 300));
      window.location.href = data.action_link;
    } catch (e: any) {
      setBusyId(null);
      notify('เกิดข้อผิดพลาด: ' + e.message, false);
    }
  }

  const onlineCount = items.filter(i => isOnline(i.last_seen_at)).length;
  const filtered = useMemo(() => {
    let list = items;
    if (filter === 'online') list = list.filter(i => isOnline(i.last_seen_at));
    else if (filter === 'admin') list = list.filter(i => i.role === 'admin' || i.is_super_admin);
    else if (filter === 'staff') list = list.filter(i => i.role !== 'admin' && !i.is_super_admin);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter(i => (i.full_name || '').toLowerCase().includes(q) || (i.username || '').toLowerCase().includes(q) || shopName(i).toLowerCase().includes(q));
    return list;
  }, [items, search, filter]);

  return (
    <>
      <Header Icon={Shield} title="ผู้ใช้ทั้งหมด" subtitle={`${items.length} บัญชี · ออนไลน์ ${onlineCount}`} color="#8b5cf6" />
      <FilterTabs
        tabs={[['all', `ทั้งหมด ${items.length}`], ['online', `🟢 ออนไลน์ ${onlineCount}`], ['admin', 'แอดมิน'], ['staff', 'พนักงาน']]}
        active={filter} onChange={(v) => setFilter(v as any)}
      />
      <SearchBar value={search} onChange={setSearch} placeholder="ค้นหา ชื่อ/username/ร้าน..." />

      {loading ? <LoadingCard /> : filtered.length === 0 ? <EmptyCard Icon={Shield} text="ไม่พบผู้ใช้" /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(u => {
            const isAdmin = u.role === 'admin' || u.is_super_admin;
            const online = isOnline(u.last_seen_at);
            return (
              <div key={u.id} className="v3-card" style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 12, background: isAdmin ? '#ede9fe' : 'var(--surface-2)', color: isAdmin ? '#8b5cf6' : 'var(--text-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {u.is_super_admin ? <Crown size={19} /> : isAdmin ? <Shield size={19} /> : <User size={19} />}
                  </div>
                  {online && <span style={{ position: 'absolute', bottom: -1, right: -1, width: 12, height: 12, borderRadius: 100, background: '#22c55e', border: '2px solid var(--surface)' }} />}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {u.full_name || u.username} {u.is_super_admin && <span style={{ fontSize: 10, color: '#8b5cf6', fontWeight: 700 }}>· SUPER</span>}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 1 }}>
                    <span>@{u.username}</span>
                    <span><Store size={10} style={{ display: 'inline', verticalAlign: '-1px' }} /> {shopName(u)}</span>
                  </div>
                  <div style={{ fontSize: 10.5, marginTop: 3, display: 'flex', alignItems: 'center', gap: 4, color: online ? '#16a34a' : 'var(--text-muted)', fontWeight: online ? 700 : 500 }}>
                    <Clock size={10} /> {online ? 'ออนไลน์อยู่ตอนนี้' : `เข้าใช้ล่าสุด: ${timeAgo(u.last_seen_at)}`}
                  </div>
                </div>

                {!u.is_super_admin && (
                  <button
                    onClick={() => handleImpersonate(u)}
                    disabled={busyId === u.id}
                    title="เข้าสู่ระบบเป็นบัญชีนี้"
                    style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5, padding: '8px 11px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface-2)', color: '#8b5cf6', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    {busyId === u.id ? <Loader2 size={14} className="v3-spin" /> : <LogIn size={14} />} เข้าใช้
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)', background: toast.ok ? '#16a34a' : '#dc2626', color: '#fff', padding: '12px 20px', borderRadius: 12, fontSize: 13, fontWeight: 600, boxShadow: '0 8px 24px rgba(0,0,0,0.2)', zIndex: 300, maxWidth: '90vw', display: 'flex', alignItems: 'center', gap: 8 }}>
          {toast.ok ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />} {toast.msg}
        </div>
      )}
    </>
  );
}
