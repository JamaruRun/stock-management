'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-client';
import Toast from '@/components/Toast';
import { PART_CATEGORIES, PART_GRADES, COMMON_PHONE_MODELS } from '@/lib/parts-constants';

export default function AddPartPage() {
  const supabase = createClient();
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ title: string; msg: string; type: string } | null>(null);

  const [form, setForm] = useState({
    name: '',
    category: 'battery',
    phone_model: '',
    grade: 'oem',
    cost_price: '',
    sell_price: '',
    stock_qty: '1',
    low_stock_alert: '2',
    supplier_id: '',
    sku: '',
    note: '',
  });

  function showToast(title: string, msg: string, type: 'success' | 'danger' = 'success') {
    setToast({ title, msg, type });
    setTimeout(() => setToast(null), 2500);
  }

  // 🆕 เฉพาะ admin เห็นช่องต้นทุน
  const isAdmin = profile?.role === 'admin';

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: p } = await supabase
        .from('profiles').select('*').eq('id', user.id).single();
      setProfile(p);

      const { data: sup } = await supabase
        .from('suppliers').select('id, name').order('name');
      setSuppliers(sup || []);
    }
    load();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    
    if (!form.name.trim()) {
      showToast('กรอกชื่ออะไหล่', '', 'danger');
      return;
    }
    if (!form.phone_model.trim()) {
      showToast('กรอกรุ่นมือถือ', '', 'danger');
      return;
    }

    setSaving(true);

    const stockQty = parseInt(form.stock_qty) || 0;
    const costPrice = parseFloat(form.cost_price) || 0;

    const { data: newPart, error } = await supabase
      .from('parts')
      .insert({
        shop_id: profile.shop_id,
        branch_id: profile.branch_id,
        name: form.name.trim(),
        category: form.category,
        phone_model: form.phone_model.trim(),
        grade: form.grade || null,
        cost_price: costPrice,
        sell_price: parseFloat(form.sell_price) || 0,
        stock_qty: stockQty,
        low_stock_alert: parseInt(form.low_stock_alert) || 2,
        supplier_id: form.supplier_id || null,
        sku: form.sku.trim() || null,
        note: form.note.trim() || null,
        added_by: profile.id,
        added_by_name: profile.full_name,
      })
      .select()
      .single();

    if (error || !newPart) {
      showToast('บันทึกไม่สำเร็จ', error?.message || '', 'danger');
      setSaving(false);
      return;
    }

    // บันทึก transaction "in" สำหรับ stock เริ่มต้น
    if (stockQty > 0) {
      await supabase.from('part_transactions').insert({
        shop_id: profile.shop_id,
        part_id: newPart.id,
        type: 'in',
        qty_change: stockQty,
        cost_at_transaction: costPrice,
        reference_type: 'purchase',
        note: 'รับเข้าครั้งแรก',
        done_by: profile.id,
        done_by_name: profile.full_name,
      });
    }

    showToast('เพิ่มอะไหล่สำเร็จ', form.name);
    setTimeout(() => router.push('/dashboard/parts'), 800);
  }

  return (
    <>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div>
          <h1>➕ เพิ่มอะไหล่</h1>
          <div className="desc">เพิ่มอะไหล่ใหม่เข้าสต๊อก</div>
        </div>
        <Link href="/dashboard/parts" style={{
          padding: '8px 14px',
          background: 'var(--surface-2)',
          color: 'var(--text)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          fontSize: 12,
          textDecoration: 'none',
        }}>← กลับ</Link>
      </div>

      <form onSubmit={handleSubmit} className="form-card">
        <h3>📦 ข้อมูลอะไหล่</h3>
        
        <div className="form-grid">
          {/* Category */}
          <div className="field full">
            <label>ประเภทอะไหล่ <span style={{ color: 'var(--danger)' }}>*</span></label>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', 
              gap: 6,
            }}>
              {PART_CATEGORIES.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setForm({ ...form, category: c.id })}
                  style={{
                    padding: '10px 6px',
                    background: form.category === c.id ? 'var(--accent)' : 'var(--surface-2)',
                    color: form.category === c.id ? '#fff' : 'var(--text)',
                    border: 'none',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontSize: 12,
                    fontWeight: form.category === c.id ? 600 : 500,
                  }}
                >{c.label}</button>
              ))}
            </div>
          </div>

          {/* Phone model */}
          <div className="field full">
            <label>รุ่นมือถือ <span style={{ color: 'var(--danger)' }}>*</span></label>
            <input
              type="text"
              value={form.phone_model}
              onChange={(e) => setForm({ ...form, phone_model: e.target.value })}
              placeholder="เช่น iPhone 11, Samsung A12"
              list="phone-models"
              required
            />
            <datalist id="phone-models">
              {COMMON_PHONE_MODELS.map(m => <option key={m} value={m} />)}
            </datalist>
          </div>

          {/* Name */}
          <div className="field full">
            <label>ชื่ออะไหล่ <span style={{ color: 'var(--danger)' }}>*</span></label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="เช่น แบต iPhone 11 OEM, จอ Samsung A12 OLED"
              required
            />
          </div>

          {/* Grade */}
          <div className="field full">
            <label>เกรด</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {PART_GRADES.map(g => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setForm({ ...form, grade: form.grade === g.id ? '' : g.id })}
                  style={{
                    padding: '8px 14px',
                    background: form.grade === g.id ? g.color : 'var(--surface-2)',
                    color: form.grade === g.id ? '#fff' : 'var(--text)',
                    border: 'none',
                    borderRadius: 100,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >{g.label}</button>
              ))}
            </div>
          </div>

          {/* Prices - ต้นทุนเฉพาะ admin */}
          {isAdmin && (
            <div className="field">
              <label>ต้นทุน/ชิ้น <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>(เฉพาะเจ้าของเห็น)</span></label>
              <input
                type="number"
                value={form.cost_price}
                onChange={(e) => setForm({ ...form, cost_price: e.target.value })}
                inputMode="decimal"
                placeholder="0"
                step="0.01"
              />
            </div>
          )}

          <div className="field">
            <label>ราคาขาย/ราคาเปลี่ยน</label>
            <input
              type="number"
              value={form.sell_price}
              onChange={(e) => setForm({ ...form, sell_price: e.target.value })}
              inputMode="decimal"
              placeholder="0"
              step="0.01"
            />
          </div>

          {/* Stock */}
          <div className="field">
            <label>จำนวนเริ่มต้น</label>
            <input
              type="number"
              value={form.stock_qty}
              onChange={(e) => setForm({ ...form, stock_qty: e.target.value })}
              inputMode="numeric"
              placeholder="1"
              min="0"
            />
          </div>

          <div className="field">
            <label>จุดแจ้งเตือนขั้นต่ำ</label>
            <input
              type="number"
              value={form.low_stock_alert}
              onChange={(e) => setForm({ ...form, low_stock_alert: e.target.value })}
              inputMode="numeric"
              placeholder="2"
              min="0"
            />
          </div>

          {/* Supplier */}
          <div className="field full">
            <label>Supplier</label>
            <select
              value={form.supplier_id}
              onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}
            >
              <option value="">- ไม่ระบุ -</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* SKU + Note */}
          <div className="field">
            <label>SKU (optional)</label>
            <input
              type="text"
              value={form.sku}
              onChange={(e) => setForm({ ...form, sku: e.target.value })}
              placeholder="P-001"
              style={{ fontFamily: 'JetBrains Mono, monospace' }}
            />
          </div>

          <div className="field">
            <label>หมายเหตุ</label>
            <input
              type="text"
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              placeholder="เช่น มีประกัน 3 เดือน"
            />
          </div>
        </div>

        {/* Preview */}
        {form.name && form.phone_model && (
          <div style={{
            padding: 12,
            background: 'var(--surface-2)',
            borderRadius: 6,
            marginTop: 14,
            fontSize: 12,
          }}>
            <div style={{ color: 'var(--text-dim)', fontSize: 10, marginBottom: 4, fontWeight: 600 }}>
              👁️ ตัวอย่าง
            </div>
            <div style={{ fontWeight: 700 }}>{form.name}</div>
            <div style={{ color: 'var(--text-dim)', marginTop: 2 }}>📱 {form.phone_model}</div>
            {isAdmin && parseFloat(form.cost_price) > 0 && parseFloat(form.sell_price) > 0 && (
              <div style={{ marginTop: 4, color: '#10b981' }}>
                💰 กำไร: ฿{((parseFloat(form.sell_price) - parseFloat(form.cost_price))).toLocaleString()}/ชิ้น
              </div>
            )}
          </div>
        )}

        <div className="form-actions" style={{ marginTop: 16 }}>
          <button type="submit" className="btn" disabled={saving}>
            {saving ? 'กำลังบันทึก...' : '💾 บันทึก'}
          </button>
        </div>
      </form>

      {toast && <Toast {...toast} />}
    </>
  );
}
