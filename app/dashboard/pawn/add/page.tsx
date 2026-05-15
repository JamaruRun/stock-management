'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase-client';
import Toast from '@/components/Toast';
import BarcodeScanner from '@/components/BarcodeScanner';

export default function AddPawnPage() {
  const supabase = createClient();
  const [form, setForm] = useState({
    imei: '', model: '', color: '', spec: '',
    pawnPrice: '', pawnDate: new Date().toISOString().split('T')[0],
    customerName: '', customerPhone: '', customerNote: '',
    branchId: '',
  });
  const [profile, setProfile] = useState<any>(null);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
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
      if (p?.role === 'admin') {
        const { data: bs } = await supabase.from('branches').select('*').order('name');
        setBranches(bs || []);
      }
      setForm(f => ({ ...f, branchId: p?.branch_id || '' }));
    }
    loadProfile();
  }, []);

  function handleScan(imei: string) {
    setForm({ ...form, imei });
    setShowScanner(false);
    showToast('สแกนสำเร็จ', `IMEI: ${imei}`);
  }

  function reset() {
    setForm({
      imei: '', model: '', color: '', spec: '',
      pawnPrice: '', pawnDate: new Date().toISOString().split('T')[0],
      customerName: '', customerPhone: '', customerNote: '',
      branchId: profile?.branch_id || '',
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!form.imei || !form.model || !form.pawnPrice || !form.customerName || !form.branchId) {
      showToast('ข้อมูลไม่ครบ', 'กรุณากรอก IMEI, รุ่น, ราคา, ชื่อลูกค้า และสาขา', 'danger');
      return;
    }

    if (form.imei.length !== 15) {
      showToast('IMEI ไม่ถูกต้อง', 'IMEI ต้องมี 15 หลัก', 'danger');
      return;
    }

    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data: existing } = await supabase
      .from('pawn_stock').select('id').eq('imei', form.imei).maybeSingle();

    if (existing) {
      showToast('IMEI ซ้ำ', 'เครื่องนี้กำลังจำนำอยู่แล้ว', 'danger');
      setLoading(false);
      return;
    }

    const { data: profileWithShop } = await supabase
      .from('profiles').select('shop_id').eq('id', user.id).single();

    const { error } = await supabase.from('pawn_stock').insert({
      imei: form.imei, model: form.model,
      color: form.color || null, spec: form.spec || null,
      pawn_price: parseFloat(form.pawnPrice), pawn_date: form.pawnDate,
      customer_name: form.customerName,
      customer_phone: form.customerPhone || null,
      customer_note: form.customerNote || null,
      added_by: user.id, added_by_name: profile.full_name,
      branch_id: form.branchId,
      shop_id: profileWithShop?.shop_id,
    });

    setLoading(false);

    if (error) {
      showToast('เกิดข้อผิดพลาด', error.message, 'danger');
      return;
    }

    showToast('รับจำนำสำเร็จ', `${form.model} - ฿${parseFloat(form.pawnPrice).toLocaleString()}`);
    reset();
  }

  const isAdmin = profile?.role === 'admin';

  return (
    <>
      <div className="page-header">
        <h2>รับจำนำเครื่อง</h2>
        <div className="desc">บันทึกเครื่องที่รับจำนำเข้าระบบ</div>
      </div>

      <div className="form-card">
        <h3>ข้อมูลเครื่อง</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="field full">
              <label>IMEI <span style={{ color: 'var(--danger)' }}>*</span></label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input type="text" inputMode="numeric" maxLength={15}
                  value={form.imei}
                  onChange={(e) => setForm({ ...form, imei: e.target.value.replace(/\D/g, '') })}
                  placeholder="356789012345678" required style={{ flex: 1 }} />
                <button type="button" className="btn btn-sec" onClick={() => setShowScanner(true)}
                  style={{ width: 'auto', padding: '0 16px', minWidth: 100, whiteSpace: 'nowrap' }}>
                  📷 สแกน
                </button>
              </div>
            </div>
            <div className="field"><label>รุ่น <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input type="text" value={form.model}
                onChange={(e) => setForm({ ...form, model: e.target.value })}
                placeholder="iPhone 15 Pro Max" required /></div>
            <div className="field"><label>สี</label>
              <input type="text" value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
                placeholder="Natural Titanium" /></div>
            <div className="field"><label>สเปค (ROM/RAM)</label>
              <input type="text" value={form.spec}
                onChange={(e) => setForm({ ...form, spec: e.target.value })}
                placeholder="256GB / 8GB" /></div>
            <div className="field"><label>ราคาจำนำ (บาท) <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input type="number" inputMode="numeric" value={form.pawnPrice}
                onChange={(e) => setForm({ ...form, pawnPrice: e.target.value })}
                placeholder="20000" required /></div>
            <div className="field"><label>วันที่รับจำนำ</label>
              <input type="date" value={form.pawnDate}
                onChange={(e) => setForm({ ...form, pawnDate: e.target.value })} /></div>

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
                <input type="text" value={profile?.branches?.name || '-'} disabled style={{ opacity: 0.7 }} />
              )}
            </div>
          </div>
        </form>
      </div>

      <div className="form-card">
        <h3>ข้อมูลลูกค้า</h3>
        <div className="form-grid">
          <div className="field"><label>ชื่อลูกค้า <span style={{ color: 'var(--danger)' }}>*</span></label>
            <input type="text" value={form.customerName}
              onChange={(e) => setForm({ ...form, customerName: e.target.value })}
              placeholder="ชื่อ - นามสกุล" required /></div>
          <div className="field"><label>เบอร์โทร</label>
            <input type="tel" inputMode="tel" value={form.customerPhone}
              onChange={(e) => setForm({ ...form, customerPhone: e.target.value })}
              placeholder="08X-XXX-XXXX" /></div>
          <div className="field full"><label>หมายเหตุ</label>
            <input type="text" value={form.customerNote}
              onChange={(e) => setForm({ ...form, customerNote: e.target.value })}
              placeholder="ที่อยู่/บัตรประชาชน/ข้อตกลง" /></div>
        </div>

        <div className="form-actions">
          <button onClick={handleSubmit} className="btn" disabled={loading}>
            {loading ? 'กำลังบันทึก...' : '+ รับจำนำเครื่อง'}
          </button>
          <button type="button" className="btn btn-sec" onClick={reset} disabled={loading}>
            ล้างฟอร์ม
          </button>
        </div>
      </div>

      {showScanner && <BarcodeScanner onScan={handleScan} onClose={() => setShowScanner(false)} mode="imei" />}
      {toast && <Toast {...toast} />}
    </>
  );
}
