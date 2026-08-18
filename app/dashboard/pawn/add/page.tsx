'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';
import Toast from '@/components/Toast';
import PatternLockPad from '@/components/PatternLockPad';
import { Eye, EyeOff } from 'lucide-react';
import { sendLineNotify } from '@/lib/line-notify';
import { syncLedgerEntry } from '@/lib/ledger-sync';

export default function AddPawnPage() {
  const supabase = createClient();
  const router = useRouter();
  const [form, setForm] = useState({
    model: '', color: '', spec: '', devicePassword: '',
    pawnPrice: '', pawnDate: new Date().toISOString().split('T')[0],
    interestDays: '30', interestAmount: '',
    customerName: '', customerPhone: '', customerNote: '',
    branchId: '',
  });
  const [profile, setProfile] = useState<any>(null);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [toast, setToast] = useState<{ title: string; msg: string; type: string } | null>(null);
  const [priorRenewals, setPriorRenewals] = useState<{ date: string; interestPaid: string }[]>([]);
  const [deviceLockType, setDeviceLockType] = useState<'password' | 'pattern'>('password');
  const [devicePattern, setDevicePattern] = useState<number[]>([]);

  function showToast(title: string, msg: string, type: 'success' | 'danger' = 'success') {
    setToast({ title, msg, type });
    setTimeout(() => setToast(null), 2500);
  }

  function addPriorRenewal() {
    setPriorRenewals([...priorRenewals, { date: '', interestPaid: '' }]);
  }
  function updatePriorRenewal(i: number, field: 'date' | 'interestPaid', value: string) {
    setPriorRenewals(priorRenewals.map((r, idx) => idx === i ? { ...r, [field]: value } : r));
  }
  function removePriorRenewal(i: number) {
    setPriorRenewals(priorRenewals.filter((_, idx) => idx !== i));
  }

  function addDays(dateStr: string, days: number) {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  }

  // คำนวณ due_date ปัจจุบัน + สร้าง record ต่อดอกย้อนหลัง จากรายการที่กรอก (นับต่อรอบ ไม่สนวันที่จริงที่กรอก)
  function computeRenewalChain() {
    const interestDays = parseInt(form.interestDays) || 30;
    const sorted = [...priorRenewals].filter(r => r.date).sort((a, b) => a.date.localeCompare(b.date));
    let runningDue = addDays(form.pawnDate, interestDays);
    const records = sorted.map(r => {
      const oldDue = runningDue;
      const newDue = addDays(oldDue, interestDays);
      runningDue = newDue;
      return { old_due_date: oldDue, new_due_date: newDue, renewal_date: r.date, interest_paid: parseFloat(r.interestPaid) || 0 };
    });
    return { finalDueDate: runningDue, records };
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
      setForm(f => ({ ...f, branchId: p?.branch_id || '' }));
    }
    load();
  }, []);

  function reset() {
    setForm({
      model: '', color: '', spec: '', devicePassword: '',
      pawnPrice: '', pawnDate: new Date().toISOString().split('T')[0],
      interestDays: '30', interestAmount: '',
      customerName: '', customerPhone: '', customerNote: '',
      branchId: profile?.branch_id || '',
    });
    setPriorRenewals([]);
    setDeviceLockType('password');
    setDevicePattern([]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!form.model || !form.pawnPrice || !form.customerName || !form.branchId) {
      showToast('ข้อมูลไม่ครบ', 'กรอก รุ่น, ราคา, ชื่อ, สาขา', 'danger');
      return;
    }

    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data: profileWithShop } = await supabase
      .from('profiles').select('shop_id').eq('id', user.id).single();

    const interestDays = parseInt(form.interestDays) || 30;
    const { finalDueDate: dueDateStr, records: renewalRecords } = computeRenewalChain();

    const { data: newItem, error } = await supabase.from('pawn_stock').insert({
      model: form.model,
      color: form.color || null, spec: form.spec || null,
      device_password: deviceLockType === 'pattern' ? (devicePattern.join(',') || null) : (form.devicePassword || null),
      device_lock_type: deviceLockType,
      pawn_price: parseFloat(form.pawnPrice), pawn_date: form.pawnDate,
      interest_days: interestDays,
      interest_amount: parseFloat(form.interestAmount) || 0,
      due_date: dueDateStr,
      status: 'active',
      renew_count: renewalRecords.length,
      customer_name: form.customerName,
      customer_phone: form.customerPhone || null,
      customer_note: form.customerNote || null,
      added_by: user.id, added_by_name: profile.full_name,
      branch_id: form.branchId,
      shop_id: profileWithShop?.shop_id,
    }).select('id').single();

    if (error) {
      setLoading(false);
      showToast('เกิดข้อผิดพลาด', error.message, 'danger');
      return;
    }

    if (renewalRecords.length > 0) {
      const { error: renewalsError } = await supabase.from('pawn_renewals').insert(
        renewalRecords.map(r => ({
          pawn_id: newItem.id,
          renewal_date: r.renewal_date,
          interest_paid: r.interest_paid,
          old_due_date: r.old_due_date,
          new_due_date: r.new_due_date,
          note: 'นำเข้าประวัติเก่า',
          renewed_by: user.id,
          renewed_by_name: profile.full_name,
          branch_id: form.branchId,
          shop_id: profileWithShop?.shop_id,
        }))
      );
      if (renewalsError) {
        setLoading(false);
        showToast('บันทึกเครื่องสำเร็จ แต่บันทึกประวัติต่อดอกเก่าไม่สำเร็จ', renewalsError.message, 'danger');
        return;
      }
    }

    setLoading(false);
    showToast('รับจำนำสำเร็จ', `${form.model} • ฿${parseFloat(form.pawnPrice).toLocaleString()}`);

    syncLedgerEntry(supabase, {
      shopId: profileWithShop?.shop_id, branchId: form.branchId, sourceEvent: 'pawn_add',
      amount: parseFloat(form.pawnPrice), description: `รับจำนำ ${form.model} - ${parseFloat(form.pawnPrice).toLocaleString()} บาท`,
      userId: user.id, userName: profile.full_name,
    });

    // 🔔 LINE Notify
    const phoneTxt = form.customerPhone ? `\n📞 ${form.customerPhone}` : '';
    const lineMsg = `💰 รับจำนำเครื่องใหม่\n━━━━━━━━━━━━━\n📦 ${form.model}\n━━━━━━━━━━━━━\n👤 ลูกค้า: ${form.customerName}${phoneTxt}\n💵 ราคารับจำนำ: ฿${parseFloat(form.pawnPrice).toLocaleString()}\n📅 ครบกำหนด: ${dueDateStr}\n👨‍💼 รับโดย: ${profile.full_name}`;
    sendLineNotify(lineMsg, 'pawn').catch(() => {});
    
    reset();
    setTimeout(() => router.push('/dashboard/pawn/stock'), 1200);
  }

  const isAdmin = profile?.role === 'admin';

  return (
    <>
      <div className="page-header">
        <h1>💰 รับจำนำเครื่อง</h1>
        <div className="desc">บันทึกข้อมูลการรับจำนำใหม่</div>
      </div>

      <div className="form-card">
        <h3>📱 ข้อมูลเครื่อง</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="field full">
              <label>รุ่น <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input type="text" value={form.model}
                onChange={(e) => setForm({ ...form, model: e.target.value })}
                placeholder="iPhone 15 Pro Max" required />
            </div>

            <div className="field">
              <label>สี</label>
              <input type="text" value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })} />
            </div>

            <div className="field">
              <label>สเปค</label>
              <input type="text" value={form.spec}
                onChange={(e) => setForm({ ...form, spec: e.target.value })} />
            </div>

            <div className="field full">
              <label>รหัสปลดล็อกเครื่อง (ถ้ามี)</label>
              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                <button type="button"
                  onClick={() => setDeviceLockType('password')}
                  className={deviceLockType === 'password' ? 'btn' : 'btn btn-sec'}
                  style={{ width: 'auto', padding: '6px 14px', fontSize: 12 }}>
                  รหัสผ่าน/PIN
                </button>
                <button type="button"
                  onClick={() => setDeviceLockType('pattern')}
                  className={deviceLockType === 'pattern' ? 'btn' : 'btn btn-sec'}
                  style={{ width: 'auto', padding: '6px 14px', fontSize: 12 }}>
                  แพทเทิร์น (ลากจุด)
                </button>
              </div>
              {deviceLockType === 'password' ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  <input type={showPassword ? 'text' : 'password'} value={form.devicePassword}
                    onChange={(e) => setForm({ ...form, devicePassword: e.target.value })}
                    placeholder="รหัสปลดล็อกเครื่อง"
                    style={{ flex: 1 }} />
                  <button type="button" className="btn btn-sec"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ width: 'auto', padding: '0 16px' }}>
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              ) : (
                <PatternLockPad value={devicePattern} onChange={setDevicePattern} size={180} />
              )}
            </div>

            <div className="field">
              <label>ราคารับจำนำ <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input type="number" inputMode="numeric" value={form.pawnPrice}
                onChange={(e) => setForm({ ...form, pawnPrice: e.target.value })}
                placeholder="25000" required />
            </div>

            <div className="field">
              <label>วันที่จำนำ</label>
              <input type="date" value={form.pawnDate}
                onChange={(e) => setForm({ ...form, pawnDate: e.target.value })} />
            </div>

            <div className="field">
              <label>จำนวนวันต่อดอก <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input type="number" inputMode="numeric" value={form.interestDays}
                onChange={(e) => setForm({ ...form, interestDays: e.target.value })}
                placeholder="30" required />
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
                💡 ครบกำหนดต่อทุก {form.interestDays || 30} วัน
              </div>
            </div>

            <div className="field">
              <label>ดอกเบี้ยต่อรอบ (บาท)</label>
              <input type="number" inputMode="numeric" value={form.interestAmount}
                onChange={(e) => setForm({ ...form, interestAmount: e.target.value })}
                placeholder="500" />
            </div>
          </div>
        </form>
      </div>

      <div className="form-card">
        <h3>🔄 ประวัติต่อดอกเก่า (ถ้ามี)</h3>
        <p style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: -4, marginBottom: 12 }}>
          ถ้าเครื่องนี้เคยต่อดอกมาก่อนจะนำเข้าระบบ ใส่แต่ละครั้งไว้ตรงนี้ ระบบจะคำนวณวันครบกำหนดปัจจุบันให้อัตโนมัติ
        </p>
        {priorRenewals.map((r, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
            <input type="date" value={r.date}
              onChange={(e) => updatePriorRenewal(i, 'date', e.target.value)}
              style={{ flex: 2 }} />
            <input type="number" inputMode="numeric" value={r.interestPaid}
              onChange={(e) => updatePriorRenewal(i, 'interestPaid', e.target.value)}
              placeholder="ดอกที่จ่าย (บาท)" style={{ flex: 2 }} />
            <button type="button" className="btn btn-sec" onClick={() => removePriorRenewal(i)}
              style={{ width: 'auto', padding: '0 12px', flex: '0 0 auto' }}>×</button>
          </div>
        ))}
        <button type="button" className="btn btn-sec" onClick={addPriorRenewal} style={{ width: 'auto' }}>
          + เพิ่มรายการต่อดอกเก่า
        </button>
        {priorRenewals.filter(r => r.date).length > 0 && (
          <div style={{ marginTop: 12, padding: 10, background: 'var(--surface-2)', borderLeft: '3px solid var(--accent)', fontSize: 13 }}>
            ✓ นับต่อดอกเก่า {priorRenewals.filter(r => r.date).length} ครั้ง → ครบกำหนดปัจจุบัน: <strong>{computeRenewalChain().finalDueDate}</strong>
          </div>
        )}
      </div>

      <div className="form-card">
        <h3>👤 ข้อมูลลูกค้า</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="field full">
              <label>ชื่อ-นามสกุล <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input type="text" value={form.customerName}
                onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                placeholder="นายสมชาย ใจดี" required />
            </div>

            <div className="field">
              <label>เบอร์โทร</label>
              <input type="tel" value={form.customerPhone}
                onChange={(e) => setForm({ ...form, customerPhone: e.target.value })}
                placeholder="0812345678" />
            </div>

            <div className="field">
              <label>สาขา <span style={{ color: 'var(--danger)' }}>*</span></label>
              {isAdmin ? (
                <select value={form.branchId}
                  onChange={(e) => setForm({ ...form, branchId: e.target.value })} required>
                  <option value="">-- เลือก --</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              ) : (
                <input type="text" value={profile?.branches?.name || '-'} disabled />
              )}
            </div>

            <div className="field full">
              <label>หมายเหตุ</label>
              <input type="text" value={form.customerNote}
                onChange={(e) => setForm({ ...form, customerNote: e.target.value })}
                placeholder="เลขบัตรประชาชน, ที่อยู่..." />
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" className="btn" disabled={loading}>
              {loading ? 'กำลังบันทึก...' : '💰 รับจำนำเครื่อง'}
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
