'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';
import Toast from '@/components/Toast';
import BarcodeScanner from '@/components/BarcodeScanner';

interface ModelSuggestion {
  model: string;
  color?: string;
  spec?: string;
  price: number;
  count: number;
}

function AddStockPageContent() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const imeiFromUrl = searchParams.get('imei');
  
  const [form, setForm] = useState({
    imei: imeiFromUrl || '',
    model: '',
    color: '',
    spec: '',
    price: '',
    costPrice: '',
    supplierId: '',
    addedDate: new Date().toISOString().split('T')[0],
    branchId: '',
    deviceCondition: 'new',
  });
  const [profile, setProfile] = useState<any>(null);
  const [branches, setBranches] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [suggestions, setSuggestions] = useState<ModelSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
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

      // โหลด suppliers
      const { data: ss } = await supabase.from('suppliers').select('id, name').order('name');
      setSuppliers(ss || []);

      setForm(f => ({ ...f, branchId: p?.branch_id || '' }));
    }
    load();
  }, []);

  async function loadSuggestions(searchModel: string) {
    if (searchModel.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    const [stockRes, salesRes] = await Promise.all([
      supabase.from('stock').select('model, color, spec, price').ilike('model', `%${searchModel}%`).limit(20),
      supabase.from('sales_history').select('model, color, spec, price').ilike('model', `%${searchModel}%`).limit(20),
    ]);

    const allItems = [...(stockRes.data || []), ...(salesRes.data || [])];
    const map = new Map<string, ModelSuggestion>();
    allItems.forEach((item) => {
      const key = `${item.model}|${item.color || ''}|${item.spec || ''}`;
      if (map.has(key)) map.get(key)!.count++;
      else map.set(key, { model: item.model, color: item.color, spec: item.spec, price: Number(item.price), count: 1 });
    });

    setSuggestions(Array.from(map.values()).sort((a, b) => b.count - a.count).slice(0, 5));
  }

  function applySuggestion(s: ModelSuggestion) {
    setForm({ ...form, model: s.model, color: s.color || '', spec: s.spec || '', price: s.price.toString() });
    setShowSuggestions(false);
    showToast('นำข้อมูลมาใช้', `${s.model}`);
  }

  async function handleScan(imei: string) {
    setShowScanner(false);
    
    // เช็คก่อนว่า IMEI นี้มีในสต๊อกแล้วหรือยัง
    const { data: existing } = await supabase
      .from('stock')
      .select('id, model, color, price, sold_at')
      .eq('imei', imei)
      .maybeSingle();
    
    if (existing) {
      // เจอแล้ว
      if (existing.sold_at) {
        showToast('IMEI ขายไปแล้ว', `${existing.model} - ดูในประวัติได้`, 'danger');
        return;
      }
      // ยังขายอยู่ → ถามว่าจะดูเครื่องเดิมไหม
      if (confirm(`IMEI นี้มีในสต๊อกแล้ว!\n\n${existing.model}${existing.color ? ` (${existing.color})` : ''}\nราคา: ฿${Number(existing.price).toLocaleString()}\n\nต้องการดูข้อมูลเครื่องเดิมไหม?`)) {
        window.location.href = '/dashboard/stock';
        return;
      }
      return;
    }
    
    // ยังไม่มีในระบบ → ใส่ IMEI ในฟอร์ม
    setForm({ ...form, imei });
    showToast('สแกนสำเร็จ', `IMEI: ${imei}`);
  }

  function reset() {
    setForm({
      imei: '', model: '', color: '', spec: '', price: '',
      costPrice: '', supplierId: '',
      addedDate: new Date().toISOString().split('T')[0],
      branchId: profile?.branch_id || '',
      deviceCondition: 'new',
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!form.imei || !form.model || !form.price || !form.branchId) {
      showToast('ข้อมูลไม่ครบ', 'กรอก IMEI, รุ่น, ราคา และสาขา', 'danger');
      return;
    }

    if (form.imei.length !== 15) {
      showToast('IMEI ไม่ถูกต้อง', 'IMEI ต้องมี 15 หลัก', 'danger');
      return;
    }

    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data: existingStock } = await supabase
      .from('stock').select('id').eq('imei', form.imei).maybeSingle();

    if (existingStock) {
      showToast('IMEI ซ้ำ', 'เลข IMEI นี้มีอยู่ในสต๊อกแล้ว', 'danger');
      setLoading(false);
      return;
    }

    const { data: profileWithShop } = await supabase
      .from('profiles').select('shop_id').eq('id', user.id).single();

    const costPrice = parseFloat(form.costPrice) || 0;

    const { error } = await supabase.from('stock').insert({
      imei: form.imei,
      model: form.model,
      color: form.color || null,
      spec: form.spec || null,
      price: parseFloat(form.price),
      cost_price: costPrice,
      supplier_id: form.supplierId || null,
      added_date: form.addedDate,
      added_by: user.id,
      added_by_name: profile.full_name,
      branch_id: form.branchId,
      device_condition: form.deviceCondition,
      shop_id: profileWithShop?.shop_id,
    });

    // ถ้ามี supplier + cost > 0 → บันทึก transaction (เพิ่มยอดค้างจ่าย)
    if (!error && form.supplierId && costPrice > 0) {
      await supabase.from('supplier_transactions').insert({
        supplier_id: form.supplierId,
        type: 'purchase',
        amount: costPrice,
        description: `รับ ${form.model} (${form.imei})`,
        reference_type: 'stock',
        transaction_date: form.addedDate,
        created_by: user.id,
        created_by_name: profile.full_name,
        branch_id: form.branchId,
        shop_id: profileWithShop?.shop_id,
      });

      // อัพเดท balance ของ supplier (-)
      const { data: sup } = await supabase
        .from('suppliers').select('balance').eq('id', form.supplierId).single();
      if (sup) {
        await supabase.from('suppliers').update({
          balance: Number(sup.balance || 0) - costPrice,
        }).eq('id', form.supplierId);
      }
    }

    setLoading(false);

    if (error) {
      showToast('เกิดข้อผิดพลาด', error.message, 'danger');
      return;
    }

    showToast('เพิ่มสำเร็จ', `${form.model} เข้าสต๊อกแล้ว`);
    reset();
    setTimeout(() => router.push('/dashboard/stock'), 1200);
  }

  const isAdmin = profile?.role === 'admin';

  return (
    <>
      <div className="page-header">
        <h1>เพิ่มเครื่อง</h1>
        <div className="desc">ลงทะเบียนเครื่องใหม่เข้าสต๊อก</div>
      </div>

      {/* Banner: มาจากหน้าขายแต่ไม่เจอ IMEI */}
      {imeiFromUrl && (
        <div style={{
          padding: 14,
          background: 'rgba(59, 130, 246, 0.08)',
          borderLeft: '3px solid var(--accent)',
          borderRadius: 6,
          marginBottom: 16,
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)', marginBottom: 4 }}>
            ✨ กำลังเพิ่มเครื่องใหม่จากการสแกน
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.5 }}>
            IMEI ที่สแกนได้: <strong style={{ color: 'var(--text)', fontFamily: 'JetBrains Mono, monospace' }}>{imeiFromUrl}</strong>
            <br/>กรอกข้อมูลเครื่อง → กดบันทึก
          </div>
        </div>
      )}

      <div className="form-card">
        <h3>📱 ข้อมูลเครื่อง</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="field full">
              <label>IMEI (15 หลัก) <span style={{ color: 'var(--danger)' }}>*</span></label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  inputMode="numeric"
                  value={form.imei}
                  onChange={(e) => setForm({ ...form, imei: e.target.value.replace(/\D/g, '').substring(0, 15) })}
                  placeholder="356789012345678"
                  style={{ flex: 1, fontFamily: 'JetBrains Mono, monospace' }}
                  maxLength={15}
                  required
                />
                <button type="button" className="btn btn-sec"
                  onClick={() => setShowScanner(true)}
                  style={{ width: 'auto', padding: '0 16px' }}>
                  📷 สแกน
                </button>
              </div>
              {form.imei.length > 0 && form.imei.length < 15 && (
                <div style={{ fontSize: 11, color: 'var(--warning)', marginTop: 4 }}>
                  อีก {15 - form.imei.length} หลัก
                </div>
              )}
            </div>

            <div className="field full" style={{ position: 'relative' }}>
              <label>รุ่น <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input
                type="text"
                value={form.model}
                onChange={(e) => {
                  setForm({ ...form, model: e.target.value });
                  loadSuggestions(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => form.model.length >= 2 && setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                placeholder="iPhone 15 Pro Max"
                required
              />
              {showSuggestions && suggestions.length > 0 && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  marginTop: 4,
                  zIndex: 10,
                  maxHeight: 200,
                  overflowY: 'auto',
                  boxShadow: 'var(--shadow-md)',
                }}>
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => applySuggestion(s)}
                      style={{
                        display: 'block',
                        width: '100%',
                        padding: '10px 12px',
                        background: 'transparent',
                        border: 'none',
                        borderBottom: '1px solid var(--border)',
                        textAlign: 'left',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        color: 'var(--text)',
                        fontSize: 13,
                      }}
                    >
                      <div style={{ fontWeight: 600 }}>{s.model}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
                        {s.color && `${s.color} • `}
                        {s.spec && `${s.spec} • `}
                        ฿{s.price.toLocaleString()} • {s.count} ครั้ง
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="field">
              <label>สี</label>
              <input type="text" value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
                placeholder="Natural Titanium" />
            </div>

            <div className="field">
              <label>สเปค</label>
              <input type="text" value={form.spec}
                onChange={(e) => setForm({ ...form, spec: e.target.value })}
                placeholder="256GB / 8GB" />
            </div>

            <div className="field">
              <label>ราคาขาย <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input type="number" inputMode="numeric" value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                placeholder="42500" required />
            </div>

            <div className="field">
              <label>ราคาทุน 
                <span style={{ fontSize: 11, color: 'var(--text-dim)', marginLeft: 6, fontWeight: 400 }}>
                  (ใส่หรือไม่ใส่ก็ได้)
                </span>
              </label>
              <input type="number" inputMode="numeric" value={form.costPrice}
                onChange={(e) => setForm({ ...form, costPrice: e.target.value })}
                placeholder="35000" />
              {form.price && form.costPrice && (
                <div style={{ 
                  fontSize: 11, 
                  color: 'var(--success)', 
                  marginTop: 4,
                  fontWeight: 600,
                }}>
                  💰 กำไรคาดการณ์: ฿{(parseFloat(form.price) - parseFloat(form.costPrice)).toLocaleString()}
                </div>
              )}
            </div>

            <div className="field">
              <label>วันที่รับเข้า</label>
              <input type="date" value={form.addedDate}
                onChange={(e) => setForm({ ...form, addedDate: e.target.value })} />
            </div>

            <div className="field">
              <label>Supplier (ผู้ส่งของ)
                <span style={{ fontSize: 11, color: 'var(--text-dim)', marginLeft: 6, fontWeight: 400 }}>
                  (ไม่บังคับ)
                </span>
              </label>
              <select value={form.supplierId}
                onChange={(e) => setForm({ ...form, supplierId: e.target.value })}>
                <option value="">-- ไม่ระบุ --</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              {suppliers.length === 0 && (
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
                  💡 ยังไม่มี supplier - ไปเพิ่มที่หน้าจัดการ Supplier
                </div>
              )}
            </div>

            <div className="field full">
              <label>สภาพเครื่อง</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, deviceCondition: 'new' })}
                  style={{
                    flex: 1,
                    padding: '10px',
                    background: form.deviceCondition === 'new' ? 'var(--accent)' : 'var(--surface-2)',
                    color: form.deviceCondition === 'new' ? 'white' : 'var(--text)',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                >
                  ✨ มือ 1
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, deviceCondition: 'used' })}
                  style={{
                    flex: 1,
                    padding: '10px',
                    background: form.deviceCondition === 'used' ? 'var(--accent)' : 'var(--surface-2)',
                    color: form.deviceCondition === 'used' ? 'white' : 'var(--text)',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                >
                  📱 มือ 2
                </button>
              </div>
            </div>

            <div className="field full">
              <label>สาขา <span style={{ color: 'var(--danger)' }}>*</span></label>
              {isAdmin ? (
                <select value={form.branchId}
                  onChange={(e) => setForm({ ...form, branchId: e.target.value })} required>
                  <option value="">-- เลือกสาขา --</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} {b.id === profile?.branch_id ? '(สาขาของคุณ)' : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <input type="text" value={profile?.branches?.name || '-'} disabled />
              )}
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" className="btn" disabled={loading}>
              {loading ? 'กำลังเพิ่ม...' : '➕ เพิ่มเข้าสต๊อก'}
            </button>
            <button type="button" className="btn btn-sec" onClick={reset} disabled={loading}>
              ล้างฟอร์ม
            </button>
          </div>
        </form>
      </div>

      {showScanner && <BarcodeScanner onScan={handleScan} onClose={() => setShowScanner(false)} mode="imei" />}
      {toast && <Toast {...toast} />}
    </>
  );
}

export default function AddStockPage() {
  return (
    <Suspense fallback={<div className="loading"><div className="spinner"></div></div>}>
      <AddStockPageContent />
    </Suspense>
  );
}
