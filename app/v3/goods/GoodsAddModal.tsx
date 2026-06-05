'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase-client';
import BarcodeScanner from '@/components/BarcodeScanner';
import {
  Package, X, ScanLine, RefreshCw, Tag, DollarSign, Boxes, Bell,
  FileText, MapPin, Loader2, CheckCircle2, AlertCircle, PackagePlus,
} from 'lucide-react';

function generateSku() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'ITM-';
  for (let i = 0; i < 6; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
}

interface Props { onClose: () => void; onSuccess: () => void; }

export default function GoodsAddModal({ onClose, onSuccess }: Props) {
  const supabase = createClient();
  const [form, setForm] = useState({
    sku: generateSku(), name: '', category: '', cost_price: '',
    sell_price: '', stock_qty: '', low_stock_alert: '5', note: '', branchId: '',
  });
  const [profile, setProfile] = useState<any>(null);
  const [branches, setBranches] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [restocking, setRestocking] = useState<any>(null);
  const [restockQty, setRestockQty] = useState('');
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  function notify(msg: string, ok = true) { setToast({ msg, ok }); setTimeout(() => setToast(null), 2600); }

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      setProfile(p);
      if (p?.role === 'admin' || p?.is_super_admin) {
        const { data: bs } = await supabase.from('branches').select('*').order('name');
        setBranches(bs || []);
      }
      const { data: goodsData } = await supabase.from('goods').select('category');
      setCategories(Array.from(new Set((goodsData || []).map((g: any) => g.category).filter(Boolean))) as string[]);
      setForm(f => ({ ...f, branchId: p?.branch_id || '' }));
    }
    load();
  }, []);

  async function checkSku(raw: string) {
    const cleaned = raw.trim();
    if (!cleaned) return;
    const { data: existing } = await supabase.from('goods').select('*').ilike('sku', cleaned).maybeSingle();
    if (existing) {
      setRestocking(existing);
      setRestockQty('');
    } else {
      setForm(f => ({ ...f, sku: cleaned }));
      notify('ใช้รหัสนี้สำหรับสินค้าใหม่');
    }
  }

  async function handleRestock() {
    const addQty = parseInt(restockQty) || 0;
    if (addQty <= 0) return notify('กรอกจำนวนที่จะเพิ่ม', false);
    setLoading(true);
    const newQty = (restocking.stock_qty || 0) + addQty;
    const { error } = await supabase.from('goods').update({ stock_qty: newQty }).eq('id', restocking.id);
    setLoading(false);
    if (error) return notify('ไม่สำเร็จ: ' + error.message, false);
    notify(`เติมสต๊อก ${restocking.name}: ${restocking.stock_qty} → ${newQty}`);
    setTimeout(() => onSuccess(), 900);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.sell_price || !form.branchId) return notify('กรอก ชื่อ, ราคาขาย, สาขา', false);
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data: existing } = await supabase.from('goods').select('id, name').eq('sku', form.sku).maybeSingle();
    if (existing) { notify(`SKU ซ้ำ — มีของ "${existing.name}" แล้ว ลองสแกนเพื่อเติมสต๊อก`, false); setLoading(false); return; }

    const { error } = await supabase.from('goods').insert({
      sku: form.sku, name: form.name, category: form.category || null,
      cost_price: parseFloat(form.cost_price) || 0, sell_price: parseFloat(form.sell_price),
      stock_qty: parseInt(form.stock_qty) || 0, low_stock_alert: parseInt(form.low_stock_alert) || 5,
      note: form.note || null, added_by: user.id, added_by_name: profile.full_name,
      branch_id: form.branchId, shop_id: profile.shop_id,
    });
    setLoading(false);
    if (error) { notify('เกิดข้อผิดพลาด: ' + error.message, false); return; }
    notify(`เพิ่ม ${form.name} เข้าสต๊อกแล้ว`);
    setTimeout(() => onSuccess(), 900);
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} className="v3-card" style={{ maxWidth: 480, width: '100%', padding: 0, maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#dbeafe', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Package size={18} /></div>
            <div><h2 style={{ fontSize: 16, fontWeight: 700, fontFamily: 'Prompt, sans-serif' }}>เพิ่มสินค้า</h2><p style={{ fontSize: 11, color: 'var(--text-dim)' }}>อุปกรณ์เสริม / สินค้าขาย</p></div>
          </div>
          <button onClick={onClose} style={closeBtn}><X size={16} /></button>
        </div>

        {restocking ? (
          /* ===== Restock panel ===== */
          <div style={{ padding: 18 }}>
            <div style={{ padding: 14, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, marginBottom: 16, textAlign: 'center' }}>
              <PackagePlus size={32} style={{ color: '#3b82f6', margin: '0 auto 8px' }} />
              <div style={{ fontSize: 15, fontWeight: 700, fontFamily: 'Prompt, sans-serif' }}>{restocking.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>SKU: {restocking.sku} · คงเหลือ {restocking.stock_qty} ชิ้น</div>
            </div>
            <F label="จำนวนที่จะเติม" req>
              <Inp Icon={Boxes} type="number" value={restockQty} onChange={setRestockQty} placeholder="0" />
            </F>
            {parseInt(restockQty) > 0 && (
              <div style={{ padding: '8px 12px', background: '#f0fdf4', borderRadius: 10, fontSize: 12, color: '#166534', marginBottom: 12 }}>
                คงเหลือใหม่: <strong>{(restocking.stock_qty || 0) + (parseInt(restockQty) || 0)}</strong> ชิ้น
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { setRestocking(null); setForm(f => ({ ...f, sku: generateSku() })); }} style={secBtn}>ย้อนกลับ</button>
              <button onClick={handleRestock} disabled={loading} style={{ ...priBtn, background: loading ? 'var(--surface-2)' : 'linear-gradient(135deg, #3b82f6, #2563eb)' }}>
                {loading ? <Loader2 size={17} className="v3-spin" /> : <PackagePlus size={17} strokeWidth={2.4} />}
                {loading ? 'กำลังเติม...' : 'เติมสต๊อก'}
              </button>
            </div>
          </div>
        ) : (
          /* ===== Add form ===== */
          <form onSubmit={handleSubmit} style={{ overflowY: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <SectionTitle Icon={Tag} color="#8b5cf6" label="รหัสสินค้า (SKU)" />
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <Tag size={16} style={iconSt} />
                  <input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} style={{ ...inputSt, paddingLeft: 40 }} onFocus={fOn} onBlur={fOff} />
                </div>
                <button type="button" onClick={() => setForm({ ...form, sku: generateSku() })} title="สุ่มรหัสใหม่" style={iconBtn}><RefreshCw size={18} /></button>
                <button type="button" onClick={() => setShowScanner(true)} title="สแกนบาร์โค้ด" style={{ ...iconBtn, background: 'var(--accent)', color: '#fff' }}><ScanLine size={18} /></button>
              </div>
              <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>สแกนบาร์โค้ดที่มีอยู่ → เติมสต๊อก · ไม่มี → สร้างใหม่</p>
            </div>

            <div>
              <SectionTitle Icon={Package} color="#3b82f6" label="ข้อมูลสินค้า" />
              <F label="ชื่อสินค้า" req><Inp value={form.name} onChange={(v: string) => setForm({ ...form, name: v })} placeholder="เช่น ฟิล์มกระจก iPhone 15" /></F>
              <F label="หมวดหมู่">
                <Inp value={form.category} onChange={(v: string) => setForm({ ...form, category: v })} placeholder="เช่น ฟิล์ม, เคส, สายชาร์จ" list="goods-cats" />
                <datalist id="goods-cats">{categories.map(c => <option key={c} value={c} />)}</datalist>
              </F>
              <div style={g2}>
                <F label="ราคาทุน (฿)"><Inp Icon={DollarSign} type="number" value={form.cost_price} onChange={(v: string) => setForm({ ...form, cost_price: v })} placeholder="0" /></F>
                <F label="ราคาขาย (฿)" req><Inp Icon={DollarSign} type="number" value={form.sell_price} onChange={(v: string) => setForm({ ...form, sell_price: v })} placeholder="0" /></F>
              </div>
              <div style={g2}>
                <F label="จำนวนเริ่มต้น"><Inp Icon={Boxes} type="number" value={form.stock_qty} onChange={(v: string) => setForm({ ...form, stock_qty: v })} placeholder="0" /></F>
                <F label="เตือนเมื่อเหลือ"><Inp Icon={Bell} type="number" value={form.low_stock_alert} onChange={(v: string) => setForm({ ...form, low_stock_alert: v })} placeholder="5" /></F>
              </div>
              <F label="หมายเหตุ"><textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="(ไม่บังคับ)" rows={2} style={{ ...inputSt, height: 'auto', minHeight: 52, padding: '10px 12px', resize: 'vertical' }} onFocus={fOn} onBlur={fOff} /></F>
              {(profile?.role === 'admin' || profile?.is_super_admin) && branches.length > 0 && (
                <F label="สาขา" req>
                  <div style={{ position: 'relative' }}>
                    <MapPin size={16} style={iconSt} />
                    <select value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })} style={{ ...inputSt, paddingLeft: 40, cursor: 'pointer' }}>
                      <option value="">เลือกสาขา</option>
                      {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                </F>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={onClose} style={secBtn}>ยกเลิก</button>
              <button type="submit" disabled={loading} style={{ ...priBtn, background: loading ? 'var(--surface-2)' : 'linear-gradient(135deg, #3b82f6, #2563eb)' }}>
                {loading ? <Loader2 size={17} className="v3-spin" /> : <Package size={17} strokeWidth={2.4} />}
                {loading ? 'กำลังบันทึก...' : 'เพิ่มสินค้า'}
              </button>
            </div>
          </form>
        )}
      </div>

      {showScanner && <BarcodeScanner onScan={(code) => { setShowScanner(false); checkSku(code); }} onClose={() => setShowScanner(false)} mode="any" />}
      {toast && (
        <div style={{ position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)', background: toast.ok ? '#16a34a' : '#dc2626', color: '#fff', padding: '12px 20px', borderRadius: 12, fontSize: 13, fontWeight: 600, boxShadow: '0 8px 24px rgba(0,0,0,0.2)', zIndex: 300, maxWidth: '90vw', display: 'flex', alignItems: 'center', gap: 8 }}>
          {toast.ok ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />} {toast.msg}
        </div>
      )}
    </div>
  );
}

function SectionTitle({ Icon, color, label }: any) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
      <div style={{ width: 28, height: 28, borderRadius: 8, background: `${color}15`, color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon size={15} /></div>
      <h3 style={{ fontSize: 13, fontWeight: 700, fontFamily: 'Prompt, sans-serif' }}>{label}</h3>
    </div>
  );
}
function F({ label, req, children }: any) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{label} {req && <span style={{ color: '#ef4444' }}>*</span>}</label>
      {children}
    </div>
  );
}
function Inp({ Icon, value, onChange, placeholder, type = 'text', list }: any) {
  return (
    <div style={{ position: 'relative' }}>
      {Icon && <Icon size={16} style={iconSt} />}
      <input type={type} list={list} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={{ ...inputSt, paddingLeft: Icon ? 40 : 12 }} onFocus={fOn} onBlur={fOff} inputMode={type === 'number' ? 'decimal' : undefined} />
    </div>
  );
}
function fOn(e: React.FocusEvent<any>) { e.target.style.borderColor = 'var(--accent)'; }
function fOff(e: React.FocusEvent<any>) { e.target.style.borderColor = 'var(--border)'; }

const closeBtn: React.CSSProperties = { width: 32, height: 32, background: 'var(--surface-2)', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const iconSt: React.CSSProperties = { position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' };
const inputSt: React.CSSProperties = { width: '100%', height: 46, padding: '0 12px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text)', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' };
const iconBtn: React.CSSProperties = { width: 46, height: 46, borderRadius: 12, background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 };
const g2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 };
const secBtn: React.CSSProperties = { flex: 1, padding: 13, background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
const priBtn: React.CSSProperties = { flex: 2, padding: 13, color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 };
