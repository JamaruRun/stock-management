'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';
import Toast from '@/components/Toast';
import { Eye, EyeOff } from 'lucide-react';
import { sendLineNotify } from '@/lib/line-notify';

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

    // คำนวณ due_date จาก pawn_date + interest_days
    const interestDays = parseInt(form.interestDays) || 30;
    const pawnDate = new Date(form.pawnDate);
    const dueDate = new Date(pawnDate);
    dueDate.setDate(dueDate.getDate() + interestDays);
    const dueDateStr = dueDate.toISOString().split('T')[0];

    const { error } = await supabase.from('pawn_stock').insert({
      model: form.model,
      color: form.color || null, spec: form.spec || null,
      device_password: form.devicePassword || null,
      pawn_price: parseFloat(form.pawnPrice), pawn_date: form.pawnDate,
      interest_days: interestDays,
      interest_amount: parseFloat(form.interestAmount) || 0,
      due_date: dueDateStr,
      status: 'active',
      renew_count: 0,
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

    showToast('รับจำนำสำเร็จ', `${form.model} • ฿${parseFloat(form.pawnPrice).toLocaleString()}`);

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
              <label>รหัสผ่านเครื่อง (ถ้ามี)</label>
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
