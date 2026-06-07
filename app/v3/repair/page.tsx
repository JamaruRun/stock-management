'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-client';
import { REPAIR_STATUSES, getStatusInfo, type RepairStatus } from '@/lib/repair-constants';
import RepairNewModal from './RepairNewModal';
import RepairManageModal from './RepairManageModal';
import {
  Plus, Search, Hammer, Smartphone, X, MoreVertical,
  Clock, Wrench, Package, CheckCircle2, Truck, Ban,
  Eye, Edit2, Phone, Calendar, User, FileText,
  ChevronDown, ArrowRight,
} from 'lucide-react';

interface RepairJob {
  id: string;
  job_no: string;
  customer_name: string;
  customer_phone?: string | null;
  device_brand?: string | null;
  device_model: string;
  problem_description?: string | null;
  status: string;
  estimated_done_date?: string | null;
  total_price?: number | null;
  paid_amount?: number | null;
  technician_id?: string | null;
  created_at?: string;
  branch_id?: string | null;
  branches?: any;
}

const STATUS_ICONS: Record<string, any> = {
  pending: Clock,
  in_progress: Wrench,
  waiting_parts: Package,
  done: CheckCircle2,
  delivered: Truck,
  cancelled: Ban,
};

export default function V3RepairPage() {
  const supabase = createClient();
  const [jobs, setJobs] = useState<RepairJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [search, setSearch] = useState('');
  const [activeStatus, setActiveStatus] = useState<string>('all');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [manageId, setManageId] = useState<string | null>(null);

  async function load() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, is_super_admin')
        .eq('id', user.id)
        .single();
      setIsAdmin(profile?.role === 'admin' || profile?.is_super_admin);

      const { data } = await supabase
        .from('repair_jobs')
        .select('*, branches(name)')
        .order('created_at', { ascending: false });

      setJobs((data || []) as RepairJob[]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  // Status counts
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: jobs.length };
    REPAIR_STATUSES.forEach(s => {
      counts[s.id] = jobs.filter(j => j.status === s.id).length;
    });
    return counts;
  }, [jobs]);

  // Active jobs (ไม่นับ done, delivered, cancelled)
  const activeJobs = useMemo(() => {
    return jobs.filter(j =>
      j.status !== 'done' && j.status !== 'delivered' && j.status !== 'cancelled'
    ).length;
  }, [jobs]);

  // Total value
  const totalValue = useMemo(() => {
    return jobs
      .filter(j => j.status !== 'cancelled')
      .reduce((s, j) => s + Number(j.total_price || 0), 0);
  }, [jobs]);

  // Filtered
  const filtered = useMemo(() => {
    return jobs.filter(j => {
      if (activeStatus !== 'all' && j.status !== activeStatus) return false;
      if (search) {
        const s = search.toLowerCase();
        const hit =
          j.job_no.toLowerCase().includes(s) ||
          j.customer_name.toLowerCase().includes(s) ||
          (j.customer_phone && j.customer_phone.toLowerCase().includes(s)) ||
          j.device_model.toLowerCase().includes(s) ||
          (j.problem_description && j.problem_description.toLowerCase().includes(s));
        if (!hit) return false;
      }
      return true;
    });
  }, [jobs, activeStatus, search]);

  async function handleDelete(job: RepairJob) {
    if (!confirm(`ยกเลิกใบงาน ${job.job_no}?`)) return;
    const { error } = await supabase
      .from('repair_jobs')
      .update({ status: 'cancelled' })
      .eq('id', job.id);
    if (error) { alert('ไม่สำเร็จ: ' + error.message); return; }
    setMenuOpenId(null);
    load();
  }

  return (
    <>
      {/* Desktop Header */}
      <div className="v3-page-header v3-desktop-only">
        <div>
          <h1 className="v3-page-title">ใบงานซ่อม</h1>
          <p className="v3-page-subtitle">งานซ่อมทั้งหมด {jobs.length} ใบ · งานค้าง {activeJobs} ใบ</p>
        </div>
        <button onClick={() => setShowNew(true)} className="v3-btn v3-btn-primary" style={{ border: 'none', cursor: 'pointer' }}>
          <Plus size={16} strokeWidth={2.5} /> รับงานซ่อมใหม่
        </button>
      </div>

      {/* Mobile mini-header */}
      <div className="v3-mobile-only" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
      }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, fontFamily: 'Prompt, sans-serif' }}>
            ใบงานซ่อม
          </h1>
          <p style={{ fontSize: 11, color: 'var(--text-dim)' }}>
            {jobs.length} ใบ · ค้าง {activeJobs} ใบ
          </p>
        </div>
        <button onClick={() => setShowNew(true)} style={{
          width: 40, height: 40,
          borderRadius: 10,
          background: 'var(--accent)',
          color: '#fff',
          border: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
        }}>
          <Plus size={20} strokeWidth={2.5} />
        </button>
      </div>

      {/* Purple Hero Summary - เป๊ะ ref */}
      <div style={{
        background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
        borderRadius: 18,
        padding: 18,
        marginBottom: 14,
        color: '#fff',
        boxShadow: '0 8px 24px rgba(124, 58, 237, 0.25)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 4 }}>สรุปงานซ่อม</div>
            <div style={{
              fontSize: 30, fontWeight: 800,
              fontFamily: 'Prompt, sans-serif',
              letterSpacing: '-0.5px',
              lineHeight: 1,
            }}>
              {activeJobs} <span style={{ fontSize: 14, fontWeight: 500, opacity: 0.9 }}>ใบ</span>
            </div>
            <div style={{ fontSize: 11, opacity: 0.85, marginTop: 4 }}>งานค้างทั้งหมด</div>
          </div>
          {isAdmin && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, opacity: 0.85 }}>มูลค่ารวม</div>
              <div style={{
                fontSize: 22, fontWeight: 800,
                fontFamily: 'Prompt, sans-serif',
              }}>
                ฿{totalValue.toLocaleString()}
              </div>
            </div>
          )}
        </div>

        {/* Status mini chips */}
        <div className="v3-status-strip" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 8,
        }}>
          {[
            { id: 'pending', Icon: Clock },
            { id: 'in_progress', Icon: Wrench },
            { id: 'done', Icon: CheckCircle2 },
            { id: 'delivered', Icon: Truck },
          ].map(({ id, Icon }) => {
            const info = getStatusInfo(id);
            const count = statusCounts[id] || 0;
            return (
              <div key={id} style={{
                background: 'rgba(255,255,255,0.18)',
                backdropFilter: 'blur(10px)',
                borderRadius: 12,
                padding: '8px 10px',
                border: '1px solid rgba(255,255,255,0.1)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                  <Icon size={12} />
                  <span style={{ fontSize: 10, opacity: 0.9 }}>{info.label}</span>
                </div>
                <div style={{
                  fontSize: 18, fontWeight: 800,
                  fontFamily: 'Prompt, sans-serif',
                }}>{count}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Search + Status Tabs */}
      <div className="v3-card" style={{ marginBottom: 12, padding: 10 }}>
        <div style={{ position: 'relative', marginBottom: 10 }}>
          <Search size={16} style={{
            position: 'absolute', left: 12, top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--text-muted)', pointerEvents: 'none',
          }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหา เลขใบงาน / ลูกค้า / เบอร์ / รุ่นเครื่อง..."
            style={{
              width: '100%',
              height: 38,
              padding: '0 12px 0 36px',
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              color: 'var(--text)',
              fontSize: 13,
              fontFamily: 'inherit',
              outline: 'none',
            }}
          />
        </div>

        {/* Status tabs */}
        <div style={{
          display: 'flex',
          gap: 6,
          overflowX: 'auto',
          paddingBottom: 4,
          scrollbarWidth: 'none',
        }}>
          <StatusTab
            active={activeStatus === 'all'}
            onClick={() => setActiveStatus('all')}
            label="ทั้งหมด"
            count={statusCounts.all}
          />
          {REPAIR_STATUSES.map(s => (
            <StatusTab
              key={s.id}
              active={activeStatus === s.id}
              onClick={() => setActiveStatus(s.id)}
              label={s.label}
              count={statusCounts[s.id] || 0}
              color={s.color}
            />
          ))}
        </div>
      </div>

      {/* Jobs List */}
      {loading ? (
        <div className="v3-card" style={{ textAlign: 'center', padding: 40, color: 'var(--text-dim)' }}>
          กำลังโหลด...
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState search={search} activeStatus={activeStatus} onNew={() => setShowNew(true)} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(job => (
            <JobCard
              key={job.id}
              job={job}
              isAdmin={isAdmin}
              menuOpen={menuOpenId === job.id}
              onToggleMenu={() => setMenuOpenId(menuOpenId === job.id ? null : job.id)}
              onClose={() => setMenuOpenId(null)}
              onDelete={() => handleDelete(job)}
              onManage={() => { setMenuOpenId(null); setManageId(job.id); }}
            />
          ))}
        </div>
      )}

      {showNew && (
        <RepairNewModal onClose={() => setShowNew(false)} onSuccess={() => { setShowNew(false); load(); }} />
      )}
      {manageId && (
        <RepairManageModal jobId={manageId} onClose={() => setManageId(null)} onChanged={() => { setManageId(null); load(); }} />
      )}
    </>
  );
}

/* =========================================================
   Components
========================================================= */

function StatusTab({ active, onClick, label, count, color }: any) {
  return (
    <button
      onClick={onClick}
      style={{
        flexShrink: 0,
        padding: '7px 12px',
        borderRadius: 100,
        border: '1px solid',
        borderColor: active ? (color || 'var(--accent)') : 'var(--border)',
        background: active ? (color || 'var(--accent)') : 'var(--surface)',
        color: active ? '#fff' : 'var(--text)',
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
        fontFamily: 'inherit',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
      <span style={{
        background: active ? 'rgba(255,255,255,0.25)' : 'var(--surface-2)',
        padding: '1px 7px',
        borderRadius: 100,
        fontSize: 10,
        fontWeight: 700,
      }}>
        {count}
      </span>
    </button>
  );
}

function JobCard({ job, isAdmin, menuOpen, onToggleMenu, onClose, onDelete, onManage }: any) {
  const info = getStatusInfo(job.status);
  const StatusIcon = STATUS_ICONS[job.status] || Hammer;
  const balance = Number(job.total_price || 0) - Number(job.paid_amount || 0);
  const isOverdue = job.estimated_done_date && new Date(job.estimated_done_date) < new Date() && 
    job.status !== 'done' && job.status !== 'delivered' && job.status !== 'cancelled';

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderLeft: `4px solid ${info.color}`,
      borderRadius: 14,
      padding: 14,
      position: 'relative',
    }}>
      <div style={{ display: 'flex', gap: 12 }}>
        {/* Phone icon */}
        <div style={{
          width: 48, height: 60,
          background: '#f8fafc',
          borderRadius: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Smartphone size={20} color="#94a3b8" strokeWidth={1.5} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Top row: job_no + status badge + menu */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 4 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{
                fontSize: 14, fontWeight: 700,
                fontFamily: 'Prompt, Sarabun, sans-serif',
                color: 'var(--text)',
              }}>
                {job.job_no}
              </div>
              {job.estimated_done_date && (
                <div style={{
                  fontSize: 10,
                  color: isOverdue ? '#ef4444' : 'var(--text-muted)',
                  marginTop: 2,
                  fontWeight: isOverdue ? 600 : 400,
                }}>
                  <Calendar size={10} style={{ display: 'inline', marginRight: 3, verticalAlign: '-1px' }} />
                  {isOverdue ? 'เกินกำหนด ' : 'กำหนด '}
                  {new Date(job.estimated_done_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <span style={{
                padding: '4px 10px',
                fontSize: 10,
                fontWeight: 700,
                borderRadius: 100,
                background: `${info.color}20`,
                color: info.color,
                whiteSpace: 'nowrap',
              }}>
                <StatusIcon size={10} style={{ display: 'inline', marginRight: 4, verticalAlign: '-1px' }} />
                {info.label}
              </span>
              <div style={{ position: 'relative' }}>
                <button
                  onClick={(e) => { e.stopPropagation(); onToggleMenu(); }}
                  style={{
                    width: 28, height: 28,
                    background: 'transparent',
                    border: 'none',
                    borderRadius: 6,
                    cursor: 'pointer',
                    color: 'var(--text-dim)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <MoreVertical size={14} />
                </button>
                {menuOpen && (
                  <>
                    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 19 }} />
                    <div style={{
                      position: 'absolute',
                      top: 30, right: 0,
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 10,
                      boxShadow: 'var(--shadow-lg)',
                      minWidth: 140,
                      padding: 4,
                      zIndex: 20,
                    }}>
                      <button onClick={onManage} style={{ ...menuLinkStyle, border: 'none', background: 'transparent', width: '100%', fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer' }}>
                        <Eye size={14} /> ดู / จัดการงาน
                      </button>
                      {job.customer_phone && (
                        <a href={`tel:${job.customer_phone}`} style={menuLinkStyle}>
                          <Phone size={14} /> โทรหาลูกค้า
                        </a>
                      )}
                      {job.status !== 'cancelled' && (
                        <button onClick={onDelete} style={{ ...menuLinkStyle, color: 'var(--danger)', border: 'none', background: 'transparent', width: '100%', fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer' }}>
                          <Ban size={14} /> ยกเลิกงาน
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Customer info */}
          <div style={{ fontSize: 12, color: 'var(--text)', marginBottom: 2 }}>
            <User size={11} style={{ display: 'inline', marginRight: 4, verticalAlign: '-1px', color: 'var(--text-muted)' }} />
            {job.customer_name}
            {job.customer_phone && (
              <span style={{ color: 'var(--text-dim)', marginLeft: 8 }}>
                {job.customer_phone}
              </span>
            )}
          </div>

          {/* Device */}
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 4 }}>
            <Smartphone size={11} style={{ display: 'inline', marginRight: 4, verticalAlign: '-1px' }} />
            {job.device_brand} {job.device_model}
          </div>

          {/* Problem */}
          {job.problem_description && (
            <div style={{
              fontSize: 11,
              color: 'var(--text-dim)',
              background: 'var(--surface-2)',
              padding: '6px 10px',
              borderRadius: 8,
              marginTop: 6,
              borderLeft: '2px solid #f59e0b',
            }}>
              <FileText size={10} style={{ display: 'inline', marginRight: 4, verticalAlign: '-1px' }} />
              {job.problem_description}
            </div>
          )}

          {/* Price */}
          {isAdmin && Number(job.total_price) > 0 && (
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 10,
              paddingTop: 10,
              borderTop: '1px solid var(--border)',
            }}>
              <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                ยอดรวม
                <span style={{
                  marginLeft: 6,
                  fontSize: 14, fontWeight: 700,
                  color: 'var(--text)',
                  fontFamily: 'Prompt, sans-serif',
                }}>
                  ฿{Number(job.total_price).toLocaleString()}
                </span>
              </div>
              {balance > 0 && job.status !== 'cancelled' && (
                <div style={{ fontSize: 11, color: '#ef4444', fontWeight: 600 }}>
                  ค้างชำระ ฿{balance.toLocaleString()}
                </div>
              )}
              {balance <= 0 && Number(job.total_price) > 0 && (
                <span style={{
                  fontSize: 10,
                  padding: '2px 8px',
                  background: '#dcfce7',
                  color: '#166534',
                  borderRadius: 100,
                  fontWeight: 600,
                }}>
                  ชำระครบ
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ search, activeStatus, onNew }: any) {
  const isFiltered = search || activeStatus !== 'all';
  return (
    <div className="v3-card" style={{ textAlign: 'center', padding: 40 }}>
      <Hammer size={48} strokeWidth={1.2} style={{ margin: '0 auto 12px', color: 'var(--text-muted)' }} />
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
        {isFiltered ? 'ไม่พบงานซ่อมตามที่ค้นหา' : 'ยังไม่มีงานซ่อม'}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 16 }}>
        {isFiltered ? 'ลองเปลี่ยนตัวกรอง' : 'เริ่มต้นโดยการรับงานซ่อมใหม่'}
      </div>
      {!isFiltered && (
        <button onClick={onNew} className="v3-btn v3-btn-primary" style={{ border: 'none', cursor: 'pointer' }}>
          <Plus size={14} /> รับงานซ่อมใหม่
        </button>
      )}
    </div>
  );
}

const menuLinkStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 10px',
  borderRadius: 6,
  color: 'var(--text)',
  fontSize: 12,
  textDecoration: 'none',
};
