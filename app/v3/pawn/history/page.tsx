'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-client';
import {
  Coins, ArrowLeft, Search, Smartphone, User, Calendar, RotateCcw, Loader2,
  Plus, X, Edit2, Trash2, Save, CheckCircle2, AlertCircle, Phone,
} from 'lucide-react';

const emptyForm = {
  model: '', color: '', spec: '', pawn_price: '', customer_name: '', customer_phone: '', customer_note: '',
  pawn_date: new Date().toISOString().split('T')[0], redeem_date: new Date().toISOString().split('T')[0],
  exit_status: 'redeemed',
};

export default function V3PawnHistoryPage() {
  const supabase = createClient();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [profile, setProfile] = useState<any>(null);
  const [viewing, setViewing] = useState<any>(null);
  const [editing, setEditing] = useState<any>(null);
  const [deleting, setDeleting] = useState<any>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  function notify(msg: string, ok = true) { setToast({ msg, ok }); setTimeout(() => setToast(null), 2400); }

  async function load() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data: p } = await supabase.from('profiles').select('role, is_super_admin, shop_id, full_name').eq('id', user.id).single();
    setProfile(p);
    const { data } = await supabase
      .from('pawn_history')
      .select('*')
      .order('redeem_date', { ascending: false })
      .limit(500);
    setItems(data || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const isAdmin = profile?.role === 'admin' || profile?.is_super_admin;

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

  async function handleAdd() {
    if (!profile) return;
    if (!addForm.model.trim() || !addForm.customer_name.trim() || !addForm.pawn_price) {
      return notify('กรอกรุ่น / ชื่อลูกค้า / ราคาจำนำ', false);
    }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('pawn_history').insert({
      shop_id: profile.shop_id,
      model: addForm.model.trim(), color: addForm.color.trim() || null, spec: addForm.spec.trim() || null,
      pawn_price: parseFloat(addForm.pawn_price) || 0,
      pawn_date: addForm.pawn_date, redeem_date: addForm.redeem_date,
      customer_name: addForm.customer_name.trim(), customer_phone: addForm.customer_phone.trim() || null,
      customer_note: addForm.customer_note.trim() || null,
      exit_status: addForm.exit_status,
      added_by: user?.id, added_by_name: profile.full_name,
      redeemed_by: user?.id, redeemed_by_name: profile.full_name,
      interest_days: 30, renew_count: 0, total_interest_paid: 0,
    });
    setSaving(false);
    if (error) return notify('บันทึกไม่สำเร็จ: ' + error.message, false);
    notify('เพิ่มประวัติแล้ว');
    setShowAdd(false);
    setAddForm({ ...emptyForm });
    load();
  }

  async function handleSaveEdit() {
    if (!editing) return;
    if (!editing.model.trim() || !editing.customer_name.trim()) return notify('กรอกรุ่น / ชื่อลูกค้า', false);
    setSaving(true);
    const { error } = await supabase.from('pawn_history').update({
      model: editing.model.trim(), color: editing.color || null, spec: editing.spec || null,
      pawn_price: parseFloat(editing.pawn_price) || 0,
      customer_name: editing.customer_name.trim(), customer_phone: editing.customer_phone || null,
      customer_note: editing.customer_note || null,
    }).eq('id', editing.id);
    setSaving(false);
    if (error) return notify('บันทึกไม่สำเร็จ: ' + error.message, false);
    notify('บันทึกแล้ว');
    setEditing(null);
    setViewing(null);
    load();
  }

  async function handleDelete() {
    if (!deleting) return;
    setSaving(true);
    const { error } = await supabase.from('pawn_history').delete().eq('id', deleting.id);
    setSaving(false);
    if (error) return notify('ลบไม่สำเร็จ: ' + error.message, false);
    notify('ลบแล้ว');
    setDeleting(null);
    setViewing(null);
    load();
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <Link href="/v3/pawn" style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--surface-2)', color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', flexShrink: 0 }}>
          <ArrowLeft size={20} />
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: '#fef3c7', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <RotateCcw size={20} />
          </div>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ fontSize: 18, fontWeight: 700, fontFamily: 'Prompt, sans-serif' }}>ประวัติจำนำ</h1>
            <p style={{ fontSize: 11, color: 'var(--text-dim)' }}>เครื่องที่ไถ่คืน/หลุดจำนำแล้ว</p>
          </div>
        </div>
        {isAdmin && (
          <button onClick={() => { setAddForm({ ...emptyForm }); setShowAdd(true); }} style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--accent)', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }} title="เพิ่มประวัติ">
            <Plus size={20} strokeWidth={2.5} />
          </button>
        )}
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
            <button key={item.id} onClick={() => setViewing(item)} style={{ textAlign: 'left', background: 'var(--surface)', border: '1px solid var(--border)', borderLeft: `4px solid ${item.exit_status === 'forfeited' ? '#ef4444' : '#22c55e'}`, borderRadius: 14, padding: 14, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', fontFamily: 'inherit', width: '100%' }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: item.exit_status === 'forfeited' ? '#fee2e2' : '#dcfce7', color: item.exit_status === 'forfeited' ? '#dc2626' : '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Smartphone size={19} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'Prompt, Sarabun, sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.model}</div>
                {item.imei && <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'monospace' }}>{item.imei}</div>}
                <div style={{ display: 'flex', gap: 10, fontSize: 11, color: 'var(--text-dim)', marginTop: 3, flexWrap: 'wrap' }}>
                  <span><User size={10} style={{ display: 'inline', verticalAlign: '-1px' }} /> {item.customer_name}</span>
                  <span><Calendar size={10} style={{ display: 'inline', verticalAlign: '-1px' }} /> {item.redeem_date ? new Date(item.redeem_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) : '-'}</span>
                  {item.exit_status === 'forfeited' && <span style={{ color: '#dc2626', fontWeight: 700 }}>หลุดจำนำ</span>}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>฿{Number(item.pawn_price).toLocaleString()}</div>
                {Number(item.total_interest_paid) > 0 && (
                  <div style={{ fontSize: 10, color: '#16a34a', fontWeight: 600 }}>+ดอก ฿{Number(item.total_interest_paid).toLocaleString()}</div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {viewing && (
        <Overlay onClose={() => setViewing(null)}>
          <div style={headerSt}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: '#fef3c7', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Coins size={18} /></div>
              <div><h2 style={{ fontSize: 16, fontWeight: 700, fontFamily: 'Prompt, sans-serif' }}>รายละเอียดประวัติ</h2><p style={{ fontSize: 11, color: 'var(--text-dim)' }}>{viewing.exit_status === 'forfeited' ? 'หลุดจำนำ' : 'ไถ่คืนแล้ว'}</p></div>
            </div>
            <button onClick={() => setViewing(null)} style={closeBtn}><X size={16} /></button>
          </div>
          <div style={{ padding: 18, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {viewing.imei && <Row label="IMEI" value={<span style={{ fontFamily: 'monospace' }}>{viewing.imei}</span>} />}
            <Row label="รุ่น" value={viewing.model} />
            <Row label="สี" value={viewing.color || '-'} />
            <Row label="สเปค" value={viewing.spec || '-'} />
            {viewing.device_password && <Row label="รหัสเครื่อง" value={<span style={{ fontFamily: 'monospace' }}>{viewing.device_password}</span>} />}
            <Row label="ราคาจำนำ" value={<span style={{ color: 'var(--accent)', fontWeight: 700 }}>฿{Number(viewing.pawn_price).toLocaleString()}</span>} />
            <Row label="ดอกเบี้ยที่จ่ายมาทั้งหมด" value={`฿${Number(viewing.total_interest_paid || 0).toLocaleString()}`} />
            <Row label="วันที่จำนำ" value={viewing.pawn_date} />
            <Row label="วันที่ไถ่คืน/หลุด" value={<span style={{ color: viewing.exit_status === 'forfeited' ? '#dc2626' : '#16a34a' }}>{viewing.redeem_date}</span>} />
            <Row label="ลูกค้า" value={viewing.customer_name} />
            <Row label="เบอร์โทร" value={viewing.customer_phone || '-'} />
            {viewing.customer_note && <Row label="หมายเหตุ" value={viewing.customer_note} />}
            <Row label="รับจำนำโดย" value={viewing.added_by_name || '-'} />
            <Row label="ไถ่คืน/ปิดโดย" value={viewing.redeemed_by_name || '-'} />
          </div>
          <div style={{ padding: 18, borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
            {isAdmin && (
              <>
                <button onClick={() => setDeleting(viewing)} style={{ ...secBtn, color: '#ef4444', flex: 1 }}><Trash2 size={15} /> ลบ</button>
                <button onClick={() => setEditing({ ...viewing })} style={{ ...secBtn, flex: 1 }}><Edit2 size={15} /> แก้ไข</button>
              </>
            )}
            <button onClick={() => setViewing(null)} style={{ ...priBtn, flex: isAdmin ? 1 : 2 }}>ปิด</button>
          </div>
        </Overlay>
      )}

      {editing && (
        <Overlay onClose={() => setEditing(null)}>
          <div style={headerSt}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: '#fef3c7', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Edit2 size={18} /></div>
              <h2 style={{ fontSize: 16, fontWeight: 700, fontFamily: 'Prompt, sans-serif' }}>แก้ไขประวัติ</h2>
            </div>
            <button onClick={() => setEditing(null)} style={closeBtn}><X size={16} /></button>
          </div>
          <div style={{ padding: 18, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <F label="รุ่น" req><Inp value={editing.model} onChange={(v: string) => setEditing({ ...editing, model: v })} /></F>
            <div style={g2}>
              <F label="สี"><Inp value={editing.color || ''} onChange={(v: string) => setEditing({ ...editing, color: v })} /></F>
              <F label="สเปค"><Inp value={editing.spec || ''} onChange={(v: string) => setEditing({ ...editing, spec: v })} /></F>
            </div>
            <F label="ราคาจำนำ (฿)"><Inp type="number" value={editing.pawn_price} onChange={(v: string) => setEditing({ ...editing, pawn_price: v })} /></F>
            <F label="ชื่อลูกค้า" req><Inp value={editing.customer_name} onChange={(v: string) => setEditing({ ...editing, customer_name: v })} /></F>
            <F label="เบอร์โทร"><Inp Icon={Phone} value={editing.customer_phone || ''} onChange={(v: string) => setEditing({ ...editing, customer_phone: v })} /></F>
            <F label="หมายเหตุ"><textarea value={editing.customer_note || ''} onChange={(e) => setEditing({ ...editing, customer_note: e.target.value })} rows={2} style={{ ...inputSt, height: 'auto', minHeight: 52, padding: '10px 12px', resize: 'vertical' }} onFocus={fOn} onBlur={fOff} /></F>
          </div>
          <div style={{ padding: 18, borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
            <button onClick={() => setEditing(null)} style={{ ...secBtn, flex: 1 }}>ยกเลิก</button>
            <button onClick={handleSaveEdit} disabled={saving} style={{ ...priBtn, flex: 2 }}>{saving ? <Loader2 size={16} className="v3-spin" /> : <Save size={16} />} บันทึก</button>
          </div>
        </Overlay>
      )}

      {deleting && (
        <Overlay onClose={() => setDeleting(null)}>
          <div style={{ padding: 24, textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, margin: '0 auto 12px', background: '#fee2e2', color: '#dc2626', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Trash2 size={26} /></div>
            <h2 style={{ fontSize: 16, fontWeight: 700, fontFamily: 'Prompt, sans-serif', marginBottom: 6 }}>ยืนยันการลบ</h2>
            <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 18 }}>จะลบประวัติของ &quot;{deleting.model}&quot; ({deleting.customer_name}) — ย้อนกลับไม่ได้</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setDeleting(null)} style={{ ...secBtn, flex: 1 }}>ยกเลิก</button>
              <button onClick={handleDelete} disabled={saving} style={{ ...priBtn, flex: 1, background: 'linear-gradient(135deg, #ef4444, #dc2626)' }}>{saving ? <Loader2 size={16} className="v3-spin" /> : <Trash2 size={16} />} ลบ</button>
            </div>
          </div>
        </Overlay>
      )}

      {showAdd && (
        <Overlay onClose={() => setShowAdd(false)}>
          <div style={headerSt}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: '#fef3c7', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Plus size={18} /></div>
              <h2 style={{ fontSize: 16, fontWeight: 700, fontFamily: 'Prompt, sans-serif' }}>เพิ่มประวัติจำนำ</h2>
            </div>
            <button onClick={() => setShowAdd(false)} style={closeBtn}><X size={16} /></button>
          </div>
          <div style={{ padding: 18, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <F label="สถานะ" req>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={() => setAddForm({ ...addForm, exit_status: 'redeemed' })} style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, background: addForm.exit_status === 'redeemed' ? '#16a34a' : 'var(--surface-2)', color: addForm.exit_status === 'redeemed' ? '#fff' : 'var(--text)' }}>ไถ่คืนแล้ว</button>
                <button type="button" onClick={() => setAddForm({ ...addForm, exit_status: 'forfeited' })} style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, background: addForm.exit_status === 'forfeited' ? '#dc2626' : 'var(--surface-2)', color: addForm.exit_status === 'forfeited' ? '#fff' : 'var(--text)' }}>หลุดจำนำ</button>
              </div>
            </F>
            <F label="รุ่น" req><Inp value={addForm.model} onChange={(v: string) => setAddForm({ ...addForm, model: v })} placeholder="เช่น iPhone 11" /></F>
            <div style={g2}>
              <F label="สี"><Inp value={addForm.color} onChange={(v: string) => setAddForm({ ...addForm, color: v })} /></F>
              <F label="สเปค"><Inp value={addForm.spec} onChange={(v: string) => setAddForm({ ...addForm, spec: v })} /></F>
            </div>
            <F label="ราคาจำนำ (฿)" req><Inp type="number" value={addForm.pawn_price} onChange={(v: string) => setAddForm({ ...addForm, pawn_price: v })} placeholder="0" /></F>
            <div style={g2}>
              <F label="วันที่จำนำ"><input type="date" value={addForm.pawn_date} onChange={(e) => setAddForm({ ...addForm, pawn_date: e.target.value })} style={inputSt} onFocus={fOn} onBlur={fOff} /></F>
              <F label="วันที่ไถ่คืน/หลุด"><input type="date" value={addForm.redeem_date} onChange={(e) => setAddForm({ ...addForm, redeem_date: e.target.value })} style={inputSt} onFocus={fOn} onBlur={fOff} /></F>
            </div>
            <F label="ชื่อลูกค้า" req><Inp value={addForm.customer_name} onChange={(v: string) => setAddForm({ ...addForm, customer_name: v })} /></F>
            <F label="เบอร์โทร"><Inp Icon={Phone} value={addForm.customer_phone} onChange={(v: string) => setAddForm({ ...addForm, customer_phone: v })} /></F>
            <F label="หมายเหตุ"><textarea value={addForm.customer_note} onChange={(e) => setAddForm({ ...addForm, customer_note: e.target.value })} rows={2} style={{ ...inputSt, height: 'auto', minHeight: 52, padding: '10px 12px', resize: 'vertical' }} onFocus={fOn} onBlur={fOff} /></F>
          </div>
          <div style={{ padding: 18, borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
            <button onClick={() => setShowAdd(false)} style={{ ...secBtn, flex: 1 }}>ยกเลิก</button>
            <button onClick={handleAdd} disabled={saving} style={{ ...priBtn, flex: 2 }}>{saving ? <Loader2 size={16} className="v3-spin" /> : <Save size={16} />} บันทึก</button>
          </div>
        </Overlay>
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)', background: toast.ok ? '#16a34a' : '#dc2626', color: '#fff', padding: '12px 20px', borderRadius: 12, fontSize: 13, fontWeight: 600, boxShadow: '0 8px 24px rgba(0,0,0,0.2)', zIndex: 300, maxWidth: '90vw', display: 'flex', alignItems: 'center', gap: 8 }}>
          {toast.ok ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />} {toast.msg}
        </div>
      )}
    </>
  );
}

function Overlay({ onClose, children }: any) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} className="v3-card" style={{ maxWidth: 480, width: '100%', padding: 0, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  );
}
function Row({ label, value }: any) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13, borderBottom: '1px dashed var(--border)', paddingBottom: 8 }}>
      <span style={{ color: 'var(--text-dim)', flexShrink: 0 }}>{label}</span>
      <span style={{ fontWeight: 600, textAlign: 'right' }}>{value}</span>
    </div>
  );
}
function F({ label, req, children }: any) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{label} {req && <span style={{ color: '#ef4444' }}>*</span>}</label>
      {children}
    </div>
  );
}
function Inp({ Icon, value, onChange, placeholder, type = 'text' }: any) {
  return (
    <div style={{ position: 'relative' }}>
      {Icon && <Icon size={16} style={iconSt} />}
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={{ ...inputSt, paddingLeft: Icon ? 40 : 12 }} onFocus={fOn} onBlur={fOff} inputMode={type === 'number' ? 'decimal' : undefined} />
    </div>
  );
}
function fOn(e: React.FocusEvent<any>) { e.target.style.borderColor = 'var(--accent)'; }
function fOff(e: React.FocusEvent<any>) { e.target.style.borderColor = 'var(--border)'; }

const headerSt: React.CSSProperties = { padding: '16px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 };
const closeBtn: React.CSSProperties = { width: 32, height: 32, background: 'var(--surface-2)', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const iconSt: React.CSSProperties = { position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' };
const inputSt: React.CSSProperties = { width: '100%', height: 42, padding: '0 12px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' };
const g2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 };
const secBtn: React.CSSProperties = { padding: 12, background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 };
const priBtn: React.CSSProperties = { padding: 12, color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'linear-gradient(135deg, #f59e0b, #d97706)' };
