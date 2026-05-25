'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-client';

const TYPE_INFO: Record<string, { label: string; icon: string; color: string }> = {
  bug: { label: 'แจ้งบั๊ก', icon: '🐛', color: '#ef4444' },
  feature: { label: 'ขอฟีเจอร์', icon: '💡', color: '#3b82f6' },
  praise: { label: 'ชื่นชม', icon: '⭐', color: '#f59e0b' },
  complaint: { label: 'ร้องเรียน', icon: '😞', color: '#8b5cf6' },
  general: { label: 'ทั่วไป', icon: '💬', color: '#6b7280' },
};

const STATUS_INFO: Record<string, { label: string; color: string }> = {
  new: { label: '🆕 ใหม่', color: '#3b82f6' },
  read: { label: '👁️ อ่านแล้ว', color: '#6b7280' },
  replied: { label: '↩️ ตอบแล้ว', color: '#10b981' },
  resolved: { label: '✅ แก้แล้ว', color: '#10b981' },
  closed: { label: '🔒 ปิด', color: '#9ca3af' },
};

export default function FeedbackAdminPage() {
  const supabase = createClient();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [selected, setSelected] = useState<any | null>(null);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('feedback')
      .select('*')
      .order('created_at', { ascending: false });
    setItems(data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return items.filter(f => {
      if (filterStatus !== 'all' && f.status !== filterStatus) return false;
      if (filterType !== 'all' && f.type !== filterType) return false;
      return true;
    });
  }, [items, filterStatus, filterType]);

  const stats = useMemo(() => ({
    total: items.length,
    new: items.filter(f => f.status === 'new').length,
    bugs: items.filter(f => f.type === 'bug').length,
    features: items.filter(f => f.type === 'feature').length,
  }), [items]);

  async function updateStatus(id: string, newStatus: string) {
    await supabase.from('feedback').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', id);
    if (selected?.id === id) {
      setSelected({ ...selected, status: newStatus });
    }
    await load();
  }

  async function saveNote(id: string, note: string) {
    await supabase.from('feedback').update({ admin_note: note }).eq('id', id);
    await load();
  }

  async function deleteFeedback(id: string) {
    if (!confirm('ลบ feedback นี้?')) return;
    await supabase.from('feedback').delete().eq('id', id);
    setSelected(null);
    await load();
  }

  function timeAgo(dateStr: string) {
    const s = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (s < 60) return 'เมื่อสักครู่';
    if (s < 3600) return `${Math.floor(s/60)} นาทีที่แล้ว`;
    if (s < 86400) return `${Math.floor(s/3600)} ชั่วโมงที่แล้ว`;
    return `${Math.floor(s/86400)} วันที่แล้ว`;
  }

  return (
    <>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div>
          <h1>📬 Feedback จากลูกค้า</h1>
          <div className="desc">ดูข้อเสนอแนะ • แจ้งบั๊ก • ขอฟีเจอร์ • คำชม</div>
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

      {/* Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 8,
        marginBottom: 16,
      }}>
        <Stat label="ทั้งหมด" value={stats.total} color="#3b82f6" />
        <Stat label="ยังไม่อ่าน" value={stats.new} color="#ef4444" />
        <Stat label="บั๊ก" value={stats.bugs} color="#f59e0b" />
        <Stat label="ฟีเจอร์" value={stats.features} color="#10b981" />
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          style={{
            padding: 8,
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            color: 'var(--text)',
            fontFamily: 'inherit',
            fontSize: 13,
          }}
        >
          <option value="all">ทุกสถานะ</option>
          <option value="new">🆕 ใหม่</option>
          <option value="read">👁️ อ่านแล้ว</option>
          <option value="replied">↩️ ตอบแล้ว</option>
          <option value="resolved">✅ แก้แล้ว</option>
          <option value="closed">🔒 ปิด</option>
        </select>

        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          style={{
            padding: 8,
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            color: 'var(--text)',
            fontFamily: 'inherit',
            fontSize: 13,
          }}
        >
          <option value="all">ทุกประเภท</option>
          {Object.entries(TYPE_INFO).map(([k, v]) => (
            <option key={k} value={k}>{v.icon} {v.label}</option>
          ))}
        </select>
      </div>

      {/* List */}
      {loading ? (
        <div className="skeleton" style={{ height: 200 }}></div>
      ) : filtered.length === 0 ? (
        <div className="form-card">
          <div className="empty">
            <div className="empty-icon" style={{ opacity: 0.3 }}>📭</div>
            <div className="empty-title">ยังไม่มี feedback</div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(f => {
            const t = TYPE_INFO[f.type] || TYPE_INFO.general;
            const s = STATUS_INFO[f.status] || STATUS_INFO.new;
            return (
              <div
                key={f.id}
                onClick={() => {
                  setSelected(f);
                  if (f.status === 'new') updateStatus(f.id, 'read');
                }}
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderLeft: `3px solid ${t.color}`,
                  borderRadius: 'var(--radius-sm)',
                  padding: 12,
                  cursor: 'pointer',
                  position: 'relative',
                }}
              >
                {f.status === 'new' && (
                  <div style={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    background: '#ef4444',
                    color: '#fff',
                    fontSize: 9,
                    padding: '2px 6px',
                    borderRadius: 4,
                    fontWeight: 700,
                  }}>NEW</div>
                )}

                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 6 }}>
                  <div style={{ fontSize: 20 }}>{t.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>
                      {f.subject || t.label}
                      {f.rating && ` ${'⭐'.repeat(f.rating)}`}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                      👤 {f.user_name} • 🏪 {f.shop_name || '-'} • {timeAgo(f.created_at)}
                    </div>
                  </div>
                </div>

                <div style={{ 
                  fontSize: 12, 
                  color: 'var(--text)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                }}>
                  {f.message}
                </div>

                <div style={{ 
                  marginTop: 6, 
                  display: 'flex', 
                  gap: 6, 
                  fontSize: 10,
                  flexWrap: 'wrap',
                }}>
                  <span style={{ 
                    padding: '2px 6px', 
                    background: `${s.color}20`, 
                    color: s.color,
                    borderRadius: 4,
                    fontWeight: 600,
                  }}>{s.label}</span>
                  {f.page_url && (
                    <span style={{ color: 'var(--text-dim)', fontFamily: 'monospace' }}>
                      📍 {f.page_url}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail Modal */}
      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ 
            maxWidth: 520, 
            maxHeight: '90vh', 
            overflow: 'auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 24, marginBottom: 4 }}>
                  {TYPE_INFO[selected.type]?.icon} {TYPE_INFO[selected.type]?.label}
                </div>
                {selected.subject && (
                  <h3 style={{ margin: '4px 0' }}>{selected.subject}</h3>
                )}
                {selected.rating && (
                  <div style={{ fontSize: 16 }}>{'⭐'.repeat(selected.rating)}</div>
                )}
              </div>
              <button
                onClick={() => setSelected(null)}
                style={{
                  background: 'var(--surface-2)',
                  border: 'none',
                  borderRadius: '50%',
                  width: 32,
                  height: 32,
                  cursor: 'pointer',
                  fontSize: 14,
                  color: 'var(--text)',
                  fontFamily: 'inherit',
                }}
              >✕</button>
            </div>

            <div style={{ 
              padding: 12, 
              background: 'var(--surface-2)', 
              borderRadius: 6, 
              margin: '14px 0',
              fontSize: 13,
              whiteSpace: 'pre-wrap',
              lineHeight: 1.6,
            }}>
              {selected.message}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--text-dim)' }}>
              <div>👤 <strong>{selected.user_name}</strong> ({selected.user_username})</div>
              <div>🏪 {selected.shop_name || '-'}</div>
              <div>📅 {new Date(selected.created_at).toLocaleString('th-TH')}</div>
              {selected.page_url && (
                <div style={{ fontFamily: 'monospace', fontSize: 11 }}>
                  📍 {selected.page_url}
                </div>
              )}
              {selected.user_agent && (
                <div style={{ fontSize: 10, opacity: 0.7, fontFamily: 'monospace' }}>
                  🖥️ {selected.user_agent.substring(0, 100)}...
                </div>
              )}
            </div>

            {/* Status buttons */}
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 6 }}>
                เปลี่ยนสถานะ
              </div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {Object.entries(STATUS_INFO).map(([k, v]) => (
                  <button
                    key={k}
                    onClick={() => updateStatus(selected.id, k)}
                    style={{
                      padding: '6px 10px',
                      background: selected.status === k ? v.color : 'var(--surface-2)',
                      color: selected.status === k ? '#fff' : 'var(--text)',
                      border: 'none',
                      borderRadius: 4,
                      cursor: 'pointer',
                      fontSize: 11,
                      fontFamily: 'inherit',
                      fontWeight: 600,
                    }}
                  >{v.label}</button>
                ))}
              </div>
            </div>

            {/* Admin note */}
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 6 }}>
                โน้ตภายใน (admin only)
              </div>
              <textarea
                defaultValue={selected.admin_note || ''}
                onBlur={(e) => {
                  if (e.target.value !== (selected.admin_note || '')) {
                    saveNote(selected.id, e.target.value);
                  }
                }}
                rows={2}
                placeholder="โน้ต / สรุป / link issue"
                style={{
                  width: '100%',
                  padding: 8,
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  color: 'var(--text)',
                  fontFamily: 'inherit',
                  fontSize: 12,
                  resize: 'vertical',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button
                onClick={() => deleteFeedback(selected.id)}
                style={{
                  padding: '8px 14px',
                  background: 'transparent',
                  color: '#ef4444',
                  border: '1px solid #ef4444',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 12,
                  fontFamily: 'inherit',
                }}
              >🗑️ ลบ</button>
              <button onClick={() => setSelected(null)} className="btn btn-sec" style={{ flex: 1 }}>
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{
      padding: 12,
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-sm)',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}
