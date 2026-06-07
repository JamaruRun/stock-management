'use client';

import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase-client';
import {
  Sparkles, Store, Phone, MapPin, Check, X, Clock, AtSign, MessageSquare,
  KeyRound, Eye, EyeOff, ChevronDown, ChevronUp, Trash2, Pencil, Loader2,
  CheckCircle2, AlertCircle, Save, UserCheck, Mail,
} from 'lucide-react';
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
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showPw, setShowPw] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  function notify(msg: string, ok = true) { setToast({ msg, ok }); setTimeout(() => setToast(null), 3500); }

  async function load() {
    const { data } = await supabase.from('beta_signups').select('*').order('created_at', { ascending: false }).limit(300);
    setItems(data || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  // อนุมัติ = สร้างบัญชีจริง (shop + auth user + profile) ด้วย user/pass ที่ลูกค้ากรอก
  async function approve(b: any) {
    if (!b.username || !b.password_hash) return notify('ไม่มี username/รหัสผ่าน ในใบสมัครนี้', false);
    const ok = confirm(`✅ อนุมัติ + สร้างบัญชีให้ "${b.shop_name}"?\n\nUsername: ${b.username}\nรหัสผ่าน: ${b.password_hash}\n\nลูกค้าจะเข้าสู่ระบบได้ทันทีด้วยข้อมูลนี้`);
    if (!ok) return;
    setBusy(b.id);
    try {
      const res = await fetch('/api/super-admin/create-shop', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: b.shop_name, owner_name: b.contact_name, phone: b.phone, email: null,
          package: 'trial', trialDays: 30,
          adminUsername: b.username, adminPassword: b.password_hash, adminFullName: b.contact_name,
          branchName: 'สาขาหลัก',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBusy(null);
        return notify('สร้างบัญชีไม่สำเร็จ: ' + (data.error || ''), false);
      }
      await supabase.from('beta_signups').update({ status: 'approved' }).eq('id', b.id);
      setBusy(null);
      notify(`สร้างบัญชีแล้ว! ลูกค้าล็อกอินด้วย ${b.username} ได้เลย 🎉`);
      load();
    } catch (e: any) {
      setBusy(null);
      notify('ผิดพลาด: ' + e.message, false);
    }
  }

  async function setStatus(b: any, status: string) {
    await supabase.from('beta_signups').update({ status }).eq('id', b.id);
    load();
  }

  async function remove(b: any) {
    const ok = confirm(`🗑️ ลบ "${b.shop_name}"?\n\n⚠️ ถ้าร้านนี้อนุมัติแล้ว ร้าน + ข้อมูลทั้งหมด + บัญชีผู้ใช้ จะถูกลบออกจากระบบถาวร\n\nยืนยันลบ?`);
    if (!ok) return;
    setBusy(b.id);
    try {
      const res = await fetch('/api/super-admin/delete-beta', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ betaId: b.id }),
      });
      const data = await res.json();
      setBusy(null);
      if (!res.ok) return notify('ลบไม่สำเร็จ: ' + (data.error || ''), false);
      notify(data.deletedShop ? 'ลบร้าน + ข้อมูลทั้งหมดแล้ว' : 'ลบใบสมัครแล้ว');
      load();
    } catch (e: any) {
      setBusy(null);
      notify('ผิดพลาด: ' + e.message, false);
    }
  }

  function startEdit(b: any) {
    setEditForm({
      shop_name: b.shop_name || '', contact_name: b.contact_name || '', phone: b.phone || '',
      username: b.username || '', password_hash: b.password_hash || '', line_id: b.line_id || '', note: b.note || '',
    });
    setEditing(b.id);
    setExpanded(b.id);
  }
  async function saveEdit(b: any) {
    if (editForm.username && !/^[a-z0-9_]{3,20}$/.test(editForm.username)) return notify('username ใช้ a-z,0-9,_ (3-20)', false);
    setBusy(b.id);
    const { error } = await supabase.from('beta_signups').update({
      shop_name: editForm.shop_name.trim(), contact_name: editForm.contact_name.trim(),
      phone: editForm.phone.trim(), username: editForm.username.trim().toLowerCase(),
      password_hash: editForm.password_hash, line_id: editForm.line_id.trim() || null, note: editForm.note.trim() || null,
    }).eq('id', b.id);
    setBusy(null);
    if (error) return notify('บันทึกไม่สำเร็จ: ' + error.message, false);
    setEditing(null);
    notify('บันทึกแล้ว' + (b.status === 'approved' ? ' (หมายเหตุ: ร้านที่อนุมัติแล้ว แก้ตรงนี้ไม่เปลี่ยนบัญชีจริง)' : ''));
    load();
  }

  const filtered = useMemo(() => {
    let list = items;
    if (filter !== 'all') list = list.filter(i => (i.status || 'pending') === filter);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter(i => [i.shop_name, i.contact_name, i.phone, i.username].some(v => (v || '').toLowerCase().includes(q)));
    return list;
  }, [items, search, filter]);

  const pending = items.filter(i => (i.status || 'pending') === 'pending').length;

  return (
    <>
      <Header Icon={Sparkles} title="Beta Signups" subtitle={`${pending} รอดำเนินการ · ${items.length} ทั้งหมด`} color="#8b5cf6" />
      <FilterTabs tabs={[['all', `ทั้งหมด ${items.length}`], ['pending', `รอ ${pending}`], ['approved', 'อนุมัติ'], ['rejected', 'ปฏิเสธ']]} active={filter} onChange={(v) => setFilter(v as any)} />
      <SearchBar value={search} onChange={setSearch} placeholder="ค้นหา ร้าน/ชื่อ/เบอร์/username..." />

      {loading ? <LoadingCard /> : filtered.length === 0 ? <EmptyCard Icon={Sparkles} text="ไม่มีรายการ" /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(b => {
            const st = STATUS[b.status || 'pending'];
            const isOpen = expanded === b.id;
            const isEdit = editing === b.id;
            const isBusy = busy === b.id;
            return (
              <div key={b.id} className="v3-card" style={{ padding: 14, borderLeft: `4px solid ${st.color}` }}>
                {/* header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'Prompt, sans-serif', display: 'flex', alignItems: 'center', gap: 6 }}><Store size={14} style={{ color: '#8b5cf6' }} /> {b.shop_name || '(ไม่ระบุชื่อร้าน)'}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      {b.contact_name && <span>{b.contact_name}</span>}
                      {b.phone && <a href={`tel:${b.phone}`} style={{ color: '#16a34a' }}><Phone size={11} style={{ display: 'inline', verticalAlign: '-1px' }} /> {b.phone}</a>}
                      {b.username && <span style={{ fontFamily: 'monospace', color: '#8b5cf6' }}><AtSign size={11} style={{ display: 'inline', verticalAlign: '-1px' }} />{b.username}</span>}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 5, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ color: st.color, fontWeight: 600 }}>● {st.label}</span>
                      <span>· {new Date(b.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}</span>
                    </div>
                  </div>
                  <button onClick={() => setExpanded(isOpen ? null : b.id)} style={iconBtn} title="ดูรายละเอียด">
                    {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                </div>

                {/* รายละเอียดทั้งหมด */}
                {isOpen && !isEdit && (
                  <div style={{ marginTop: 10, padding: 12, background: 'var(--surface-2)', borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12.5 }}>
                    <Detail Icon={AtSign} label="Username" value={b.username} mono />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <KeyRound size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                      <span style={{ color: 'var(--text-dim)', minWidth: 70 }}>รหัสผ่าน</span>
                      <span style={{ fontFamily: 'monospace', flex: 1 }}>{showPw[b.id] ? (b.password_hash || '—') : '••••••••'}</span>
                      <button onClick={() => setShowPw({ ...showPw, [b.id]: !showPw[b.id] })} style={{ ...iconBtn, width: 28, height: 28 }}>{showPw[b.id] ? <EyeOff size={13} /> : <Eye size={13} />}</button>
                    </div>
                    <Detail Icon={Store} label="ชื่อร้าน" value={b.shop_name} />
                    <Detail Icon={UserCheck} label="ผู้ติดต่อ" value={b.contact_name} />
                    <Detail Icon={Phone} label="เบอร์โทร" value={b.phone} />
                    <Detail Icon={MessageSquare} label="ติดต่อ" value={b.line_id} />
                    <Detail Icon={MapPin} label="จังหวัด" value={b.province} />
                    <Detail Icon={Sparkles} label="ประเภท" value={b.business_type} />
                    <Detail Icon={Store} label="ขนาด/สาขา" value={[b.shop_size, b.branch_count ? `${b.branch_count} สาขา` : ''].filter(Boolean).join(' · ')} />
                    <Detail Icon={Mail} label="หมายเหตุ" value={b.note} />
                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                      <button onClick={() => startEdit(b)} style={smallBtn('#3b82f6')}><Pencil size={13} /> แก้ไข</button>
                      <button onClick={() => remove(b)} disabled={isBusy} style={smallBtn('#ef4444')}>{isBusy ? <Loader2 size={13} className="v3-spin" /> : <Trash2 size={13} />} ลบร้าน</button>
                    </div>
                  </div>
                )}

                {/* แก้ไข */}
                {isOpen && isEdit && (
                  <div style={{ marginTop: 10, padding: 12, background: 'var(--surface-2)', borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <EditRow label="ชื่อร้าน" value={editForm.shop_name} onChange={(v: string) => setEditForm({ ...editForm, shop_name: v })} />
                    <EditRow label="ผู้ติดต่อ" value={editForm.contact_name} onChange={(v: string) => setEditForm({ ...editForm, contact_name: v })} />
                    <EditRow label="เบอร์โทร" value={editForm.phone} onChange={(v: string) => setEditForm({ ...editForm, phone: v })} />
                    <EditRow label="Username" value={editForm.username} onChange={(v: string) => setEditForm({ ...editForm, username: v.toLowerCase().replace(/[^a-z0-9_]/g, '') })} mono />
                    <EditRow label="รหัสผ่าน" value={editForm.password_hash} onChange={(v: string) => setEditForm({ ...editForm, password_hash: v })} mono />
                    <EditRow label="ติดต่อ FB/LINE" value={editForm.line_id} onChange={(v: string) => setEditForm({ ...editForm, line_id: v })} />
                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                      <button onClick={() => setEditing(null)} style={smallBtn('#64748b')}>ยกเลิก</button>
                      <button onClick={() => saveEdit(b)} disabled={isBusy} style={smallBtn('#16a34a')}>{isBusy ? <Loader2 size={13} className="v3-spin" /> : <Save size={13} />} บันทึก</button>
                    </div>
                  </div>
                )}

                {/* ปุ่มหลัก (อนุมัติ/ปฏิเสธ) */}
                {(b.status || 'pending') === 'pending' && !isEdit && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <button onClick={() => approve(b)} disabled={isBusy} style={{ flex: 2, padding: 10, background: '#16a34a', color: '#fff', border: 'none', borderRadius: 9, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      {isBusy ? <Loader2 size={14} className="v3-spin" /> : <Check size={14} />} อนุมัติ + สร้างบัญชี
                    </button>
                    <button onClick={() => setStatus(b, 'rejected')} disabled={isBusy} style={{ flex: 1, padding: 10, background: 'var(--surface-2)', color: '#ef4444', border: '1px solid var(--border)', borderRadius: 9, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><X size={14} /> ปฏิเสธ</button>
                  </div>
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

function Detail({ Icon, label, value, mono }: any) {
  if (!value) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <Icon size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
      <span style={{ color: 'var(--text-dim)', minWidth: 70 }}>{label}</span>
      <span style={{ flex: 1, fontFamily: mono ? 'monospace' : 'inherit', wordBreak: 'break-word' }}>{value}</span>
    </div>
  );
}
function EditRow({ label, value, onChange, mono }: any) {
  return (
    <div>
      <label style={{ fontSize: 11, color: 'var(--text-dim)', display: 'block', marginBottom: 3 }}>{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} style={{ width: '100%', height: 38, padding: '0 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13, fontFamily: mono ? 'monospace' : 'inherit', boxSizing: 'border-box', outline: 'none' }} />
    </div>
  );
}

const iconBtn: React.CSSProperties = { width: 32, height: 32, borderRadius: 8, background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 };
function smallBtn(color: string): React.CSSProperties {
  return { flex: 1, padding: 9, background: color, color: '#fff', border: 'none', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 };
}
