'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase-client';
import { sendLineNotify } from '@/lib/line-notify';
import {
  RotateCcw, RefreshCw, X, Smartphone, User, Coins, Calendar,
  Loader2, CheckCircle2, AlertCircle, Percent, Eye, EyeOff, Pencil, Lock, FileText, AlertTriangle,
} from 'lucide-react';

function Overlay({ onClose, children }: any) {
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
      zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div onClick={(e) => e.stopPropagation()} className="v3-card" style={{ maxWidth: 440, width: '100%', padding: 0, maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  );
}

function ItemSummary({ item }: any) {
  return (
    <div style={{ padding: 14, background: 'var(--surface-2)', borderRadius: 12, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: '#fef3c7', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Smartphone size={18} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'Prompt, sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.model}</div>
          {item.imei && <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'monospace' }}>IMEI: {item.imei}</div>}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 14, marginTop: 10, fontSize: 12, color: 'var(--text-dim)' }}>
        <span><User size={11} style={{ display: 'inline', marginRight: 3, verticalAlign: '-1px' }} />{item.customer_name}</span>
        <span><Coins size={11} style={{ display: 'inline', marginRight: 3, verticalAlign: '-1px' }} />฿{Number(item.pawn_price).toLocaleString()}</span>
      </div>
    </div>
  );
}

const headerSt: React.CSSProperties = { padding: '16px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 };
const closeBtn: React.CSSProperties = { width: 32, height: 32, background: 'var(--surface-2)', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const inputSt: React.CSSProperties = { width: '100%', height: 46, padding: '0 12px 0 40px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text)', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' };
const iconSt: React.CSSProperties = { position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' };

function Toast({ toast }: any) {
  if (!toast) return null;
  return (
    <div style={{ position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)', background: toast.ok ? '#16a34a' : '#dc2626', color: '#fff', padding: '12px 20px', borderRadius: 12, fontSize: 13, fontWeight: 600, boxShadow: '0 8px 24px rgba(0,0,0,0.2)', zIndex: 300, maxWidth: '90vw', display: 'flex', alignItems: 'center', gap: 8 }}>
      {toast.ok ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />} {toast.msg}
    </div>
  );
}

/* ============ ไถ่คืน ============ */
export function PawnRedeemModal({ item, onClose, onSuccess }: any) {
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [totalInterest, setTotalInterest] = useState(0);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  function notify(msg: string, ok = true) { setToast({ msg, ok }); setTimeout(() => setToast(null), 2600); }

  useEffect(() => {
    async function loadInterest() {
      const { data } = await supabase.from('pawn_renewals').select('interest_paid').eq('pawn_id', item.id);
      setTotalInterest((data || []).reduce((s: number, r: any) => s + Number(r.interest_paid || 0), 0));
    }
    loadInterest();
  }, [item.id]);

  async function confirm() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data: profile } = await supabase.from('profiles').select('full_name, shop_id').eq('id', user.id).single();

    const { error: insertError } = await supabase.from('pawn_history').insert({
      imei: item.imei, model: item.model, color: item.color, spec: item.spec,
      device_password: item.device_password,
      pawn_price: item.pawn_price, pawn_date: item.pawn_date,
      customer_name: item.customer_name, customer_phone: item.customer_phone, customer_note: item.customer_note,
      added_by: item.added_by, added_by_name: item.added_by_name,
      redeemed_by: user.id, redeemed_by_name: profile?.full_name,
      redeem_date: new Date().toISOString().split('T')[0],
      branch_id: item.branch_id, shop_id: profile?.shop_id,
      interest_days: item.interest_days || 30, renew_count: item.renew_count || 0,
      total_interest_paid: totalInterest, exit_status: 'redeemed',
    });
    if (insertError) { notify('เกิดข้อผิดพลาด: ' + insertError.message, false); setLoading(false); return; }

    await supabase.from('pawn_stock').delete().eq('id', item.id);

    const interestTxt = totalInterest > 0 ? `\n💰 ดอกเบี้ยที่จ่ายมาทั้งหมด: ฿${totalInterest.toLocaleString()}` : '';
    const lineMsg = `🔓 ไถ่คืนเครื่องจำนำ\n━━━━━━━━━━━━━\n📦 ${item.model}\n━━━━━━━━━━━━━\n👤 ลูกค้า: ${item.customer_name}\n💵 รับเงินคืน: ฿${Number(item.pawn_price).toLocaleString()}${interestTxt}\n👨‍💼 รับโดย: ${profile?.full_name || '-'}`;
    sendLineNotify(lineMsg, 'pawn').catch(() => {});

    setLoading(false);
    notify('ไถ่คืนสำเร็จ');
    setTimeout(() => onSuccess(), 800);
  }

  return (
    <Overlay onClose={onClose}>
      <div style={headerSt}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: '#dcfce7', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><RotateCcw size={18} /></div>
          <div><h2 style={{ fontSize: 16, fontWeight: 700, fontFamily: 'Prompt, sans-serif' }}>ไถ่คืนเครื่อง</h2><p style={{ fontSize: 11, color: 'var(--text-dim)' }}>ลูกค้ามารับเครื่องคืน</p></div>
        </div>
        <button onClick={onClose} style={closeBtn}><X size={16} /></button>
      </div>
      <div style={{ padding: 18, overflowY: 'auto' }}>
        <ItemSummary item={item} />
        <div style={{ padding: 14, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
            <span style={{ color: '#166534' }}>เงินต้นที่รับคืน</span>
            <strong style={{ color: '#166534', fontFamily: 'Prompt, sans-serif' }}>฿{Number(item.pawn_price).toLocaleString()}</strong>
          </div>
          {totalInterest > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#15803d' }}>
              <span>ดอกเบี้ยที่จ่ายมาแล้ว</span>
              <span>฿{totalInterest.toLocaleString()}</span>
            </div>
          )}
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 16, textAlign: 'center' }}>
          ยืนยันการไถ่คืน เครื่องจะถูกย้ายไปประวัติจำนำ
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 13, background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>ยกเลิก</button>
          <button onClick={confirm} disabled={loading} style={{ flex: 2, padding: 13, background: loading ? 'var(--surface-2)' : 'linear-gradient(135deg, #22c55e, #16a34a)', color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: loading ? 'wait' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {loading ? <Loader2 size={17} className="v3-spin" /> : <RotateCcw size={17} strokeWidth={2.4} />}
            {loading ? 'กำลังบันทึก...' : 'ยืนยันไถ่คืน'}
          </button>
        </div>
      </div>
      <Toast toast={toast} />
    </Overlay>
  );
}

/* ============ ต่อดอก ============ */
export function PawnRenewModal({ item, onClose, onSuccess }: any) {
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [interestPaid, setInterestPaid] = useState(String(item.interest_amount || ''));
  const [note, setNote] = useState('');
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  function notify(msg: string, ok = true) { setToast({ msg, ok }); setTimeout(() => setToast(null), 2600); }

  const interestDays = item.interest_days || 30;
  const defaultNewDueStr = (() => {
    const oldDue = item.due_date ? new Date(item.due_date) : new Date(item.pawn_date);
    const newDue = new Date(oldDue);
    newDue.setDate(newDue.getDate() + interestDays);
    return newDue.toISOString().split('T')[0];
  })();
  const [newDueStr, setNewDueStr] = useState(defaultNewDueStr);

  async function confirm() {
    const paid = parseFloat(interestPaid) || 0;
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data: profile } = await supabase.from('profiles').select('full_name, shop_id').eq('id', user.id).single();

    const { error: renewError } = await supabase.from('pawn_renewals').insert({
      pawn_id: item.id, renewal_date: new Date().toISOString().split('T')[0],
      interest_paid: paid, old_due_date: item.due_date || null, new_due_date: newDueStr,
      note: note || null, renewed_by: user.id, renewed_by_name: profile?.full_name,
      branch_id: item.branch_id, shop_id: profile?.shop_id,
    });
    if (renewError) { notify('เกิดข้อผิดพลาด: ' + renewError.message, false); setLoading(false); return; }

    const { error: updateError } = await supabase.from('pawn_stock').update({
      due_date: newDueStr, status: 'active', renew_count: (item.renew_count || 0) + 1,
      reminder_due_sent_at: null, reminder_overdue_sent_at: null, forfeit_alert_sent_at: null,
    }).eq('id', item.id);
    if (updateError) { notify('เกิดข้อผิดพลาด: ' + updateError.message, false); setLoading(false); return; }

    const lineMsg = `🔄 ต่อดอกจำนำ\n━━━━━━━━━━━━━\n📦 ${item.model}\n━━━━━━━━━━━━━\n👤 ลูกค้า: ${item.customer_name}\n💰 ดอกเบี้ยที่จ่าย: ฿${paid.toLocaleString()}\n📅 ครบกำหนดใหม่: ${newDueStr}\n🔢 ต่อมาแล้ว: ${(item.renew_count || 0) + 1} ครั้ง`;
    sendLineNotify(lineMsg, 'pawn').catch(() => {});

    setLoading(false);
    notify('ต่อดอกสำเร็จ');
    setTimeout(() => onSuccess(), 800);
  }

  return (
    <Overlay onClose={onClose}>
      <div style={headerSt}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: '#dbeafe', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><RefreshCw size={18} /></div>
          <div><h2 style={{ fontSize: 16, fontWeight: 700, fontFamily: 'Prompt, sans-serif' }}>ต่อดอกจำนำ</h2><p style={{ fontSize: 11, color: 'var(--text-dim)' }}>ต่ออายุการจำนำออกไป</p></div>
        </div>
        <button onClick={onClose} style={closeBtn}><X size={16} /></button>
      </div>
      <div style={{ padding: 18, overflowY: 'auto' }}>
        <ItemSummary item={item} />
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>ดอกเบี้ยที่ลูกค้าจ่าย (฿)</label>
          <div style={{ position: 'relative' }}>
            <Percent size={16} style={iconSt} />
            <input type="number" inputMode="decimal" value={interestPaid} onChange={(e) => setInterestPaid(e.target.value)} placeholder="0" style={inputSt} />
          </div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>หมายเหตุ</label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="(ไม่บังคับ)" rows={2} style={{ ...inputSt, height: 'auto', minHeight: 52, padding: '10px 12px', resize: 'vertical' }} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>วันครบกำหนดใหม่ (ปรับเองได้)</label>
          <div style={{ position: 'relative' }}>
            <Calendar size={16} style={iconSt} />
            <input type="date" value={newDueStr} onChange={(e) => setNewDueStr(e.target.value)} style={inputSt} />
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
            💡 ระบบคำนวณให้อัตโนมัติจากวันครบกำหนดเดิม + {interestDays} วัน · ต่อครั้งที่ {(item.renew_count || 0) + 1}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 13, background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>ยกเลิก</button>
          <button onClick={confirm} disabled={loading} style={{ flex: 2, padding: 13, background: loading ? 'var(--surface-2)' : 'linear-gradient(135deg, #3b82f6, #2563eb)', color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: loading ? 'wait' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {loading ? <Loader2 size={17} className="v3-spin" /> : <RefreshCw size={17} strokeWidth={2.4} />}
            {loading ? 'กำลังบันทึก...' : 'ยืนยันต่อดอก'}
          </button>
        </div>
      </div>
      <Toast toast={toast} />
    </Overlay>
  );
}

/* ============ แก้ไข ============ */
export function PawnEditModal({ item, onClose, onSuccess }: any) {
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  function notify(msg: string, ok = true) { setToast({ msg, ok }); setTimeout(() => setToast(null), 2600); }

  const [form, setForm] = useState({
    model: item.model || '', color: item.color || '', spec: item.spec || '',
    devicePassword: item.device_password || '',
    pawnPrice: String(item.pawn_price ?? ''), pawnDate: item.pawn_date || '',
    interestDays: String(item.interest_days || 30), interestAmount: String(item.interest_amount ?? ''),
    dueDate: item.due_date || '',
    customerName: item.customer_name || '', customerPhone: item.customer_phone || '', customerNote: item.customer_note || '',
    recalcDue: false,
  });

  async function save() {
    setLoading(true);
    const interestDays = parseInt(form.interestDays) || 30;
    let dueDate = form.dueDate;
    if (form.recalcDue && form.pawnDate) {
      const d = new Date(form.pawnDate);
      d.setDate(d.getDate() + interestDays);
      dueDate = d.toISOString().split('T')[0];
    }

    const { error } = await supabase.from('pawn_stock').update({
      model: form.model, color: form.color || null, spec: form.spec || null,
      device_password: form.devicePassword || null,
      pawn_price: parseFloat(form.pawnPrice) || 0, pawn_date: form.pawnDate,
      interest_days: interestDays, interest_amount: parseFloat(form.interestAmount) || 0,
      due_date: dueDate,
      customer_name: form.customerName, customer_phone: form.customerPhone || null, customer_note: form.customerNote || null,
      reminder_due_sent_at: null, reminder_overdue_sent_at: null, forfeit_alert_sent_at: null,
    }).eq('id', item.id);

    setLoading(false);
    if (error) { notify('เกิดข้อผิดพลาด: ' + error.message, false); return; }
    notify('บันทึกสำเร็จ');
    setTimeout(() => onSuccess(), 800);
  }

  return (
    <Overlay onClose={onClose}>
      <div style={headerSt}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: '#ede9fe', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Pencil size={18} /></div>
          <div><h2 style={{ fontSize: 16, fontWeight: 700, fontFamily: 'Prompt, sans-serif' }}>แก้ไขข้อมูลจำนำ</h2><p style={{ fontSize: 11, color: 'var(--text-dim)' }}>{item.model}</p></div>
        </div>
        <button onClick={onClose} style={closeBtn}><X size={16} /></button>
      </div>
      <div style={{ padding: 18, overflowY: 'auto' }}>
        {item.imei && (
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>IMEI</label>
            <div style={{ ...inputSt, display: 'flex', alignItems: 'center', color: 'var(--text-dim)', fontFamily: 'monospace' }}>{item.imei}</div>
          </div>
        )}
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>รุ่น</label>
          <input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} style={inputSt} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>สี</label>
            <input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} style={inputSt} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>สเปค</label>
            <input value={form.spec} onChange={(e) => setForm({ ...form, spec: e.target.value })} style={inputSt} />
          </div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>รหัสผ่านเครื่อง</label>
          <div style={{ position: 'relative' }}>
            <Lock size={16} style={iconSt} />
            <input type={showPassword ? 'text' : 'password'} value={form.devicePassword}
              onChange={(e) => setForm({ ...form, devicePassword: e.target.value })}
              style={{ ...inputSt, paddingRight: 40 }} />
            <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}>
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>ราคาจำนำ</label>
            <input type="number" value={form.pawnPrice} onChange={(e) => setForm({ ...form, pawnPrice: e.target.value })} style={inputSt} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>วันที่จำนำ</label>
            <input type="date" value={form.pawnDate} onChange={(e) => setForm({ ...form, pawnDate: e.target.value, recalcDue: true })} style={inputSt} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>จำนวนวันต่อดอก</label>
            <input type="number" value={form.interestDays} onChange={(e) => setForm({ ...form, interestDays: e.target.value, recalcDue: true })} style={inputSt} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>ดอกเบี้ยต่อรอบ (฿)</label>
            <input type="number" value={form.interestAmount} onChange={(e) => setForm({ ...form, interestAmount: e.target.value })} style={inputSt} />
          </div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>วันครบกำหนดต่อดอก (ปรับเองได้)</label>
          <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value, recalcDue: false })} style={inputSt} />
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>📅 ถ้าแก้วันจำนำหรือจำนวนวันด้านบน วันนี้จะคำนวณใหม่อัตโนมัติ</div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>ชื่อลูกค้า</label>
          <input value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} style={inputSt} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>เบอร์โทร</label>
          <input value={form.customerPhone} onChange={(e) => setForm({ ...form, customerPhone: e.target.value })} style={inputSt} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>หมายเหตุ</label>
          <input value={form.customerNote} onChange={(e) => setForm({ ...form, customerNote: e.target.value })} style={inputSt} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 13, background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>ยกเลิก</button>
          <button onClick={save} disabled={loading} style={{ flex: 2, padding: 13, background: loading ? 'var(--surface-2)' : 'linear-gradient(135deg, #7c3aed, #6d28d9)', color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: loading ? 'wait' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {loading ? <Loader2 size={17} className="v3-spin" /> : <Pencil size={17} strokeWidth={2.4} />}
            {loading ? 'กำลังบันทึก...' : 'บันทึก'}
          </button>
        </div>
      </div>
      <Toast toast={toast} />
    </Overlay>
  );
}

/* ============ ดูรายละเอียด ============ */
export function PawnDetailModal({ item, onClose }: any) {
  const supabase = createClient();
  const [showPassword, setShowPassword] = useState(false);
  const [renewals, setRenewals] = useState<any[]>([]);
  const [loadingRenewals, setLoadingRenewals] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('pawn_renewals').select('*').eq('pawn_id', item.id).order('renewal_date', { ascending: false });
      setRenewals(data || []);
      setLoadingRenewals(false);
    }
    load();
  }, [item.id]);

  const row = (label: string, value: any) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
      <span style={{ color: 'var(--text-dim)' }}>{label}</span>
      <span style={{ fontWeight: 600, textAlign: 'right' }}>{value ?? '-'}</span>
    </div>
  );

  return (
    <Overlay onClose={onClose}>
      <div style={headerSt}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><FileText size={18} /></div>
          <div><h2 style={{ fontSize: 16, fontWeight: 700, fontFamily: 'Prompt, sans-serif' }}>รายละเอียดการจำนำ</h2><p style={{ fontSize: 11, color: 'var(--text-dim)' }}>{item.model}</p></div>
        </div>
        <button onClick={onClose} style={closeBtn}><X size={16} /></button>
      </div>
      <div style={{ padding: 18, overflowY: 'auto' }}>
        {item.imei && row('IMEI', <span style={{ fontFamily: 'monospace' }}>{item.imei}</span>)}
        {row('รุ่น', item.model)}
        {row('สี', item.color)}
        {row('สเปค', item.spec)}
        {row('รหัสผ่านเครื่อง', item.device_password ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {showPassword ? item.device_password : '••••••••'}
            <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', display: 'flex' }}>
              {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </span>
        ) : '-')}
        {row('ราคาจำนำ', `฿${Number(item.pawn_price).toLocaleString()}`)}
        {row('วันที่รับจำนำ', item.pawn_date)}
        {row('วันครบกำหนด', item.due_date)}
        {row('ต่อดอกไปแล้ว', `${item.renew_count || 0} ครั้ง`)}
        {row('ลูกค้า', item.customer_name)}
        {row('เบอร์โทร', item.customer_phone)}
        {item.customer_note && row('หมายเหตุ', item.customer_note)}
        {item.added_by_name && row('เพิ่มโดย', item.added_by_name)}

        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>ประวัติการต่อดอก</div>
          {loadingRenewals ? (
            <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>กำลังโหลด...</div>
          ) : renewals.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>ยังไม่เคยต่อดอก</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {renewals.map((r) => (
                <div key={r.id} style={{ padding: 10, background: 'var(--surface-2)', borderRadius: 10, fontSize: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>{r.renewal_date}</span>
                    <span style={{ color: '#16a34a', fontWeight: 700 }}>฿{Number(r.interest_paid || 0).toLocaleString()}</span>
                  </div>
                  <div style={{ color: 'var(--text-dim)', marginTop: 2 }}>
                    {r.old_due_date || '-'} → {r.new_due_date}{r.note ? ` • ${r.note}` : ''}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ marginTop: 18 }}>
          <button onClick={onClose} style={{ width: '100%', padding: 13, background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>ปิด</button>
        </div>
      </div>
    </Overlay>
  );
}

/* ============ บันทึกหลุดจำนำ ============ */
export function PawnForfeitModal({ item, onClose, onSuccess }: any) {
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [totalInterest, setTotalInterest] = useState(0);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  function notify(msg: string, ok = true) { setToast({ msg, ok }); setTimeout(() => setToast(null), 2600); }

  useEffect(() => {
    async function loadInterest() {
      const { data } = await supabase.from('pawn_renewals').select('interest_paid').eq('pawn_id', item.id);
      setTotalInterest((data || []).reduce((s: number, r: any) => s + Number(r.interest_paid || 0), 0));
    }
    loadInterest();
  }, [item.id]);

  async function confirm() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data: profile } = await supabase.from('profiles').select('full_name, shop_id').eq('id', user.id).single();

    const { error: insertError } = await supabase.from('pawn_history').insert({
      imei: item.imei, model: item.model, color: item.color, spec: item.spec,
      device_password: item.device_password,
      pawn_price: item.pawn_price, pawn_date: item.pawn_date,
      customer_name: item.customer_name, customer_phone: item.customer_phone, customer_note: item.customer_note,
      added_by: item.added_by, added_by_name: item.added_by_name,
      redeemed_by: user.id, redeemed_by_name: profile?.full_name,
      redeem_date: new Date().toISOString().split('T')[0],
      branch_id: item.branch_id, shop_id: profile?.shop_id,
      interest_days: item.interest_days || 30, renew_count: item.renew_count || 0,
      total_interest_paid: totalInterest, exit_status: 'forfeited',
    });
    if (insertError) { notify('เกิดข้อผิดพลาด: ' + insertError.message, false); setLoading(false); return; }

    await supabase.from('pawn_stock').delete().eq('id', item.id);

    const lineMsg = `⚠️ บันทึกหลุดจำนำ\n━━━━━━━━━━━━━\n📦 ${item.model}\n━━━━━━━━━━━━━\n👤 ลูกค้า: ${item.customer_name}\n💵 ราคาจำนำเดิม: ฿${Number(item.pawn_price).toLocaleString()}\n💰 ดอกเบี้ยที่ได้รับ: ฿${totalInterest.toLocaleString()}\n🔢 ต่อมาแล้ว: ${item.renew_count || 0} ครั้ง\n\n📌 เครื่องเข้าครอบครองร้านแล้ว`;
    sendLineNotify(lineMsg, 'pawn').catch(() => {});

    setLoading(false);
    notify('บันทึกหลุดจำนำแล้ว');
    setTimeout(() => onSuccess(), 800);
  }

  return (
    <Overlay onClose={onClose}>
      <div style={headerSt}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><AlertTriangle size={18} /></div>
          <div><h2 style={{ fontSize: 16, fontWeight: 700, fontFamily: 'Prompt, sans-serif' }}>บันทึกหลุดจำนำ</h2><p style={{ fontSize: 11, color: 'var(--text-dim)' }}>เครื่องเข้าครอบครองร้าน</p></div>
        </div>
        <button onClick={onClose} style={closeBtn}><X size={16} /></button>
      </div>
      <div style={{ padding: 18, overflowY: 'auto' }}>
        <ItemSummary item={item} />
        <div style={{ padding: 14, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
            <span style={{ color: '#92400e' }}>ราคาจำนำเดิม (เงินต้น)</span>
            <strong style={{ color: '#92400e', fontFamily: 'Prompt, sans-serif' }}>฿{Number(item.pawn_price).toLocaleString()}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#b45309' }}>
            <span>ดอกเบี้ยที่เก็บมาแล้ว</span>
            <span>฿{totalInterest.toLocaleString()}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#b45309', marginTop: 2 }}>
            <span>ต่อดอกมาแล้ว</span>
            <span>{item.renew_count || 0} ครั้ง</span>
          </div>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 16, textAlign: 'center' }}>
          ลูกค้าไม่มาไถ่/ต่อดอกตามกำหนด เครื่องจะเข้าครอบครองร้าน และย้ายไปประวัติจำนำ
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 13, background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>ยกเลิก</button>
          <button onClick={confirm} disabled={loading} style={{ flex: 2, padding: 13, background: loading ? 'var(--surface-2)' : 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: loading ? 'wait' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {loading ? <Loader2 size={17} className="v3-spin" /> : <AlertTriangle size={17} strokeWidth={2.4} />}
            {loading ? 'กำลังบันทึก...' : 'ยืนยันหลุดจำนำ'}
          </button>
        </div>
      </div>
      <Toast toast={toast} />
    </Overlay>
  );
}
