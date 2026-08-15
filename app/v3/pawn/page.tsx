'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';
import {
  Plus, Search, Coins, Smartphone, MoreVertical, Phone,
  CheckCircle2, Clock, AlertTriangle, Calendar, User,
  RotateCcw, FileText, Eye, Trash2, RefreshCw, Pencil,
} from 'lucide-react';
import PawnAddModal from './PawnAddModal';
import { PawnRedeemModal, PawnRenewModal, PawnEditModal, PawnDetailModal, PawnForfeitModal } from './PawnActionModals';

interface PawnItem {
  id: string;
  imei?: string | null;
  model: string;
  color?: string | null;
  spec?: string | null;
  device_password?: string | null;
  pawn_price: number;
  pawn_date: string;
  interest_days: number;
  interest_amount?: number | null;
  due_date: string;
  customer_name: string;
  customer_phone?: string | null;
  customer_note?: string | null;
  status?: string | null;
  renew_count?: number;
  branch_id?: string;
  branch?: any;
  added_by?: string | null;
  added_by_name?: string | null;
}

const STATUS_COLORS = {
  normal: { color: '#22c55e', bg: '#dcfce7', label: 'ปกติ', Icon: CheckCircle2 },
  due_soon: { color: '#f59e0b', bg: '#fef3c7', label: 'ใกล้ครบ', Icon: Clock },
  overdue: { color: '#ef4444', bg: '#fee2e2', label: 'เลยกำหนด', Icon: AlertTriangle },
};

function getStatusOf(item: PawnItem): keyof typeof STATUS_COLORS {
  if (!item.due_date) return 'normal';
  const due = new Date(item.due_date);
  const now = new Date();
  const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 'overdue';
  if (diffDays <= 7) return 'due_soon';
  return 'normal';
}

export default function V3PawnPage() {
  const supabase = createClient();
  const [items, setItems] = useState<PawnItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeStatus, setActiveStatus] = useState<string>('all');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(useSearchParams().get('add') === '1');
  const [redeemItem, setRedeemItem] = useState<PawnItem | null>(null);
  const [renewItem, setRenewItem] = useState<PawnItem | null>(null);
  const [editItem, setEditItem] = useState<PawnItem | null>(null);
  const [viewItem, setViewItem] = useState<PawnItem | null>(null);
  const [forfeitItem, setForfeitItem] = useState<PawnItem | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: p } = await supabase.from('profiles').select('role, is_super_admin').eq('id', user.id).single();
      setIsAdmin(p?.role === 'admin' || !!p?.is_super_admin);
    }
    loadProfile();
  }, []);

  async function load() {
    try {
      const { data } = await supabase
        .from('pawn_stock')
        .select('*, branch:branches(name)')
        .order('pawn_date', { ascending: false });
      setItems((data || []) as PawnItem[]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const counts = useMemo(() => {
    const c = { all: items.length, normal: 0, due_soon: 0, overdue: 0, totalValue: 0 };
    for (const it of items) {
      const s = getStatusOf(it);
      c[s]++;
      c.totalValue += Number(it.pawn_price || 0);
    }
    return c;
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter(it => {
      if (activeStatus !== 'all') {
        const s = getStatusOf(it);
        if (s !== activeStatus) return false;
      }
      if (search) {
        const s = search.toLowerCase();
        const hit =
          (it.imei || '').toLowerCase().includes(s) ||
          it.model.toLowerCase().includes(s) ||
          it.customer_name.toLowerCase().includes(s) ||
          (it.customer_phone && it.customer_phone.toLowerCase().includes(s));
        if (!hit) return false;
      }
      return true;
    });
  }, [items, activeStatus, search]);

  async function handleDelete(item: PawnItem) {
    if (!confirm(`ลบรายการจำนำของ ${item.customer_name}? (เครื่อง: ${item.model})\n\nย้อนกลับไม่ได้`)) return;
    const { error } = await supabase.from('pawn_stock').delete().eq('id', item.id);
    if (error) { alert('ลบไม่สำเร็จ: ' + error.message); return; }
    setMenuOpenId(null);
    load();
  }

  return (
    <>
      <div className="v3-page-header v3-desktop-only">
        <div>
          <h1 className="v3-page-title">รับจำนำเครื่อง</h1>
          <p className="v3-page-subtitle">ทั้งหมด {counts.all} รายการ · มูลค่ารวม ฿{counts.totalValue.toLocaleString()}</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="v3-btn v3-btn-primary" style={{ border: 'none', cursor: 'pointer' }}>
          <Plus size={16} strokeWidth={2.5} /> รับจำนำใหม่
        </button>
      </div>

      <div className="v3-mobile-only" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
      }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, fontFamily: 'Prompt, sans-serif' }}>
            รับจำนำเครื่อง
          </h1>
          <p style={{ fontSize: 11, color: 'var(--text-dim)' }}>
            ทั้งหมด {counts.all} รายการ
          </p>
        </div>
        <button onClick={() => setShowAdd(true)} style={{
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

      <div className="v3-pawn-stats" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 10,
        marginBottom: 14,
      }}>
        <StatCard label="รวมทั้งหมด" value={counts.all} sub={`฿${counts.totalValue.toLocaleString()}`} color="#f59e0b" Icon={Coins} />
        <StatCard label="ปกติ" value={counts.normal} sub="ยังไม่ครบ" color="#22c55e" Icon={CheckCircle2} />
        <StatCard label="ใกล้ครบ" value={counts.due_soon} sub="ภายใน 7 วัน" color="#f59e0b" Icon={Clock} />
        <StatCard label="เลยกำหนด" value={counts.overdue} sub="ต้องติดตาม" color="#ef4444" Icon={AlertTriangle} />
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: 8,
        marginBottom: 14,
      }}>
        <ActionBtn Icon={Plus} label="รับจำนำใหม่" onClick={() => setShowAdd(true)} primary />
        <ActionBtn Icon={FileText} label="ประวัติจำนำ" href="/v3/pawn/history" />
      </div>

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
            placeholder="ค้นหา รุ่น / ชื่อลูกค้า / เบอร์..."
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

        <div style={{
          display: 'flex',
          gap: 6,
          overflowX: 'auto',
          paddingBottom: 4,
        }}>
          <Tab active={activeStatus === 'all'} onClick={() => setActiveStatus('all')} label="ทั้งหมด" count={counts.all} />
          <Tab active={activeStatus === 'normal'} onClick={() => setActiveStatus('normal')} label="ปกติ" count={counts.normal} color="#22c55e" />
          <Tab active={activeStatus === 'due_soon'} onClick={() => setActiveStatus('due_soon')} label="ใกล้ครบ" count={counts.due_soon} color="#f59e0b" />
          <Tab active={activeStatus === 'overdue'} onClick={() => setActiveStatus('overdue')} label="เลยกำหนด" count={counts.overdue} color="#ef4444" />
        </div>
      </div>

      {loading ? (
        <div className="v3-card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-dim)' }}>
          กำลังโหลด...
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState hasFilters={!!(search || activeStatus !== 'all')} onAdd={() => setShowAdd(true)} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(item => (
            <PawnCard
              key={item.id}
              item={item}
              menuOpen={menuOpenId === item.id}
              onToggleMenu={() => setMenuOpenId(menuOpenId === item.id ? null : item.id)}
              onClose={() => setMenuOpenId(null)}
              onDelete={() => handleDelete(item)}
              onRedeem={() => { setMenuOpenId(null); setRedeemItem(item); }}
              onRenew={() => { setMenuOpenId(null); setRenewItem(item); }}
              onEdit={() => { setMenuOpenId(null); setEditItem(item); }}
              onView={() => { setMenuOpenId(null); setViewItem(item); }}
              onForfeit={() => { setMenuOpenId(null); setForfeitItem(item); }}
              isAdmin={isAdmin}
            />
          ))}
        </div>
      )}

      {showAdd && (
        <PawnAddModal
          onClose={() => setShowAdd(false)}
          onSuccess={() => { setShowAdd(false); load(); }}
        />
      )}
      {redeemItem && (
        <PawnRedeemModal
          item={redeemItem}
          onClose={() => setRedeemItem(null)}
          onSuccess={() => { setRedeemItem(null); load(); }}
        />
      )}
      {renewItem && (
        <PawnRenewModal
          item={renewItem}
          onClose={() => setRenewItem(null)}
          onSuccess={() => { setRenewItem(null); load(); }}
        />
      )}
      {editItem && (
        <PawnEditModal
          item={editItem}
          onClose={() => setEditItem(null)}
          onSuccess={() => { setEditItem(null); load(); }}
        />
      )}
      {viewItem && (
        <PawnDetailModal
          item={viewItem}
          onClose={() => setViewItem(null)}
        />
      )}
      {forfeitItem && (
        <PawnForfeitModal
          item={forfeitItem}
          onClose={() => setForfeitItem(null)}
          onSuccess={() => { setForfeitItem(null); load(); }}
        />
      )}

      <style jsx>{`
        @media (max-width: 640px) {
          :global(.v3-pawn-stats) {
            grid-template-columns: 1fr 1fr !important;
          }
        }
      `}</style>
    </>
  );
}

function StatCard({ label, value, sub, color, Icon }: any) {
  return (
    <div className="v3-card" style={{ padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <div style={{
          width: 34, height: 34,
          borderRadius: 10,
          background: `${color}15`,
          color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Icon size={17} strokeWidth={2.2} />
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{label}</div>
      </div>
      <div style={{
        fontSize: 22, fontWeight: 800,
        fontFamily: 'Prompt, sans-serif',
        letterSpacing: '-0.3px',
        lineHeight: 1,
      }}>
        {value}
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>{sub}</div>
    </div>
  );
}

function ActionBtn({ Icon, label, href, onClick, primary }: any) {
  const style: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: '12px',
    background: primary ? 'var(--accent)' : 'var(--surface)',
    color: primary ? '#fff' : 'var(--text)',
    border: primary ? 'none' : '1px solid var(--border)',
    borderRadius: 12,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    textDecoration: 'none',
    fontFamily: 'inherit',
    width: '100%',
  };
  if (onClick) {
    return (
      <button onClick={onClick} style={style}>
        <Icon size={14} strokeWidth={2.2} />
        {label}
      </button>
    );
  }
  return (
    <Link href={href} style={style}>
      <Icon size={14} strokeWidth={2.2} />
      {label}
    </Link>
  );
}

function Tab({ active, onClick, label, count, color }: any) {
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

function PawnCard({ item, menuOpen, onToggleMenu, onClose, onDelete, onRedeem, onRenew, onEdit, onView, onForfeit, isAdmin }: any) {
  const status = getStatusOf(item);
  const info = STATUS_COLORS[status];
  const StatusIcon = info.Icon;
  const dueDate = new Date(item.due_date);
  const now = new Date();
  const diffDays = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const totalValue = Number(item.pawn_price || 0) + Number(item.interest_amount || 0);

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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 4 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{
                fontSize: 14, fontWeight: 700,
                fontFamily: 'Prompt, Sarabun, sans-serif',
              }}>
                {item.model}
              </div>
              {item.imei && (
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1, fontFamily: 'monospace' }}>
                  {item.imei}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <span style={{
                padding: '4px 10px',
                fontSize: 10,
                fontWeight: 700,
                borderRadius: 100,
                background: info.bg,
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
                      minWidth: 150,
                      padding: 4,
                      zIndex: 20,
                    }}>
                      <button onClick={onRenew} style={{ ...menuLinkStyle, border: 'none', background: 'transparent', width: '100%', fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer' }}>
                        <RefreshCw size={14} /> ต่อดอก
                      </button>
                      <button onClick={onRedeem} style={{ ...menuLinkStyle, border: 'none', background: 'transparent', width: '100%', fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer', color: '#16a34a' }}>
                        <RotateCcw size={14} /> ไถ่คืนเครื่อง
                      </button>
                      <button onClick={onEdit} style={{ ...menuLinkStyle, border: 'none', background: 'transparent', width: '100%', fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer' }}>
                        <Pencil size={14} /> แก้ไข
                      </button>
                      <button onClick={onView} style={{ ...menuLinkStyle, border: 'none', background: 'transparent', width: '100%', fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer' }}>
                        <Eye size={14} /> ดูรายละเอียด
                      </button>
                      {isAdmin && (
                        <button onClick={onForfeit} style={{ ...menuLinkStyle, border: 'none', background: 'transparent', width: '100%', fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer', color: '#d97706' }}>
                          <AlertTriangle size={14} /> บันทึกหลุดจำนำ
                        </button>
                      )}
                      {item.customer_phone && (
                        <a href={`tel:${item.customer_phone}`} style={menuLinkStyle}>
                          <Phone size={14} /> โทรหาลูกค้า
                        </a>
                      )}
                      <button onClick={onDelete} style={{
                        ...menuLinkStyle,
                        color: 'var(--danger)',
                        border: 'none',
                        background: 'transparent',
                        width: '100%',
                        fontFamily: 'inherit',
                        textAlign: 'left',
                        cursor: 'pointer',
                      }}>
                        <Trash2 size={14} /> ลบ
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <div style={{ fontSize: 12, color: 'var(--text)', marginBottom: 2 }}>
            <User size={11} style={{ display: 'inline', marginRight: 4, verticalAlign: '-1px', color: 'var(--text-muted)' }} />
            {item.customer_name}
            {item.customer_phone && (
              <span style={{ color: 'var(--text-dim)', marginLeft: 8 }}>{item.customer_phone}</span>
            )}
          </div>

          {(item.spec || item.color) && (
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>
              {item.spec}{item.spec && item.color ? ' • ' : ''}{item.color}
            </div>
          )}

          <div style={{
            display: 'flex',
            gap: 12,
            fontSize: 11,
            color: 'var(--text-dim)',
            marginTop: 6,
            flexWrap: 'wrap',
          }}>
            <span>
              <Calendar size={10} style={{ display: 'inline', marginRight: 3, verticalAlign: '-1px' }} />
              จำนำ {new Date(item.pawn_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}
            </span>
            <span style={{ color: info.color, fontWeight: 600 }}>
              <Clock size={10} style={{ display: 'inline', marginRight: 3, verticalAlign: '-1px' }} />
              {status === 'overdue'
                ? `เกินกำหนด ${Math.abs(diffDays)} วัน`
                : `เหลือ ${diffDays} วัน`}
              {' • '}
              ครบ {new Date(item.due_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
            </span>
          </div>

          <div style={{
            marginTop: 10,
            paddingTop: 10,
            borderTop: '1px solid var(--border)',
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 8,
            fontSize: 11,
          }}>
            <div>
              <div style={{ color: 'var(--text-dim)', marginBottom: 2 }}>เงินต้น</div>
              <div style={{ fontWeight: 700, fontFamily: 'Prompt, sans-serif', fontSize: 13 }}>
                ฿{Number(item.pawn_price).toLocaleString()}
              </div>
            </div>
            <div>
              <div style={{ color: 'var(--text-dim)', marginBottom: 2 }}>ดอกเบี้ย</div>
              <div style={{
                fontWeight: 700,
                fontFamily: 'Prompt, sans-serif',
                fontSize: 13,
                color: item.interest_amount && Number(item.interest_amount) > 0 ? 'var(--text)' : 'var(--text-muted)',
                fontStyle: !item.interest_amount ? 'italic' : 'normal',
              }}>
                {item.interest_amount && Number(item.interest_amount) > 0
                  ? `฿${Number(item.interest_amount).toLocaleString()}`
                  : 'ไม่มี'}
              </div>
            </div>
            <div>
              <div style={{ color: 'var(--text-dim)', marginBottom: 2 }}>รวมต้องจ่าย</div>
              <div style={{
                fontWeight: 700,
                fontFamily: 'Prompt, sans-serif',
                fontSize: 13,
                color: 'var(--accent)',
              }}>
                ฿{totalValue.toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ hasFilters, onAdd }: any) {
  return (
    <div className="v3-card" style={{ textAlign: 'center', padding: 40 }}>
      <Coins size={48} strokeWidth={1.2} style={{ margin: '0 auto 12px', color: 'var(--text-muted)' }} />
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
        {hasFilters ? 'ไม่พบรายการตามที่ค้นหา' : 'ยังไม่มีรายการจำนำ'}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 16 }}>
        {hasFilters ? 'ลองเปลี่ยนตัวกรอง' : 'เริ่มต้นโดยการรับจำนำใหม่'}
      </div>
      {!hasFilters && (
        <button onClick={onAdd} className="v3-btn v3-btn-primary" style={{ border: 'none', cursor: 'pointer' }}>
          <Plus size={14} /> รับจำนำใหม่
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
