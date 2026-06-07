'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';
import {
  Plus, Search, CreditCard, Smartphone, MoreVertical, Phone,
  CheckCircle2, Clock, AlertTriangle, Calendar, User,
  TrendingUp, FileText, Eye, Trash2, DollarSign,
} from 'lucide-react';
import { InstallmentAddModal, InstallmentPayModal } from './InstallmentModals';
import InstallmentDetailModal from './InstallmentDetailModal';

interface InstallmentItem {
  id: string;
  imei: string;
  model: string;
  color?: string | null;
  spec?: string | null;
  full_price: number;
  down_payment?: number | null;
  installment_amount: number;
  total_periods: number;
  start_date: string;
  customer_name: string;
  customer_phone?: string | null;
  status?: string | null;
  branch_id?: string;
  branch?: any;
  paid_periods?: number;
  total_paid?: number;
  image_url?: string | null;
}

const STATUS_COLORS = {
  active: { color: '#22c55e', bg: '#dcfce7', label: 'ปกติ', Icon: CheckCircle2 },
  due_soon: { color: '#f59e0b', bg: '#fef3c7', label: 'ใกล้ครบงวด', Icon: Clock },
  overdue: { color: '#ef4444', bg: '#fee2e2', label: 'เกินกำหนด', Icon: AlertTriangle },
  completed: { color: '#3b82f6', bg: '#dbeafe', label: 'จบสัญญา', Icon: TrendingUp },
};

function getStatusOf(item: InstallmentItem): keyof typeof STATUS_COLORS {
  const paid = item.paid_periods || 0;
  const total = item.total_periods || 0;
  if (paid >= total) return 'completed';

  // คำนวณงวดที่ควรจ่ายถึงตอนนี้
  const start = new Date(item.start_date);
  const now = new Date();
  const monthsSinceStart = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  const expectedPaid = Math.max(0, monthsSinceStart);

  if (expectedPaid > paid + 1) return 'overdue';
  if (expectedPaid >= paid) return 'due_soon';
  return 'active';
}

function getNextDueDate(item: InstallmentItem): Date {
  const start = new Date(item.start_date);
  const paid = item.paid_periods || 0;
  const next = new Date(start);
  next.setMonth(start.getMonth() + paid + 1);
  return next;
}

export default function V3InstallmentPage() {
  const supabase = createClient();
  const [items, setItems] = useState<InstallmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeStatus, setActiveStatus] = useState<string>('all');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const sp = useSearchParams();
  const [showAdd, setShowAdd] = useState(sp.get('add') === '1');
  const [payItem, setPayItem] = useState<any>(null);
  const [detailItem, setDetailItem] = useState<any>(null);

  async function load() {
    try {
      const { data } = await supabase
        .from('installment_stock')
        .select('*, branch:branches(name)')
        .order('start_date', { ascending: false });

      // ดึงจำนวนงวดที่จ่ายแล้ว
      const withPayments = await Promise.all(
        (data || []).map(async (item) => {
          const { data: payments } = await supabase
            .from('installment_payments')
            .select('amount')
            .eq('installment_id', item.id);
          const totalPaid = (payments || []).reduce((sum, p) => sum + Number(p.amount), 0);
          return {
            ...item,
            paid_periods: payments?.length || 0,
            total_paid: totalPaid,
          };
        })
      );

      setItems(withPayments as InstallmentItem[]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const counts = useMemo(() => {
    const c = { all: items.length, active: 0, due_soon: 0, overdue: 0, completed: 0, totalValue: 0, todayRevenue: 0 };
    const today = new Date().toISOString().split('T')[0];
    for (const it of items) {
      const s = getStatusOf(it);
      c[s]++;
      c.totalValue += Number(it.full_price || 0);
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
          it.imei.toLowerCase().includes(s) ||
          it.model.toLowerCase().includes(s) ||
          it.customer_name.toLowerCase().includes(s) ||
          (it.customer_phone && it.customer_phone.toLowerCase().includes(s));
        if (!hit) return false;
      }
      return true;
    });
  }, [items, activeStatus, search]);

  async function handleDelete(item: InstallmentItem) {
    if (!confirm(`ลบรายการผ่อนของ ${item.customer_name}? (เครื่อง: ${item.model})\n\nย้อนกลับไม่ได้`)) return;
    const { error } = await supabase.from('installment_stock').delete().eq('id', item.id);
    if (error) { alert('ลบไม่สำเร็จ: ' + error.message); return; }
    setMenuOpenId(null);
    load();
  }

  return (
    <>
      <div className="v3-page-header v3-desktop-only">
        <div>
          <h1 className="v3-page-title">ผ่อนชำระ</h1>
          <p className="v3-page-subtitle">ทั้งหมด {counts.all} รายการ · มูลค่ารวม ฿{counts.totalValue.toLocaleString()}</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="v3-btn v3-btn-primary" style={{ border: 'none', cursor: 'pointer' }}>
          <Plus size={16} strokeWidth={2.5} /> เพิ่มเครื่องผ่อนใหม่
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
            ผ่อนชำระ
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

      {/* 4 KPI cards */}
      <div className="v3-inst-stats" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 10,
        marginBottom: 14,
      }}>
        <StatCard label="ทั้งหมด" value={counts.all} sub={`฿${counts.totalValue.toLocaleString()}`} color="#8b5cf6" Icon={CreditCard} />
        <StatCard label="ปกติ" value={counts.active} sub="ยังจ่ายตามนัด" color="#22c55e" Icon={CheckCircle2} />
        <StatCard label="ใกล้ครบงวด" value={counts.due_soon} sub="ต้องเก็บ" color="#f59e0b" Icon={Clock} />
        <StatCard label="เกินกำหนด" value={counts.overdue} sub="ต้องติดตาม" color="#ef4444" Icon={AlertTriangle} />
      </div>

      {/* Action buttons */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: 8,
        marginBottom: 14,
      }}>
        <ActionBtn Icon={Plus} label="เพิ่มเครื่องผ่อน" onClick={() => setShowAdd(true)} primary />
        <ActionBtn Icon={FileText} label="ประวัติผ่อน" href="/v3/installment/history" />
      </div>

      {/* Search + Tabs */}
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
            placeholder="ค้นหา IMEI / รุ่น / ชื่อลูกค้า / เบอร์..."
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
          <Tab active={activeStatus === 'active'} onClick={() => setActiveStatus('active')} label="ปกติ" count={counts.active} color="#22c55e" />
          <Tab active={activeStatus === 'due_soon'} onClick={() => setActiveStatus('due_soon')} label="ใกล้ครบงวด" count={counts.due_soon} color="#f59e0b" />
          <Tab active={activeStatus === 'overdue'} onClick={() => setActiveStatus('overdue')} label="เกินกำหนด" count={counts.overdue} color="#ef4444" />
          <Tab active={activeStatus === 'completed'} onClick={() => setActiveStatus('completed')} label="จบสัญญา" count={counts.completed} color="#3b82f6" />
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="v3-card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-dim)' }}>
          กำลังโหลด...
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState hasFilters={!!(search || activeStatus !== 'all')} onAdd={() => setShowAdd(true)} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(item => (
            <InstallmentCard
              key={item.id}
              item={item}
              menuOpen={menuOpenId === item.id}
              onToggleMenu={() => setMenuOpenId(menuOpenId === item.id ? null : item.id)}
              onClose={() => setMenuOpenId(null)}
              onDelete={() => handleDelete(item)}
              onPay={() => { setMenuOpenId(null); setPayItem(item); }}
              onDetail={() => { setMenuOpenId(null); setDetailItem(item); }}
            />
          ))}
        </div>
      )}

      {showAdd && (
        <InstallmentAddModal onClose={() => setShowAdd(false)} onSuccess={() => { setShowAdd(false); load(); }} />
      )}
      {payItem && (
        <InstallmentPayModal item={payItem} onClose={() => setPayItem(null)} onSuccess={() => { setPayItem(null); load(); }} />
      )}
      {detailItem && (
        <InstallmentDetailModal
          itemId={detailItem.id}
          onClose={() => setDetailItem(null)}
          onPay={() => { const it = detailItem; setDetailItem(null); setPayItem(it); }}
        />
      )}

      <style jsx>{`
        @media (max-width: 640px) {
          :global(.v3-inst-stats) {
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
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '12px',
    background: primary ? 'var(--accent)' : 'var(--surface)', color: primary ? '#fff' : 'var(--text)',
    border: primary ? 'none' : '1px solid var(--border)', borderRadius: 12, fontSize: 12, fontWeight: 600,
    cursor: 'pointer', textDecoration: 'none', fontFamily: 'inherit', width: '100%',
  };
  if (onClick) {
    return <button onClick={onClick} style={style}><Icon size={14} strokeWidth={2.2} />{label}</button>;
  }
  return <Link href={href} style={style}><Icon size={14} strokeWidth={2.2} />{label}</Link>;
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

function InstallmentCard({ item, menuOpen, onToggleMenu, onClose, onDelete, onPay, onDetail }: any) {
  const status = getStatusOf(item);
  const info = STATUS_COLORS[status];
  const StatusIcon = info.Icon;
  const paid = item.paid_periods || 0;
  const total = item.total_periods || 0;
  const totalPaid = Number(item.total_paid || 0) + Number(item.down_payment || 0);
  const remaining = Number(item.full_price) - totalPaid;
  const progress = total > 0 ? (paid / total) * 100 : 0;
  const nextDue = getNextDueDate(item);
  const now = new Date();
  const diffDays = Math.ceil((nextDue.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

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
          overflow: 'hidden',
        }}>
          {item.image_url ? (
            <img src={item.image_url} alt={item.model} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 4 }} />
          ) : (
            <Smartphone size={20} color="#94a3b8" strokeWidth={1.5} />
          )}
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
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1, fontFamily: 'monospace' }}>
                {item.imei}
              </div>
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
                      <button onClick={onDetail} style={{ ...menuLinkStyle, border: 'none', background: 'transparent', width: '100%', fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer' }}>
                        <Eye size={14} /> ดูรายละเอียด
                      </button>
                      <button onClick={onPay} style={{ ...menuLinkStyle, border: 'none', background: 'transparent', width: '100%', fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer', color: '#16a34a' }}>
                        <DollarSign size={14} /> รับชำระงวด
                      </button>
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

          {/* Customer */}
          <div style={{ fontSize: 12, color: 'var(--text)', marginBottom: 4 }}>
            <User size={11} style={{ display: 'inline', marginRight: 4, verticalAlign: '-1px', color: 'var(--text-muted)' }} />
            {item.customer_name}
            {item.customer_phone && (
              <span style={{ color: 'var(--text-dim)', marginLeft: 8 }}>{item.customer_phone}</span>
            )}
          </div>

          {/* Progress bar */}
          <div style={{ marginTop: 8 }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 11,
              color: 'var(--text-dim)',
              marginBottom: 4,
            }}>
              <span>ผ่อนแล้ว {paid}/{total} งวด</span>
              <span style={{ fontWeight: 600, color: info.color }}>{Math.round(progress)}%</span>
            </div>
            <div style={{
              height: 6,
              background: 'var(--surface-2)',
              borderRadius: 100,
              overflow: 'hidden',
            }}>
              <div style={{
                width: `${progress}%`,
                height: '100%',
                background: info.color,
                borderRadius: 100,
                transition: 'width 0.3s',
              }} />
            </div>
          </div>

          {/* Next due (if not completed) */}
          {status !== 'completed' && (
            <div style={{
              marginTop: 8,
              fontSize: 11,
              color: status === 'overdue' ? '#ef4444' : 'var(--text-dim)',
              fontWeight: status === 'overdue' ? 600 : 400,
            }}>
              <Calendar size={10} style={{ display: 'inline', marginRight: 3, verticalAlign: '-1px' }} />
              งวดถัดไป: {nextDue.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}
              {status === 'overdue' && diffDays < 0 && ` (เกิน ${Math.abs(diffDays)} วัน)`}
              {diffDays >= 0 && diffDays <= 7 && ` (เหลือ ${diffDays} วัน)`}
            </div>
          )}

          {/* Money breakdown */}
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
              <div style={{ color: 'var(--text-dim)', marginBottom: 2 }}>ราคาเต็ม</div>
              <div style={{ fontWeight: 700, fontFamily: 'Prompt, sans-serif', fontSize: 13 }}>
                ฿{Number(item.full_price).toLocaleString()}
              </div>
            </div>
            <div>
              <div style={{ color: 'var(--text-dim)', marginBottom: 2 }}>ผ่อน/งวด</div>
              <div style={{ fontWeight: 700, fontFamily: 'Prompt, sans-serif', fontSize: 13 }}>
                ฿{Number(item.installment_amount).toLocaleString()}
              </div>
            </div>
            <div>
              <div style={{ color: 'var(--text-dim)', marginBottom: 2 }}>คงเหลือ</div>
              <div style={{
                fontWeight: 700,
                fontFamily: 'Prompt, sans-serif',
                fontSize: 13,
                color: remaining > 0 ? '#ef4444' : '#22c55e',
              }}>
                ฿{remaining.toLocaleString()}
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
      <CreditCard size={48} strokeWidth={1.2} style={{ margin: '0 auto 12px', color: 'var(--text-muted)' }} />
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
        {hasFilters ? 'ไม่พบรายการตามที่ค้นหา' : 'ยังไม่มีรายการผ่อน'}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 16 }}>
        {hasFilters ? 'ลองเปลี่ยนตัวกรอง' : 'เริ่มต้นโดยการเพิ่มเครื่องผ่อนใหม่'}
      </div>
      {!hasFilters && (
        <button onClick={onAdd} className="v3-btn v3-btn-primary" style={{ border: 'none', cursor: 'pointer' }}>
          <Plus size={14} /> เพิ่มเครื่องผ่อนใหม่
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
