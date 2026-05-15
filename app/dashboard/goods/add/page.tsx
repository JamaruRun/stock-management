'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';
import Toast from '@/components/Toast';
import BarcodeScanner from '@/components/BarcodeScanner';

// สุ่ม SKU
function generateSku() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'ITM-';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export default function AddGoodsPage() {
  const supabase = createClient();
  const router = useRouter();
  const [form, setForm] = useState({
    sku: generateSku(),
    name: '',
    category: '',
    cost_price: '',
    sell_price: '',
    stock_qty: '',
    low_stock_alert: '5',
    note: '',
    branchId: '',
  });
  const [profile, setProfile] = useState<any>(null);
  const [branches, setBranches] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [restocking, setRestocking] = useState<any>(null);
  const [restockQty, setRestockQty] = useState('');
  const [toast, setToast] = useState<{ title: string; msg: string; type: string } | null>(null);

  function showToast(title: string, msg: string, type: 'success' | 'danger' = 'success') {
    setToast({ title, msg, type });
    setTimeout(() => setToast(null), 2500);
  }

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: p } = await supabase
        .from('profiles').select('*, branches(name)').eq('id', user.id).single();
      setProfile(p);

      if (p?.role === 'admin') {
        const { data: bs } = await supabase.from('branches').select('*').order('name');
        setBranches(bs || []);
      }

      const { data: goodsData } = await supabase.from('goods').select('category');
      const cats = Array.from(new Set((goodsData || []).map(g => g.category).filter(Boolean)));
      setCategories(cats as string[]);

      setForm(f => ({ ...f, branchId: p?.branch_id || '' }));
    }
    load();
  }, []);

  // เมื่อสแกนเสร็จ
  async function handleScan(code: string) {
    setShowScanner(false);
    const cleaned = code.trim().toUpperCase();

    // ค้นหาในฐานข้อมูล (case-insensitive)
    const { data: existing } = await supabase
      .from('goods')
      .select('*')
      .ilike('sku', cleaned)
      .maybeSingle();

    if (existing) {
      // เจอ! → เปิด modal เติมของ
      setRestocking(existing);
      setRestockQty('');
      showToast('เจอสินค้าเดิม', `${existing.name} • คงเหลือ ${existing.stock_qty}`);
    } else {
      // ไม่เจอ → ใช้ SKU นี้สำหรับสินค้าใหม่
      setForm(f => ({ ...f, sku: cleaned }));
      showToast('รหัสใหม่', 'ใช้ SKU นี้สำหรับสินค้าใหม่');
    }
  }

  async function handleRestock() {
    if (!restocking) return;
    const addQty = parseInt(restockQty) || 0;
    if (addQty <= 0) {
      showToast('จำนวนผิด', 'กรอกจำนวนที่จะเพิ่ม', 'danger');
      return;
    }

    setLoading(true);
    const newQty = (restocking.stock_qty || 0) + addQty;
    const { error } = await supabase
      .from('goods')
      .update({ stock_qty: newQty })
      .eq('id', restocking.id);

    setLoading(false);

    if (error) {
      showToast('ไม่สำเร็จ', error.message, 'danger');
      return;
    }

    showToast('เติมสต๊อกแล้ว', `${restocking.name} • ${restocking.stock_qty} → ${newQty}`);
    setRestocking(null);
    setRestockQty('');
  }

  function reset() {
    setForm({
      sku: generateSku(),
      name: '', category: '', cost_price: '',
      sell_price: '', stock_qty: '', low_stock_alert: '5', note: '',
      branchId: profile?.branch_id || '',
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!form.name || !form.sell_price || !form.branchId) {
      showToast('ข้อมูลไม่ครบ', 'กรอก ชื่อ, ราคาขาย, สาขา', 'danger');
      return;
    }

    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data: existing } = await supabase
      .from('goods').select('id, name').eq('sku', form.sku).maybeSingle();
    if (existing) {
      showToast('SKU ซ้ำ', `รหัสนี้มีของ "${existing.name}" แล้ว - ลองสแกนเพื่อเติมสต๊อกแทน`, 'danger');
      setLoading(false);
      return;
    }

    const { error } = await supabase.from('goods').insert({
      sku: form.sku,
      name: form.name,
      category: form.category || null,
      cost_price: parseFloat(form.cost_price) || 0,
      sell_price: parseFloat(form.sell_price),
      stock_qty: parseInt(form.stock_qty) || 0,
      low_stock_alert: parseInt(form.low_stock_alert) || 5,
      note: form.note || null,
      added_by: user.id,
      added_by_name: profile.full_name,
      branch_id: form.branchId,
      shop_id: profile.shop_id,
    });

    setLoading(false);

    if (error) {
      showToast('เกิดข้อผิดพลาด', error.message, 'danger');
      return;
    }

    showToast('เพิ่มสำเร็จ', `${form.name} เข้าสต๊อกแล้ว`);
    reset();
    setTimeout(() => router.push('/dashboard/goods/stock'), 1000);
  }

  const isAdmin = profile?.role === 'admin';

  return (
    <>
      <div className="page-header">
        <h2>เพิ่มสินค้า</h2>
        <div className="desc">เพิ่มของใหม่ หรือสแกน barcode เพื่อเติมของเดิม</div>
      </div>

      {/* Quick Action: Scan to Restock */}
      <div className="form-card" style={{ background: 'var(--surface-2)', borderLeft: '3px solid var(--accent)' }}>
        <h3>🔄 เติมสต๊อกของเดิม</h3>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 12 }}>
          สแกน barcode บนของเดิม → ระบบจะเปิดให้กรอกจำนวนเพิ่มทันที
        </p>
        <button type="button" className="btn" onClick={() => setShowScanner(true)} style={{ width: '100%' }}>
          📷 สแกน Barcode เพื่อเติมสต๊อก
        </button>
      </div>

      <div className="form-card">
        <h3>➕ เพิ่มสินค้าใหม่</h3>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 16 }}>
          กรอกรายละเอียดสินค้าที่ยังไม่เคยมีในระบบ
        </p>
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="field full">
              <label>SKU (รหัสสำหรับ Barcode)</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input type="text" value={form.sku}
                  onChange={(e) => setForm({ ...form, sku: e.target.value.toUpperCase() })}
                  style={{ flex: 1, fontFamily: 'JetBrains Mono, monospace' }} />
                <button type="button" className="btn btn-sec"
                  onClick={() => setForm({ ...form, sku: generateSku() })}
                  style={{ width: 'auto', padding: '0 16px' }}>
                  🎲 สุ่ม
                </button>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
                💡 จะใช้รหัสนี้สร้าง barcode สำหรับปริ้นติดสินค้า
              </div>
            </div>

            <div className="field full">
              <label>ชื่อสินค้า <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input type="text" value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="เคส iPhone 15 Pro Max" required />
            </div>

            <div className="field full">
              <label>หมวดหมู่</label>
              <input type="text" value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="เคส / หูฟัง / ฟิล์ม / ชาร์จเจอร์"
                list="categories" />
              <datalist id="categories">
                {categories.map(c => <option key={c} value={c} />)}
              </datalist>
            </div>

            {isAdmin && (
              <div className="field">
                <label>ราคาทุน (บาท) <span style={{ color: 'var(--text-dim)', fontSize: 10 }}>🔒 Admin</span></label>
                <input type="number" inputMode="numeric" value={form.cost_price}
                  onChange={(e) => setForm({ ...form, cost_price: e.target.value })}
                  placeholder="0" />
              </div>
            )}
            <div className={`field ${isAdmin ? '' : 'full'}`}>
              <label>ราคาขาย (บาท) <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input type="number" inputMode="numeric" value={form.sell_price}
                onChange={(e) => setForm({ ...form, sell_price: e.target.value })}
                placeholder="199" required />
            </div>

            <div className="field">
              <label>จำนวนเริ่มต้น</label>
              <input type="number" inputMode="numeric" value={form.stock_qty}
                onChange={(e) => setForm({ ...form, stock_qty: e.target.value })}
                placeholder="50" />
            </div>
            <div className="field">
              <label>แจ้งเตือนเมื่อต่ำกว่า</label>
              <input type="number" inputMode="numeric" value={form.low_stock_alert}
                onChange={(e) => setForm({ ...form, low_stock_alert: e.target.value })}
                placeholder="5" />
            </div>

            <div className="field full">
              <label>หมายเหตุ</label>
              <input type="text" value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                placeholder="ที่เก็บ, ผู้ขายส่ง" />
            </div>

            <div className="field full">
              <label>สาขา <span style={{ color: 'var(--danger)' }}>*</span></label>
              {isAdmin ? (
                <select value={form.branchId}
                  onChange={(e) => setForm({ ...form, branchId: e.target.value })} required>
                  <option value="">-- เลือก --</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} {b.id === profile?.branch_id ? '(สาขาของคุณ)' : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <input type="text" value={profile?.branches?.name || '-'} disabled style={{ opacity: 0.7 }} />
              )}
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" className="btn" disabled={loading}>
              {loading ? 'กำลังเพิ่ม...' : '+ เพิ่มเข้าสต๊อก'}
            </button>
            <button type="button" className="btn btn-sec" onClick={reset} disabled={loading}>
              ล้างฟอร์ม
            </button>
          </div>
        </form>
      </div>

      {/* Restock Modal */}
      {restocking && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setRestocking(null)}>
          <div className="modal">
            <h3>🔄 เติมสต๊อกของเดิม</h3>
            <p className="modal-sub">{restocking.name}</p>

            <div style={{
              background: 'var(--surface-2)',
              padding: 14,
              marginBottom: 16,
              fontSize: 13,
              borderLeft: '3px solid var(--accent)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ color: 'var(--text-dim)' }}>SKU:</span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{restocking.sku}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ color: 'var(--text-dim)' }}>หมวด:</span>
                <span>{restocking.category || '-'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ color: 'var(--text-dim)' }}>ราคาขาย:</span>
                <span style={{ color: 'var(--accent)', fontWeight: 600 }}>
                  ฿{Number(restocking.sell_price).toLocaleString()}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-dim)' }}>คงเหลือปัจจุบัน:</span>
                <span style={{ fontWeight: 600 }}>
                  📦 {restocking.stock_qty}
                  {restocking.stock_qty <= (restocking.low_stock_alert || 5) && (
                    <span style={{ color: '#ffa502', marginLeft: 4 }}>(ใกล้หมด)</span>
                  )}
                </span>
              </div>
            </div>

            <div className="field full">
              <label>เพิ่มจำนวน (ชิ้น) <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input
                type="number"
                inputMode="numeric"
                value={restockQty}
                onChange={(e) => setRestockQty(e.target.value)}
                placeholder="เช่น 50"
                autoFocus
                style={{ fontSize: 20, fontWeight: 600, textAlign: 'center' }}
              />
            </div>

            {restockQty && parseInt(restockQty) > 0 && (
              <div style={{
                marginTop: 12,
                padding: 12,
                background: 'rgba(46, 213, 115, 0.1)',
                borderLeft: '3px solid var(--success)',
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--success)',
              }}>
                หลังเติม: 📦 {(restocking.stock_qty || 0) + parseInt(restockQty)} ชิ้น
              </div>
            )}

            <div className="modal-actions" style={{ marginTop: 20 }}>
              <button className="btn" onClick={handleRestock} disabled={loading}>
                {loading ? 'กำลังเติม...' : '✓ เติมสต๊อก'}
              </button>
              <button className="btn btn-sec" onClick={() => setRestocking(null)}>
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}

      {showScanner && <BarcodeScanner onScan={handleScan} onClose={() => setShowScanner(false)} />}
      {toast && <Toast {...toast} />}
    </>
  );
}
