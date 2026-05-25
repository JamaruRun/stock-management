'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-client';
import { REPAIR_STATUSES, getStatusInfo, type RepairStatus } from '@/lib/repair-constants';

interface RepairJob {
  id: string;
  job_no: string;
  customer_name: string;
  customer_phone?: string;
  device_brand?: string;
  device_model: string;
  problem_description: string;
  status: RepairStatus;
  labor_cost: number;
  parts_cost: number;
  total_price: number;
  profit: number;
  received_date: string;
  done_date?: string;
  technician_name?: string;
  created_at: string;
}

type TabFilter = 'all' | 'active' | RepairStatus;

export default function RepairListPage() {
  const supabase = createClient();
  const [jobs, setJobs] = useState<RepairJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<TabFilter>('active');

  async function load() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data: p } = await supabase
      .from('profiles').select('*').eq('id', user.id).single();
    setProfile(p);

    const { data } = await supabase
      .from('repair_jobs')
      .select('*')
      .order('created_at', { ascending: false });
    
    setJobs(data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const isAdmin = profile?.role === 'admin';

  const filtered = useMemo(() => {
    let result = jobs;

    if (tab === 'active') {
      result = result.filter(j => 
        j.status === 'pending' || 
        j.status === 'in_progress' || 
        j.status === 'waiting_parts'
      );
    } else if (tab !== 'all') {
      result = result.filter(j => j.status === tab);
    }

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(j =>
        j.job_no.toLowerCase().includes(q) ||
        j.customer_name.toLowerCase().includes(q) ||
        (j.customer_phone && j.customer_phone.includes(q)) ||
        j.device_model.toLowerCase().includes(q)
      );
    }

    return result;
  }, [jobs, tab, search]);

  const stats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return {
      total: jobs.length,
      active: jobs.filter(j => 
        j.status === 'pending' || j.status === 'in_progress' || j.status === 'waiting_parts'
      ).length,
      pending: jobs.filter(j => j.status === 'pending').length,
      waiting: jobs.filter(j => j.status === 'waiting_parts').length,
      doneNotDelivered: jobs.filter(j => j.status === 'done').length,
      revenueToday: jobs
        .filter(j => j.delivered_date === today || (j.done_date === today && j.status === 'delivered'))
        .reduce((s, j) => s + Number(j.total_price || 0), 0),
      profitToday: jobs
        .filter(j => j.delivered_date === today || (j.done_date === today && j.status === 'delivered'))
        .reduce((s, j) => s + Number(j.profit || 0), 0),
    };
  }, [jobs]);

  function timeAgo(dateStr: string) {
    const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (seconds < 60) return 'เมื่อสักครู่';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} นาทีที่แล้ว`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} ชั่วโมงที่แล้ว`;
    return `${Math.floor(seconds / 86400)} วันที่แล้ว`;
  }

  if (loading) {
    return (
      <>
        <div className="page-header"><h1>🛠️ ใบงานซ่อม</h1></div>
        <div className="skeleton" style={{ height: 200 }}></div>
      </>
    );
  }

  return (
    <>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div>
          <h1>🛠️ ใบงานซ่อม</h1>
          <div className="desc">รับซ่อม • ติดตามสถานะ • ตัดสต๊อกอะไหล่อัตโนมัติ</div>
        </div>
        <Link href="/dashboard/repair/new" style={{
          padding: '10px 16px',
          background: 'var(--accent)',
          color: '#fff',
          borderRadius: 6,
          fontSize: 13,
          textDecoration: 'none',
          fontWeight: 600,
          whiteSpace: 'nowrap',
        }}>+ รับงาน</Link>
      </div>

      {/* Hero Stats */}
      <div style={{
        background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
        borderRadius: 'var(--radius)',
        padding: 20,
        marginBottom: 16,
        color: '#fff',
      }}>
        <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 6 }}>งานค้างทั้งหมด</div>
        <div style={{ fontSize: 36, fontWeight: 700, lineHeight: 1 }}>
          {stats.active} <span style={{ fontSize: 16, opacity: 0.9 }}>ใบ</span>
        </div>
        <div style={{ 
          marginTop: 12, 
          paddingTop: 12, 
          borderTop: '1px solid rgba(255,255,255,0.2)',
          display: 'flex', 
          gap: 16, 
          flexWrap: 'wrap',
          fontSize: 12,
        }}>
          <div>🕐 {stats.pending} รอตรวจ</div>
          <div>⏳ {stats.waiting} รออะไหล่</div>
          <div>✅ {stats.doneNotDelivered} รอรับเครื่อง</div>
        </div>
      </div>

      {/* Stats วันนี้ (admin only) */}
      {isAdmin && stats.revenueToday > 0 && (
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
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>รายได้วันนี้</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>
              ฿{stats.revenueToday.toLocaleString()}
            </div>
          </div>
          <div style={{
            padding: 14,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
          }}>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>กำไรวันนี้</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#10b981' }}>
              ฿{stats.profitToday.toLocaleString()}
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="🔍 ค้นหา: เลขใบ / ลูกค้า / เบอร์ / รุ่นเครื่อง"
        style={{
          width: '100%',
          padding: 12,
          fontSize: 14,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          color: 'var(--text)',
          fontFamily: 'inherit',
          marginBottom: 12,
        }}
      />

      {/* Tabs */}
      <div style={{ 
        display: 'flex', 
        gap: 6, 
        marginBottom: 12,
        overflowX: 'auto',
        paddingBottom: 4,
      }}>
        <TabChip 
          active={tab === 'active'} 
          onClick={() => setTab('active')}
          label={`🔥 งานค้าง (${stats.active})`} 
        />
        <TabChip 
          active={tab === 'pending'} 
          onClick={() => setTab('pending')}
          label="🕐 รอตรวจ" 
        />
        <TabChip 
          active={tab === 'in_progress'} 
          onClick={() => setTab('in_progress')}
          label="🔧 กำลังซ่อม" 
        />
        <TabChip 
          active={tab === 'waiting_parts'} 
          onClick={() => setTab('waiting_parts')}
          label="⏳ รออะไหล่" 
        />
        <TabChip 
          active={tab === 'done'} 
          onClick={() => setTab('done')}
          label="✅ รอรับ" 
        />
        <TabChip 
          active={tab === 'delivered'} 
          onClick={() => setTab('delivered')}
          label="🎉 ส่งมอบ" 
        />
        <TabChip 
          active={tab === 'all'} 
          onClick={() => setTab('all')}
          label="ทั้งหมด" 
        />
      </div>

      {/* List */}
      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 8, padding: '0 4px' }}>
        แสดง {filtered.length} ใบ
      </div>

      {filtered.length === 0 ? (
        <div className="form-card">
          <div className="empty">
            <div className="empty-icon" style={{ opacity: 0.3 }}>📋</div>
            <div className="empty-title">
              {jobs.length === 0 ? 'ยังไม่มีใบงาน' : 'ไม่พบใบงาน'}
            </div>
            {jobs.length === 0 && (
              <Link href="/dashboard/repair/new" style={{ 
                display: 'inline-block',
                marginTop: 10,
                padding: '8px 16px',
                background: 'var(--accent)',
                color: '#fff',
                borderRadius: 6,
                textDecoration: 'none',
                fontSize: 13,
              }}>+ รับงานซ่อมใบแรก</Link>
            )}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(j => {
            const status = getStatusInfo(j.status);
            return (
              <Link
                key={j.id}
                href={`/dashboard/repair/edit?id=${j.id}`}
                style={{
                  background: 'var(--surface)',
                  border: `1px solid var(--border)`,
                  borderLeft: `3px solid ${status.color}`,
                  borderRadius: 'var(--radius-sm)',
                  padding: 12,
                  textDecoration: 'none',
                  color: 'inherit',
                  display: 'block',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ 
                      fontSize: 11, 
                      color: 'var(--text-dim)',
                      fontFamily: 'JetBrains Mono, monospace',
                      marginBottom: 2,
                    }}>
                      {j.job_no} • {timeAgo(j.created_at)}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>
                      📱 {j.device_brand ? j.device_brand + ' ' : ''}{j.device_model}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 2 }}>
                      👤 {j.customer_name}
                      {j.customer_phone && ` • 📞 ${j.customer_phone}`}
                    </div>
                    <div style={{ 
                      fontSize: 11, 
                      color: 'var(--text-dim)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      ⚠️ {j.problem_description}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{
                      padding: '3px 8px',
                      borderRadius: 4,
                      fontSize: 10,
                      fontWeight: 700,
                      background: `${status.color}25`,
                      color: status.color,
                      marginBottom: 4,
                      whiteSpace: 'nowrap',
                    }}>
                      {status.icon} {status.label}
                    </div>
                    {j.total_price > 0 && (
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)' }}>
                        ฿{Number(j.total_price).toLocaleString()}
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}

function TabChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '7px 12px',
        background: active ? 'var(--accent)' : 'var(--surface-2)',
        color: active ? '#fff' : 'var(--text)',
        border: 'none',
        borderRadius: 100,
        fontSize: 12,
        cursor: 'pointer',
        fontFamily: 'inherit',
        fontWeight: active ? 600 : 500,
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >{label}</button>
  );
}
