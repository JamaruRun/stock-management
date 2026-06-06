'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase-client';
import { sendLinePush } from '@/lib/line-notify';
import { DEVICE_BRANDS } from '@/lib/repair-constants';
import {
  Wrench, X, User, Phone, MessageCircle, Smartphone, Lock, Package2,
  AlertTriangle, Stethoscope, DollarSign, Calendar, FileText, Layers,
  Loader2, CheckCircle2, AlertCircle,
} from 'lucide-react';

interface Props { onClose: () => void; onSuccess: () => void; }

export default function RepairNewModal({ onClose, onSuccess }: Props) {
  const supabase = createClient();
  const [form, setForm] = useState({
    customer_name: '', customer_phone: '', customer_line_id: '',
    device_brand: 'Apple', device_model: '', device_color: '', device_imei: '',
    device_password: '', device_accessories: '', device_condition_note: '',
    problem_description: '', diagnosis: '',
    labor_cost: '', received_date: new Date().toISOString().split('T')[0],
    estimated_done_date: '', internal_note: '',
  });
  const [profile, setProfile] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  function notify(msg: string, ok = true) { setToast({ msg, ok }); setTimeout(() => setToast(null), 2600); }
  function up(k: string, v: any) { setForm({ ...form, [k]: v }); }

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      setProfile(p);
    }
    load();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    if (!form.customer_name.trim()) return notify('กรอกชื่อลูกค้า', false);
    if (!form.device_model.trim()) return notify('กรอกรุ่นเครื่อง', false);
    if (!form.problem_description.trim()) return notify('กรอกอาการเสีย', false);

    setSaving(true);
    const { data: jobNoData, error: jobNoError } = await supabase
      .rpc('generate_repair_job_no', { p_shop_id: profile.shop_id });
    if (jobNoError || !jobNoData) { notify('สร้างเลขใบไม่สำเร็จ: ' + (jobNoError?.message || ''), false); setSaving(false); return; }

    const { data: newJob, error } = await supabase.from('repair_jobs').insert({
      shop_id: profile.shop_id, branch_id: profile.branch_id, job_no: jobNoData,
      customer_name: form.customer_name.trim(), customer_phone: form.customer_phone.trim() || null,
      customer_line_id: form.customer_line_id.trim() || null,
      device_brand: form.device_brand, device_model: form.device_model.trim(),
      device_color: form.device_color.trim() || null, device_imei: form.device_imei.trim() || null,
      device_password: form.device_password.trim() || null, device_accessories: form.device_accessories.trim() || null,
      device_condition_note: form.device_condition_note.trim() || null,
      problem_description: form.problem_description.trim(), diagnosis: form.diagnosis.trim() || null,
      labor_cost: parseFloat(form.labor_cost) || 0, received_date: form.received_date,
      estimated_done_date: form.estimated_done_date || null,
      technician_id: profile.id, technician_name: profile.full_name || profile.username,
      added_by: profile.id, added_by_name: profile.full_name || profile.username,
      internal_note: form.internal_note.trim() || null, status: 'pending',
    }).select().single();

    if (error || !newJob) { notify('บันทึกไม่สำเร็จ: ' + (error?.message || ''), false); setSaving(false); return; }

    await supabase.from('repair_status_log').insert({
      shop_id: profile.shop_id, job_id: newJob.id, from_status: null, to_status: 'pending',
      note: 'รับงานใหม่', changed_by: profile.id, changed_by_name: profile.full_name || profile.username,
    });

    sendLinePush(
      `🛠️ รับงานซ่อมใหม่\n\n📋 ${newJob.job_no}\n📱 ${form.device_brand} ${form.device_model}\n👤 ${form.customer_name}${form.customer_phone ? '\n📞 ' + form.customer_phone : ''}\n⚠️ ${form.problem_description}`,
      'sale'
    ).catch(() => {});

    setSaving(false);
    notify(`รับงานสำเร็จ • ${newJob.job_no}`);
    setTimeout(() => onSuccess(), 1000);
  }

  return (
    <div onClick={onClose} style={ov}>
      <div onClick={(e) => e.stopPropagation()} className="v3-card" style={card}>
        <div style={headerSt}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#dbeafe', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Wrench size={18} /></div>
            <div><h2 style={{ fontSize: 16, fontWeight: 700, fontFamily: 'Prompt, sans-serif' }}>รับงานซ่อมใหม่</h2><p style={{ fontSize: 11, color: 'var(--text-dim)' }}>เปิดใบงานซ่อม</p></div>
          </div>
          <button onClick={onClose} style={closeBtn}><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ overflowY: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* ลูกค้า */}
          <div>
            <SectionTitle Icon={User} color="#22c55e" label="ข้อมูลลูกค้า" />
            <F label="ชื่อลูกค้า" req><Inp Icon={User} value={form.customer_name} onChange={(v: string) => up('customer_name', v)} placeholder="ชื่อ-นามสกุล" /></F>
            <div style={g2}>
              <F label="เบอร์โทร"><Inp Icon={Phone} type="tel" value={form.customer_phone} onChange={(v: string) => up('customer_phone', v)} placeholder="08x-xxx-xxxx" /></F>
              <F label="LINE ID"><Inp Icon={MessageCircle} value={form.customer_line_id} onChange={(v: string) => up('customer_line_id', v)} placeholder="(ไม่บังคับ)" /></F>
            </div>
          </div>

          {/* เครื่อง */}
          <div>
            <SectionTitle Icon={Smartphone} color="#3b82f6" label="ข้อมูลเครื่อง" />
            <div style={g2}>
              <F label="ยี่ห้อ" req>
                <Sel Icon={Smartphone} value={form.device_brand} onChange={(v: string) => up('device_brand', v)}>
                  {DEVICE_BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
                </Sel>
              </F>
              <F label="รุ่น" req><Inp value={form.device_model} onChange={(v: string) => up('device_model', v)} placeholder="iPhone 13" /></F>
            </div>
            <div style={g2}>
              <F label="สี"><Inp value={form.device_color} onChange={(v: string) => up('device_color', v)} placeholder="ดำ" /></F>
              <F label="IMEI"><Inp value={form.device_imei} onChange={(v: string) => up('device_imei', v)} placeholder="(ไม่บังคับ)" /></F>
            </div>
            <div style={g2}>
              <F label="รหัสปลดล็อก"><Inp Icon={Lock} value={form.device_password} onChange={(v: string) => up('device_password', v)} placeholder="รหัสเครื่อง" /></F>
              <F label="อุปกรณ์ที่มาด้วย"><Inp Icon={Package2} value={form.device_accessories} onChange={(v: string) => up('device_accessories', v)} placeholder="เคส, ที่ชาร์จ" /></F>
            </div>
            <F label="สภาพเครื่อง (ก่อนซ่อม)"><Inp value={form.device_condition_note} onChange={(v: string) => up('device_condition_note', v)} placeholder="รอยขีดข่วน, รอยบุบ ฯลฯ" /></F>
          </div>

          {/* ปัญหา */}
          <div>
            <SectionTitle Icon={AlertTriangle} color="#f59e0b" label="อาการเสีย" />
            <F label="อาการที่ลูกค้าแจ้ง" req>
              <textarea value={form.problem_description} onChange={(e) => up('problem_description', e.target.value)} placeholder="เช่น จอแตก, แบตเสื่อม..." rows={2}
                style={{ ...inputSt, height: 'auto', minHeight: 56, padding: '10px 12px', resize: 'vertical' }} onFocus={fOn} onBlur={fOff} />
            </F>
            <F label="วินิจฉัยเบื้องต้น">
              <textarea value={form.diagnosis} onChange={(e) => up('diagnosis', e.target.value)} placeholder="(ไม่บังคับ)" rows={2}
                style={{ ...inputSt, height: 'auto', minHeight: 52, padding: '10px 12px', resize: 'vertical' }} onFocus={fOn} onBlur={fOff} />
            </F>
          </div>

          {/* ราคา + กำหนด */}
          <div>
            <SectionTitle Icon={DollarSign} color="#8b5cf6" label="ราคา + กำหนดการ" />
            <div style={g2}>
              <F label="ค่าซ่อม (฿)"><Inp Icon={DollarSign} type="number" value={form.labor_cost} onChange={(v: string) => up('labor_cost', v)} placeholder="0" /></F>
              <F label="วันที่รับเครื่อง"><Inp Icon={Calendar} type="date" value={form.received_date} onChange={(v: string) => up('received_date', v)} /></F>
            </div>
            <F label="คาดว่าเสร็จ"><Inp Icon={Calendar} type="date" value={form.estimated_done_date} onChange={(v: string) => up('estimated_done_date', v)} /></F>
            <F label="โน้ตภายใน (ลูกค้าไม่เห็น)"><Inp Icon={FileText} value={form.internal_note} onChange={(v: string) => up('internal_note', v)} placeholder="(ไม่บังคับ)" /></F>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={onClose} style={secBtn}>ยกเลิก</button>
            <button type="submit" disabled={saving} style={{ ...priBtn, background: saving ? 'var(--surface-2)' : 'linear-gradient(135deg, #3b82f6, #2563eb)' }}>
              {saving ? <Loader2 size={17} className="v3-spin" /> : <Wrench size={17} strokeWidth={2.4} />}
              {saving ? 'กำลังบันทึก...' : 'รับงานซ่อม'}
            </button>
          </div>
        </form>
      </div>
      {toast && (
        <div style={{ position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)', background: toast.ok ? '#16a34a' : '#dc2626', color: '#fff', padding: '12px 20px', borderRadius: 12, fontSize: 13, fontWeight: 600, boxShadow: '0 8px 24px rgba(0,0,0,0.2)', zIndex: 300, maxWidth: '90vw', display: 'flex', alignItems: 'center', gap: 8 }}>
          {toast.ok ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />} {toast.msg}
        </div>
      )}
    </div>
  );
}

function SectionTitle({ Icon, color, label }: any) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
      <div style={{ width: 28, height: 28, borderRadius: 8, background: `${color}15`, color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon size={15} /></div>
      <h3 style={{ fontSize: 13, fontWeight: 700, fontFamily: 'Prompt, sans-serif' }}>{label}</h3>
    </div>
  );
}
function F({ label, req, children }: any) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{label} {req && <span style={{ color: '#ef4444' }}>*</span>}</label>
      {children}
    </div>
  );
}
function Inp({ Icon, value, onChange, placeholder, type = 'text' }: any) {
  return (
    <div style={{ position: 'relative' }}>
      {Icon && <Icon size={16} style={iconSt} />}
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={{ ...inputSt, paddingLeft: Icon ? 40 : 12 }} onFocus={fOn} onBlur={fOff} inputMode={type === 'number' ? 'decimal' : undefined} />
    </div>
  );
}
function Sel({ Icon, value, onChange, children }: any) {
  return (
    <div style={{ position: 'relative' }}>
      {Icon && <Icon size={16} style={iconSt} />}
      <select value={value} onChange={(e) => onChange(e.target.value)} style={{ ...inputSt, paddingLeft: Icon ? 40 : 12, cursor: 'pointer' }}>{children}</select>
    </div>
  );
}
function fOn(e: React.FocusEvent<any>) { e.target.style.borderColor = 'var(--accent)'; }
function fOff(e: React.FocusEvent<any>) { e.target.style.borderColor = 'var(--border)'; }

const ov: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 };
const card: React.CSSProperties = { maxWidth: 520, width: '100%', padding: 0, maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' };
const headerSt: React.CSSProperties = { padding: '16px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 };
const closeBtn: React.CSSProperties = { width: 32, height: 32, background: 'var(--surface-2)', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const iconSt: React.CSSProperties = { position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' };
const inputSt: React.CSSProperties = { width: '100%', height: 46, padding: '0 12px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text)', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' };
const g2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 };
const secBtn: React.CSSProperties = { flex: 1, padding: 13, background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
const priBtn: React.CSSProperties = { flex: 2, padding: 13, color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 };
