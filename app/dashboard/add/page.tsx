'use client';

import { useState, useEffect } from 'react';
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

export default function AddStockPage() {
  const supabase = createClient();
  const [form, setForm] = useState({
    imei: '',
    model: '',
    color: '',
    spec: '',
    price: '',
    addedDate: new Date().toISOString().split('T')[0],
    branchId: '',
    deviceCondition: 'new', // มือ 1 (new) / มือ 2 (used)
  });
  const [profile, setProfile] = useState<any>(null);
  const [branches, setBranches] = useState<any[]>([]);
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
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: p } = await supabase
        .from('profiles').select('*, branches(name)').eq('id', user.id).single();
      setProfile(p);

      // ถ้าเป็น admin ดึงสาขาทั้งหมด
      if (p?.role === 'admin') {
        const { data: bs } = await supabase.from('branches').select('*').order('name');
        setBranches(bs || []);
      }

      // default branch = สาขาตัวเอง
      setForm(f => ({ ...f, branchId: p?.branch_id || '' }));
    }
    loadProfile();
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
    showToast('นำข้อมูลมาใช้', `${s.model}${s.color ? ' - ' + s.color : ''}`);
  }

  function handleScan(imei: string) {
    setForm({ ...form, imei });
    setShowScanner(false);
    showToast('สแกนสำเร็จ', `IMEI: ${imei}`);
  }

  function reset() {
    setForm({
      imei: '', model: '', color: '', spec: '', price: '',
      addedDate: new Date().toISOString().split('T')[0],
      branchId: profile?.branch_id || '',
      deviceCondition: 'new',
    });
    setSuggestions([]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!form.imei || !form.model || !form.price || !form.branchId) {
      showToast('ข้อมูลไม่ครบ', 'กรุณากรอก IMEI, รุ่น, ราคา และสาขา', 'danger');
      return;
    }

    if (form.imei.length !== 15) {
      showToast('IMEI ไม่ถูกต้อง', 'IMEI ต้องมี 15 หลัก', 'danger');
      return;
    }

    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      showToast('ไม่พบผู้ใช้', '', 'danger');
      setLoading(false);
      return;
    }

    const { data: existingStock } = await supabase
      .from('stock').select('id').eq('imei', form.imei).maybeSingle();

    if (existingStock) {
      showToast('IMEI ซ้ำ', 'เลข IMEI นี้มีอยู่ในสต๊อกแล้ว', 'danger');
      setLoading(false);
      return;
    }

    const { data: profileWithShop } = await supabase
      .from('profiles').select('shop_id').eq('id', user.id).single();

    const { error } = await supabase.from('stock').insert({
      imei: form.imei,
      model: form.model,
      color: form.color || null,
      spec: form.spec || null,
      price: parseFloat(form.price),
      added_date: form.addedDate,
      added_by: user.id,
      added_by_name: profile.full_name,
      branch_id: form.branchId,
      device_condition: form.deviceCondition,
      shop_id: profileWithShop?.shop_id,
    });

    setLoading(false);

    if (error) {
      showToast('เกิดข้อผิดพลาด', error.message, 'danger');
      return;
    }

    showToast('เพิ่มสำเร็จ', `${form.model} เข้าสต๊อกแล้ว`);
    reset();
  }

  const isAdmin = profile?.role === 'admin';

  return (
    <>
      <div className="page-header">
        <h2>เพิ่มเครื่อง</h2>
        <div className="desc">ลงทะเบียนเครื่องใหม่เข้าสต๊อก</div>
      </div>

      <div className="form-card">
        <h3>รายละเอียดเครื่อง</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="field full">
              <label>IMEI <span style={{ color: 'var(--danger)' }}>*</span></label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text" inputMode="numeric" maxLength={15}
                  value={form.imei}
                  onChange={(e) => setForm({ ...form, imei: e.target.value.replace(/\D/g, '') })}
                  placeholder="356789012345678" required style={{ flex: 1 }}
                />
                <button type="button" className="btn btn-sec" onClick={() => setShowScanner(true)}
                  style={{ width: 'auto', padding: '0 16px', minWidth: 100, whiteSpace: 'nowrap' }}>
                  📷 สแกน
                </button>
              </div>
            </div>

            <div className="field full" style={{ position: 'relative' }}>
              <label>รุ่น <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input
                type="text" value={form.model}
                onChange={(e) => {
                  setForm({ ...form, model: e.target.value });
                  loadSuggestions(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => {
                  if (form.model.length >= 2) {
                    loadSuggestions(form.model);
                    setShowSuggestions(true);
                  }
                }}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                placeholder="iPhone 15 Pro Max" required autoComplete="off"
              />
              {showSuggestions && suggestions.length > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0,
                  background: 'var(--surface-2)', border: '1px solid var(--accent)', borderTop: 'none',
                  maxHeight: 280, overflowY: 'auto', zIndex: 10,
                }}>
                  <div style={{
                    padding: '8px 12px', fontSize: 10, color: 'var(--accent)',
                    fontFamily: 'JetBrains Mono, monospace', letterSpacing: 1,
                    borderBottom: '1px solid var(--border)',
                  }}>
                    // เคยเพิ่มมาก่อน - กดเพื่อกรอกอัตโนมัติ
                  </div>
                  {suggestions.map((s, i) => (
                    <button key={i} type="button" onMouseDown={(e) => e.preventDefault()}
                      onClick={() => applySuggestion(s)}
                      style={{
                        display: 'block', width: '100%', padding: '12px',
                        background: 'transparent', border: 'none',
                        borderBottom: '1px solid var(--border)',
                        color: 'var(--text)', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
                      }}>
                      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{s.model}</div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        {s.color && <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>🎨 {s.color}</span>}
                        {s.spec && <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>💾 {s.spec}</span>}
                        <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>
                          ฿{s.price.toLocaleString()}
                        </span>
                        <span style={{ fontSize: 10, color: 'var(--text-dim)', marginLeft: 'auto', fontFamily: 'JetBrains Mono, monospace' }}>
                          x{s.count}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="field"><label>สี</label>
              <input type="text" value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
                placeholder="Natural Titanium" /></div>
            <div className="field"><label>สเปค (ROM/RAM)</label>
              <input type="text" value={form.spec}
                onChange={(e) => setForm({ ...form, spec: e.target.value })}
                placeholder="256GB / 8GB" /></div>
            <div className="field"><label>ราคา (บาท) <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input type="number" inputMode="numeric" value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                placeholder="45000" required /></div>
            <div className="field"><label>วันที่ลงสต๊อก</label>
              <input type="date" value={form.addedDate}
                onChange={(e) => setForm({ ...form, addedDate: e.target.value })} /></div>

            {/* Device Condition - มือ 1 / มือ 2 */}
            <div className="field full">
              <label>สภาพเครื่อง <span style={{ color: 'var(--danger)' }}>*</span></label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, deviceCondition: 'new' })}
                  style={{
                    flex: 1,
                    padding: '12px',
                    background: form.deviceCondition === 'new' ? 'var(--accent)' : 'var(--surface-2)',
                    color: form.deviceCondition === 'new' ? 'var(--bg)' : 'var(--text)',
                    border: `1px solid ${form.deviceCondition === 'new' ? 'var(--accent)' : 'var(--border)'}`,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontSize: 14,
                    fontWeight: 600,
                    transition: 'all 0.15s',
                  }}
                >
                  ✨ มือ 1 (ใหม่)
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, deviceCondition: 'used' })}
                  style={{
                    flex: 1,
                    padding: '12px',
                    background: form.deviceCondition === 'used' ? 'var(--accent)' : 'var(--surface-2)',
                    color: form.deviceCondition === 'used' ? 'var(--bg)' : 'var(--text)',
                    border: `1px solid ${form.deviceCondition === 'used' ? 'var(--accent)' : 'var(--border)'}`,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontSize: 14,
                    fontWeight: 600,
                    transition: 'all 0.15s',
                  }}
                >
                  📱 มือ 2 (มือสอง)
                </button>
              </div>
            </div>

            {/* Branch Selector */}
            <div className="field full">
              <label>
                สาขา <span style={{ color: 'var(--danger)' }}>*</span>
                {!isAdmin && <span style={{ color: 'var(--text-dim)', fontSize: 10, marginLeft: 8 }}>(สาขาของคุณ)</span>}
              </label>
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
                <input type="text" value={profile?.branches?.name || '-'} disabled
                  style={{ opacity: 0.7, cursor: 'not-allowed' }} />
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

      {showScanner && <BarcodeScanner onScan={handleScan} onClose={() => setShowScanner(false)} />}
      {toast && <Toast {...toast} />}
    </>
  );
}
