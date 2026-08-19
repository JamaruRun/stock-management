'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-client';
import Toast from '@/components/Toast';
import { PART_CATEGORIES, PART_GRADES, getCategoryPlainLabel } from '@/lib/parts-constants';
import { saveCompatibilityRows, type CompatRow } from '@/lib/part-compatibility';
import { sendLinePush } from '@/lib/line-notify';
import { syncLedgerEntry } from '@/lib/ledger-sync';
import PartModelCompatibilityEditor from '@/components/PartModelCompatibilityEditor';

export default function AddPartPage() {
  const supabase = createClient();
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ title: string; msg: string; type: string } | null>(null);
  const [compatRows, setCompatRows] = useState<CompatRow[]>([]);
  const [autoName, setAutoName] = useState('');

  const [form, setForm] = useState({
    name: '',
    category: 'battery',
    grade: 'oem',
    cost_price: '',
    wholesale_price: '',
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

  useEffect(() => {
    const modelsPart = compatRows.length > 0 ? ' - ' + compatRows.map(r => r.model_name).join(' / ') : '';
    const newAuto = `${getCategoryPlainLabel(form.category)}${modelsPart}`;
    setForm(prev => (prev.name === '' || prev.name === autoName) ? { ...prev, name: newAuto } : prev);
    setAutoName(newAuto);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.category, compatRows]);

  // จำราคาทุน/ส่ง/หน้าร้านที่เคยกรอกไว้ (เฉพาะร้านตัวเอง) มาเติมให้อัตโนมัติเมื่อยังไม่ได้กรอกราคาเอง
  useEffect(() => {
    if (!profile || form.cost_price !== '' || form.wholesale_price !== '' || form.sell_price !== '') return;
    let cancelled = false;
    async function recallPrice() {
      let matched: any = null;
      const modelName = compatRows[0]?.model_name;
      if (modelName) {
        const { data: dm } = await supabase.from('device_models').select('id').ilike('model_name', modelName).limit(1);
        if (dm && dm[0]) {
          const { data: compat } = await supabase.from('part_compatibility').select('part_id').eq('device_model_id', dm[0].id);
          const partIds = (compat || []).map((c: any) => c.part_id);
          if (partIds.length > 0) {
            const { data: rows } = await supabase.from('parts').select('cost_price, wholesale_price, sell_price')
              .in('id', partIds).eq('category', form.category).eq('shop_id', profile.shop_id)
              .order('created_at', { ascending: false }).limit(1);
            if (rows && rows[0]) matched = rows[0];
          }
        }
      }
      if (!matched) {
        const { data: rows } = await supabase.from('parts').select('cost_price, wholesale_price, sell_price')
          .eq('category', form.category).eq('shop_id', profile.shop_id)
          .order('created_at', { ascending: false }).limit(1);
        if (rows && rows[0]) matched = rows[0];
      }
      if (cancelled || !matched) return;
      const cost = String(matched.cost_price ?? '');
      const wholesale = String(matched.wholesale_price ?? '');
      const sell = String(matched.sell_price ?? '');
      setForm(prev => (prev.cost_price === '' && prev.wholesale_price === '' && prev.sell_price === '')
        ? { ...prev, cost_price: cost, wholesale_price: wholesale, sell_price: sell } : prev);
      setCompatRows(prevRows => prevRows.map(r => (r.cost_price === '' && r.sell_price === '') ? { ...r, cost_price: cost, sell_price: sell } : r));
    }
    recallPrice();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.category, compatRows.length, compatRows[0]?.model_name, profile]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    
    if (!form.name.trim()) {
      showToast('กรอกชื่ออะไหล่', '', 'danger');
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
        phone_model: compatRows[0]?.model_name || '',
        grade: form.grade || null,
        cost_price: costPrice,
        wholesale_price: parseFloat(form.wholesale_price) || 0,
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

    let compatErrors: string[] = [];
    if (compatRows.length > 0) {
      const { resolved, errors } = await saveCompatibilityRows(supabase, newPart.id, compatRows);
      compatErrors = errors;
      const first = resolved[0];
      if (first) {
        await supabase.from('parts').update({
          phone_model: first.model_name,
          cost_price: parseFloat(first.cost_price) || 0,
          sell_price: parseFloat(first.sell_price) || 0,
        }).eq('id', newPart.id);
      }
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
      const codeTxt = form.sku.trim() || newPart.id.slice(0, 8);
      const modelsTxt = compatRows.length > 0 ? compatRows.map(r => r.model_name).join(' / ') : 'ทั่วไป';
      const msg = `📦 รับอะไหล่เข้าสต็อค\n━━━━━━━━━━━━━\n🔧 ${form.name.trim()}\n🔖 ${codeTxt}\n📱 ${modelsTxt}\n➕ รับเข้า: ${stockQty} ชิ้น\n💰 ต้นทุน/ชิ้น: ฿${costPrice.toLocaleString()}\n📊 คงเหลือ: ${stockQty} ชิ้น\n👤 บันทึกโดย: ${profile.full_name}`;
      sendLinePush(msg, 'restock').catch(() => {});
      syncLedgerEntry(supabase, {
        shopId: profile.shop_id, branchId: profile.branch_id, sourceEvent: 'parts_stock_in',
        amount: costPrice * stockQty, description: `รับอะไหล่ ${form.name.trim()} เข้าสต็อค ${stockQty} ชิ้น`,
        userId: profile.id, userName: profile.full_name,
      });
    }

    if (compatErrors.length > 0) showToast('เพิ่มอะไหล่สำเร็จ', 'แต่ ' + compatErrors.join('; '), 'danger');
    else showToast('เพิ่มอะไหล่สำเร็จ', form.name);
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

          {/* Name */}
          <div className="field full">
            <label>ชื่ออะไหล่ <span style={{ color: 'var(--danger)' }}>*</span></label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="เติมอัตโนมัติจากประเภท+รุ่น (แก้ไขเพิ่มเติมได้)"
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

          {/* Prices */}
          <div className="field full" style={{ marginBottom: -6 }}>
            <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>ระบบจำราคาที่เคยกรอกของร้านนี้ให้อัตโนมัติตามประเภท/รุ่น — แก้ไขได้ตามจริง</div>
          </div>
          <div className="field">
            <label>ราคาทุน/ชิ้น</label>
            <input
              type="number"
              value={form.cost_price}
              onChange={(e) => setForm({ ...form, cost_price: e.target.value })}
              inputMode="decimal"
              placeholder="0"
              step="0.01"
            />
          </div>

          <div className="field">
            <label>ราคาส่ง/ชิ้น</label>
            <input
              type="number"
              value={form.wholesale_price}
              onChange={(e) => setForm({ ...form, wholesale_price: e.target.value })}
              inputMode="decimal"
              placeholder="0"
              step="0.01"
            />
          </div>

          <div className="field">
            <label>ราคาหน้าร้าน/ชิ้น</label>
            <input
              type="number"
              value={form.sell_price}
              onChange={(e) => setForm({ ...form, sell_price: e.target.value })}
              inputMode="decimal"
              placeholder="0"
              step="0.01"
            />
          </div>

          {/* Model compatibility */}
          <div className="field full">
            <label>รุ่นมือถือที่ใช้ได้ (เลือกได้หลายรุ่น)</label>
            <PartModelCompatibilityEditor
              rows={compatRows}
              onChange={setCompatRows}
              defaultCostPrice={form.cost_price}
              defaultSellPrice={form.sell_price}
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
        {form.name && (
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
            <div style={{ color: 'var(--text-dim)', marginTop: 2 }}>
              📱 {compatRows.length > 0 ? compatRows.map(r => r.model_name).join(' / ') : 'ยังไม่ได้เลือกรุ่น'}
            </div>
            {parseFloat(form.cost_price) > 0 && parseFloat(form.sell_price) > 0 && (
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
