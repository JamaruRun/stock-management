'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase-client';
import {
  Megaphone, X, Plus, Trash2, Eye, EyeOff, Pin, Loader2,
  CheckCircle2, AlertCircle, Info, AlertTriangle, Gift,
} from 'lucide-react';

const TYPES = [
  { id: 'info', label: 'ข่าวสาร', color: '#3b82f6', Icon: Info },
  { id: 'success', label: 'อัพเดท', color: '#22c55e', Icon: CheckCircle2 },
  { id: 'warning', label: 'แจ้งเตือน', color: '#f59e0b', Icon: AlertTriangle },
  { id: 'promo', label: 'โปรโมชั่น', color: '#8b5cf6', Icon: Gift },
];
export function typeInfo(t: string) { return TYPES.find(x => x.id === t) || TYPES[0]; }

interface Props { onClose: () => void; }

export default function AnnouncementsManageModal({ onClose }: Props) {
  const supabase = createClient();
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [form, setForm] = useState({ title: '', body: '', type: 'info', pinned: false, expires_at: '' });
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  function notify(msg: string, ok = true) { setToast({ msg, ok }); setTimeout(() => setToast(null), 2400); }

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: p } = await supabase.from('profiles').select('id, full_name, username').eq('id', user.id).single();
      setProfile(p);
    }
    const { data, error } = await supabase.from('announcements').select('*').order('created_at', { ascending: false });
    if (error) notify('โหลดไม่ได้ — รัน SQL announcements หรือยัง?', false);
    setList(data || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function create() {
    if (!form.title.trim() || !form.body.trim()) return notify('กรอกหัวข้อ + เนื้อหา', false);
    setSaving(true);
    const { error } = await supabase.from('announcements').insert({
      title: form.title.trim(), body: form.body.trim(), type: form.type, pinned: form.pinned,
      expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
      created_by: profile?.id, created_by_name: profile?.full_name || profile?.username,
    });
    setSaving(false);
    if (error) return notify('สร้างไม่สำเร็จ: ' + error.message, false);
    notify('ส่งประกาศแล้ว 📢');
    setForm({ title: '', body: '', type: 'info', pinned: false, expires_at: '' });
    setShowForm(false);
    load();
  }

  async function toggleActive(a: any) {
    const { error } = await supabase.from('announcements').update({ is_active: !a.is_active }).eq('id', a.id);
    if (error) return notify('ไม่สำเร็จ', false);
    load();
  }
  async function remove(a: any) {
    if (!confirm(`ลบประกาศ "${a.title}"?`)) return;
    const { error } = await supabase.from('announcements').delete().eq('id', a.id);
    if (error) return notify('ลบไม่สำเร็จ', false);
    notify('ลบแล้ว'); load();
  }

  return (
    <div onClick={onClose} style={ov}>
      <div onClick={(e) => e.stopPropagation()} className="v3-card" style={{ maxWidth: 520, width: '100%', padding: 0, height: '90vh', maxHeight: 760, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={headerSt}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#ede9fe', color: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Megaphone size={18} /></div>
            <div><h2 style={{ fontSize: 16, fontWeight: 700, fontFamily: 'Prompt, sans-serif' }}>ประกาศถึงทุกร้าน</h2><p style={{ fontSize: 11, color: 'var(--text-dim)' }}>Broadcast ขึ้นหน้าหลักของทุกร้าน</p></div>
          </div>
          <button onClick={onClose} style={closeBtn}><X size={16} /></button>
        </div>

        <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          {!showForm ? (
            <button onClick={() => setShowForm(true)} style={{ width: '100%', padding: 12, background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <Plus size={17} /> เขียนประกาศใหม่
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {TYPES.map(t => (
                  <button key={t.id} onClick={() => setForm({ ...form, type: t.id })} style={{
                    display: 'flex', alignItems: 'center', gap: 5, padding: '7px 11px', borderRadius: 100, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                    border: `1px solid ${form.type === t.id ? t.color : 'var(--border)'}`,
                    background: form.type === t.id ? t.color : 'var(--surface)', color: form.type === t.id ? '#fff' : 'var(--text)',
                  }}><t.Icon size={13} /> {t.label}</button>
                ))}
              </div>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="หัวข้อประกาศ" style={inputSt} onFocus={fOn} onBlur={fOff} />
              <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="เนื้อหา..." rows={3} style={{ ...inputSt, height: 'auto', minHeight: 70, padding: '10px 12px', resize: 'vertical' }} onFocus={fOn} onBlur={fOff} />
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.pinned} onChange={(e) => setForm({ ...form, pinned: e.target.checked })} /> <Pin size={13} /> ปักหมุด
                </label>
                <div style={{ flex: 1, minWidth: 150 }}>
                  <label style={{ fontSize: 10, color: 'var(--text-dim)' }}>หมดอายุ (ไม่บังคับ)</label>
                  <input type="date" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} style={{ ...inputSt, height: 38 }} onFocus={fOn} onBlur={fOff} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { setShowForm(false); setForm({ title: '', body: '', type: 'info', pinned: false, expires_at: '' }); }} style={secBtn}>ยกเลิก</button>
                <button onClick={create} disabled={saving} style={{ ...priBtn, background: saving ? 'var(--surface-2)' : 'linear-gradient(135deg, #8b5cf6, #6d28d9)' }}>
                  {saving ? <Loader2 size={16} className="v3-spin" /> : <Megaphone size={16} />} {saving ? 'กำลังส่ง...' : 'ส่งประกาศ'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-dim)' }}><Loader2 size={22} className="v3-spin" /></div>
          ) : list.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-dim)' }}>
              <Megaphone size={40} strokeWidth={1.2} style={{ margin: '0 auto 10px' }} />
              <div style={{ fontSize: 13 }}>ยังไม่มีประกาศ</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {list.map(a => {
                const ti = typeInfo(a.type);
                const expired = a.expires_at && new Date(a.expires_at) < new Date();
                return (
                  <div key={a.id} style={{ background: 'var(--surface-2)', borderRadius: 12, padding: 12, borderLeft: `4px solid ${ti.color}`, opacity: a.is_active && !expired ? 1 : 0.55 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <ti.Icon size={16} style={{ color: ti.color, flexShrink: 0, marginTop: 2 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {a.pinned && <Pin size={11} style={{ color: ti.color }} />}
                          <span style={{ fontSize: 14, fontWeight: 700, fontFamily: 'Prompt, sans-serif' }}>{a.title}</span>
                        </div>
                        <p style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2, whiteSpace: 'pre-wrap' }}>{a.body}</p>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                          {new Date(a.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}
                          {expired && ' · หมดอายุแล้ว'} {!a.is_active && ' · ปิดอยู่'}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        <button onClick={() => toggleActive(a)} title={a.is_active ? 'ปิด' : 'เปิด'} style={iconBtn}>{a.is_active ? <Eye size={15} /> : <EyeOff size={15} />}</button>
                        <button onClick={() => remove(a)} style={{ ...iconBtn, color: '#ef4444' }}><Trash2 size={15} /></button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      {toast && (
        <div style={{ position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)', background: toast.ok ? '#16a34a' : '#dc2626', color: '#fff', padding: '12px 20px', borderRadius: 12, fontSize: 13, fontWeight: 600, boxShadow: '0 8px 24px rgba(0,0,0,0.2)', zIndex: 300, maxWidth: '90vw', display: 'flex', alignItems: 'center', gap: 8 }}>
          {toast.ok ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />} {toast.msg}
        </div>
      )}
    </div>
  );
}

function fOn(e: React.FocusEvent<any>) { e.target.style.borderColor = 'var(--accent)'; }
function fOff(e: React.FocusEvent<any>) { e.target.style.borderColor = 'var(--border)'; }

const ov: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 };
const headerSt: React.CSSProperties = { padding: '16px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 };
const closeBtn: React.CSSProperties = { width: 32, height: 32, background: 'var(--surface-2)', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const inputSt: React.CSSProperties = { width: '100%', height: 44, padding: '0 12px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' };
const iconBtn: React.CSSProperties = { width: 30, height: 30, borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' };
const secBtn: React.CSSProperties = { flex: 1, padding: 12, background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
const priBtn: React.CSSProperties = { flex: 2, padding: 12, color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 };
