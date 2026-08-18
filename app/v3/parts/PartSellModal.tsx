'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase-client';
import { sendLineNotify } from '@/lib/line-notify';
import { syncLedgerEntry } from '@/lib/ledger-sync';
import { getCategoryShort, getGradeInfo } from '@/lib/parts-constants';
import {
  ShoppingCart, X, Search, Plus, Minus, Trash2, Tag, Wrench,
  Loader2, CheckCircle2, AlertCircle, Receipt, ScanLine,
} from 'lucide-react';
import BarcodeScanner from '@/components/BarcodeScanner';

interface CartItem {
  part_id: string; name: string; sku?: string | null; phone_model?: string; category?: string; grade?: string;
  sell_price: number; cost_price: number; quantity: number; stock_qty: number;
}
interface Props { onClose: () => void; onSuccess: () => void; }

export default function PartSellModal({ onClose, onSuccess }: Props) {
  const supabase = createClient();
  const [profile, setProfile] = useState<any>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [query, setQuery] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [resultModels, setResultModels] = useState<Record<string, string[]>>({});
  const [searching, setSearching] = useState(false);
  const [discount, setDiscount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<any>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  function notify(msg: string, ok = true) { setToast({ msg, ok }); setTimeout(() => setToast(null), 2200); }

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      setProfile(p);
    }
    load();
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (!q) { setResults([]); setResultModels({}); return; }
    setSearching(true);
    const t = setTimeout(async () => {
      const { data: direct } = await supabase.from('parts').select('*')
        .or(`name.ilike.%${q}%,phone_model.ilike.%${q}%,sku.ilike.%${q}%`).gt('stock_qty', 0).limit(8);

      const { data: models } = await supabase.from('device_models').select('id').ilike('model_name', `%${q}%`).limit(20);
      const modelIds = (models || []).map((m: any) => m.id);
      let viaModel: any[] = [];
      if (modelIds.length > 0) {
        const { data: compat } = await supabase.from('part_compatibility').select('part_id').in('device_model_id', modelIds);
        const partIds = Array.from(new Set((compat || []).map((c: any) => c.part_id)));
        if (partIds.length > 0) {
          const { data: viaModelParts } = await supabase.from('parts').select('*').in('id', partIds).gt('stock_qty', 0).limit(8);
          viaModel = viaModelParts || [];
        }
      }

      const merged: any[] = [...(direct || [])];
      viaModel.forEach(p => { if (!merged.some(m => m.id === p.id)) merged.push(p); });
      const final = merged.slice(0, 8);
      setResults(final);

      if (final.length > 0) {
        const { data: compatRows } = await supabase.from('part_compatibility')
          .select('part_id, device_models(model_name)').in('part_id', final.map(p => p.id));
        const map: Record<string, string[]> = {};
        (compatRows || []).forEach((r: any) => {
          const name = r.device_models?.model_name;
          if (!name) return;
          if (!map[r.part_id]) map[r.part_id] = [];
          map[r.part_id].push(name);
        });
        setResultModels(map);
      } else {
        setResultModels({});
      }
      setSearching(false);
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  function addItem(item: any) {
    if (item.stock_qty <= 0) { notify('สต๊อกหมด: ' + item.name, false); return; }
    setCart(prev => {
      const idx = prev.findIndex(c => c.part_id === item.id);
      if (idx >= 0) {
        if (prev[idx].quantity >= item.stock_qty) { notify(`${item.name} เหลือ ${item.stock_qty}`, false); return prev; }
        const nc = [...prev]; nc[idx] = { ...nc[idx], quantity: nc[idx].quantity + 1 }; return nc;
      }
      return [...prev, { part_id: item.id, name: item.name, sku: item.sku, phone_model: item.phone_model, category: item.category, grade: item.grade, sell_price: Number(item.sell_price), cost_price: Number(item.cost_price || 0), quantity: 1, stock_qty: item.stock_qty }];
    });
    setQuery(''); setResults([]);
  }

  function updateQty(idx: number, delta: number) {
    setCart(prev => {
      const item = prev[idx];
      const newQty = item.quantity + delta;
      if (newQty <= 0) return prev.filter((_, i) => i !== idx);
      if (newQty > item.stock_qty) { notify(`เหลือแค่ ${item.stock_qty}`, false); return prev; }
      const nc = [...prev]; nc[idx] = { ...item, quantity: newQty }; return nc;
    });
  }

  const subtotal = useMemo(() => cart.reduce((s, c) => s + c.sell_price * c.quantity, 0), [cart]);
  const discountValue = Math.max(0, parseFloat(discount) || 0);
  const total = Math.max(0, subtotal - discountValue);
  const totalQty = cart.reduce((s, c) => s + c.quantity, 0);

  async function confirmSell() {
    if (cart.length === 0) return notify('ตะกร้าว่าง', false);
    if (discountValue > subtotal) return notify('ส่วนลดเกินยอดรวม', false);
    if (!profile) return notify('กำลังโหลดข้อมูล กรุณารอสักครู่', false);
    setSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSubmitting(false); return; }

    for (const c of cart) {
      await supabase.from('part_transactions').insert({
        shop_id: profile.shop_id, part_id: c.part_id, type: 'out', qty_change: -c.quantity,
        cost_at_transaction: c.cost_price, reference_type: 'sale',
        note: `ขายอะไหล่ @ ฿${c.sell_price.toLocaleString()} x${c.quantity}`,
        done_by: user.id, done_by_name: profile?.full_name,
      });
      await supabase.from('parts').update({ stock_qty: c.stock_qty - c.quantity }).eq('id', c.part_id);
    }

    const { data: compatRows } = await supabase.from('part_compatibility')
      .select('part_id, device_models(model_name)').in('part_id', cart.map(c => c.part_id));
    const modelsMap: Record<string, string[]> = {};
    (compatRows || []).forEach((r: any) => {
      const name = r.device_models?.model_name;
      if (!name) return;
      (modelsMap[r.part_id] ||= []).push(name);
    });

    const itemLines = cart.map(c => {
      const code = c.sku || c.part_id.slice(0, 8);
      const modelsTxt = (modelsMap[c.part_id]?.join(' / ')) || c.phone_model || 'ทั่วไป';
      const profit = (c.sell_price - c.cost_price) * c.quantity;
      const remain = c.stock_qty - c.quantity;
      return `🔧 ${c.name}\n🔖 ${code} • 📱 ${modelsTxt}\nจำนวน ${c.quantity} • ราคา ฿${c.sell_price.toLocaleString()}/ชิ้น\nกำไร ฿${profit.toLocaleString()} • คงเหลือ ${remain} ชิ้น`;
    }).join('\n━━━━━━━━━━━━━\n');
    const discountTxt = discountValue > 0 ? `\nส่วนลด: -฿${discountValue.toLocaleString()}` : '';
    const lineMsg = `🛒 ขายอะไหล่\n━━━━━━━━━━━━━\n${itemLines}\n━━━━━━━━━━━━━${discountTxt}\n💵 ยอดสุทธิ: ฿${total.toLocaleString()}`;
    sendLineNotify(lineMsg, 'sale').catch(() => {});

    syncLedgerEntry(supabase, {
      shopId: profile.shop_id, branchId: profile.branch_id, sourceEvent: 'parts_sold',
      amount: total, description: `ขายอะไหล่ ${cart.map(c => c.name).join(', ')} - ${total.toLocaleString()} บาท`,
      userId: user.id, userName: profile.full_name,
    });

    setSubmitting(false);
    setDone({ items: [...cart], subtotal, discount: discountValue, total });
  }

  if (done) {
    return (
      <Overlay onClose={() => onSuccess()}>
        <div style={{ padding: 24, textAlign: 'center', overflowY: 'auto' }}>
          <div style={{ width: 72, height: 72, margin: '0 auto 14px', background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: '#fff', borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CheckCircle2 size={42} strokeWidth={2.2} /></div>
          <h2 style={{ fontSize: 20, fontWeight: 800, fontFamily: 'Prompt, sans-serif' }}>ขายสำเร็จ!</h2>
          <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 16 }}>หักสต๊อกเรียบร้อย</p>
          <div style={{ textAlign: 'left', background: 'var(--surface-2)', borderRadius: 12, padding: 14, marginBottom: 16 }}>
            {done.items.map((it: CartItem, i: number) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                <span>{it.name} <span style={{ color: 'var(--text-muted)' }}>x{it.quantity}</span></span>
                <span style={{ fontWeight: 600 }}>฿{(it.sell_price * it.quantity).toLocaleString()}</span>
              </div>
            ))}
            <div style={{ borderTop: '1px dashed var(--border)', marginTop: 8, paddingTop: 8 }}>
              {done.discount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#ef4444' }}><span>ส่วนลด</span><span>-฿{done.discount.toLocaleString()}</span></div>}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 800, fontFamily: 'Prompt, sans-serif', marginTop: 4 }}><span>รวมสุทธิ</span><span style={{ color: '#16a34a' }}>฿{done.total.toLocaleString()}</span></div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { setDone(null); setCart([]); setDiscount(''); }} style={secBtn}>ขายต่อ</button>
            <button onClick={() => onSuccess()} style={{ ...priBtn, background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}>เสร็จสิ้น</button>
          </div>
        </div>
      </Overlay>
    );
  }

  return (
    <Overlay onClose={onClose}>
      <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: '#fce7f3', color: '#ec4899', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ShoppingCart size={18} /></div>
          <div><h2 style={{ fontSize: 16, fontWeight: 700, fontFamily: 'Prompt, sans-serif' }}>ขายอะไหล่</h2><p style={{ fontSize: 11, color: 'var(--text-dim)' }}>{totalQty} ชิ้นในตะกร้า</p></div>
        </div>
        <button onClick={onClose} style={closeBtn}><X size={16} /></button>
      </div>

      <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
            <Search size={16} style={iconSt} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ค้นหาชื่อ / รุ่นมือถือ / SKU..." style={{ ...inputSt, paddingLeft: 40, width: '100%' }} onFocus={fOn} onBlur={fOff} />
          </div>
          <button type="button" onClick={() => setShowScanner(true)} title="สแกน SKU" style={{ width: 46, height: 46, borderRadius: 12, background: 'var(--accent)', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}><ScanLine size={20} /></button>
        </div>
        {query.trim() && (
          <div style={{ marginTop: 8, maxHeight: 200, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 12 }}>
            {searching ? (
              <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-dim)' }}><Loader2 size={16} className="v3-spin" /></div>
            ) : results.length === 0 ? (
              <div style={{ padding: 16, textAlign: 'center', fontSize: 12, color: 'var(--text-dim)' }}>ไม่พบอะไหล่ (หรือสต๊อกหมด)</div>
            ) : results.map(r => {
              const grade = getGradeInfo(r.grade);
              return (
                <button key={r.id} onClick={() => addItem(r)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: 10, background: 'transparent', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                  <div style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--surface-2)', color: '#ec4899', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Wrench size={16} /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{(resultModels[r.id]?.join(' / ')) || r.phone_model || getCategoryShort(r.category)} {grade && `· ${grade.label}`} · เหลือ {r.stock_qty}</div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#16a34a' }}>฿{Number(r.sell_price).toLocaleString()}</div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 18 }}>
        {cart.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-dim)' }}>
            <ShoppingCart size={40} strokeWidth={1.2} style={{ margin: '0 auto 10px' }} />
            <div style={{ fontSize: 13 }}>ค้นหาอะไหล่เพื่อเพิ่มลงตะกร้า</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {cart.map((c, idx) => (
              <div key={c.part_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, background: 'var(--surface-2)', borderRadius: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>฿{c.sell_price.toLocaleString()} × {c.quantity} = <strong>฿{(c.sell_price * c.quantity).toLocaleString()}</strong></div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <button onClick={() => updateQty(idx, -1)} style={stepBtn}><Minus size={14} /></button>
                  <span style={{ minWidth: 22, textAlign: 'center', fontSize: 14, fontWeight: 700 }}>{c.quantity}</span>
                  <button onClick={() => updateQty(idx, 1)} style={stepBtn}><Plus size={14} /></button>
                  <button onClick={() => setCart(cart.filter((_, i) => i !== idx))} style={{ ...stepBtn, color: '#ef4444', marginLeft: 2 }}><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {cart.length > 0 && (
        <div style={{ padding: 18, borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <span style={{ fontSize: 13, color: 'var(--text-dim)', flexShrink: 0 }}>ส่วนลด (฿)</span>
            <div style={{ position: 'relative', flex: 1 }}>
              <Tag size={15} style={iconSt} />
              <input type="number" inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0" style={{ ...inputSt, height: 40, paddingLeft: 38 }} onFocus={fOn} onBlur={fOff} />
            </div>
          </div>
          <div style={{ background: 'var(--surface-2)', borderRadius: 12, padding: 12, marginBottom: 12 }}>
            <Row label={`ยอดรวม (${totalQty} ชิ้น)`} value={`฿${subtotal.toLocaleString()}`} />
            {discountValue > 0 && <Row label="ส่วนลด" value={`-฿${discountValue.toLocaleString()}`} color="#ef4444" />}
            <div style={{ borderTop: '1px dashed var(--border)', marginTop: 8, paddingTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 14, fontWeight: 700 }}>รวมสุทธิ</span>
              <span style={{ fontSize: 22, fontWeight: 800, fontFamily: 'Prompt, sans-serif', color: '#16a34a' }}>฿{total.toLocaleString()}</span>
            </div>
          </div>
          <button onClick={confirmSell} disabled={submitting} style={{ ...priBtn, width: '100%', padding: 15, background: submitting ? 'var(--surface-2)' : 'linear-gradient(135deg, #22c55e, #16a34a)', fontSize: 15 }}>
            {submitting ? <Loader2 size={18} className="v3-spin" /> : <Receipt size={18} strokeWidth={2.4} />}
            {submitting ? 'กำลังบันทึก...' : `ยืนยันการขาย ฿${total.toLocaleString()}`}
          </button>
        </div>
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)', background: toast.ok ? '#16a34a' : '#dc2626', color: '#fff', padding: '12px 20px', borderRadius: 12, fontSize: 13, fontWeight: 600, boxShadow: '0 8px 24px rgba(0,0,0,0.2)', zIndex: 300, maxWidth: '90vw', display: 'flex', alignItems: 'center', gap: 8 }}>
          {toast.ok ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />} {toast.msg}
        </div>
      )}
      {showScanner && <BarcodeScanner mode="any" onScan={(code) => { setShowScanner(false); try { (navigator as any).vibrate?.(100); } catch {} setQuery(code.trim()); }} onClose={() => setShowScanner(false)} />}
    </Overlay>
  );
}

function Overlay({ onClose, children }: any) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} className="v3-card" style={{ maxWidth: 520, width: '100%', padding: 0, height: '88vh', maxHeight: 720, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  );
}
function Row({ label, value, color }: any) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
      <span style={{ color: 'var(--text-dim)' }}>{label}</span>
      <span style={{ fontWeight: 600, color: color || 'var(--text)' }}>{value}</span>
    </div>
  );
}
function fOn(e: React.FocusEvent<any>) { e.target.style.borderColor = 'var(--accent)'; }
function fOff(e: React.FocusEvent<any>) { e.target.style.borderColor = 'var(--border)'; }

const closeBtn: React.CSSProperties = { width: 32, height: 32, background: 'var(--surface-2)', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const iconSt: React.CSSProperties = { position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' };
const inputSt: React.CSSProperties = { width: '100%', height: 46, padding: '0 12px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text)', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' };
const stepBtn: React.CSSProperties = { width: 28, height: 28, borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 };
const secBtn: React.CSSProperties = { flex: 1, padding: 13, background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
const priBtn: React.CSSProperties = { flex: 1, padding: 13, color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 };
