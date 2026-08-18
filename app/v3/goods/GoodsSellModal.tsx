'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase-client';
import BarcodeScanner from '@/components/BarcodeScanner';
import ReceiptPDF from '@/components/ReceiptPDF';
import { sendLineNotify } from '@/lib/line-notify';
import { computeBusinessDate, getShopCutoffTime } from '@/lib/business-date';
import {
  ShoppingCart, X, ScanLine, Search, Plus, Minus, Trash2, Tag,
  Loader2, CheckCircle2, AlertCircle, Receipt, Package, Printer,
} from 'lucide-react';

interface CartItem {
  goods_id: string; sku: string; name: string; category?: string | null;
  unit_price: number; quantity: number; stock_qty: number;
}
interface Props { onClose: () => void; onSuccess: () => void; }

export default function GoodsSellModal({ onClose, onSuccess }: Props) {
  const supabase = createClient();
  const [profile, setProfile] = useState<any>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [discount, setDiscount] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
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

  // ค้นหาแบบ debounce (ชื่อ หรือ SKU)
  useEffect(() => {
    const q = query.trim();
    if (!q) { setResults([]); return; }
    setSearching(true);
    const t = setTimeout(async () => {
      const { data } = await supabase.from('goods').select('*')
        .or(`name.ilike.%${q}%,sku.ilike.%${q}%`).gt('stock_qty', 0).limit(8);
      setResults(data || []);
      setSearching(false);
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  function addItem(item: any) {
    if (item.stock_qty <= 0) { notify('สต๊อกหมด: ' + item.name, false); return; }
    setCart(prev => {
      const idx = prev.findIndex(c => c.goods_id === item.id);
      if (idx >= 0) {
        if (prev[idx].quantity >= item.stock_qty) { notify(`${item.name} เหลือ ${item.stock_qty}`, false); return prev; }
        const nc = [...prev]; nc[idx] = { ...nc[idx], quantity: nc[idx].quantity + 1 }; return nc;
      }
      return [...prev, { goods_id: item.id, sku: item.sku, name: item.name, category: item.category, unit_price: Number(item.sell_price), quantity: 1, stock_qty: item.stock_qty }];
    });
    setQuery(''); setResults([]);
  }

  async function addBySku(sku: string) {
    const cleaned = sku.trim();
    if (!cleaned) return;
    const { data: item } = await supabase.from('goods').select('*').ilike('sku', cleaned).maybeSingle();
    if (!item) { notify('ไม่พบสินค้า SKU: ' + cleaned, false); return; }
    addItem(item);
    notify('เพิ่ม: ' + item.name);
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

  const subtotal = useMemo(() => cart.reduce((s, c) => s + c.unit_price * c.quantity, 0), [cart]);
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

    const receiptId = crypto.randomUUID();
    const cutoffTime = await getShopCutoffTime(supabase, profile.shop_id);
    const businessDate = computeBusinessDate(new Date(), cutoffTime);
    const sales = cart.map(c => {
      const itemSubtotal = c.unit_price * c.quantity;
      const itemDiscount = subtotal > 0 ? (discountValue * itemSubtotal / subtotal) : 0;
      return {
        receipt_id: receiptId, goods_id: c.goods_id, sku: c.sku, name: c.name, category: c.category || null,
        unit_price: c.unit_price, quantity: c.quantity, subtotal: Number((itemSubtotal - itemDiscount).toFixed(2)),
        sold_by: user.id, sold_by_name: profile?.full_name, sold_date: new Date().toISOString().split('T')[0],
        business_date: businessDate,
        branch_id: profile.branch_id, shop_id: profile.shop_id,
      };
    });

    const { error: salesError } = await supabase.from('goods_sales').insert(sales);
    if (salesError) { notify('เกิดข้อผิดพลาด: ' + salesError.message, false); setSubmitting(false); return; }

    for (const c of cart) {
      await supabase.from('goods').update({ stock_qty: c.stock_qty - c.quantity }).eq('id', c.goods_id);
    }

    const itemLines = cart.map(c => `• ${c.name} x${c.quantity} = ฿${(c.unit_price * c.quantity).toLocaleString()}`).join('\n');
    const lineMsg = `🎒 ขายอุปกรณ์เสริม\n━━━━━━━━━━━━━\n${itemLines}\n━━━━━━━━━━━━━\n💵 รวม: ฿${total.toLocaleString()}`;
    sendLineNotify(lineMsg, 'goods').catch(() => {});

    setSubmitting(false);
    setDone({ receiptNo: receiptId.substring(0, 8).toUpperCase(), items: [...cart], subtotal, discount: discountValue, total });
  }

  /* ===== Success view ===== */
  if (done) {
    return (
      <Overlay onClose={() => { onSuccess(); }}>
        <div style={{ padding: 24, textAlign: 'center', overflowY: 'auto' }}>
          <div style={{ width: 72, height: 72, margin: '0 auto 14px', background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: '#fff', borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle2 size={42} strokeWidth={2.2} />
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 800, fontFamily: 'Prompt, sans-serif' }}>ขายสำเร็จ!</h2>
          <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 16 }}>ใบเสร็จ #{done.receiptNo}</p>
          <div style={{ textAlign: 'left', background: 'var(--surface-2)', borderRadius: 12, padding: 14, marginBottom: 16 }}>
            {done.items.map((it: CartItem, i: number) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                <span>{it.name} <span style={{ color: 'var(--text-muted)' }}>x{it.quantity}</span></span>
                <span style={{ fontWeight: 600 }}>฿{(it.unit_price * it.quantity).toLocaleString()}</span>
              </div>
            ))}
            <div style={{ borderTop: '1px dashed var(--border)', marginTop: 8, paddingTop: 8 }}>
              {done.discount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#ef4444' }}><span>ส่วนลด</span><span>-฿{done.discount.toLocaleString()}</span></div>}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 800, fontFamily: 'Prompt, sans-serif', marginTop: 4 }}><span>รวมสุทธิ</span><span style={{ color: '#16a34a' }}>฿{done.total.toLocaleString()}</span></div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setShowReceipt(true)} style={{ ...secBtn, background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><Printer size={15} /> พิมพ์</button>
            <button onClick={() => { setDone(null); setCart([]); setDiscount(''); }} style={secBtn}>ขายต่อ</button>
            <button onClick={() => onSuccess()} style={{ ...priBtn, background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}>เสร็จสิ้น</button>
          </div>
        </div>
        {showReceipt && (
          <ReceiptPDF
            receiptNo={done.receiptNo}
            type="goods_sale"
            items={done.items.map((it: CartItem) => ({ name: it.name, qty: it.quantity, price: it.unit_price }))}
            subtotal={done.subtotal}
            discount={done.discount}
            total={done.total}
            onClose={() => setShowReceipt(false)}
          />
        )}
      </Overlay>
    );
  }

  return (
    <Overlay onClose={onClose}>
      <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: '#dcfce7', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ShoppingCart size={18} /></div>
          <div><h2 style={{ fontSize: 16, fontWeight: 700, fontFamily: 'Prompt, sans-serif' }}>ขายอุปกรณ์เสริม</h2><p style={{ fontSize: 11, color: 'var(--text-dim)' }}>{totalQty} ชิ้นในตะกร้า</p></div>
        </div>
        <button onClick={onClose} style={closeBtn}><X size={16} /></button>
      </div>

      {/* Search + scan */}
      <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={16} style={iconSt} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ค้นหาชื่อ / SKU..." style={{ ...inputSt, paddingLeft: 40 }} onFocus={fOn} onBlur={fOff} />
          </div>
          <button type="button" onClick={() => setShowScanner(true)} style={{ width: 46, height: 46, borderRadius: 12, background: 'var(--accent)', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}><ScanLine size={20} /></button>
        </div>
        {/* results dropdown */}
        {query.trim() && (
          <div style={{ marginTop: 8, maxHeight: 200, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 12 }}>
            {searching ? (
              <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-dim)' }}><Loader2 size={16} className="v3-spin" /></div>
            ) : results.length === 0 ? (
              <div style={{ padding: 16, textAlign: 'center', fontSize: 12, color: 'var(--text-dim)' }}>ไม่พบสินค้า (หรือสต๊อกหมด)</div>
            ) : results.map(r => (
              <button key={r.id} onClick={() => addItem(r)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: 10, background: 'transparent', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--surface-2)', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Package size={16} /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{r.sku} · เหลือ {r.stock_qty}</div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#16a34a' }}>฿{Number(r.sell_price).toLocaleString()}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Cart */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 18 }}>
        {cart.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-dim)' }}>
            <ShoppingCart size={40} strokeWidth={1.2} style={{ margin: '0 auto 10px' }} />
            <div style={{ fontSize: 13 }}>ค้นหาหรือสแกนสินค้าเพื่อเพิ่มลงตะกร้า</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {cart.map((c, idx) => (
              <div key={c.goods_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, background: 'var(--surface-2)', borderRadius: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>฿{c.unit_price.toLocaleString()} × {c.quantity} = <strong>฿{(c.unit_price * c.quantity).toLocaleString()}</strong></div>
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

      {/* Footer: discount + total + confirm */}
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

      {showScanner && <BarcodeScanner onScan={(code) => { setShowScanner(false); try { (navigator as any).vibrate?.(100); } catch {} addBySku(code); }} onClose={() => setShowScanner(false)} mode="any" />}
      {toast && (
        <div style={{ position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)', background: toast.ok ? '#16a34a' : '#dc2626', color: '#fff', padding: '12px 20px', borderRadius: 12, fontSize: 13, fontWeight: 600, boxShadow: '0 8px 24px rgba(0,0,0,0.2)', zIndex: 300, maxWidth: '90vw', display: 'flex', alignItems: 'center', gap: 8 }}>
          {toast.ok ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />} {toast.msg}
        </div>
      )}
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
