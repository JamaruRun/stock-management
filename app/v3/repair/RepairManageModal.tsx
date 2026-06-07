'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase-client';
import { sendLinePush } from '@/lib/line-notify';
import { REPAIR_STATUSES, getStatusInfo } from '@/lib/repair-constants';
import {
  Wrench, X, Smartphone, User, Phone, Search, Plus, Minus, Trash2,
  DollarSign, Loader2, CheckCircle2, AlertCircle, RefreshCw, History, Package2,
} from 'lucide-react';

interface Props { jobId: string; onClose: () => void; onChanged: () => void; }

export default function RepairManageModal({ jobId, onClose, onChanged }: Props) {
  const supabase = createClient();
  const [profile, setProfile] = useState<any>(null);
  const [job, setJob] = useState<any>(null);
  const [jobParts, setJobParts] = useState<any[]>([]);
  const [statusLog, setStatusLog] = useState<any[]>([]);
  const [allParts, setAllParts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const [statusNote, setStatusNote] = useState('');
  const [showStatusPick, setShowStatusPick] = useState(false);
  const [searchPart, setSearchPart] = useState('');
  const [showAddPart, setShowAddPart] = useState(false);
  const [laborInput, setLaborInput] = useState('');
  const [paidInput, setPaidInput] = useState('');
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  function notify(msg: string, ok = true) { setToast({ msg, ok }); setTimeout(() => setToast(null), 2400); }

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    setProfile(p);
    const [jobRes, partsRes, logRes, allPartsRes] = await Promise.all([
      supabase.from('repair_jobs').select('*').eq('id', jobId).single(),
      supabase.from('repair_job_parts').select('*').eq('job_id', jobId).order('created_at'),
      supabase.from('repair_status_log').select('*').eq('job_id', jobId).order('created_at', { ascending: false }).limit(12),
      supabase.from('parts').select('id, name, phone_model, grade, stock_qty, cost_price, sell_price').order('name'),
    ]);
    if (jobRes.data) {
      setJob(jobRes.data);
      setLaborInput(String(jobRes.data.labor_cost || 0));
      setPaidInput(String(jobRes.data.paid_amount || 0));
    }
    setJobParts(partsRes.data || []);
    setStatusLog(logRes.data || []);
    setAllParts(allPartsRes.data || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, [jobId]);

  function closeWithRefresh() { if (dirty) onChanged(); else onClose(); }

  const filteredParts = useMemo(() => {
    const q = searchPart.trim().toLowerCase();
    const list = !q ? allParts : allParts.filter(p => p.name.toLowerCase().includes(q) || (p.phone_model || '').toLowerCase().includes(q));
    return list.filter(p => p.stock_qty > 0).slice(0, 12);
  }, [allParts, searchPart]);

  async function changeStatus(newStatus: string) {
    if (!job || !profile) return;
    setSaving(true);
    const updates: any = { status: newStatus };
    if (newStatus === 'done') updates.done_date = new Date().toISOString().split('T')[0];
    if (newStatus === 'delivered') updates.delivered_date = new Date().toISOString().split('T')[0];
    const { error } = await supabase.from('repair_jobs').update(updates).eq('id', job.id);
    if (error) { notify('เปลี่ยนสถานะไม่สำเร็จ', false); setSaving(false); return; }
    await supabase.from('repair_status_log').insert({
      shop_id: profile.shop_id, job_id: job.id, from_status: job.status, to_status: newStatus,
      note: statusNote || null, changed_by: profile.id, changed_by_name: profile.full_name || profile.username,
    });
    const info = getStatusInfo(newStatus);
    sendLinePush(`🛠️ อัพเดทใบงาน\n\n📋 ${job.job_no}\n📱 ${job.device_brand || ''} ${job.device_model}\n👤 ${job.customer_name}\n\n${info.icon} ${info.label}${statusNote ? '\n💬 ' + statusNote : ''}`, 'sale').catch(() => {});
    setSaving(false); setShowStatusPick(false); setStatusNote(''); setDirty(true);
    notify('เปลี่ยนสถานะ: ' + info.label);
    await load();
  }

  async function addPart(part: any) {
    if (!job || !profile) return;
    if (part.stock_qty < 1) { notify('สต๊อกหมด', false); return; }
    setSaving(true);
    const { error } = await supabase.from('repair_job_parts').insert({
      shop_id: profile.shop_id, job_id: job.id, part_id: part.id, part_name: part.name,
      part_phone_model: part.phone_model, part_grade: part.grade, qty: 1,
      unit_cost: Number(part.cost_price), unit_price: Number(part.sell_price),
      added_by: profile.id, added_by_name: profile.full_name || profile.username,
    });
    setSaving(false);
    if (error) { notify('เพิ่มอะไหล่ไม่สำเร็จ', false); return; }
    setDirty(true); setSearchPart(''); setShowAddPart(false);
    notify('เพิ่ม: ' + part.name);
    await load();
  }

  async function removePart(row: any) {
    if (!confirm(`ลบ "${row.part_name}" × ${row.qty}? (คืนสต๊อกอัตโนมัติ)`)) return;
    const { error } = await supabase.from('repair_job_parts').delete().eq('id', row.id);
    if (error) { notify('ลบไม่สำเร็จ', false); return; }
    setDirty(true); notify('ลบอะไหล่แล้ว'); await load();
  }

  async function saveLabor() {
    if (!job) return;
    const v = parseFloat(laborInput) || 0;
    if (v === Number(job.labor_cost)) return;
    const { error } = await supabase.from('repair_jobs').update({ labor_cost: v }).eq('id', job.id);
    if (error) { notify('บันทึกค่าแรงไม่สำเร็จ', false); return; }
    setDirty(true); notify('อัพเดทค่าแรงแล้ว'); await load();
  }
  async function savePaid() {
    if (!job) return;
    const v = parseFloat(paidInput) || 0;
    if (v === Number(job.paid_amount)) return;
    const { error } = await supabase.from('repair_jobs').update({ paid_amount: v }).eq('id', job.id);
    if (error) { notify('บันทึกเงินรับไม่สำเร็จ', false); return; }
    setDirty(true); notify('บันทึกเงินรับแล้ว'); await load();
  }

  const statusInfo = job ? getStatusInfo(job.status) : null;
  const balance = job ? Number(job.total_price) - Number(job.paid_amount || 0) : 0;

  return (
    <div onClick={closeWithRefresh} style={ov}>
      <div onClick={(e) => e.stopPropagation()} className="v3-card" style={{ maxWidth: 520, width: '100%', padding: 0, height: '90vh', maxHeight: 760, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {loading || !job ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-dim)' }}><Loader2 size={24} className="v3-spin" /></div>
        ) : (
          <>
            {/* Header */}
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'monospace' }}>{job.job_no}</div>
                <h2 style={{ fontSize: 15, fontWeight: 700, fontFamily: 'Prompt, sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.device_brand} {job.device_model}</h2>
                <div style={{ fontSize: 11, color: 'var(--text-dim)' }}><User size={10} style={{ display: 'inline', verticalAlign: '-1px' }} /> {job.customer_name}{job.customer_phone && <a href={`tel:${job.customer_phone}`} style={{ marginLeft: 8, color: '#16a34a' }}><Phone size={10} style={{ display: 'inline', verticalAlign: '-1px' }} /> โทร</a>}</div>
              </div>
              <button onClick={closeWithRefresh} style={closeBtn}><X size={16} /></button>
            </div>

            <div style={{ overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* สถานะ */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <SectionLabel Icon={RefreshCw} label="สถานะงาน" />
                  <button onClick={() => setShowStatusPick(!showStatusPick)} style={miniBtn}>เปลี่ยนสถานะ</button>
                </div>
                <div style={{ padding: '10px 14px', borderRadius: 10, background: `${statusInfo!.color}18`, color: statusInfo!.color, fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>{statusInfo!.icon}</span> {statusInfo!.label}
                </div>
                {showStatusPick && (
                  <div style={{ marginTop: 10, padding: 12, background: 'var(--surface-2)', borderRadius: 10 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                      {REPAIR_STATUSES.map(s => (
                        <button key={s.id} onClick={() => changeStatus(s.id)} disabled={saving || s.id === job.status} style={{
                          padding: '7px 11px', borderRadius: 100, fontSize: 12, fontWeight: 600, cursor: s.id === job.status ? 'default' : 'pointer',
                          border: `1px solid ${s.id === job.status ? s.color : 'var(--border)'}`,
                          background: s.id === job.status ? s.color : 'var(--surface)', color: s.id === job.status ? '#fff' : 'var(--text)', fontFamily: 'inherit',
                          opacity: s.id === job.status ? 0.6 : 1,
                        }}>{s.icon} {s.label}</button>
                      ))}
                    </div>
                    <input value={statusNote} onChange={(e) => setStatusNote(e.target.value)} placeholder="โน้ต (ไม่บังคับ) — แตะสถานะด้านบนเพื่อบันทึก" style={inputSt} onFocus={fOn} onBlur={fOff} />
                  </div>
                )}
              </div>

              {/* อะไหล่ */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <SectionLabel Icon={Package2} label={`อะไหล่ในงาน (${jobParts.length})`} />
                  <button onClick={() => setShowAddPart(!showAddPart)} style={miniBtn}><Plus size={12} /> เพิ่มอะไหล่</button>
                </div>
                {showAddPart && (
                  <div style={{ marginBottom: 10, padding: 12, background: 'var(--surface-2)', borderRadius: 10 }}>
                    <div style={{ position: 'relative', marginBottom: 8 }}>
                      <Search size={15} style={iconSt} />
                      <input value={searchPart} onChange={(e) => setSearchPart(e.target.value)} placeholder="ค้นหาอะไหล่..." style={{ ...inputSt, paddingLeft: 38 }} onFocus={fOn} onBlur={fOff} />
                    </div>
                    <div style={{ maxHeight: 160, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {filteredParts.length === 0 ? (
                        <div style={{ padding: 12, textAlign: 'center', fontSize: 12, color: 'var(--text-dim)' }}>ไม่พบอะไหล่ (หรือสต๊อกหมด)</div>
                      ) : filteredParts.map(p => (
                        <button key={p.id} onClick={() => addPart(p)} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                          <Wrench size={14} style={{ color: '#ec4899', flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{p.phone_model} · เหลือ {p.stock_qty}</div>
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#16a34a' }}>฿{Number(p.sell_price).toLocaleString()}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {jobParts.length === 0 ? (
                  <div style={{ padding: 12, textAlign: 'center', fontSize: 12, color: 'var(--text-dim)', background: 'var(--surface-2)', borderRadius: 10 }}>ยังไม่มีอะไหล่ในงานนี้</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {jobParts.map(row => (
                      <div key={row.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, background: 'var(--surface-2)', borderRadius: 10 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.part_name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>฿{Number(row.unit_price).toLocaleString()} × {row.qty} = ฿{(Number(row.unit_price) * row.qty).toLocaleString()}</div>
                        </div>
                        <button onClick={() => removePart(row)} style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}><Trash2 size={14} /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* เงิน */}
              <div>
                <SectionLabel Icon={DollarSign} label="ค่าใช้จ่าย" />
                <div style={{ background: 'var(--surface-2)', borderRadius: 12, padding: 12, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>ค่าแรง (฿)</span>
                    <input type="number" inputMode="decimal" value={laborInput} onChange={(e) => setLaborInput(e.target.value)} onBlur={saveLabor} style={{ ...inputSt, width: 120, height: 38, textAlign: 'right' }} onFocus={fOn} />
                  </div>
                  <Row label="ค่าอะไหล่ (อัตโนมัติ)" value={`฿${Number(job.parts_cost || 0).toLocaleString()}`} />
                  <div style={{ borderTop: '1px dashed var(--border)', paddingTop: 8, display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 14, fontWeight: 700 }}>ยอดรวม</span>
                    <span style={{ fontSize: 18, fontWeight: 800, fontFamily: 'Prompt, sans-serif', color: '#3b82f6' }}>฿{Number(job.total_price).toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>รับเงินมาแล้ว (฿)</span>
                    <input type="number" inputMode="decimal" value={paidInput} onChange={(e) => setPaidInput(e.target.value)} onBlur={savePaid} style={{ ...inputSt, width: 120, height: 38, textAlign: 'right' }} onFocus={fOn} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>คงเหลือ</span>
                    <span style={{ fontSize: 15, fontWeight: 800, fontFamily: 'Prompt, sans-serif', color: balance > 0 ? '#ef4444' : '#16a34a' }}>฿{balance.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* timeline */}
              {statusLog.length > 0 && (
                <div>
                  <SectionLabel Icon={History} label="ประวัติสถานะ" />
                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {statusLog.map(log => {
                      const to = getStatusInfo(log.to_status);
                      return (
                        <div key={log.id} style={{ display: 'flex', gap: 8, fontSize: 11, color: 'var(--text-dim)', alignItems: 'baseline' }}>
                          <span style={{ color: to.color, fontWeight: 600 }}>{to.icon} {to.label}</span>
                          <span style={{ flex: 1 }}>{log.note || ''}</span>
                          <span>{new Date(log.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
      {toast && (
        <div style={{ position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)', background: toast.ok ? '#16a34a' : '#dc2626', color: '#fff', padding: '12px 20px', borderRadius: 12, fontSize: 13, fontWeight: 600, boxShadow: '0 8px 24px rgba(0,0,0,0.2)', zIndex: 300, maxWidth: '90vw', display: 'flex', alignItems: 'center', gap: 8 }}>
          {toast.ok ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />} {toast.msg}
        </div>
      )}
    </div>
  );
}

function SectionLabel({ Icon, label }: any) {
  return <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--text)' }}><Icon size={14} style={{ color: 'var(--text-dim)' }} /> {label}</div>;
}
function Row({ label, value }: any) {
  return <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><span style={{ color: 'var(--text-dim)' }}>{label}</span><span style={{ fontWeight: 600 }}>{value}</span></div>;
}
function fOn(e: React.FocusEvent<any>) { e.target.style.borderColor = 'var(--accent)'; }
function fOff(e: React.FocusEvent<any>) { e.target.style.borderColor = 'var(--border)'; }

const ov: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 };
const closeBtn: React.CSSProperties = { width: 32, height: 32, background: 'var(--surface-2)', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 };
const iconSt: React.CSSProperties = { position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' };
const inputSt: React.CSSProperties = { width: '100%', height: 42, padding: '0 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' };
const miniBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 10px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
