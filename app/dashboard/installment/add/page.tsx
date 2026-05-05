'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase-client';
import Toast from '@/components/Toast';
import BarcodeScanner from '@/components/BarcodeScanner';

export default function AddInstallmentPage() {
  const supabase = createClient();
  const [form, setForm] = useState({
    imei: '',
    model: '',
    color: '',
    spec: '',
    fullPrice: '',
    downPayment: '',
    installmentAmount: '',
    totalPeriods: '',
    startDate: new Date().toISOString().split('T')[0],
    customerName: '',
    customerPhone: '',
    customerIdCard: '',
    customerAddress: '',
    customerNote: '',
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
      imei: '',
      model: '',
      color: '',
      spec: '',
      fullPrice: '',
      downPayment: '',
      installmentAmount: '',
      totalPeriods: '',
      startDate: new Date().toISOString().split('T')[0],
      customerName: '',
      customerPhone: '',
      customerIdCard: '',
      customerAddress: '',
      customerNote: '',
      branchId: profile?.branch_id || '',
    });
  }

  // คำนวณยอดรวมที่ต้องผ่อน
  const fullPrice = parseFloat(form.fullPrice) || 0;
  const downPayment = parseFloat(form.downPayment) || 0;
  const installmentAmount = parseFloat(form.installmentAmount) || 0;
  const totalPeriods = parseInt(form.totalPeriods) || 0;
  
  const totalInstallment = installmentAmount * totalPeriods;
  const totalWithDown = downPayment + totalInstallment;
  const remainingFromFull = fullPrice - downPayment;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!form.imei || !form.model || !form.fullPrice || !form.downPayment 
        || !form.installmentAmount || !form.totalPeriods 
        || !form.customerName || !form.customerPhone || !form.customerIdCard
        || !form.branchId) {
      showToast('ข้อมูลไม่ครบ', 'กรุณากรอกข้อมูลที่จำเป็นทั้งหมด', 'danger');
      return;
    }

    if (form.imei.length !== 15) {
      showToast('IMEI ไม่ถูกต้อง', 'IMEI ต้องมี 15 หลัก', 'danger');
      return;
    }

    if (form.customerIdCard.length !== 13) {
      showToast('เลขบัตรประชาชนไม่ถูกต้อง', 'ต้องมี 13 หลัก', 'danger');
      return;
    }

    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      showToast('ไม่พบผู้ใช้', '', 'danger');
      setLoading(false);
      return;
    }

    // เช็ค IMEI ซ้ำ
    const { data: existing } = await supabase
      .from('installment_stock')
      .select('id')
      .eq('imei', form.imei)
      .maybeSingle();

    if (existing) {
      showToast('IMEI ซ้ำ', 'เครื่องนี้กำลังผ่อนอยู่แล้ว', 'danger');
      setLoading(false);
      return;
    }

    const { error } = await supabase.from('installment_stock').insert({
      imei: form.imei,
      model: form.model,
      color: form.color || null,
      spec: form.spec || null,
      full_price: parseFloat(form.fullPrice),
      down_payment: parseFloat(form.downPayment),
      installment_amount: parseFloat(form.installmentAmount),
      total_periods: parseInt(form.totalPeriods),
      start_date: form.startDate,
      customer_name: form.customerName,
      customer_phone: form.customerPhone,
      customer_id_card: form.customerIdCard,
      customer_address: form.customerAddress || null,
      customer_note: form.customerNote || null,
      added_by: user.id,
      added_by_name: profile.full_name,
      branch_id: form.branchId,
    });

    setLoading(false);

    if (error) {
      showToast('เกิดข้อผิดพลาด', error.message, 'danger');
      return;
    }

    showToast('เพิ่มผ่อนสำเร็จ', `${form.model} - ${form.customerName}`);
    reset();
  }

  return (
    <>
      <div className="page-header">
        <h2>เพิ่มเครื่องผ่อน</h2>
        <div className="desc">บันทึกเครื่องที่ลูกค้าผ่อนเข้าระบบ</div>
      </div>

      <div className="form-card">
        <h3>ข้อมูลเครื่อง</h3>
        <div className="form-grid">
          <div className="field full">
            <label>IMEI <span style={{ color: 'var(--danger)' }}>*</span></label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                inputMode="numeric"
                maxLength={15}
                value={form.imei}
                onChange={(e) => setForm({ ...form, imei: e.target.value.replace(/\D/g, '') })}
                placeholder="356789012345678"
                required
                style={{ flex: 1 }}
              />
              <button
                type="button"
                className="btn btn-sec"
                onClick={() => setShowScanner(true)}
                style={{ width: 'auto', padding: '0 16px', minWidth: 100, whiteSpace: 'nowrap' }}
              >
                📷 สแกน
              </button>
            </div>
          </div>
          <div className="field">
            <label>รุ่น <span style={{ color: 'var(--danger)' }}>*</span></label>
            <input type="text" value={form.model}
              onChange={(e) => setForm({ ...form, model: e.target.value })}
              placeholder="iPhone 15 Pro Max" required />
          </div>
          <div className="field">
            <label>สี</label>
            <input type="text" value={form.color}
              onChange={(e) => setForm({ ...form, color: e.target.value })}
              placeholder="Natural Titanium" />
          </div>
          <div className="field full">
            <label>สเปค (ROM/RAM)</label>
            <input type="text" value={form.spec}
              onChange={(e) => setForm({ ...form, spec: e.target.value })}
              placeholder="256GB / 8GB" />
          </div>
        </div>
      </div>

      <div className="form-card">
        <h3>ข้อมูลการเงิน</h3>
        <div className="form-grid">
          <div className="field">
            <label>ราคาเต็ม (บาท) <span style={{ color: 'var(--danger)' }}>*</span></label>
            <input type="number" inputMode="numeric" value={form.fullPrice}
              onChange={(e) => setForm({ ...form, fullPrice: e.target.value })}
              placeholder="35000" required />
          </div>
          <div className="field">
            <label>เงินดาวน์ (บาท) <span style={{ color: 'var(--danger)' }}>*</span></label>
            <input type="number" inputMode="numeric" value={form.downPayment}
              onChange={(e) => setForm({ ...form, downPayment: e.target.value })}
              placeholder="5000" required />
          </div>
          <div className="field">
            <label>ยอดผ่อน/งวด (บาท) <span style={{ color: 'var(--danger)' }}>*</span></label>
            <input type="number" inputMode="numeric" value={form.installmentAmount}
              onChange={(e) => setForm({ ...form, installmentAmount: e.target.value })}
              placeholder="3000" required />
          </div>
          <div className="field">
            <label>จำนวนงวด <span style={{ color: 'var(--danger)' }}>*</span></label>
            <input type="number" inputMode="numeric" value={form.totalPeriods}
              onChange={(e) => setForm({ ...form, totalPeriods: e.target.value })}
              placeholder="10" required />
          </div>
          <div className="field full">
            <label>วันที่เริ่มผ่อน</label>
            <input type="date" value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
          </div>
          
          <div className="field full">
            <label>
              สาขา <span style={{ color: 'var(--danger)' }}>*</span>
              {profile?.role !== 'admin' && <span style={{ color: 'var(--text-dim)', fontSize: 10, marginLeft: 8 }}>(สาขาของคุณ)</span>}
            </label>
            {profile?.role === 'admin' ? (
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

        {/* Summary */}
        {(fullPrice > 0 || downPayment > 0 || installmentAmount > 0) && (
          <div style={{
            marginTop: 16,
            padding: 16,
            background: 'var(--surface-2)',
            borderLeft: '3px solid var(--accent)',
          }}>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'JetBrains Mono, monospace', letterSpacing: 1, marginBottom: 8 }}>
              // สรุปการเงิน
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 13 }}>
              <div>
                <div style={{ color: 'var(--text-dim)', fontSize: 11 }}>เงินดาวน์</div>
                <div style={{ fontWeight: 600 }}>฿{downPayment.toLocaleString()}</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-dim)', fontSize: 11 }}>ผ่อนรวม ({totalPeriods} งวด)</div>
                <div style={{ fontWeight: 600 }}>฿{totalInstallment.toLocaleString()}</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-dim)', fontSize: 11 }}>รวมที่ลูกค้าจ่าย</div>
                <div style={{ fontWeight: 600, color: 'var(--accent)' }}>฿{totalWithDown.toLocaleString()}</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-dim)', fontSize: 11 }}>ราคาเต็ม</div>
                <div style={{ fontWeight: 600 }}>฿{fullPrice.toLocaleString()}</div>
              </div>
              {totalWithDown > fullPrice && fullPrice > 0 && (
                <div style={{ gridColumn: '1 / -1', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                  <div style={{ color: 'var(--text-dim)', fontSize: 11 }}>กำไร/ดอกเบี้ย</div>
                  <div style={{ fontWeight: 600, color: 'var(--success)' }}>
                    ฿{(totalWithDown - fullPrice).toLocaleString()}
                    {' '}({(((totalWithDown - fullPrice) / fullPrice) * 100).toFixed(1)}%)
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="form-card">
        <h3>ข้อมูลลูกค้า</h3>
        <div className="form-grid">
          <div className="field">
            <label>ชื่อลูกค้า <span style={{ color: 'var(--danger)' }}>*</span></label>
            <input type="text" value={form.customerName}
              onChange={(e) => setForm({ ...form, customerName: e.target.value })}
              placeholder="ชื่อ - นามสกุล" required />
          </div>
          <div className="field">
            <label>เบอร์โทร <span style={{ color: 'var(--danger)' }}>*</span></label>
            <input type="tel" inputMode="tel" value={form.customerPhone}
              onChange={(e) => setForm({ ...form, customerPhone: e.target.value })}
              placeholder="08X-XXX-XXXX" required />
          </div>
          <div className="field full">
            <label>เลขบัตรประชาชน <span style={{ color: 'var(--danger)' }}>*</span></label>
            <input type="text" inputMode="numeric" maxLength={13} value={form.customerIdCard}
              onChange={(e) => setForm({ ...form, customerIdCard: e.target.value.replace(/\D/g, '') })}
              placeholder="1-2345-67890-12-3" required />
          </div>
          <div className="field full">
            <label>ที่อยู่</label>
            <input type="text" value={form.customerAddress}
              onChange={(e) => setForm({ ...form, customerAddress: e.target.value })}
              placeholder="ที่อยู่ตามบัตรประชาชน" />
          </div>
          <div className="field full">
            <label>หมายเหตุ</label>
            <input type="text" value={form.customerNote}
              onChange={(e) => setForm({ ...form, customerNote: e.target.value })}
              placeholder="ข้อตกลง / รายละเอียดเพิ่มเติม" />
          </div>
        </div>

        <div className="form-actions">
          <button onClick={handleSubmit} className="btn" disabled={loading}>
            {loading ? 'กำลังบันทึก...' : '+ เพิ่มเครื่องผ่อน'}
          </button>
          <button type="button" className="btn btn-sec" onClick={reset} disabled={loading}>
            ล้างฟอร์ม
          </button>
        </div>
      </div>

      {showScanner && (
        <BarcodeScanner onScan={handleScan} onClose={() => setShowScanner(false)} />
      )}

      {toast && <Toast {...toast} />}
    </>
  );
}
