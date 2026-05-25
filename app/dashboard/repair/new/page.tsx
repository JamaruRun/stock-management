'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-client';
import Toast from '@/components/Toast';
import { DEVICE_BRANDS, COMMON_PROBLEMS } from '@/lib/repair-constants';
import { COMMON_PHONE_MODELS } from '@/lib/parts-constants';
import { sendLinePush } from '@/lib/line-notify';

export default function NewRepairPage() {
  const supabase = createClient();
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ title: string; msg: string; type: string } | null>(null);

  const [form, setForm] = useState({
    // ลูกค้า
    customer_name: '',
    customer_phone: '',
    customer_line_id: '',
    // เครื่อง
    device_brand: 'Apple',
    device_model: '',
    device_color: '',
    device_imei: '',
    device_password: '',
    device_accessories: '',
    device_condition_note: '',
    // ปัญหา
    problem_description: '',
    diagnosis: '',
    // ราคา
    labor_cost: '',
    // กำหนดการ
    received_date: new Date().toISOString().split('T')[0],
    estimated_done_date: '',
    technician_id: '',
    internal_note: '',
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
    }
    load();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;

    if (!form.customer_name.trim()) {
      showToast('กรอกชื่อลูกค้า', '', 'danger');
      return;
    }
    if (!form.device_model.trim()) {
      showToast('กรอกรุ่นเครื่อง', '', 'danger');
      return;
    }
    if (!form.problem_description.trim()) {
      showToast('กรอกอาการเสีย', '', 'danger');
      return;
    }

    setSaving(true);

    // Generate job_no
    const { data: jobNoData, error: jobNoError } = await supabase
      .rpc('generate_repair_job_no', { p_shop_id: profile.shop_id });

    if (jobNoError || !jobNoData) {
      showToast('สร้างเลขใบไม่สำเร็จ', jobNoError?.message || '', 'danger');
      setSaving(false);
      return;
    }

    const { data: newJob, error } = await supabase
      .from('repair_jobs')
      .insert({
        shop_id: profile.shop_id,
        branch_id: profile.branch_id,
        job_no: jobNoData,
        customer_name: form.customer_name.trim(),
        customer_phone: form.customer_phone.trim() || null,
        customer_line_id: form.customer_line_id.trim() || null,
        device_brand: form.device_brand,
        device_model: form.device_model.trim(),
        device_color: form.device_color.trim() || null,
        device_imei: form.device_imei.trim() || null,
        device_password: form.device_password.trim() || null,
        device_accessories: form.device_accessories.trim() || null,
        device_condition_note: form.device_condition_note.trim() || null,
        problem_description: form.problem_description.trim(),
        diagnosis: form.diagnosis.trim() || null,
        labor_cost: parseFloat(form.labor_cost) || 0,
        received_date: form.received_date,
        estimated_done_date: form.estimated_done_date || null,
        technician_id: form.technician_id || profile.id,
        technician_name: profile.full_name || profile.username,
        added_by: profile.id,
        added_by_name: profile.full_name || profile.username,
        internal_note: form.internal_note.trim() || null,
        status: 'pending',
      })
      .select()
      .single();

    if (error || !newJob) {
      showToast('บันทึกไม่สำเร็จ', error?.message || '', 'danger');
      setSaving(false);
      return;
    }

    // บันทึก status log
    await supabase.from('repair_status_log').insert({
      shop_id: profile.shop_id,
      job_id: newJob.id,
      from_status: null,
      to_status: 'pending',
      note: 'รับงานใหม่',
      changed_by: profile.id,
      changed_by_name: profile.full_name || profile.username,
    });

    // LINE notify
    sendLinePush(
      `🛠️ รับงานซ่อมใหม่\n\n📋 ${newJob.job_no}\n📱 ${form.device_brand} ${form.device_model}\n👤 ${form.customer_name}${form.customer_phone ? '\n📞 ' + form.customer_phone : ''}\n⚠️ ${form.problem_description}`,
      'sale'
    ).catch(() => {});

    showToast('รับงานสำเร็จ', `เลขใบ: ${newJob.job_no}`);
    setTimeout(() => router.push(`/dashboard/repair/edit?id=${newJob.id}`), 800);
  }

  return (
    <>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div>
          <h1>📋 รับงานซ่อม</h1>
          <div className="desc">รับเครื่อง • ออกใบงาน • ตั้งสถานะ</div>
        </div>
        <Link href="/dashboard/repair" style={{
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
        {/* ลูกค้า */}
        <h3>👤 ข้อมูลลูกค้า</h3>
        <div className="form-grid">
          <div className="field full">
            <label>ชื่อ-นามสกุล <span style={{ color: 'var(--danger)' }}>*</span></label>
            <input
              type="text"
              value={form.customer_name}
              onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
              placeholder="ชื่อจริง นามสกุลจริง"
              required
            />
          </div>

          <div className="field">
            <label>เบอร์โทร</label>
            <input
              type="tel"
              value={form.customer_phone}
              onChange={(e) => setForm({ ...form, customer_phone: e.target.value })}
              placeholder="0812345678"
              inputMode="numeric"
            />
          </div>

          <div className="field">
            <label>LINE ID</label>
            <input
              type="text"
              value={form.customer_line_id}
              onChange={(e) => setForm({ ...form, customer_line_id: e.target.value })}
              placeholder="@line_id"
            />
          </div>
        </div>

        {/* เครื่อง */}
        <h3 style={{ marginTop: 20 }}>📱 ข้อมูลเครื่อง</h3>
        <div className="form-grid">
          <div className="field">
            <label>ยี่ห้อ</label>
            <select
              value={form.device_brand}
              onChange={(e) => setForm({ ...form, device_brand: e.target.value })}
            >
              {DEVICE_BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>

          <div className="field">
            <label>รุ่น <span style={{ color: 'var(--danger)' }}>*</span></label>
            <input
              type="text"
              value={form.device_model}
              onChange={(e) => setForm({ ...form, device_model: e.target.value })}
              placeholder="iPhone 13"
              list="phone-models-repair"
              required
            />
            <datalist id="phone-models-repair">
              {COMMON_PHONE_MODELS.map(m => <option key={m} value={m} />)}
            </datalist>
          </div>

          <div className="field">
            <label>สี</label>
            <input
              type="text"
              value={form.device_color}
              onChange={(e) => setForm({ ...form, device_color: e.target.value })}
              placeholder="ดำ / ขาว"
            />
          </div>

          <div className="field">
            <label>IMEI / Serial</label>
            <input
              type="text"
              value={form.device_imei}
              onChange={(e) => setForm({ ...form, device_imei: e.target.value })}
              placeholder="356789012345678"
              style={{ fontFamily: 'JetBrains Mono, monospace' }}
            />
          </div>

          <div className="field">
            <label>รหัสปลดล็อค</label>
            <input
              type="text"
              value={form.device_password}
              onChange={(e) => setForm({ ...form, device_password: e.target.value })}
              placeholder="123456 / pattern"
            />
          </div>

          <div className="field">
            <label>ของแถม</label>
            <input
              type="text"
              value={form.device_accessories}
              onChange={(e) => setForm({ ...form, device_accessories: e.target.value })}
              placeholder="ซิม, เคส, ฟิล์ม"
            />
          </div>

          <div className="field full">
            <label>สภาพเครื่องที่รับ</label>
            <input
              type="text"
              value={form.device_condition_note}
              onChange={(e) => setForm({ ...form, device_condition_note: e.target.value })}
              placeholder="เช่น รอยขีดข่วน, จอแตก"
            />
          </div>
        </div>

        {/* ปัญหา */}
        <h3 style={{ marginTop: 20 }}>⚠️ อาการเสีย</h3>
        <div className="form-grid">
          <div className="field full">
            <label>อาการที่ลูกค้าแจ้ง <span style={{ color: 'var(--danger)' }}>*</span></label>
            <input
              type="text"
              value={form.problem_description}
              onChange={(e) => setForm({ ...form, problem_description: e.target.value })}
              placeholder="เช่น จอแตก, แบตเสื่อม"
              list="common-problems"
              required
            />
            <datalist id="common-problems">
              {COMMON_PROBLEMS.map(p => <option key={p} value={p} />)}
            </datalist>
            <small style={{ fontSize: 11, color: 'var(--text-dim)' }}>
              💡 พิมพ์/เลือก หรือพิมพ์เพิ่มเอง
            </small>
          </div>

          <div className="field full">
            <label>วิเคราะห์เบื้องต้น (optional)</label>
            <textarea
              value={form.diagnosis}
              onChange={(e) => setForm({ ...form, diagnosis: e.target.value })}
              placeholder="ช่างวิเคราะห์เบื้องต้น"
              rows={2}
              style={{ resize: 'vertical' }}
            />
          </div>
        </div>

        {/* ราคา */}
        <h3 style={{ marginTop: 20 }}>💰 ราคา</h3>
        <div className="form-grid">
          <div className="field">
            <label>ค่าแรง (ตกลงเบื้องต้น)</label>
            <input
              type="number"
              value={form.labor_cost}
              onChange={(e) => setForm({ ...form, labor_cost: e.target.value })}
              inputMode="decimal"
              placeholder="0"
              step="0.01"
            />
            <small style={{ fontSize: 11, color: 'var(--text-dim)' }}>
              💡 ราคาอะไหล่ใส่ทีหลังตอนเลือกอะไหล่
            </small>
          </div>

          <div className="field">
            <label>วันที่รับ</label>
            <input
              type="date"
              value={form.received_date}
              onChange={(e) => setForm({ ...form, received_date: e.target.value })}
            />
          </div>

          <div className="field">
            <label>วันที่นัดรับ</label>
            <input
              type="date"
              value={form.estimated_done_date}
              onChange={(e) => setForm({ ...form, estimated_done_date: e.target.value })}
            />
          </div>

          <div className="field full">
            <label>หมายเหตุภายใน</label>
            <input
              type="text"
              value={form.internal_note}
              onChange={(e) => setForm({ ...form, internal_note: e.target.value })}
              placeholder="โน้ตให้ทีมรู้"
            />
          </div>
        </div>

        <div className="form-actions" style={{ marginTop: 20 }}>
          <button type="submit" className="btn" disabled={saving}>
            {saving ? 'กำลังบันทึก...' : '💾 รับงาน + ออกใบ'}
          </button>
        </div>
      </form>

      {toast && <Toast {...toast} />}
    </>
  );
}
