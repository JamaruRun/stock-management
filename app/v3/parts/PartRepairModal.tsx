'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase-client';
import { sendLinePush } from '@/lib/line-notify';
import { syncLedgerEntry } from '@/lib/ledger-sync';
import {
  Wrench, X, Search, Plus, Minus, Trash2, DollarSign, Tag, Smartphone,
  Loader2, CheckCircle2, AlertCircle, Save,
} from 'lucide-react';

interface RepairItem {
  part_id: string; name: string; sku?: string | null;
  cost_price: number; sell_price: number; wholesale_price: number;
  quantity: number; stock_qty: number;
}
interface Props { onClose: () => void; onSuccess: () => void; }

export default function PartRepairModal({ onClose, onSuccess }: Props) {
  const supabase = createClient();
  const [profile, setProfile] = useState<any>(null);
  const [items, setItems] = useState<RepairItem[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [modelOptions, setModelOptions] = useState<string[]>([]);
  const [deviceModel, setDeviceModel] = useState('');
  const [priceType, setPriceType] = useState<'retail' | 'wholesale'>('retail');
  const [laborCost, setLaborCost] = useState('');
  const [discount, setDiscount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<any>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  function notify(msg: string, ok = true) { setToast({ msg, ok }); setTimeout(() => setToast(null), 2400); }

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
    if (!q) { setResults([]); return; }
    setSearching(true);
    const t = setTimeout(async () => {
      const { data } = await supabase.from('parts').select('*')
        .or(`name.ilike.%${q}%,phone_model.ilike.%${q}%,battery_model.ilike.%${q}%,sku.ilike.%${q}%`).gt('stock_qty', 0).limit(8);
      setResults(data || []);
      setSearching(false);
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    async function loadModels() {
      if (items.length === 0) { setModelOptions([]); setDeviceModel(''); return; }
      const { data } = await supabase.from('part_compatibility')
        .select('part_id, device_models(model_name)').in('part_id', items.map(i => i.part_id));
      if (cancelled) return;
      const union = Array.from(new Set((data || []).map((r: any) => r.device_models?.model_name).filter(Boolean)));
      setModelOptions(union);
      setDeviceModel(prev => (prev && union.includes(prev)) ? prev : (union[0] || ''));
    }
    loadModels();
    return () => { cancelled = true; };
  }, [items.map(i => i.part_id).join(',')]);

  function addItem(item: any) {
    if (item.stock_qty <= 0) { notify('สต๊อกหมด: ' + item.name, false); return; }
    setItems(prev => {
      const idx = prev.findIndex(i => i.part_id === item.id);
      if (idx >= 0) {
        if (prev[idx].quantity >= item.stock_qty) { notify(`${item.name} เหลือ ${item.stock_qty}`, false); return prev; }
        const nc = [...prev]; nc[idx] = { ...nc[idx], quantity: nc[idx].quantity + 1 }; return nc;
      }
      return [...prev, {
        part_id: item.id, name: item.name, sku: item.sku,
        cost_price: Number(item.cost_price || 0), sell_price: Number(item.sell_price || 0), wholesale_price: Number(item.wholesale_price || 0),
        quantity: 1, stock_qty: item.stock_qty,
      }];
    });
    setQuery(''); setResults([]);
  }

  function updateQty(idx: number, delta: number) {
    setItems(prev => {
      const item = prev[idx];
      const newQty = item.quantity + delta;
      if (newQty <= 0) return prev.filter((_, i) => i !== idx);
      if (newQty > item.stock_qty) { notify(`เหลือแค่ ${item.stock_qty}`, false); return prev; }
      const nc = [...prev]; nc[idx] = { ...item, quantity: newQty }; return nc;
    });
  }

  function unitPriceOf(item: RepairItem) {
    return priceType === 'retail' ? item.sell_price : item.wholesale_price;
  }

  const partsTotal = useMemo(() => items.reduce((s, i) => s + unitPriceOf(i) * i.quantity, 0), [items, priceType]);
  const laborCostNum = Math.max(0, parseFloat(laborCost) || 0);
  const discountNum = Math.max(0, parseFloat(discount) || 0);
  const subtotal = partsTotal + laborCostNum;
  const total = Math.max(0, subtotal - discountNum);
  const totalQty = items.reduce((s, i) => s + i.quantity, 0);

  async function confirmRepair() {
    if (items.length === 0) return notify('ยังไม่ได้เลือกอะไหล่', false);
    if (!deviceModel) return notify('เลือกรุ่นเครื่องที่ซ่อม', false);
    if (discountNum > subtotal) return notify('ส่วนลดเกินยอดรวม', false);
    if (!profile) return notify('กำลังโหลดข้อมูล กรุณารอสักครู่', false);
    setSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSubmitting(false); return; }

    const { data: log, error: logError } = await supabase.from('repair_log').insert({
      shop_id: profile.shop_id, branch_id: profile.branch_id, device_model: deviceModel,
      price_type: priceType, labor_cost: laborCostNum, parts_total: partsTotal, discount: discountNum, total,
      done_by: user.id, done_by_name: profile.full_name,
    }).select().single();

    if (logError || !log) { setSubmitting(false); notify('บันทึกไม่สำเร็จ: ' + (logError?.message || ''), false); return; }

    await supabase.from('repair_log_parts').insert(items.map(i => ({
      repair_log_id: log.id, part_id: i.part_id, part_name: i.name, qty: i.quantity,
      unit_cost: i.cost_price, unit_price: unitPriceOf(i),
    })));

    for (const i of items) {
      await supabase.from('parts').update({ stock_qty: i.stock_qty - i.quantity }).eq('id', i.part_id);
      await supabase.from('part_transactions').insert({
        shop_id: profile.shop_id, part_id: i.part_id, type: 'out', qty_change: -i.quantity,
        cost_at_transaction: i.cost_price, reference_type: 'used_in_repair', note: `ซ่อม ${deviceModel}`,
        done_by: user.id, done_by_name: profile.full_name,
      });
    }

    const priceLabel = priceType === 'retail' ? 'หน้าร้าน' : 'ส่ง';
    const itemLines = items.map(i => {
      const code = i.sku || i.part_id.slice(0, 8);
      const remain = i.stock_qty - i.quantity;
      return `🔧 ${i.name} (${code}) x${i.quantity}\nคงเหลือหลังตัด: ${remain} ชิ้น`;
    }).join('\n');
    const discountTxt = discountNum > 0 ? `\nส่วนลด: -฿${discountNum.toLocaleString()}` : '';
    const lineMsg = `🛠️ ซ่อมด่วน (ตัดสต็อคตรง)\n━━━━━━━━━━━━━\n📱 รุ่นเครื่อง: ${deviceModel}\n💲 ราคาที่คิด: ${priceLabel}\n━━━━━━━━━━━━━\n${itemLines}\n━━━━━━━━━━━━━\nค่าอะไหล่: ฿${partsTotal.toLocaleString()}\nค่าแรง: ฿${laborCostNum.toLocaleString()}${discountTxt}\n💵 ยอดรวม: ฿${total.toLocaleString()}`;
    sendLinePush(lineMsg, 'repair_log').catch(() => {});

    syncLedgerEntry(supabase, {
      shopId: profile.shop_id, branchId: profile.branch_id, sourceEvent: 'parts_repair_used',
      amount: total, description: `ซ่อมด่วน ${deviceModel} - ${total.toLocaleString()} บาท`,
      userId: user.id, userName: profile.full_name,
    });

    setSubmitting(false);
    setDone({ items: [...items], deviceModel, priceType, partsTotal, laborCost: laborCostNum, discount: discountNum, total });
  }

  if (done) {
    return (
      <Overlay onClose={() => onSuccess()}>
        <div style={{ padding: 24, textAlign: 'center', overflowY: 'auto' }}>
          <div style={{ width: 72, height: 72, margin: '0 auto 14px', background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: '#fff', borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CheckCircle2 size={42} strokeWidth={2.2} /></div>
          <h2 style={{ fontSize: 20, fontWeight: 800, fontFamily: 'Prompt, sans-serif' }}>บันทึกซ่อมสำเร็จ!</h2>
          <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 16 }}>{done.deviceModel} • หักสต๊อกเรียบร้อย</p>
          <div style={{ textAlign: 'left', background: 'var(--surface-2)', borderRadius: 12, padding: 14, marginBottom: 16 }}>
            {done.items.map((it: RepairItem, i: number) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                <span>{it.name} <span style={{ color: 'var(--text-muted)' }}>x{it.quantity}</span></span>
              </div>
            ))}
            <div style={{ borderTop: '1px dashed var(--border)', marginTop: 8, paddingTop: 8 }}>
              {done.discount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#ef4444' }}><span>ส่วนลด</span><span>-฿{done.discount.toLocaleString()}</span></div>}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 800, fontFamily: 'Prompt, sans-serif', marginTop: 4 }}><span>รวมสุทธิ</span><span style={{ color: '#16a34a' }}>฿{done.total.toLocaleString()}</span></div>
            </div>
          </div>
          <button onClick={() => onSuccess()} style={{ ...priBtn, width: '100%', background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}>เสร็จสิ้น</button>
        </div>
      </Overlay>
    );
  }

  return (
    <Overlay onClose={onClose}>
      <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: '#fce7f3', color: '#ec4899', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Wrench size={18} /></div>
          <div><h2 style={{ fontSize: 16, fontWeight: 700, fontFamily: 'Prompt, sans-serif' }}>ซ่อมด่วน</h2><p style={{ fontSize: 11, color: 'var(--text-dim)' }}>{totalQty} ชิ้น • ไม่ผ่านใบงาน</p></div>
        </div>
        <button onClick={onClose} style={closeBtn}><X size={16} /></button>
      </div>

      <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ position: 'relative' }}>
          <Search size={16} style={iconSt} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ค้นหาอะไหล่ที่ใช้..." style={{ ...inputSt, paddingLeft: 40, width: '100%' }} onFocus={fOn} onBlur={fOff} />
        </div>
        {query.trim() && (
          <div style={{ marginTop: 8, maxHeight: 200, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 12 }}>
            {searching ? (
              <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-dim)' }}><Loader2 size={16} className="v3-spin" /></div>
            ) : results.length === 0 ? (
              <div style={{ padding: 16, textAlign: 'center', fontSize: 12, color: 'var(--text-dim)' }}>ไม่พบอะไหล่ (หรือสต๊อกหมด)</div>
            ) : results.map(r => (
              <button key={r.id} onClick={() => addItem(r)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: 10, background: 'transparent', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--surface-2)', color: '#ec4899', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Wrench size={16} /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>เหลือ {r.stock_qty} ชิ้น</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-dim)' }}>
            <Wrench size={40} strokeWidth={1.2} style={{ margin: '0 auto 10px' }} />
            <div style={{ fontSize: 13 }}>ค้นหาอะไหล่ที่ใช้ในการซ่อม</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {items.map((it, idx) => (
              <div key={it.part_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, background: 'var(--surface-2)', borderRadius: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>฿{unitPriceOf(it).toLocaleString()} × {it.quantity} = <strong>฿{(unitPriceOf(it) * it.quantity).toLocaleString()}</strong></div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <button onClick={() => updateQty(idx, -1)} style={stepBtn}><Minus size={14} /></button>
                  <span style={{ minWidth: 22, textAlign: 'center', fontSize: 14, fontWeight: 700 }}>{it.quantity}</span>
                  <button onClick={() => updateQty(idx, 1)} style={stepBtn}><Plus size={14} /></button>
                  <button onClick={() => setItems(items.filter((_, i) => i !== idx))} style={{ ...stepBtn, color: '#ef4444', marginLeft: 2 }}><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        )}

        {items.length > 0 && (
          <>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 6 }}>รุ่นเครื่องที่ซ่อม</div>
              {modelOptions.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>อะไหล่ที่เลือกยังไม่ได้ผูกกับรุ่นไหนเลย</div>
              ) : (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {modelOptions.map(m => (
                    <button key={m} type="button" onClick={() => setDeviceModel(m)} style={{
                      padding: '7px 12px', borderRadius: 100, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
                      background: deviceModel === m ? 'var(--accent)' : 'var(--surface-2)', color: deviceModel === m ? '#fff' : 'var(--text)',
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                    }}><Smartphone size={11} /> {m}</button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 6 }}>ราคาที่คิด</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={() => setPriceType('retail')} style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, background: priceType === 'retail' ? 'var(--accent)' : 'var(--surface-2)', color: priceType === 'retail' ? '#fff' : 'var(--text)' }}>ราคาหน้าร้าน</button>
                <button type="button" onClick={() => setPriceType('wholesale')} style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, background: priceType === 'wholesale' ? 'var(--accent)' : 'var(--surface-2)', color: priceType === 'wholesale' ? '#fff' : 'var(--text)' }}>ราคาส่ง</button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 6 }}>ค่าแรง (฿)</div>
                <div style={{ position: 'relative' }}>
                  <DollarSign size={15} style={iconSt} />
                  <input type="number" inputMode="decimal" value={laborCost} onChange={(e) => setLaborCost(e.target.value)} placeholder="0" style={{ ...inputSt, paddingLeft: 38 }} onFocus={fOn} onBlur={fOff} />
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 6 }}>ส่วนลด (฿)</div>
                <div style={{ position: 'relative' }}>
                  <Tag size={15} style={iconSt} />
                  <input type="number" inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0" style={{ ...inputSt, paddingLeft: 38 }} onFocus={fOn} onBlur={fOff} />
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {items.length > 0 && (
        <div style={{ padding: 18, borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ background: 'var(--surface-2)', borderRadius: 12, padding: 12, marginBottom: 12 }}>
            <Row label="ค่าอะไหล่" value={`฿${partsTotal.toLocaleString()}`} />
            <Row label="ค่าแรง" value={`฿${laborCostNum.toLocaleString()}`} />
            {discountNum > 0 && <Row label="ส่วนลด" value={`-฿${discountNum.toLocaleString()}`} color="#ef4444" />}
            <div style={{ borderTop: '1px dashed var(--border)', marginTop: 8, paddingTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 14, fontWeight: 700 }}>รวมสุทธิ</span>
              <span style={{ fontSize: 22, fontWeight: 800, fontFamily: 'Prompt, sans-serif', color: '#16a34a' }}>฿{total.toLocaleString()}</span>
            </div>
          </div>
          <button onClick={confirmRepair} disabled={submitting} style={{ ...priBtn, width: '100%', padding: 15, background: submitting ? 'var(--surface-2)' : 'linear-gradient(135deg, #22c55e, #16a34a)', fontSize: 15 }}>
            {submitting ? <Loader2 size={18} className="v3-spin" /> : <Save size={18} strokeWidth={2.4} />}
            {submitting ? 'กำลังบันทึก...' : `ยืนยันซ่อม ฿${total.toLocaleString()}`}
          </button>
        </div>
      )}

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
      <div onClick={(e) => e.stopPropagation()} className="v3-card" style={{ maxWidth: 520, width: '100%', padding: 0, height: '88vh', maxHeight: 760, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
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
const priBtn: React.CSSProperties = { flex: 1, padding: 13, color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 };
