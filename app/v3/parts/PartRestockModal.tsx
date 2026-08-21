'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase-client';
import { sendLinePush } from '@/lib/line-notify';
import { syncLedgerEntry } from '@/lib/ledger-sync';
import {
  Boxes, X, DollarSign, Loader2, CheckCircle2, AlertCircle, PackagePlus,
} from 'lucide-react';

interface Props { item: any; onClose: () => void; onSuccess: () => void; }

export default function PartRestockModal({ item, onClose, onSuccess }: Props) {
  const supabase = createClient();
  const [qty, setQty] = useState('1');
  const [costPrice, setCostPrice] = useState(String(item.cost_price ?? ''));
  const [note, setNote] = useState('');
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  function notify(msg: string, ok = true) { setToast({ msg, ok }); setTimeout(() => setToast(null), 2600); }

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      setProfile(p);
    }
    load();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const addQty = parseInt(qty);
    if (!addQty || addQty <= 0) return notify('กรอกจำนวนที่รับเข้าให้ถูกต้อง', false);
    if (!profile) return notify('กำลังโหลดข้อมูล กรุณารอสักครู่', false);
    setLoading(true);

    const cost = parseFloat(costPrice) || 0;
    const newQty = Number(item.stock_qty || 0) + addQty;

    const { error: txError } = await supabase.from('part_transactions').insert({
      shop_id: profile.shop_id, part_id: item.id, type: 'in', qty_change: addQty,
      cost_at_transaction: cost, reference_type: 'purchase', note: note.trim() || 'เติมสต๊อก',
      done_by: profile.id, done_by_name: profile.full_name,
    });
    if (txError) { notify('บันทึกไม่สำเร็จ: ' + txError.message, false); setLoading(false); return; }

    const { error: updateError } = await supabase.from('parts')
      .update({ stock_qty: newQty, cost_price: cost })
      .eq('id', item.id);
    if (updateError) { notify('อัปเดตสต๊อกไม่สำเร็จ: ' + updateError.message, false); setLoading(false); return; }

    const codeTxt = item.sku || item.id.slice(0, 8);
    const msg = `📦 เติมสต๊อกอะไหล่\n━━━━━━━━━━━━━\n🔧 ${item.name}\n🔖 ${codeTxt}\n➕ รับเข้า: ${addQty} ชิ้น\n💰 ต้นทุน/ชิ้น: ฿${cost.toLocaleString()}\n📊 คงเหลือ: ${newQty} ชิ้น\n👤 บันทึกโดย: ${profile.full_name}`;
    sendLinePush(msg, 'restock').catch(() => {});
    syncLedgerEntry(supabase, {
      shopId: profile.shop_id, branchId: profile.branch_id, sourceEvent: 'parts_stock_in',
      amount: cost * addQty, description: `เติมสต๊อกอะไหล่ ${item.name} ${addQty} ชิ้น`,
      userId: profile.id, userName: profile.full_name,
    });

    setLoading(false);
    notify('เติมสต๊อกสำเร็จ');
    setTimeout(() => onSuccess(), 800);
  }

  return (
    <div onClick={onClose} style={ov}>
      <div onClick={(e) => e.stopPropagation()} className="v3-card" style={card}>
        <div style={headerSt}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#dcfce7', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><PackagePlus size={18} /></div>
            <div style={{ minWidth: 0 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, fontFamily: 'Prompt, sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>เติมสต๊อก</h2>
              <p style={{ fontSize: 11, color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name} · คงเหลือตอนนี้ {item.stock_qty} ชิ้น</p>
            </div>
          </div>
          <button onClick={onClose} style={closeBtn}><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ overflowY: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <F label="จำนวนที่รับเข้า" req><Inp Icon={Boxes} type="number" value={qty} onChange={(v: string) => setQty(v)} placeholder="1" /></F>
          <F label="ต้นทุน/ชิ้น (฿)"><Inp Icon={DollarSign} type="number" value={costPrice} onChange={(v: string) => setCostPrice(v)} placeholder="0" /></F>
          <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>คงเหลือหลังเติม: {Number(item.stock_qty || 0) + (parseInt(qty) || 0)} ชิ้น</div>
          <F label="หมายเหตุ"><textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="(ไม่บังคับ)" rows={2} style={{ ...inputSt, height: 'auto', minHeight: 52, padding: '10px 12px', resize: 'vertical' }} onFocus={fOn} onBlur={fOff} /></F>

          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button type="button" onClick={onClose} style={secBtn}>ยกเลิก</button>
            <button type="submit" disabled={loading} style={{ ...priBtn, background: loading ? 'var(--surface-2)' : 'linear-gradient(135deg, #16a34a, #15803d)' }}>
              {loading ? <Loader2 size={17} className="v3-spin" /> : <PackagePlus size={17} strokeWidth={2.4} />}
              {loading ? 'กำลังบันทึก...' : 'เติมสต๊อก'}
            </button>
          </div>
        </form>
      </div>
      {toast && (
        <div style={{ position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)', background: toast.ok ? '#16a34a' : '#dc2626', color: '#fff', padding: '12px 20px', borderRadius: 12, fontSize: 13, fontWeight: 600, boxShadow: '0 8px 24px rgba(0,0,0,0.2)', zIndex: 300, maxWidth: '90vw', display: 'flex', alignItems: 'center', gap: 8 }}>
          {toast.ok ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />} {toast.msg}
        </div>
      )}
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

const ov: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 };
const card: React.CSSProperties = { maxWidth: 420, width: '100%', padding: 0, maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' };
const headerSt: React.CSSProperties = { padding: '16px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, gap: 8 };
const closeBtn: React.CSSProperties = { width: 32, height: 32, background: 'var(--surface-2)', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 };
const iconSt: React.CSSProperties = { position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' };
const inputSt: React.CSSProperties = { width: '100%', height: 46, padding: '0 12px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text)', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' };
const secBtn: React.CSSProperties = { flex: 1, padding: 13, background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
const priBtn: React.CSSProperties = { flex: 2, padding: 13, color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 };
