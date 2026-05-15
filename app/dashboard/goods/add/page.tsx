'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';
import Toast from '@/components/Toast';

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

      // ดึงหมวดที่เคยใช้
      const { data: goodsData } = await supabase.from('goods').select('category');
      const cats = Array.from(new Set((goodsData || []).map(g => g.category).filter(Boolean)));
      setCategories(cats as string[]);

      setForm(f => ({ ...f, branchId: p?.branch_id || '' }));
    }
    load();
  }, []);

  const isAdmin = profile?.role === 'admin';

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

    // เช็ค SKU ซ้ำ
    const { data: existing } = await supabase
      .from('goods').select('id').eq('sku', form.sku).maybeSingle();
    if (existing) {
      // สุ่ม SKU ใหม่
      setForm(f => ({ ...f, sku: generateSku() }));
      showToast('SKU ซ้ำ', 'สุ่ม SKU ใหม่ให้แล้ว ลองอีกครั้ง', 'danger');
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

  return (
    <>
      <div className="page-header">
        <h2>เพิ่มสินค้า</h2>
        <div className="desc">เพิ่มสินค้าใหม่เข้าสต๊อกของ</div>
      </div>

      <div className="form-card">
        <h3>รายละเอียดสินค้า</h3>
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
                  🎲 สุ่มใหม่
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

      {toast && <Toast {...toast} />}
    </>
  );
}
