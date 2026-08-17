'use client';

import { useState, useEffect, Suspense, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-client';
import Toast from '@/components/Toast';
import { REPAIR_STATUSES, getStatusInfo, type RepairStatus } from '@/lib/repair-constants';
import { sendLinePush } from '@/lib/line-notify';
import { getCategoryShort, getGradeInfo } from '@/lib/parts-constants';
import DeviceModelPicker from '@/components/DeviceModelPicker';

function EditRepairContent() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const jobId = searchParams.get('id');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [job, setJob] = useState<any>(null);
  const [jobParts, setJobParts] = useState<any[]>([]);
  const [statusLog, setStatusLog] = useState<any[]>([]);
  
  // ค้นหา + เพิ่มอะไหล่
  const [allParts, setAllParts] = useState<any[]>([]);
  const [modelsByPart, setModelsByPart] = useState<Record<string, string[]>>({});
  const [showAddPart, setShowAddPart] = useState(false);
  const [selectedModel, setSelectedModel] = useState('');
  const [showAllParts, setShowAllParts] = useState(false);
  const [selectedPartId, setSelectedPartId] = useState('');
  const [partQty, setPartQty] = useState('1');
  const [partUnitPrice, setPartUnitPrice] = useState('');

  // เปลี่ยน status
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [newStatus, setNewStatus] = useState<RepairStatus>('pending');
  const [statusNote, setStatusNote] = useState('');

  // payment
  const [paidInput, setPaidInput] = useState('');

  const [toast, setToast] = useState<{ title: string; msg: string; type: string } | null>(null);

  function showToast(title: string, msg: string, type: 'success' | 'danger' = 'success') {
    setToast({ title, msg, type });
    setTimeout(() => setToast(null), 2500);
  }

  async function load() {
    if (!jobId) {
      router.push('/dashboard/repair');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: p } = await supabase
      .from('profiles').select('*').eq('id', user.id).single();
    setProfile(p);

    const [jobRes, partsRes, logRes, allPartsRes, compatRes] = await Promise.all([
      supabase.from('repair_jobs').select('*').eq('id', jobId).single(),
      supabase.from('repair_job_parts').select('*').eq('job_id', jobId).order('created_at'),
      supabase.from('repair_status_log').select('*').eq('job_id', jobId).order('created_at', { ascending: false }).limit(20),
      supabase.from('parts').select('id, name, phone_model, category, grade, stock_qty, cost_price, sell_price').order('name'),
      supabase.from('part_compatibility').select('part_id, device_models(model_name)'),
    ]);

    if (jobRes.error || !jobRes.data) {
      showToast('ไม่พบใบงาน', '', 'danger');
      setTimeout(() => router.push('/dashboard/repair'), 1000);
      return;
    }

    setJob(jobRes.data);
    setJobParts(partsRes.data || []);
    setStatusLog(logRes.data || []);
    setAllParts(allPartsRes.data || []);
    setPaidInput(String(jobRes.data.paid_amount || 0));

    if (jobRes.data.device_model) {
      const { data: matched } = await supabase.from('device_models').select('model_name').ilike('model_name', jobRes.data.device_model).limit(1);
      if (matched && matched[0]) setSelectedModel(matched[0].model_name);
    }

    const map: Record<string, string[]> = {};
    (compatRes.data || []).forEach((r: any) => {
      const name = r.device_models?.model_name;
      if (!name) return;
      if (!map[r.part_id]) map[r.part_id] = [];
      map[r.part_id].push(name);
    });
    setModelsByPart(map);

    setLoading(false);
  }

  useEffect(() => { load(); }, [jobId]);

  const filteredParts = useMemo(() => {
    if (showAllParts) return allParts.slice(0, 30);
    if (!selectedModel) return [];
    return allParts.filter(p => (modelsByPart[p.id] || []).includes(selectedModel)).slice(0, 30);
  }, [allParts, selectedModel, showAllParts, modelsByPart]);

  async function handleAddPart() {
    if (!selectedPartId || !profile || !job) return;
    
    const qty = parseInt(partQty);
    if (!qty || qty < 1) {
      showToast('จำนวนผิด', '', 'danger');
      return;
    }

    const part = allParts.find(p => p.id === selectedPartId);
    if (!part) return;

    if (part.stock_qty < qty) {
      showToast('สต๊อกไม่พอ', `${part.name} เหลือ ${part.stock_qty} ชิ้น`, 'danger');
      return;
    }

    setSaving(true);
    const unitPrice = parseFloat(partUnitPrice) || Number(part.sell_price);

    const { error } = await supabase.from('repair_job_parts').insert({
      shop_id: profile.shop_id,
      job_id: job.id,
      part_id: part.id,
      part_name: part.name,
      part_phone_model: part.phone_model,
      part_grade: part.grade,
      qty,
      unit_cost: Number(part.cost_price),
      unit_price: unitPrice,
      added_by: profile.id,
      added_by_name: profile.full_name || profile.username,
    });

    if (error) {
      setSaving(false);
      showToast('เพิ่มอะไหล่ไม่สำเร็จ', error.message, 'danger');
      return;
    }

    await supabase.from('parts').update({ stock_qty: Number(part.stock_qty) - qty }).eq('id', part.id);
    await supabase.from('part_transactions').insert({
      shop_id: profile.shop_id, part_id: part.id, type: 'out', qty_change: -qty,
      cost_at_transaction: Number(part.cost_price), reference_type: 'used_in_repair',
      note: `ใช้ในงานซ่อม ${job.job_no}`, done_by: profile.id, done_by_name: profile.full_name || profile.username,
    });

    setSaving(false);
    showToast('เพิ่มอะไหล่แล้ว', `${part.name} × ${qty}`);
    setShowAddPart(false);
    setSelectedPartId('');
    setPartQty('1');
    setPartUnitPrice('');
    await load();
  }

  async function handleRemovePart(partRow: any) {
    if (!confirm(`ลบ "${partRow.part_name}" × ${partRow.qty}?\n\nสต๊อกจะถูกคืนอัตโนมัติ`)) return;
    if (!profile || !job) return;

    const { error } = await supabase
      .from('repair_job_parts').delete().eq('id', partRow.id);

    if (error) {
      showToast('ลบไม่สำเร็จ', error.message, 'danger');
      return;
    }

    if (partRow.part_id) {
      const { data: partNow } = await supabase.from('parts').select('stock_qty').eq('id', partRow.part_id).single();
      if (partNow) {
        await supabase.from('parts').update({ stock_qty: Number(partNow.stock_qty) + Number(partRow.qty || 1) }).eq('id', partRow.part_id);
      }
      await supabase.from('part_transactions').insert({
        shop_id: profile.shop_id, part_id: partRow.part_id, type: 'in', qty_change: Number(partRow.qty || 1),
        cost_at_transaction: Number(partRow.unit_cost || 0), reference_type: 'used_in_repair',
        note: `คืนสต๊อกจากงานซ่อม ${job.job_no}`, done_by: profile.id, done_by_name: profile.full_name || profile.username,
      });
    }

    showToast('ลบอะไหล่แล้ว', 'คืนสต๊อกอัตโนมัติ');
    await load();
  }

  async function handleSaveLabor() {
    if (!job || !profile) return;
    const v = parseFloat(paidInput);
    
    const { error } = await supabase
      .from('repair_jobs')
      .update({ paid_amount: isNaN(v) ? 0 : v })
      .eq('id', job.id);
    
    if (error) {
      showToast('บันทึกไม่สำเร็จ', error.message, 'danger');
      return;
    }
    showToast('บันทึกเงินรับแล้ว', '');
    await load();
  }

  async function handleUpdateLabor(newLabor: number) {
    if (!job || !profile) return;
    
    const { error } = await supabase
      .from('repair_jobs')
      .update({ labor_cost: newLabor })
      .eq('id', job.id);
    
    if (error) {
      showToast('บันทึกไม่สำเร็จ', error.message, 'danger');
      return;
    }
    showToast('อัพเดทค่าแรงแล้ว', '');
    await load();
  }

  async function handleChangeStatus() {
    if (!job || !profile) return;

    setSaving(true);
    
    const updates: any = { status: newStatus };
    if (newStatus === 'done') updates.done_date = new Date().toISOString().split('T')[0];
    if (newStatus === 'delivered') updates.delivered_date = new Date().toISOString().split('T')[0];

    const { error } = await supabase
      .from('repair_jobs')
      .update(updates)
      .eq('id', job.id);

    if (error) {
      showToast('เปลี่ยนสถานะไม่สำเร็จ', error.message, 'danger');
      setSaving(false);
      return;
    }

    // บันทึก status log
    await supabase.from('repair_status_log').insert({
      shop_id: profile.shop_id,
      job_id: job.id,
      from_status: job.status,
      to_status: newStatus,
      note: statusNote || null,
      changed_by: profile.id,
      changed_by_name: profile.full_name || profile.username,
    });

    // LINE notify
    const statusInfo = getStatusInfo(newStatus);
    sendLinePush(
      `🛠️ อัพเดทใบงาน\n\n📋 ${job.job_no}\n📱 ${job.device_brand || ''} ${job.device_model}\n👤 ${job.customer_name}\n\n${statusInfo.icon} ${statusInfo.label}${statusNote ? '\n💬 ' + statusNote : ''}`,
      'sale'
    ).catch(() => {});

    showToast('เปลี่ยนสถานะแล้ว', statusInfo.label);
    setShowStatusModal(false);
    setStatusNote('');
    setSaving(false);
    await load();
  }

  async function handleDelete() {
    if (!job) return;
    if (!confirm(`ลบใบงาน ${job.job_no}?\n\nอะไหล่ที่ใช้จะถูกคืนสต๊อกอัตโนมัติ\nการกระทำนี้ย้อนกลับไม่ได้`)) return;

    const { error } = await supabase.from('repair_jobs').delete().eq('id', job.id);
    if (error) {
      showToast('ลบไม่สำเร็จ', error.message, 'danger');
      return;
    }
    showToast('ลบใบงานแล้ว', '');
    setTimeout(() => router.push('/dashboard/repair'), 600);
  }

  if (loading || !job) {
    return (
      <>
        <div className="page-header"><h1>📋 ใบงานซ่อม</h1></div>
        <div className="skeleton" style={{ height: 300 }}></div>
      </>
    );
  }

  const statusInfo = getStatusInfo(job.status);
  const balance = Number(job.total_price) - Number(job.paid_amount || 0);
  const isAdmin = profile?.role === 'admin';

  return (
    <>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20 }}>{job.job_no}</h1>
          <div className="desc">📱 {job.device_brand} {job.device_model} • 👤 {job.customer_name}</div>
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

      {/* Status Hero */}
      <div style={{
        background: `linear-gradient(135deg, ${statusInfo.color}ee 0%, ${statusInfo.color} 100%)`,
        borderRadius: 'var(--radius)',
        padding: 16,
        marginBottom: 16,
        color: '#fff',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
      }}>
        <div>
          <div style={{ fontSize: 11, opacity: 0.9, marginBottom: 2 }}>สถานะปัจจุบัน</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>
            {statusInfo.icon} {statusInfo.label}
          </div>
        </div>
        <button
          onClick={() => { setNewStatus(job.status); setShowStatusModal(true); }}
          style={{
            padding: '10px 16px',
            background: 'rgba(255,255,255,0.2)',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.4)',
            borderRadius: 6,
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: 13,
            fontWeight: 600,
          }}
        >🔄 เปลี่ยน</button>
      </div>

      {/* Total */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 10,
        marginBottom: 16,
      }}>
        <div style={{
          padding: 14,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
        }}>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>รวมที่ต้องจ่าย</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)' }}>
            ฿{Number(job.total_price).toLocaleString()}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}>
            แรง ฿{Number(job.labor_cost).toLocaleString()} + อะไหล่ ฿{Number(job.parts_cost).toLocaleString()}
          </div>
        </div>
        <div style={{
          padding: 14,
          background: balance > 0 ? 'rgba(239, 68, 68, 0.08)' : 'rgba(16, 185, 129, 0.08)',
          border: `1px solid ${balance > 0 ? '#ef4444' : '#10b981'}`,
          borderRadius: 'var(--radius-sm)',
        }}>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>
            {balance > 0 ? 'ค้างจ่าย' : 'จ่ายครบแล้ว'}
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: balance > 0 ? '#ef4444' : '#10b981' }}>
            ฿{Math.abs(balance).toLocaleString()}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}>
            รับแล้ว ฿{Number(job.paid_amount || 0).toLocaleString()}
          </div>
        </div>
      </div>

      {/* Profit (admin only) */}
      {isAdmin && job.profit > 0 && (
        <div style={{
          padding: 12,
          background: 'rgba(16, 185, 129, 0.08)',
          borderLeft: '3px solid #10b981',
          borderRadius: 6,
          marginBottom: 16,
          fontSize: 13,
        }}>
          💰 <strong>กำไร: ฿{Number(job.profit).toLocaleString()}</strong>
          <span style={{ color: 'var(--text-dim)', marginLeft: 8 }}>
            (ค่าแรง + กำไรอะไหล่ ฿{(Number(job.parts_cost) - Number(job.parts_cost_total)).toLocaleString()})
          </span>
        </div>
      )}

      {/* รายละเอียดลูกค้า + เครื่อง */}
      <div className="form-card">
        <h3>📋 รายละเอียด</h3>
        <InfoRow label="👤 ลูกค้า" value={job.customer_name} />
        {job.customer_phone && <InfoRow label="📞 เบอร์" value={job.customer_phone} copyable />}
        {job.customer_line_id && <InfoRow label="💬 LINE" value={job.customer_line_id} copyable />}
        <InfoRow label="📱 เครื่อง" value={`${job.device_brand || ''} ${job.device_model}${job.device_color ? ' (' + job.device_color + ')' : ''}`} />
        {job.device_imei && <InfoRow label="🔢 IMEI" value={job.device_imei} copyable />}
        {job.device_password && <InfoRow label="🔐 รหัส" value={job.device_password} />}
        {job.device_accessories && <InfoRow label="🎁 ของแถม" value={job.device_accessories} />}
        {job.device_condition_note && <InfoRow label="📝 สภาพรับ" value={job.device_condition_note} />}
        <InfoRow label="⚠️ อาการ" value={job.problem_description} />
        {job.diagnosis && <InfoRow label="🔍 วิเคราะห์" value={job.diagnosis} />}
        {job.solution && <InfoRow label="✅ วิธีแก้" value={job.solution} />}
        <InfoRow label="🕐 วันที่รับ" value={job.received_date} />
        {job.estimated_done_date && <InfoRow label="📅 นัดรับ" value={job.estimated_done_date} />}
        {job.technician_name && <InfoRow label="👨‍🔧 ช่าง" value={job.technician_name} />}
      </div>

      {/* ค่าแรง - แก้ได้ */}
      <div className="form-card" style={{ marginTop: 16 }}>
        <h3>💼 ค่าแรง</h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="number"
            defaultValue={job.labor_cost}
            onBlur={(e) => {
              const v = parseFloat(e.target.value) || 0;
              if (v !== Number(job.labor_cost)) handleUpdateLabor(v);
            }}
            placeholder="0"
            step="0.01"
            style={{
              flex: 1,
              padding: 12,
              fontSize: 16,
              fontWeight: 600,
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              color: 'var(--text)',
              fontFamily: 'inherit',
            }}
          />
          <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>บาท</span>
        </div>
        <small style={{ fontSize: 11, color: 'var(--text-dim)' }}>💡 พิมพ์แล้วกดออกจากช่อง = บันทึกอัตโนมัติ</small>
      </div>

      {/* อะไหล่ที่ใช้ */}
      <div className="form-card" style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>🔧 อะไหล่ที่ใช้ ({jobParts.length})</h3>
          <button
            onClick={() => setShowAddPart(true)}
            style={{
              padding: '6px 12px',
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600,
              fontFamily: 'inherit',
            }}
          >+ เพิ่มอะไหล่</button>
        </div>

        {jobParts.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text-dim)', textAlign: 'center', padding: 20 }}>
            ยังไม่มีอะไหล่ที่ใช้
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {jobParts.map(p => (
              <div key={p.id} style={{
                padding: 10,
                background: 'var(--surface-2)',
                borderRadius: 6,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{p.part_name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
                    {p.part_phone_model}
                    {p.part_grade && ` • ${getGradeInfo(p.part_grade)?.label || p.part_grade}`}
                    {' • '}{p.qty} ชิ้น × ฿{Number(p.unit_price).toLocaleString()}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)' }}>
                    ฿{(p.qty * Number(p.unit_price)).toLocaleString()}
                  </div>
                  <button
                    onClick={() => handleRemovePart(p)}
                    style={{
                      marginTop: 4,
                      background: 'transparent',
                      border: 'none',
                      color: '#ef4444',
                      fontSize: 10,
                      cursor: 'pointer',
                      padding: '2px 6px',
                      fontFamily: 'inherit',
                    }}
                  >🗑️ ลบ</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* การจ่ายเงิน */}
      <div className="form-card" style={{ marginTop: 16 }}>
        <h3>💵 การจ่ายเงิน</h3>
        <div className="form-grid">
          <div className="field">
            <label>ลูกค้าจ่ายแล้ว</label>
            <input
              type="number"
              value={paidInput}
              onChange={(e) => setPaidInput(e.target.value)}
              placeholder="0"
              step="0.01"
              style={{ fontSize: 16, fontWeight: 600 }}
            />
          </div>
          <div className="field">
            <label>&nbsp;</label>
            <button 
              onClick={handleSaveLabor}
              className="btn"
              style={{ width: '100%' }}
            >บันทึก</button>
          </div>
        </div>
      </div>

      {/* Status log */}
      {statusLog.length > 0 && (
        <div className="form-card" style={{ marginTop: 16 }}>
          <h3>📜 ประวัติสถานะ</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {statusLog.map(log => {
              const toInfo = getStatusInfo(log.to_status);
              return (
                <div key={log.id} style={{
                  padding: 10,
                  background: 'var(--surface-2)',
                  borderRadius: 6,
                  fontSize: 12,
                }}>
                  <div style={{ fontWeight: 600, color: toInfo.color }}>
                    {toInfo.icon} {toInfo.label}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>
                    {new Date(log.created_at).toLocaleString('th-TH')}
                    {log.changed_by_name && ` • ${log.changed_by_name}`}
                  </div>
                  {log.note && (
                    <div style={{ fontSize: 11, marginTop: 4, fontStyle: 'italic' }}>
                      "{log.note}"
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Delete */}
      {isAdmin && (
        <div style={{ marginTop: 20, padding: 14, background: 'rgba(239, 68, 68, 0.06)', borderRadius: 6 }}>
          <button
            onClick={handleDelete}
            style={{
              width: '100%',
              padding: 10,
              background: 'transparent',
              color: '#ef4444',
              border: '1px solid #ef4444',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
              fontFamily: 'inherit',
            }}
          >🗑️ ลบใบงานนี้</button>
        </div>
      )}

      {/* Modal: Add Part */}
      {showAddPart && (
        <div className="modal-overlay" onClick={() => setShowAddPart(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480, maxHeight: '90vh', overflow: 'auto' }}>
            <h3>+ เพิ่มอะไหล่</h3>
            
            <div className="field full" style={{ marginTop: 14 }}>
              <label>รุ่นเครื่อง</label>
              <DeviceModelPicker value={selectedModel} onChange={(v) => { setSelectedModel(v); setShowAllParts(false); }} />
            </div>

            <div style={{
              maxHeight: 240,
              overflow: 'auto',
              border: '1px solid var(--border)',
              borderRadius: 6,
              marginBottom: 6,
            }}>
              {!selectedModel && !showAllParts ? (
                <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-dim)', fontSize: 12 }}>
                  เลือกรุ่นเครื่องด้านบนเพื่อดูอะไหล่ที่ใช้ได้
                </div>
              ) : filteredParts.length === 0 ? (
                <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-dim)', fontSize: 12 }}>
                  ไม่มีอะไหล่ที่ผูกกับรุ่นนี้ (หรือสต๊อกหมด)
                </div>
              ) : (
                filteredParts.map(p => (
                  <div
                    key={p.id}
                    onClick={() => {
                      if (p.stock_qty < 1) return;
                      setSelectedPartId(p.id);
                      setPartUnitPrice(String(p.sell_price));
                    }}
                    style={{
                      padding: 10,
                      borderBottom: '1px solid var(--border)',
                      cursor: p.stock_qty < 1 ? 'not-allowed' : 'pointer',
                      background: selectedPartId === p.id ? 'rgba(59, 130, 246, 0.1)' : undefined,
                      opacity: p.stock_qty < 1 ? 0.5 : 1,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
                          {(modelsByPart[p.id]?.join(' / ')) || p.phone_model} • {getCategoryShort(p.category)}
                          {p.grade && ` • ${getGradeInfo(p.grade)?.label}`}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ 
                          fontSize: 13, 
                          fontWeight: 700, 
                          color: p.stock_qty <= 0 ? '#ef4444' : p.stock_qty <= 2 ? '#f59e0b' : 'var(--text)',
                        }}>
                          {p.stock_qty} ชิ้น
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--accent)' }}>
                          ฿{Number(p.sell_price).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {selectedModel && !showAllParts && (
              <button
                type="button"
                onClick={() => setShowAllParts(true)}
                style={{ marginBottom: 14, background: 'transparent', border: 'none', color: 'var(--accent)', fontSize: 12, cursor: 'pointer', padding: 0 }}
              >ดูอะไหล่ทั้งหมด (ไม่กรองตามรุ่น)</button>
            )}

            {selectedPartId && (
              <div className="form-grid">
                <div className="field">
                  <label>จำนวน</label>
                  <input
                    type="number"
                    value={partQty}
                    onChange={(e) => setPartQty(e.target.value)}
                    min="1"
                    style={{ fontSize: 16, textAlign: 'center' }}
                  />
                </div>
                <div className="field">
                  <label>ราคาขาย/ชิ้น</label>
                  <input
                    type="number"
                    value={partUnitPrice}
                    onChange={(e) => setPartUnitPrice(e.target.value)}
                    step="0.01"
                    style={{ fontSize: 16 }}
                  />
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button 
                onClick={() => setShowAddPart(false)}
                disabled={saving}
                className="btn btn-sec"
              >ยกเลิก</button>
              <button 
                onClick={handleAddPart}
                disabled={!selectedPartId || saving}
                className="btn"
              >{saving ? 'กำลังบันทึก...' : 'เพิ่ม'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Change Status */}
      {showStatusModal && (
        <div className="modal-overlay" onClick={() => setShowStatusModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <h3>🔄 เปลี่ยนสถานะ</h3>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 14 }}>
              {job.job_no} • {job.customer_name}
            </div>

            <div className="field full">
              <label>สถานะใหม่</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
                {REPAIR_STATUSES.map(s => (
                  <button
                    key={s.id}
                    onClick={() => setNewStatus(s.id)}
                    style={{
                      padding: 12,
                      background: newStatus === s.id ? s.color : 'var(--surface-2)',
                      color: newStatus === s.id ? '#fff' : 'var(--text)',
                      border: 'none',
                      borderRadius: 6,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      fontSize: 13,
                      fontWeight: 600,
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <span>{s.icon}</span>
                    <span>{s.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="field full" style={{ marginTop: 12 }}>
              <label>หมายเหตุ (optional)</label>
              <textarea
                value={statusNote}
                onChange={(e) => setStatusNote(e.target.value)}
                placeholder="เช่น เปลี่ยนจอแล้ว, รออะไหล่จากซัพ"
                rows={2}
                style={{ resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button onClick={() => setShowStatusModal(false)} className="btn btn-sec" disabled={saving}>ยกเลิก</button>
              <button onClick={handleChangeStatus} className="btn" disabled={saving}>
                {saving ? 'กำลังบันทึก...' : 'ยืนยัน'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast {...toast} />}
    </>
  );
}

function InfoRow({ label, value, copyable }: { label: string; value: string; copyable?: boolean }) {
  function copy() {
    navigator.clipboard.writeText(value);
  }
  return (
    <div style={{
      display: 'flex',
      gap: 10,
      padding: '8px 0',
      borderBottom: '1px solid var(--border)',
      fontSize: 13,
    }}>
      <div style={{ flex: '0 0 100px', color: 'var(--text-dim)', fontSize: 12 }}>{label}</div>
      <div style={{ flex: 1, fontWeight: 500 }}>{value}</div>
      {copyable && (
        <button
          onClick={copy}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--accent)',
            cursor: 'pointer',
            fontSize: 11,
            padding: '2px 6px',
          }}
        >📋</button>
      )}
    </div>
  );
}

export default function EditRepairPage() {
  return (
    <Suspense fallback={<div className="loading"><div className="spinner"></div></div>}>
      <EditRepairContent />
    </Suspense>
  );
}
