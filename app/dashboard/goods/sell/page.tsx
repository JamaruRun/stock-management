'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase-client';
import Toast from '@/components/Toast';
import BarcodeScanner from '@/components/BarcodeScanner';

interface CartItem {
  goods_id: string;
  sku: string;
  name: string;
  category?: string;
  unit_price: number;
  quantity: number;
  stock_qty: number;
}

export default function SellGoodsPage() {
  const supabase = createClient();
  const [profile, setProfile] = useState<any>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showScanner, setShowScanner] = useState(false);
  const [manualSku, setManualSku] = useState('');
  const [discount, setDiscount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ title: string; msg: string; type: string } | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  function showToast(title: string, msg: string, type: 'success' | 'danger' = 'success') {
    setToast({ title, msg, type });
    setTimeout(() => setToast(null), 2000);
  }

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: p } = await supabase
        .from('profiles').select('*').eq('id', user.id).single();
      setProfile(p);
    }
    load();
  }, []);

  async function addBySku(sku: string) {
    const cleaned = sku.trim().toUpperCase();
    if (!cleaned) return;

    // ค้นหาในฐานข้อมูลก่อน (case-insensitive)
    const { data: item, error } = await supabase
      .from('goods').select('*').ilike('sku', cleaned).maybeSingle();

    if (error) {
      showToast('เกิดข้อผิดพลาด', error.message, 'danger');
      return;
    }

    if (!item) {
      showToast('ไม่พบสินค้า', `SKU: ${cleaned}`, 'danger');
      return;
    }

    if (item.stock_qty <= 0) {
      showToast('สต๊อกหมด', item.name, 'danger');
      return;
    }

    // ใช้ functional update เพื่อไม่ให้ติด closure
    setCart(prev => {
      const existingIdx = prev.findIndex(c => c.sku === cleaned);
      if (existingIdx >= 0) {
        const existing = prev[existingIdx];
        if (existing.quantity >= item.stock_qty) {
          showToast('สต๊อกหมด', `${item.name} เหลือ ${item.stock_qty}`, 'danger');
          return prev;
        }
        const newCart = [...prev];
        newCart[existingIdx] = { ...existing, quantity: existing.quantity + 1 };
        showToast('เพิ่มอีก 1', `${item.name} (${existing.quantity + 1})`);
        return newCart;
      }

      // เพิ่มใหม่
      showToast('เพิ่มเข้าตะกร้า', item.name);
      return [...prev, {
        goods_id: item.id,
        sku: item.sku,
        name: item.name,
        category: item.category,
        unit_price: Number(item.sell_price),
        quantity: 1,
        stock_qty: item.stock_qty,
      }];
    });
  }

  function handleScan(code: string) {
    setShowScanner(false);
    // Vibrate ถ้ารองรับ
    try {
      if (navigator.vibrate) navigator.vibrate(100);
    } catch (e) {}
    addBySku(code);
  }

  function handleManualAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!manualSku.trim()) return;
    addBySku(manualSku);
    setManualSku('');
  }

  function updateQty(idx: number, delta: number) {
    const item = cart[idx];
    const newQty = item.quantity + delta;
    if (newQty <= 0) {
      setCart(cart.filter((_, i) => i !== idx));
      return;
    }
    if (newQty > item.stock_qty) {
      showToast('สต๊อกไม่พอ', `เหลือแค่ ${item.stock_qty}`, 'danger');
      return;
    }
    const newCart = [...cart];
    newCart[idx] = { ...item, quantity: newQty };
    setCart(newCart);
  }

  function removeItem(idx: number) {
    setCart(cart.filter((_, i) => i !== idx));
  }

  const subtotal = cart.reduce((sum, c) => sum + c.unit_price * c.quantity, 0);
  const discountValue = parseFloat(discount) || 0;
  const total = Math.max(0, subtotal - discountValue);

  async function confirmSell() {
    if (cart.length === 0) {
      showToast('ตะกร้าว่าง', '', 'danger');
      return;
    }

    if (discountValue < 0) {
      showToast('ส่วนลดผิด', 'ติดลบไม่ได้', 'danger');
      return;
    }
    if (discountValue > subtotal) {
      showToast('ส่วนลดเกิน', 'เกินยอดรวม', 'danger');
      return;
    }

    setSubmitting(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSubmitting(false); return; }

    // กระจายส่วนลดตามสัดส่วนของแต่ละชิ้น (เพื่อให้ subtotal รวมตรง)
    const receiptId = crypto.randomUUID();
    const totalQty = cart.reduce((s, c) => s + c.quantity, 0);
    
    const sales = cart.map(c => {
      const itemSubtotal = c.unit_price * c.quantity;
      const itemDiscount = subtotal > 0 ? (discountValue * itemSubtotal / subtotal) : 0;
      const finalSubtotal = itemSubtotal - itemDiscount;
      
      return {
        receipt_id: receiptId,
        goods_id: c.goods_id,
        sku: c.sku,
        name: c.name,
        category: c.category || null,
        unit_price: c.unit_price,
        quantity: c.quantity,
        subtotal: Number(finalSubtotal.toFixed(2)),
        sold_by: user.id,
        sold_by_name: profile?.full_name,
        sold_date: new Date().toISOString().split('T')[0],
        branch_id: profile.branch_id,
        shop_id: profile.shop_id,
      };
    });

    // 1. Insert sales
    const { error: salesError } = await supabase.from('goods_sales').insert(sales);
    if (salesError) {
      showToast('เกิดข้อผิดพลาด', salesError.message, 'danger');
      setSubmitting(false);
      return;
    }

    // 2. หักสต๊อก
    for (const c of cart) {
      await supabase
        .from('goods')
        .update({ stock_qty: c.stock_qty - c.quantity })
        .eq('id', c.goods_id);
    }

    setSubmitting(false);
    setShowConfirm(false);
    showToast('ขายสำเร็จ', `${cart.length} รายการ • ฿${total.toLocaleString()}`);
    setCart([]);
    setDiscount('');
  }

  return (
    <>
      <div className="page-header">
        <h2>ขายของ 📷</h2>
        <div className="desc">สแกน barcode หรือกรอก SKU เพื่อขาย</div>
      </div>

      <div className="form-card">
        <h3>1. สแกนสินค้า</h3>
        <button className="btn" onClick={() => setShowScanner(true)} style={{ marginBottom: 12 }}>
          📷 เปิดกล้องสแกน
        </button>
        
        <form onSubmit={handleManualAdd}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={manualSku}
              onChange={(e) => setManualSku(e.target.value)}
              placeholder="หรือกรอก SKU แล้วกด Enter"
              style={{ 
                flex: 1, 
                padding: 12, 
                background: 'var(--surface-2)', 
                border: '1px solid var(--border)', 
                color: 'var(--text)',
                fontFamily: 'JetBrains Mono, monospace',
              }}
            />
            <button type="submit" className="btn btn-sec" style={{ width: 'auto', padding: '0 20px' }}>
              เพิ่ม
            </button>
          </div>
        </form>
      </div>

      {cart.length > 0 && (
        <div className="form-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>2. ตะกร้า ({cart.length} รายการ)</h3>
            <button 
              onClick={() => setShowScanner(true)}
              style={{
                padding: '8px 14px',
                background: 'var(--success)',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 13,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              📷 สแกนต่อ
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {cart.map((c, idx) => (
              <div key={idx} style={{
                background: 'var(--surface-2)',
                padding: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                flexWrap: 'wrap',
              }}>
                <div style={{ flex: '1 1 200px', minWidth: 150 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'JetBrains Mono, monospace' }}>
                    {c.sku} • ฿{c.unit_price.toLocaleString()}/ชิ้น
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <button onClick={() => updateQty(idx, -1)} style={{
                    width: 32, height: 32,
                    background: 'var(--surface-3)', border: '1px solid var(--border)',
                    color: 'var(--text)', cursor: 'pointer', fontSize: 18,
                  }}>-</button>
                  <div style={{
                    minWidth: 40, textAlign: 'center', fontWeight: 600,
                    fontFamily: 'JetBrains Mono, monospace',
                  }}>{c.quantity}</div>
                  <button onClick={() => updateQty(idx, 1)} style={{
                    width: 32, height: 32,
                    background: 'var(--surface-3)', border: '1px solid var(--border)',
                    color: 'var(--text)', cursor: 'pointer', fontSize: 18,
                  }}>+</button>
                </div>
                <div style={{ fontWeight: 700, color: 'var(--accent)', minWidth: 80, textAlign: 'right' }}>
                  ฿{(c.unit_price * c.quantity).toLocaleString()}
                </div>
                <button onClick={() => removeItem(idx)} style={{
                  width: 32, height: 32,
                  background: 'transparent', border: '1px solid var(--danger)',
                  color: 'var(--danger)', cursor: 'pointer',
                }}>×</button>
              </div>
            ))}
          </div>

          <div className="field">
            <label>ส่วนลด (บาท)</label>
            <input type="number" inputMode="numeric" value={discount}
              onChange={(e) => setDiscount(e.target.value)}
              placeholder="0" />
          </div>

          <div style={{
            background: 'var(--surface-2)',
            padding: 16,
            marginTop: 16,
            borderLeft: '3px solid var(--accent)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-dim)' }}>
              <span>ยอดรวม:</span>
              <span>฿{subtotal.toLocaleString()}</span>
            </div>
            {discountValue > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#ff6b6b' }}>
                <span>ส่วนลด:</span>
                <span>-฿{discountValue.toLocaleString()}</span>
              </div>
            )}
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              fontSize: 22, fontWeight: 700, color: 'var(--accent)',
              marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)',
            }}>
              <span>รวมจ่าย:</span>
              <span>฿{total.toLocaleString()}</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button className="btn" onClick={() => setShowConfirm(true)} disabled={submitting} style={{ flex: 1 }}>
              ✓ ยืนยันการขาย
            </button>
            <button className="btn btn-sec" onClick={() => { setCart([]); setDiscount(''); }}
              style={{ width: 'auto', padding: '0 20px' }}>
              ล้างตะกร้า
            </button>
          </div>
        </div>
      )}

      {/* Scanner */}
      {showScanner && <BarcodeScanner onScan={handleScan} onClose={() => setShowScanner(false)} />}

      {/* Confirm */}
      {showConfirm && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowConfirm(false)}>
          <div className="modal">
            <h3>ยืนยันการขาย?</h3>
            <p className="modal-sub">{cart.length} รายการ • รวม ฿{total.toLocaleString()}</p>
            <div className="modal-actions">
              <button className="btn" onClick={confirmSell} disabled={submitting}>
                {submitting ? 'กำลังบันทึก...' : 'ยืนยัน ✓'}
              </button>
              <button className="btn btn-sec" onClick={() => setShowConfirm(false)}>
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast {...toast} />}
    </>
  );
}
