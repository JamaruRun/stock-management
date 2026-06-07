'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';
import {
  Shield, Store, Plus, Search, Phone, Crown, Clock, AlertTriangle,
  CheckCircle2, XCircle, TrendingUp, Users, MessageSquare, Sparkles,
  MoreVertical, Calendar, RefreshCw, Pause, Play, Edit2, Trash2,
  Loader2, Lock, DollarSign, Inbox, ChevronRight, X, Zap, Bell, Megaphone,
} from 'lucide-react';
import AnnouncementsManageModal from './AnnouncementsManageModal';

interface Shop {
  id: string;
  name: string;
  owner_name?: string | null;
  phone?: string | null;
  email?: string | null;
  package: 'trial' | 'monthly' | 'yearly' | 'lifetime';
  expires_at?: string | null;
  status: 'active' | 'suspended' | 'expired';
  note?: string | null;
  created_at?: string;
}

// ราคาประมาณการ (ปรับได้ตามจริง) — ใช้คำนวณ MRR
const PACKAGE_PRICE = { monthly: 299, yearly: 2990, lifetime: 4990, trial: 0 };
const PACKAGE_LABEL: Record<string, string> = {
  trial: 'ทดลอง', monthly: 'รายเดือน', yearly: 'รายปี', lifetime: 'ตลอดชีพ',
};
const PACKAGE_COLOR: Record<string, string> = {
  trial: '#94a3b8', monthly: '#3b82f6', yearly: '#8b5cf6', lifetime: '#f59e0b',
};

function daysLeft(expiresAt?: string | null): number | null {
  if (!expiresAt) return null;
  const diff = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  return diff;
}

export default function V3SuperAdminPage() {
  const supabase = createClient();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isSuper, setIsSuper] = useState(false);
  const [accessChecked, setAccessChecked] = useState(false);

  const [shops, setShops] = useState<Shop[]>([]);
  const [betaPending, setBetaPending] = useState(0);
  const [feedbackNew, setFeedbackNew] = useState(0);

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'trial' | 'paid' | 'expiring' | 'expired' | 'suspended'>('all');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Shop | null>(null);
  const [showAnnounce, setShowAnnounce] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  function notify(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 2600);
  }

  async function loadData() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      const { data: p } = await supabase
        .from('profiles')
        .select('is_super_admin')
        .eq('id', user.id)
        .single();

      const sa = !!p?.is_super_admin;
      setIsSuper(sa);
      setAccessChecked(true);
      if (!sa) { setLoading(false); return; }

      const [shopsRes, betaRes, fbRes] = await Promise.all([
        supabase.from('shops').select('*').order('created_at', { ascending: false }),
        supabase.from('beta_signups').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('feedback').select('id', { count: 'exact', head: true }).eq('status', 'new'),
      ]);

      setShops((shopsRes.data || []) as Shop[]);
      setBetaPending(betaRes.count || 0);
      setFeedbackNew(fbRes.count || 0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  const stats = useMemo(() => {
    let active = 0, trial = 0, paid = 0, expiring = 0, expired = 0, suspended = 0, mrr = 0;
    shops.forEach(s => {
      if (s.status === 'suspended') { suspended++; return; }
      if (s.package === 'trial') trial++;
      else paid++;
      const d = daysLeft(s.expires_at);
      if (s.status === 'expired' || (d !== null && d <= 0)) { expired++; return; }
      if (d !== null && d <= 7) expiring++;
      active++;
      // MRR
      if (s.package === 'monthly') mrr += PACKAGE_PRICE.monthly;
      else if (s.package === 'yearly') mrr += PACKAGE_PRICE.yearly / 12;
    });
    return { total: shops.length, active, trial, paid, expiring, expired, suspended, mrr: Math.round(mrr) };
  }, [shops]);

  // ร้านใกล้หมดอายุ (เรียงด่วนสุดก่อน)
  const expiringShops = useMemo(() => {
    return shops
      .filter(s => s.status !== 'suspended' && s.package !== 'lifetime')
      .map(s => ({ s, d: daysLeft(s.expires_at) }))
      .filter(x => x.d !== null && x.d <= 7)
      .sort((a, b) => (a.d! - b.d!))
      .slice(0, 8);
  }, [shops]);

  const filtered = useMemo(() => {
    return shops.filter(s => {
      const d = daysLeft(s.expires_at);
      const isExpired = s.status === 'expired' || (d !== null && d <= 0);
      if (filter === 'active' && (s.status === 'suspended' || isExpired)) return false;
      if (filter === 'trial' && s.package !== 'trial') return false;
      if (filter === 'paid' && s.package === 'trial') return false;
      if (filter === 'expiring' && !(d !== null && d > 0 && d <= 7 && s.status !== 'suspended')) return false;
      if (filter === 'expired' && !isExpired) return false;
      if (filter === 'suspended' && s.status !== 'suspended') return false;
      if (search) {
        const q = search.toLowerCase();
        if (!s.name.toLowerCase().includes(q) &&
            !(s.owner_name || '').toLowerCase().includes(q) &&
            !(s.phone || '').toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [shops, filter, search]);

  async function extendShop(shop: Shop, days: number) {
    setBusy(true);
    const cur = shop.expires_at ? new Date(shop.expires_at) : new Date();
    const base = new Date(Math.max(cur.getTime(), Date.now()));
    base.setDate(base.getDate() + days);
    const res = await fetch('/api/super-admin/update-shop', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...shop, expires_at: base.toISOString(), status: 'active' }),
    });
    setBusy(false); setMenuOpenId(null);
    if (!res.ok) return notify('ต่ออายุไม่สำเร็จ', false);
    notify(`ต่ออายุ ${shop.name} +${days} วัน ✓`);
    loadData();
  }

  async function toggleSuspend(shop: Shop) {
    const next = shop.status === 'suspended' ? 'active' : 'suspended';
    setBusy(true);
    const res = await fetch('/api/super-admin/update-shop', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...shop, status: next }),
    });
    setBusy(false); setMenuOpenId(null);
    if (!res.ok) return notify('เปลี่ยนสถานะไม่สำเร็จ', false);
    notify(next === 'suspended' ? `ระงับ ${shop.name} แล้ว` : `เปิดใช้ ${shop.name} แล้ว`);
    loadData();
  }

  async function deleteShop(shop: Shop) {
    if (!confirm(`ลบร้าน "${shop.name}" ถาวร?\n\nข้อมูลทั้งหมดของร้านนี้จะหายไปทั้งหมด ย้อนกลับไม่ได้!`)) return;
    setBusy(true);
    const res = await fetch('/api/super-admin/delete-shop', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shopId: shop.id }),
    });
    setBusy(false); setMenuOpenId(null);
    if (!res.ok) return notify('ลบไม่สำเร็จ', false);
    notify(`ลบ ${shop.name} แล้ว`);
    loadData();
  }

  if (accessChecked && !isSuper) {
    return (
      <div className="v3-card" style={{ padding: 40, textAlign: 'center' }}>
        <Lock size={48} strokeWidth={1.2} style={{ margin: '0 auto 12px', color: 'var(--text-muted)' }} />
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>เฉพาะ Super Admin</h2>
        <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>หน้านี้สงวนสำหรับผู้ดูแลระบบสูงสุด</p>
      </div>
    );
  }

  return (
    <>
      <div className="v3-page-header v3-desktop-only">
        <div>
          <h1 className="v3-page-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Shield size={22} color="#8b5cf6" /> Super Admin
          </h1>
          <p className="v3-page-subtitle">ศูนย์บัญชาการ — จัดการทุกร้านในระบบ</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="v3-btn v3-btn-primary">
          <Plus size={16} strokeWidth={2.5} /> สร้างร้านใหม่
        </button>
      </div>

      <div className="v3-mobile-only" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, fontFamily: 'Prompt, sans-serif', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Shield size={18} color="#8b5cf6" /> Super Admin
          </h1>
          <p style={{ fontSize: 11, color: 'var(--text-dim)' }}>จัดการทุกร้านในระบบ</p>
        </div>
        <button onClick={() => setShowCreate(true)} style={{
          width: 40, height: 40, borderRadius: 10, background: 'var(--accent)',
          color: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
        }}>
          <Plus size={20} strokeWidth={2.5} />
        </button>
      </div>

      {loading ? (
        <div className="v3-card" style={{ padding: 60, textAlign: 'center', color: 'var(--text-dim)' }}>
          <Loader2 size={24} className="v3-spin" style={{ marginBottom: 10 }} />
          <div>กำลังโหลด...</div>
        </div>
      ) : (
        <>
          {/* KPI cards */}
          <div className="v3-sa-kpis" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
            <Kpi label="ร้านทั้งหมด" value={stats.total} sub={`${stats.active} ใช้งานอยู่`} color="#3b82f6" Icon={Store} />
            <Kpi label="จ่ายเงินแล้ว" value={stats.paid} sub={`ทดลอง ${stats.trial}`} color="#22c55e" Icon={Crown} />
            <Kpi label="รายได้/เดือน" value={`฿${stats.mrr.toLocaleString()}`} sub="ประมาณการ (MRR)" color="#f59e0b" Icon={DollarSign} />
            <Kpi label="ใกล้หมดอายุ" value={stats.expiring} sub={`หมดแล้ว ${stats.expired}`} color="#ef4444" Icon={AlertTriangle} />
          </div>

          {/* Action Center — ต้องทำวันนี้ */}
          <div className="v3-card" style={{ padding: 16, marginBottom: 14, border: '1px solid #fde68a', background: 'linear-gradient(180deg, #fffbeb 0%, var(--surface) 60%)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: '#fef3c7', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Zap size={16} />
              </div>
              <h3 style={{ fontSize: 14, fontWeight: 700, fontFamily: 'Prompt, sans-serif' }}>ต้องทำวันนี้</h3>
            </div>

            {/* quick links */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: expiringShops.length ? 14 : 0 }}>
              <ActionLink
                href="/super-admin/beta"
                Icon={Inbox}
                label="Beta รออนุมัติ"
                count={betaPending}
                color="#3b82f6"
                empty={betaPending === 0}
              />
              <ActionLink
                href="/super-admin/feedback"
                Icon={MessageSquare}
                label="Feedback ใหม่"
                count={feedbackNew}
                color="#8b5cf6"
                empty={feedbackNew === 0}
              />
            </div>

            {/* expiring shops with call + extend */}
            {expiringShops.length > 0 ? (
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 600, marginBottom: 8 }}>
                  🔔 ร้านใกล้หมดอายุ — ติดต่อต่ออายุ ({expiringShops.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {expiringShops.map(({ s, d }) => (
                    <div key={s.id} style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: 10,
                      background: 'var(--surface-2)', borderRadius: 10,
                      borderLeft: `3px solid ${d! <= 2 ? '#ef4444' : '#f59e0b'}`,
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {s.name}
                        </div>
                        <div style={{ fontSize: 10, color: d! <= 2 ? '#ef4444' : '#d97706', fontWeight: 600 }}>
                          {d! <= 0 ? 'หมดอายุแล้ว' : `เหลือ ${d} วัน`}
                          {s.owner_name && <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> · {s.owner_name}</span>}
                        </div>
                      </div>
                      {s.phone && (
                        <a href={`tel:${s.phone}`} style={{
                          width: 32, height: 32, borderRadius: 8, background: '#dcfce7', color: '#16a34a',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', flexShrink: 0,
                        }}>
                          <Phone size={14} />
                        </a>
                      )}
                      <button onClick={() => extendShop(s, 30)} disabled={busy} style={{
                        padding: '7px 10px', borderRadius: 8, background: 'var(--accent)', color: '#fff',
                        border: 'none', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0,
                      }}>
                        +30 วัน
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : betaPending === 0 && feedbackNew === 0 ? (
              <div style={{ textAlign: 'center', padding: '8px 0', fontSize: 12, color: '#16a34a', fontWeight: 600 }}>
                <CheckCircle2 size={16} style={{ display: 'inline', marginRight: 6, verticalAlign: '-3px' }} />
                เคลียร์หมดแล้ว ไม่มีงานค้าง 🎉
              </div>
            ) : null}
          </div>

          {/* Quick nav to sub-tools */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, marginBottom: 14 }}>
            <NavTile href="/super-admin/activity" Icon={TrendingUp} label="กิจกรรมร้าน" color="#3b82f6" />
            <NavTile href="/super-admin/online" Icon={Users} label="ออนไลน์ตอนนี้" color="#22c55e" />
            <NavTile href="/super-admin/users" Icon={Shield} label="ผู้ใช้ทั้งหมด" color="#8b5cf6" />
            <NavTile href="/super-admin/feedback" Icon={MessageSquare} label="Feedback" color="#f59e0b" />
            <button onClick={() => setShowAnnounce(true)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '14px 8px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: '#ede9fe', color: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Megaphone size={17} /></div>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)' }}>ส่งประกาศ</span>
            </button>
          </div>

          {/* Shops list */}
          <div className="v3-card" style={{ padding: 10, marginBottom: 12 }}>
            <div style={{ position: 'relative', marginBottom: 10 }}>
              <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
              <input
                type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="ค้นหาร้าน / เจ้าของ / เบอร์..."
                style={{ width: '100%', height: 38, padding: '0 12px 0 36px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', outline: 'none' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
              <Tab active={filter === 'all'} onClick={() => setFilter('all')} label="ทั้งหมด" count={stats.total} />
              <Tab active={filter === 'active'} onClick={() => setFilter('active')} label="ใช้งาน" count={stats.active} color="#22c55e" />
              <Tab active={filter === 'paid'} onClick={() => setFilter('paid')} label="จ่ายเงิน" count={stats.paid} color="#3b82f6" />
              <Tab active={filter === 'trial'} onClick={() => setFilter('trial')} label="ทดลอง" count={stats.trial} color="#94a3b8" />
              <Tab active={filter === 'expiring'} onClick={() => setFilter('expiring')} label="ใกล้หมด" count={stats.expiring} color="#f59e0b" />
              <Tab active={filter === 'expired'} onClick={() => setFilter('expired')} label="หมดอายุ" count={stats.expired} color="#ef4444" />
              <Tab active={filter === 'suspended'} onClick={() => setFilter('suspended')} label="ระงับ" count={stats.suspended} color="#6b7280" />
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="v3-card" style={{ textAlign: 'center', padding: 40 }}>
              <Store size={48} strokeWidth={1.2} style={{ margin: '0 auto 12px', color: 'var(--text-muted)' }} />
              <div style={{ fontSize: 14, fontWeight: 600 }}>ไม่พบร้านตามที่ค้นหา</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filtered.map(s => (
                <ShopCard
                  key={s.id}
                  shop={s}
                  menuOpen={menuOpenId === s.id}
                  busy={busy}
                  onToggleMenu={() => setMenuOpenId(menuOpenId === s.id ? null : s.id)}
                  onClose={() => setMenuOpenId(null)}
                  onExtend={extendShop}
                  onSuspend={() => toggleSuspend(s)}
                  onEdit={() => { setMenuOpenId(null); setEditing(s); }}
                  onDelete={() => deleteShop(s)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {showCreate && (
        <CreateShopModal onClose={() => setShowCreate(false)} onSuccess={() => { setShowCreate(false); loadData(); notify('สร้างร้านสำเร็จ ✓'); }} />
      )}
      {editing && (
        <EditShopModal shop={editing} onClose={() => setEditing(null)} onSuccess={() => { setEditing(null); loadData(); notify('บันทึกสำเร็จ ✓'); }} />
      )}

      {toast && (
        <div style={{
          position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)',
          background: toast.ok ? '#16a34a' : '#dc2626', color: '#fff',
          padding: '12px 20px', borderRadius: 12, fontSize: 13, fontWeight: 600,
          boxShadow: '0 8px 24px rgba(0,0,0,0.2)', zIndex: 200, maxWidth: '90vw',
        }}>
          {toast.msg}
        </div>
      )}

      {showAnnounce && <AnnouncementsManageModal onClose={() => setShowAnnounce(false)} />}

      <style jsx>{`
        @media (max-width: 640px) {
          :global(.v3-sa-kpis) { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>
    </>
  );
}

/* ===== Components ===== */

function Kpi({ label, value, sub, color, Icon }: any) {
  return (
    <div className="v3-card" style={{ padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: `${color}15`, color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon size={17} strokeWidth={2.2} />
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{label}</div>
      </div>
      <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'Prompt, sans-serif', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>{sub}</div>
    </div>
  );
}

function ActionLink({ href, Icon, label, count, color, empty }: any) {
  return (
    <Link href={href} style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: 12,
      background: empty ? 'var(--surface-2)' : `${color}12`,
      border: `1px solid ${empty ? 'var(--border)' : color + '40'}`,
      borderRadius: 12, textDecoration: 'none', position: 'relative',
    }}>
      <div style={{ width: 34, height: 34, borderRadius: 10, background: empty ? 'var(--surface)' : color, color: empty ? 'var(--text-dim)' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={16} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{label}</div>
        <div style={{ fontSize: 11, color: empty ? 'var(--text-muted)' : color, fontWeight: 600 }}>
          {empty ? 'ไม่มีรายการ' : `${count} รายการรอ`}
        </div>
      </div>
      {!empty && (
        <span style={{ background: color, color: '#fff', minWidth: 22, height: 22, borderRadius: 11, fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 6px' }}>
          {count}
        </span>
      )}
    </Link>
  );
}

function NavTile({ href, Icon, label, color }: any) {
  return (
    <Link href={href} style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '14px 8px',
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, textDecoration: 'none',
    }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: `${color}15`, color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={18} />
      </div>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', textAlign: 'center' }}>{label}</div>
    </Link>
  );
}

function Tab({ active, onClick, label, count, color }: any) {
  return (
    <button onClick={onClick} style={{
      flexShrink: 0, padding: '7px 12px', borderRadius: 100, border: '1px solid',
      borderColor: active ? (color || 'var(--accent)') : 'var(--border)',
      background: active ? (color || 'var(--accent)') : 'var(--surface)',
      color: active ? '#fff' : 'var(--text)', fontSize: 12, fontWeight: 600,
      cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
    }}>
      {label}
      <span style={{ background: active ? 'rgba(255,255,255,0.25)' : 'var(--surface-2)', padding: '1px 7px', borderRadius: 100, fontSize: 10, fontWeight: 700 }}>
        {count}
      </span>
    </button>
  );
}

function ShopCard({ shop, menuOpen, busy, onToggleMenu, onClose, onExtend, onSuspend, onEdit, onDelete }: any) {
  const d = daysLeft(shop.expires_at);
  const isExpired = shop.status === 'expired' || (d !== null && d <= 0);
  const pkgColor = PACKAGE_COLOR[shop.package] || '#94a3b8';
  let statusColor = '#22c55e', statusLabel = 'ใช้งาน';
  if (shop.status === 'suspended') { statusColor = '#6b7280'; statusLabel = 'ระงับ'; }
  else if (isExpired) { statusColor = '#ef4444'; statusLabel = 'หมดอายุ'; }
  else if (d !== null && d <= 7) { statusColor = '#f59e0b'; statusLabel = `เหลือ ${d} วัน`; }
  else if (shop.package === 'lifetime') { statusColor = '#f59e0b'; statusLabel = 'ตลอดชีพ'; }
  else if (d !== null) { statusLabel = `เหลือ ${d} วัน`; }

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderLeft: `4px solid ${statusColor}`, borderRadius: 14, padding: 14,
      display: 'flex', alignItems: 'center', gap: 12, position: 'relative',
    }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: `${pkgColor}15`, color: pkgColor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Store size={20} strokeWidth={2.2} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'Prompt, Sarabun, sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {shop.name}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>
          {shop.owner_name && <span>{shop.owner_name}</span>}
          {shop.phone && <span>{shop.phone}</span>}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
          <span style={{ padding: '2px 8px', fontSize: 10, fontWeight: 700, borderRadius: 100, background: `${pkgColor}18`, color: pkgColor }}>
            {PACKAGE_LABEL[shop.package]}
          </span>
          <span style={{ padding: '2px 8px', fontSize: 10, fontWeight: 700, borderRadius: 100, background: `${statusColor}18`, color: statusColor }}>
            {statusLabel}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
        {shop.phone && (
          <a href={`tel:${shop.phone}`} style={{ width: 32, height: 32, borderRadius: 8, background: '#dcfce7', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>
            <Phone size={14} />
          </a>
        )}
        <div style={{ position: 'relative' }}>
          <button onClick={onToggleMenu} style={{ width: 32, height: 32, background: 'var(--surface-2)', border: 'none', borderRadius: 8, cursor: 'pointer', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <MoreVertical size={15} />
          </button>
          {menuOpen && (
            <>
              <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 19 }} />
              <div style={{ position: 'absolute', top: 36, right: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: 'var(--shadow-lg)', minWidth: 170, padding: 4, zIndex: 20 }}>
                <button onClick={() => onExtend(shop, 30)} disabled={busy} style={menuBtn}>
                  <RefreshCw size={13} /> ต่ออายุ +30 วัน
                </button>
                <button onClick={() => onExtend(shop, 365)} disabled={busy} style={menuBtn}>
                  <Calendar size={13} /> ต่ออายุ +365 วัน
                </button>
                <button onClick={onSuspend} disabled={busy} style={menuBtn}>
                  {shop.status === 'suspended' ? <><Play size={13} /> เปิดใช้งาน</> : <><Pause size={13} /> ระงับร้าน</>}
                </button>
                <button onClick={onEdit} style={menuBtn}>
                  <Edit2 size={13} /> แก้ไขข้อมูล
                </button>
                <button onClick={onDelete} disabled={busy} style={{ ...menuBtn, color: 'var(--danger)' }}>
                  <Trash2 size={13} /> ลบร้าน
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function CreateShopModal({ onClose, onSuccess }: any) {
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');
  const [form, setForm] = useState({
    name: '', owner_name: '', phone: '', email: '',
    package: 'trial', trialDays: 30,
    adminUsername: '', adminPassword: '', adminFullName: '', branchName: 'สาขาหลัก',
  });
  function up(k: string, v: any) { setForm({ ...form, [k]: v }); if (err) setErr(''); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.adminUsername || !form.adminPassword || !form.adminFullName)
      return setErr('กรอกข้อมูลที่จำเป็น (*) ให้ครบ');
    if (form.adminPassword.length < 6) return setErr('รหัสผ่านอย่างน้อย 6 ตัว');
    setSubmitting(true);
    const res = await fetch('/api/super-admin/create-shop', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    });
    const r = await res.json().catch(() => ({}));
    setSubmitting(false);
    if (!res.ok) return setErr(r.error || 'สร้างไม่สำเร็จ');
    onSuccess();
  }

  return (
    <Modal title="สร้างร้านใหม่" onClose={onClose}>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#3b82f6' }}>ข้อมูลร้าน</div>
        <F label="ชื่อร้าน" req><I value={form.name} onChange={(v: string) => up('name', v)} placeholder="เช่น ช่างปอง เซ็นทรัลบางนา" /></F>
        <div style={g2}>
          <F label="เจ้าของ"><I value={form.owner_name} onChange={(v: string) => up('owner_name', v)} placeholder="ชื่อเจ้าของ" /></F>
          <F label="เบอร์โทร"><I value={form.phone} onChange={(v: string) => up('phone', v)} placeholder="08x-xxx-xxxx" /></F>
        </div>
        <div style={g2}>
          <F label="แพ็กเกจ">
            <select value={form.package} onChange={(e) => up('package', e.target.value)} style={inp}>
              <option value="trial">ทดลอง</option>
              <option value="monthly">รายเดือน</option>
              <option value="yearly">รายปี</option>
              <option value="lifetime">ตลอดชีพ</option>
            </select>
          </F>
          <F label="จำนวนวัน (trial)"><I type="number" value={String(form.trialDays)} onChange={(v: string) => up('trialDays', parseInt(v) || 30)} placeholder="30" /></F>
        </div>

        <div style={{ fontSize: 11, fontWeight: 700, color: '#3b82f6', marginTop: 4 }}>บัญชีแอดมินร้าน</div>
        <div style={g2}>
          <F label="Username" req><I value={form.adminUsername} onChange={(v: string) => up('adminUsername', v.toLowerCase().replace(/[^a-z0-9_]/g, ''))} placeholder="admin" /></F>
          <F label="รหัสผ่าน" req><I value={form.adminPassword} onChange={(v: string) => up('adminPassword', v)} placeholder="≥6 ตัว" /></F>
        </div>
        <F label="ชื่อ-นามสกุลแอดมิน" req><I value={form.adminFullName} onChange={(v: string) => up('adminFullName', v)} placeholder="ชื่อจริง" /></F>

        {err && <div style={errBox}>{err}</div>}
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button type="button" onClick={onClose} style={btnSec}>ยกเลิก</button>
          <button type="submit" disabled={submitting} style={btnPri}>{submitting ? 'กำลังสร้าง...' : '+ สร้างร้าน'}</button>
        </div>
      </form>
    </Modal>
  );
}

function EditShopModal({ shop, onClose, onSuccess }: any) {
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');
  const [form, setForm] = useState({
    name: shop.name || '', owner_name: shop.owner_name || '', phone: shop.phone || '',
    email: shop.email || '', package: shop.package, note: shop.note || '',
  });
  function up(k: string, v: any) { setForm({ ...form, [k]: v }); if (err) setErr(''); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name) return setErr('ต้องมีชื่อร้าน');
    setSubmitting(true);
    const res = await fetch('/api/super-admin/update-shop', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: shop.id, ...form }),
    });
    const r = await res.json().catch(() => ({}));
    setSubmitting(false);
    if (!res.ok) return setErr(r.error || 'บันทึกไม่สำเร็จ');
    onSuccess();
  }

  return (
    <Modal title={`แก้ไข: ${shop.name}`} onClose={onClose}>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <F label="ชื่อร้าน" req><I value={form.name} onChange={(v: string) => up('name', v)} /></F>
        <div style={g2}>
          <F label="เจ้าของ"><I value={form.owner_name} onChange={(v: string) => up('owner_name', v)} /></F>
          <F label="เบอร์โทร"><I value={form.phone} onChange={(v: string) => up('phone', v)} /></F>
        </div>
        <F label="อีเมล"><I value={form.email} onChange={(v: string) => up('email', v)} /></F>
        <F label="แพ็กเกจ">
          <select value={form.package} onChange={(e) => up('package', e.target.value)} style={inp}>
            <option value="trial">ทดลอง</option>
            <option value="monthly">รายเดือน</option>
            <option value="yearly">รายปี</option>
            <option value="lifetime">ตลอดชีพ</option>
          </select>
        </F>
        <F label="หมายเหตุ (เห็นเฉพาะคุณ)">
          <textarea value={form.note} onChange={(e) => up('note', e.target.value)} placeholder="เช่น ลูกค้าดี จ่ายตรง / ขอส่วนลด ฯลฯ" rows={2} style={{ ...inp, padding: '10px 12px', minHeight: 56, resize: 'vertical' }} />
        </F>
        {err && <div style={errBox}>{err}</div>}
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button type="button" onClick={onClose} style={btnSec}>ยกเลิก</button>
          <button type="submit" disabled={submitting} style={btnPri}>{submitting ? 'กำลังบันทึก...' : 'บันทึก'}</button>
        </div>
      </form>
    </Modal>
  );
}

function Modal({ title, onClose, children }: any) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} className="v3-card" style={{ maxWidth: 460, width: '100%', padding: 18, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, fontFamily: 'Prompt, sans-serif' }}>{title}</h2>
          <button onClick={onClose} style={{ width: 32, height: 32, background: 'var(--surface-2)', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function F({ label, req, children }: any) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4, color: 'var(--text)' }}>
        {label} {req && <span style={{ color: '#ef4444' }}>*</span>}
      </label>
      {children}
    </div>
  );
}

function I({ value, onChange, placeholder, type = 'text' }: any) {
  return <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={inp} />;
}

const inp: React.CSSProperties = {
  width: '100%', height: 38, padding: '0 12px', background: 'var(--surface-2)',
  border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', outline: 'none',
};
const g2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 };
const errBox: React.CSSProperties = { padding: '10px 12px', background: '#fee2e2', color: '#991b1b', borderRadius: 10, fontSize: 12, fontWeight: 500 };
const btnPri: React.CSSProperties = { flex: 1, padding: '11px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' };
const btnSec: React.CSSProperties = { flex: 1, padding: '11px', background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
const menuBtn: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, padding: '9px 10px', borderRadius: 6, color: 'var(--text)', fontSize: 12, border: 'none', background: 'transparent', width: '100%', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' };
