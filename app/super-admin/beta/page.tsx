'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-client';
import Toast from '@/components/Toast';

interface BetaSignup {
  id: string;
  shop_name: string;
  contact_name: string;
  phone: string;
  line_id?: string;
  province?: string;
  business_type?: string;
  shop_size?: string;
  branch_count?: number;
  current_system?: string;
  username?: string;
  password_hash?: string;
  note?: string;
  admin_note?: string;
  status: 'pending' | 'approved' | 'rejected';
  approved_shop_id?: string;
  approved_at?: string;
  rejected_at?: string;
  rejected_reason?: string;
  created_at: string;
}

export default function BetaSignupsPage() {
  const supabase = createClient();
  const [signups, setSignups] = useState<BetaSignup[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [processing, setProcessing] = useState<string | null>(null);
  const [showDetail, setShowDetail] = useState<BetaSignup | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [toast, setToast] = useState<{ title: string; msg: string; type: string } | null>(null);

  function showToast(title: string, msg: string, type: 'success' | 'danger' = 'success') {
    setToast({ title, msg, type });
    setTimeout(() => setToast(null), 4000);
  }

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('beta_signups')
      .select('*')
      .order('created_at', { ascending: false });
    setSignups(data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleAction(action: 'approve' | 'reject') {
    if (!showDetail) return;
    setProcessing(showDetail.id);

    try {
      const res = await fetch('/api/super-admin/beta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signup_id: showDetail.id,
          action,
          admin_note: adminNote.trim() || null,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        showToast('เกิดข้อผิดพลาด', data.error || 'unknown', 'danger');
        return;
      }

      if (action === 'approve') {
        showToast(
          'Approve สำเร็จ ✓', 
          `สร้างร้าน "${data.shop.name}" • username: ${data.user.username}`,
        );
      } else {
        showToast('Reject แล้ว', '');
      }

      setShowDetail(null);
      setAdminNote('');
      await load();
    } catch (e: any) {
      showToast('เกิดข้อผิดพลาด', e.message, 'danger');
    } finally {
      setProcessing(null);
    }
  }

  const filtered = signups.filter(s => tab === 'all' || s.status === tab);
  
  const counts = {
    pending: signups.filter(s => s.status === 'pending').length,
    approved: signups.filter(s => s.status === 'approved').length,
    rejected: signups.filter(s => s.status === 'rejected').length,
    all: signups.length,
  };

  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleString('th-TH', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function timeAgo(dateStr: string) {
    const d = new Date(dateStr);
    const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ที่แล้ว`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ที่แล้ว`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ที่แล้ว`;
    return `${Math.floor(seconds / 86400)}d ที่แล้ว`;
  }

  return (
    <>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div>
          <h1>📋 Beta Signups</h1>
          <div className="desc">คำขอสมัคร Beta - approve/reject</div>
        </div>
        <Link href="/super-admin" style={{
          padding: '8px 14px',
          background: 'var(--surface-2)',
          color: 'var(--text)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          fontSize: 12,
          textDecoration: 'none',
        }}>← กลับ</Link>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: 4,
        marginBottom: 20,
        background: 'var(--surface-2)',
        padding: 4,
        borderRadius: 'var(--radius-sm)',
        flexWrap: 'wrap',
      }}>
        {([
          { id: 'pending', label: '⏳ รอ approve', count: counts.pending, color: '#f59e0b' },
          { id: 'approved', label: '✅ Approved', count: counts.approved, color: '#10b981' },
          { id: 'rejected', label: '❌ Rejected', count: counts.rejected, color: '#ef4444' },
          { id: 'all', label: 'ทั้งหมด', count: counts.all, color: 'var(--text)' },
        ] as const).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flex: '1 1 auto',
              padding: '10px 12px',
              background: tab === t.id ? 'var(--surface)' : 'transparent',
              color: tab === t.id ? t.color : 'var(--text-dim)',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 13,
              fontWeight: tab === t.id ? 700 : 500,
              boxShadow: tab === t.id ? 'var(--shadow-sm)' : 'none',
              whiteSpace: 'nowrap',
            }}
          >
            {t.label} <strong style={{ marginLeft: 4 }}>({t.count})</strong>
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="skeleton" style={{ height: 100 }}></div>
      ) : filtered.length === 0 ? (
        <div className="form-card">
          <div className="empty">
            <div className="empty-icon" style={{ opacity: 0.3 }}>📭</div>
            <div className="empty-title">
              {tab === 'pending' ? 'ไม่มีคำขอรอ approve' : `ไม่มีคำขอ ${tab}`}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map((s) => (
            <div
              key={s.id}
              onClick={() => { setShowDetail(s); setAdminNote(s.admin_note || ''); }}
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: 14,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent)';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 6 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 2 }}>
                    🏪 {s.shop_name}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                    {s.contact_name} • 📞 {s.phone}
                    {s.line_id && ` • LINE: ${s.line_id}`}
                  </div>
                </div>
                <div style={{
                  padding: '3px 8px',
                  borderRadius: 4,
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: 0.5,
                  background: 
                    s.status === 'pending' ? 'rgba(245, 158, 11, 0.15)' :
                    s.status === 'approved' ? 'rgba(16, 185, 129, 0.15)' :
                    'rgba(239, 68, 68, 0.15)',
                  color:
                    s.status === 'pending' ? '#f59e0b' :
                    s.status === 'approved' ? '#10b981' :
                    '#ef4444',
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                }}>
                  {s.status}
                </div>
              </div>
              <div style={{ 
                display: 'flex', 
                gap: 8, 
                fontSize: 11, 
                color: 'var(--text-dim)',
                flexWrap: 'wrap',
              }}>
                {s.province && <span>📍 {s.province}</span>}
                {s.branch_count && <span>🏬 {s.branch_count} สาขา</span>}
                <span style={{ marginLeft: 'auto' }}>{timeAgo(s.created_at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {showDetail && (
        <div className="modal-overlay" onClick={() => !processing && setShowDetail(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 540 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <h3 style={{ margin: 0 }}>📋 รายละเอียดคำขอ</h3>
              <button
                onClick={() => !processing && setShowDetail(null)}
                disabled={!!processing}
                style={{
                  background: 'var(--surface-2)',
                  border: 'none',
                  borderRadius: '50%',
                  width: 28,
                  height: 28,
                  cursor: 'pointer',
                  fontSize: 14,
                  color: 'var(--text)',
                  fontFamily: 'inherit',
                }}
              >✕</button>
            </div>

            {/* Status */}
            <div style={{
              padding: 10,
              background: 
                showDetail.status === 'pending' ? 'rgba(245, 158, 11, 0.1)' :
                showDetail.status === 'approved' ? 'rgba(16, 185, 129, 0.1)' :
                'rgba(239, 68, 68, 0.1)',
              borderLeft: `3px solid ${
                showDetail.status === 'pending' ? '#f59e0b' :
                showDetail.status === 'approved' ? '#10b981' :
                '#ef4444'
              }`,
              borderRadius: 4,
              marginBottom: 14,
              fontSize: 12,
            }}>
              <strong>สถานะ:</strong> {
                showDetail.status === 'pending' ? '⏳ รอการ approve' :
                showDetail.status === 'approved' ? `✅ Approved เมื่อ ${formatDate(showDetail.approved_at!)}` :
                `❌ Rejected เมื่อ ${formatDate(showDetail.rejected_at!)}`
              }
            </div>

            {/* Info Grid */}
            <div style={{ display: 'grid', gap: 10, fontSize: 13 }}>
              <Row label="🏪 ชื่อร้าน" value={showDetail.shop_name} />
              <Row label="👤 ผู้ติดต่อ" value={showDetail.contact_name} />
              <Row label="📞 เบอร์โทร" value={showDetail.phone} copyable />
              {showDetail.line_id && <Row label="💬 LINE" value={showDetail.line_id} copyable />}
              {showDetail.province && <Row label="📍 จังหวัด" value={showDetail.province} />}
              {showDetail.shop_size && <Row label="📊 ขนาด" value={
                showDetail.shop_size === 'small' ? 'เล็ก (1-50/เดือน)' :
                showDetail.shop_size === 'medium' ? 'กลาง (50-200/เดือน)' :
                'ใหญ่ (200+/เดือน)'
              } />}
              {showDetail.branch_count && <Row label="🏬 จำนวนสาขา" value={`${showDetail.branch_count} สาขา`} />}
              {showDetail.current_system && <Row label="💻 ระบบปัจจุบัน" value={
                showDetail.current_system === 'paper' ? 'สมุดจด/กระดาษ' :
                showDetail.current_system === 'excel' ? 'Excel/Google Sheets' :
                showDetail.current_system === 'other_software' ? 'ระบบอื่น' :
                'ยังไม่มีระบบ'
              } />}
              
              {/* Account info */}
              {showDetail.username && (
                <div style={{ 
                  padding: 10, 
                  background: 'var(--surface-2)', 
                  borderRadius: 6,
                  marginTop: 4,
                }}>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 6, fontWeight: 600 }}>
                    🔐 ข้อมูล Account (ใช้สร้างหลัง approve)
                  </div>
                  <Row label="Username" value={showDetail.username} copyable />
                  {showDetail.status === 'pending' && showDetail.password_hash && (
                    <Row 
                      label="Password" 
                      value={showPassword ? showDetail.password_hash : '••••••••'} 
                      copyable={showPassword}
                      extra={
                        <button
                          onClick={() => setShowPassword(!showPassword)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--accent)',
                            cursor: 'pointer',
                            fontSize: 11,
                            padding: '2px 6px',
                          }}
                        >{showPassword ? '🙈 ซ่อน' : '👁️ ดู'}</button>
                      }
                    />
                  )}
                </div>
              )}

              {showDetail.note && (
                <div style={{ 
                  padding: 10, 
                  background: 'var(--surface-2)', 
                  borderRadius: 6,
                  fontSize: 12,
                  lineHeight: 1.5,
                }}>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4, fontWeight: 600 }}>
                    💬 หมายเหตุจากผู้สมัคร
                  </div>
                  {showDetail.note}
                </div>
              )}

              <Row label="🕐 สมัครเมื่อ" value={formatDate(showDetail.created_at)} />
            </div>

            {/* Actions - เฉพาะ pending */}
            {showDetail.status === 'pending' && (
              <>
                <div style={{ marginTop: 16 }}>
                  <label style={{ 
                    fontSize: 12, 
                    fontWeight: 600, 
                    color: 'var(--text)',
                    display: 'block',
                    marginBottom: 6,
                  }}>
                    📝 หมายเหตุ (optional)
                  </label>
                  <textarea
                    value={adminNote}
                    onChange={(e) => setAdminNote(e.target.value)}
                    placeholder="เหตุผล / คำแนะนำ"
                    rows={2}
                    style={{
                      width: '100%',
                      padding: 10,
                      fontSize: 13,
                      background: 'var(--surface-2)',
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      color: 'var(--text)',
                      fontFamily: 'inherit',
                      resize: 'vertical',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                  <button
                    onClick={() => handleAction('reject')}
                    disabled={!!processing}
                    style={{
                      flex: 1,
                      padding: 12,
                      background: 'var(--surface-2)',
                      color: '#ef4444',
                      border: '1px solid #ef4444',
                      borderRadius: 6,
                      cursor: processing ? 'not-allowed' : 'pointer',
                      fontFamily: 'inherit',
                      fontSize: 14,
                      fontWeight: 600,
                    }}
                  >
                    {processing === showDetail.id ? '...' : '❌ Reject'}
                  </button>
                  <button
                    onClick={() => handleAction('approve')}
                    disabled={!!processing}
                    style={{
                      flex: 2,
                      padding: 12,
                      background: '#10b981',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 6,
                      cursor: processing ? 'not-allowed' : 'pointer',
                      fontFamily: 'inherit',
                      fontSize: 14,
                      fontWeight: 700,
                    }}
                  >
                    {processing === showDetail.id ? 'กำลังสร้างร้าน...' : '✅ Approve & สร้างร้านเลย'}
                  </button>
                </div>
              </>
            )}

            {/* Show admin note ถ้ามี */}
            {showDetail.status !== 'pending' && showDetail.admin_note && (
              <div style={{ 
                marginTop: 16,
                padding: 10, 
                background: 'var(--surface-2)', 
                borderRadius: 6,
                fontSize: 12,
              }}>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4, fontWeight: 600 }}>
                  📝 Admin Note
                </div>
                {showDetail.admin_note}
              </div>
            )}
          </div>
        </div>
      )}

      {toast && <Toast {...toast} />}
    </>
  );
}

function Row({ label, value, copyable, extra }: { label: string; value: string; copyable?: boolean; extra?: React.ReactNode }) {
  function copy() {
    navigator.clipboard.writeText(value);
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
      <div style={{ flex: '0 0 110px', color: 'var(--text-dim)', fontSize: 12 }}>{label}</div>
      <div style={{ flex: 1, fontWeight: 500, fontFamily: copyable ? 'JetBrains Mono, monospace' : 'inherit', fontSize: copyable ? 12 : 13 }}>
        {value}
      </div>
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
      {extra}
    </div>
  );
}
