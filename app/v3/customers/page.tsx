'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-client';
import {
  Users, Search, Phone, Smartphone, Coins, CreditCard,
  Hammer, Calendar, TrendingUp, AlertCircle, User,
  MapPin, Sparkles, Crown, Loader2, ChevronRight,
} from 'lucide-react';

interface CustomerEvent {
  type: 'pawn' | 'installment' | 'repair' | 'stock_sale';
  date: string;
  amount: number;
  detail: string;
}

interface Customer {
  key: string; // phone or name
  name: string;
  phone: string;
  idCard?: string;
  events: CustomerEvent[];
  totalSpent: number;
  pawnCount: number;
  installmentCount: number;
  repairCount: number;
  firstSeen: string;
  lastSeen: string;
}

export default function V3CustomersPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'new' | 'top' | 'recent'>('all');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [pawns, insts, repairs, sales] = await Promise.all([
        supabase
          .from('pawn_stock')
          .select('id, customer_name, customer_phone, customer_id_card, model, pawn_price, pawn_date')
          .order('pawn_date', { ascending: false })
          .limit(2000),
        supabase
          .from('installment_stock')
          .select('id, customer_name, customer_phone, customer_id_card, model, full_price, start_date')
          .order('start_date', { ascending: false })
          .limit(2000),
        supabase
          .from('repair_jobs')
          .select('id, customer_name, customer_phone, device_model, total_price, created_at')
          .order('created_at', { ascending: false })
          .limit(2000),
        supabase
          .from('sales_history')
          .select('id, model, final_price, sold_date')
          .order('sold_date', { ascending: false })
          .limit(500),
      ]);

      // Aggregate by phone (or name if no phone)
      const map = new Map<string, Customer>();

      (pawns.data || []).forEach((r: any) => {
        const phone = (r.customer_phone || '').trim();
        const name = (r.customer_name || '').trim();
        if (!name) return;
        const key = phone || `name:${name}`;
        if (!map.has(key)) {
          map.set(key, {
            key, name, phone,
            idCard: r.customer_id_card,
            events: [], totalSpent: 0,
            pawnCount: 0, installmentCount: 0, repairCount: 0,
            firstSeen: r.pawn_date, lastSeen: r.pawn_date,
          });
        }
        const c = map.get(key)!;
        c.events.push({
          type: 'pawn',
          date: r.pawn_date,
          amount: Number(r.pawn_price || 0),
          detail: r.model || 'จำนำ',
        });
        c.pawnCount++;
        c.totalSpent += Number(r.pawn_price || 0);
        if (r.customer_id_card && !c.idCard) c.idCard = r.customer_id_card;
        if ((r.pawn_date || '') < c.firstSeen) c.firstSeen = r.pawn_date;
        if ((r.pawn_date || '') > c.lastSeen) c.lastSeen = r.pawn_date;
      });

      (insts.data || []).forEach((r: any) => {
        const phone = (r.customer_phone || '').trim();
        const name = (r.customer_name || '').trim();
        if (!name) return;
        const key = phone || `name:${name}`;
        if (!map.has(key)) {
          map.set(key, {
            key, name, phone,
            idCard: r.customer_id_card,
            events: [], totalSpent: 0,
            pawnCount: 0, installmentCount: 0, repairCount: 0,
            firstSeen: r.start_date, lastSeen: r.start_date,
          });
        }
        const c = map.get(key)!;
        c.events.push({
          type: 'installment',
          date: r.start_date,
          amount: Number(r.full_price || 0),
          detail: r.model || 'ผ่อนเครื่อง',
        });
        c.installmentCount++;
        c.totalSpent += Number(r.full_price || 0);
        if (r.customer_id_card && !c.idCard) c.idCard = r.customer_id_card;
        if ((r.start_date || '') < c.firstSeen) c.firstSeen = r.start_date;
        if ((r.start_date || '') > c.lastSeen) c.lastSeen = r.start_date;
      });

      (repairs.data || []).forEach((r: any) => {
        const phone = (r.customer_phone || '').trim();
        const name = (r.customer_name || '').trim();
        if (!name) return;
        const key = phone || `name:${name}`;
        const date = (r.created_at || '').split('T')[0];
        if (!map.has(key)) {
          map.set(key, {
            key, name, phone,
            events: [], totalSpent: 0,
            pawnCount: 0, installmentCount: 0, repairCount: 0,
            firstSeen: date, lastSeen: date,
          });
        }
        const c = map.get(key)!;
        c.events.push({
          type: 'repair',
          date,
          amount: Number(r.total_price || 0),
          detail: r.device_model || 'ซ่อมเครื่อง',
        });
        c.repairCount++;
        c.totalSpent += Number(r.total_price || 0);
        if (date < c.firstSeen) c.firstSeen = date;
        if (date > c.lastSeen) c.lastSeen = date;
      });

      // Sort events of each customer (newest first)
      map.forEach(c => {
        c.events.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      });

      // Convert to array, sort by lastSeen
      const arr = Array.from(map.values()).sort((a, b) =>
        (b.lastSeen || '').localeCompare(a.lastSeen || '')
      );
      setCustomers(arr);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  // Stats
  const stats = useMemo(() => {
    const now = new Date();
    const last30 = new Date(); last30.setDate(now.getDate() - 30);
    const last30ISO = last30.toISOString().split('T')[0];
    const newCount = customers.filter(c => (c.firstSeen || '') >= last30ISO).length;
    const totalRevenue = customers.reduce((s, c) => s + c.totalSpent, 0);
    return {
      total: customers.length,
      newCount,
      totalRevenue,
      avgPerCustomer: customers.length > 0 ? totalRevenue / customers.length : 0,
    };
  }, [customers]);

  const filtered = useMemo(() => {
    let list = customers;

    if (activeTab === 'new') {
      const now = new Date();
      const last30 = new Date(); last30.setDate(now.getDate() - 30);
      const last30ISO = last30.toISOString().split('T')[0];
      list = list.filter(c => (c.firstSeen || '') >= last30ISO);
    } else if (activeTab === 'top') {
      list = [...list].sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 50);
    } else if (activeTab === 'recent') {
      const now = new Date();
      const last7 = new Date(); last7.setDate(now.getDate() - 7);
      const last7ISO = last7.toISOString().split('T')[0];
      list = list.filter(c => (c.lastSeen || '') >= last7ISO);
    }

    if (search) {
      const s = search.toLowerCase();
      list = list.filter(c =>
        c.name.toLowerCase().includes(s) ||
        c.phone.toLowerCase().includes(s) ||
        (c.idCard || '').toLowerCase().includes(s)
      );
    }

    return list;
  }, [customers, activeTab, search]);

  return (
    <>
      <div className="v3-page-header v3-desktop-only">
        <div>
          <h1 className="v3-page-title">ลูกค้า</h1>
          <p className="v3-page-subtitle">{stats.total} ลูกค้า · {stats.newCount} ลูกค้าใหม่เดือนนี้</p>
        </div>
      </div>

      <div className="v3-mobile-only" style={{ marginBottom: 12 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, fontFamily: 'Prompt, sans-serif' }}>
          ลูกค้า
        </h1>
        <p style={{ fontSize: 11, color: 'var(--text-dim)' }}>
          {stats.total} ลูกค้า · {stats.newCount} ใหม่เดือนนี้
        </p>
      </div>

      {/* 4 KPI */}
      <div className="v3-cust-stats" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 10,
        marginBottom: 14,
      }}>
        <StatCard label="ลูกค้าทั้งหมด" value={stats.total} sub="คน" color="#3b82f6" Icon={Users} />
        <StatCard label="ลูกค้าใหม่" value={stats.newCount} sub="30 วันที่ผ่านมา" color="#22c55e" Icon={Sparkles} />
        <StatCard label="รวมรายได้" value={`฿${(stats.totalRevenue / 1000).toFixed(1)}k`} sub="จากลูกค้าทั้งหมด" color="#f59e0b" Icon={TrendingUp} />
        <StatCard label="เฉลี่ย/คน" value={`฿${Math.round(stats.avgPerCustomer).toLocaleString()}`} sub="ค่าใช้จ่ายเฉลี่ย" color="#8b5cf6" Icon={Crown} />
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
            placeholder="ค้นหา ชื่อ / เบอร์ / เลขบัตรประชาชน..."
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

        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
          <Tab active={activeTab === 'all'} onClick={() => setActiveTab('all')} label="ทั้งหมด" count={customers.length} />
          <Tab active={activeTab === 'recent'} onClick={() => setActiveTab('recent')} label="ติดต่อล่าสุด" sub="7 วัน" color="#3b82f6" />
          <Tab active={activeTab === 'new'} onClick={() => setActiveTab('new')} label="ลูกค้าใหม่" count={stats.newCount} color="#22c55e" />
          <Tab active={activeTab === 'top'} onClick={() => setActiveTab('top')} label="Top Spender" sub="Top 50" color="#f59e0b" />
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="v3-card" style={{ padding: 60, textAlign: 'center', color: 'var(--text-dim)' }}>
          <Loader2 size={24} className="v3-spin" style={{ marginBottom: 10 }} />
          <div>กำลังรวบรวมข้อมูลลูกค้า...</div>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState search={!!search} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(c => (
            <CustomerCard
              key={c.key}
              customer={c}
              onSelect={() => setSelectedCustomer(c)}
            />
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {selectedCustomer && (
        <CustomerDetailModal
          customer={selectedCustomer}
          onClose={() => setSelectedCustomer(null)}
        />
      )}

      <style jsx>{`
        @media (max-width: 640px) {
          :global(.v3-cust-stats) {
            grid-template-columns: 1fr 1fr !important;
          }
        }
      `}</style>
    </>
  );
}

/* =========================
   Components
========================= */

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
        lineHeight: 1,
      }}>
        {value}
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>{sub}</div>
    </div>
  );
}

function Tab({ active, onClick, label, count, sub, color }: any) {
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
      {count !== undefined && (
        <span style={{
          background: active ? 'rgba(255,255,255,0.25)' : 'var(--surface-2)',
          padding: '1px 7px',
          borderRadius: 100,
          fontSize: 10,
          fontWeight: 700,
        }}>
          {count}
        </span>
      )}
      {sub && (
        <span style={{
          fontSize: 9,
          opacity: 0.8,
          fontWeight: 500,
        }}>
          {sub}
        </span>
      )}
    </button>
  );
}

function CustomerCard({ customer, onSelect }: { customer: Customer; onSelect: () => void }) {
  // คำนวณ tier
  const tier = customer.totalSpent >= 100000 ? 'platinum' :
               customer.totalSpent >= 50000 ? 'gold' :
               customer.totalSpent >= 20000 ? 'silver' : 'normal';
  const tierColor = tier === 'platinum' ? '#8b5cf6' : tier === 'gold' ? '#f59e0b' : tier === 'silver' ? '#94a3b8' : '#3b82f6';
  const tierLabel = tier === 'platinum' ? 'VIP' : tier === 'gold' ? 'GOLD' : tier === 'silver' ? 'SILVER' : '';

  const totalEvents = customer.pawnCount + customer.installmentCount + customer.repairCount;

  return (
    <button
      onClick={onSelect}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        padding: 14,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        cursor: 'pointer',
        fontFamily: 'inherit',
        textAlign: 'left',
        width: '100%',
      }}
    >
      {/* Avatar */}
      <div style={{
        width: 48, height: 48,
        borderRadius: 24,
        background: `${tierColor}15`,
        color: tierColor,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
        fontWeight: 700,
        fontSize: 18,
        fontFamily: 'Prompt, sans-serif',
        position: 'relative',
      }}>
        {customer.name.charAt(0).toUpperCase()}
        {tierLabel && (
          <div style={{
            position: 'absolute',
            bottom: -6, right: -6,
            padding: '1px 6px',
            background: tierColor,
            color: '#fff',
            borderRadius: 100,
            fontSize: 8,
            fontWeight: 800,
            border: '2px solid var(--surface)',
          }}>
            {tierLabel}
          </div>
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 14, fontWeight: 700,
          fontFamily: 'Prompt, Sarabun, sans-serif',
          marginBottom: 2,
        }}>
          {customer.name}
        </div>
        {customer.phone && (
          <div style={{
            fontSize: 11,
            color: 'var(--text-dim)',
            marginBottom: 4,
          }}>
            <Phone size={9} style={{ display: 'inline', marginRight: 3, verticalAlign: '-1px' }} />
            {customer.phone}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 10 }}>
          {customer.pawnCount > 0 && (
            <span style={{ color: '#f59e0b' }}>
              <Coins size={9} style={{ display: 'inline', verticalAlign: '-1px' }} /> {customer.pawnCount}
            </span>
          )}
          {customer.installmentCount > 0 && (
            <span style={{ color: '#8b5cf6' }}>
              <CreditCard size={9} style={{ display: 'inline', verticalAlign: '-1px' }} /> {customer.installmentCount}
            </span>
          )}
          {customer.repairCount > 0 && (
            <span style={{ color: '#06b6d4' }}>
              <Hammer size={9} style={{ display: 'inline', verticalAlign: '-1px' }} /> {customer.repairCount}
            </span>
          )}
          <span style={{ color: 'var(--text-muted)' }}>
            ติดต่อล่าสุด: {customer.lastSeen ? new Date(customer.lastSeen).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) : '-'}
          </span>
        </div>
      </div>

      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{
          fontSize: 13,
          fontWeight: 800,
          fontFamily: 'Prompt, sans-serif',
          color: tierColor,
        }}>
          ฿{customer.totalSpent.toLocaleString()}
        </div>
        <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>
          รวม {totalEvents} รายการ
        </div>
      </div>

      <ChevronRight size={16} color="var(--text-muted)" />
    </button>
  );
}

function CustomerDetailModal({ customer, onClose }: { customer: Customer; onClose: () => void }) {
  const eventTypeInfo: Record<string, { label: string; color: string; bg: string; Icon: any }> = {
    pawn: { label: 'จำนำ', color: '#f59e0b', bg: '#fef3c7', Icon: Coins },
    installment: { label: 'ผ่อน', color: '#8b5cf6', bg: '#ede9fe', Icon: CreditCard },
    repair: { label: 'ซ่อม', color: '#06b6d4', bg: '#cffafe', Icon: Hammer },
    stock_sale: { label: 'ขาย', color: '#22c55e', bg: '#dcfce7', Icon: Smartphone },
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="v3-card"
        style={{
          maxWidth: 520,
          width: '100%',
          padding: 0,
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        {/* Header */}
        <div style={{
          padding: 20,
          background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
          color: '#fff',
          borderRadius: '14px 14px 0 0',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            marginBottom: 14,
          }}>
            <div style={{
              width: 64, height: 64,
              borderRadius: 32,
              background: 'rgba(255,255,255,0.2)',
              color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
              fontWeight: 700,
              fontSize: 26,
              fontFamily: 'Prompt, sans-serif',
            }}>
              {customer.name.charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 18, fontWeight: 800,
                fontFamily: 'Prompt, sans-serif',
                marginBottom: 4,
              }}>
                {customer.name}
              </div>
              {customer.phone && (
                <a href={`tel:${customer.phone}`} style={{
                  fontSize: 12,
                  color: 'rgba(255,255,255,0.9)',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}>
                  <Phone size={11} /> {customer.phone}
                </a>
              )}
              {customer.idCard && (
                <div style={{
                  fontSize: 10,
                  color: 'rgba(255,255,255,0.7)',
                  marginTop: 2,
                  fontFamily: 'monospace',
                }}>
                  บัตรประชาชน: {customer.idCard}
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              style={{
                width: 32, height: 32,
                background: 'rgba(255,255,255,0.2)',
                border: 'none',
                borderRadius: 8,
                color: '#fff',
                cursor: 'pointer',
                fontSize: 16,
              }}
            >
              ✕
            </button>
          </div>

          {/* Mini stats */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 8,
          }}>
            <MiniStat label="ครั้งรวม" value={customer.events.length} />
            <MiniStat label="จำนำ" value={customer.pawnCount} />
            <MiniStat label="ผ่อน" value={customer.installmentCount} />
            <MiniStat label="ซ่อม" value={customer.repairCount} />
          </div>

          {/* Total spent */}
          <div style={{
            marginTop: 14,
            padding: 12,
            background: 'rgba(255,255,255,0.15)',
            borderRadius: 10,
            backdropFilter: 'blur(4px)',
          }}>
            <div style={{ fontSize: 11, opacity: 0.9 }}>มูลค่ารวมที่ใช้กับร้าน</div>
            <div style={{
              fontSize: 26,
              fontWeight: 800,
              fontFamily: 'Prompt, sans-serif',
              marginTop: 2,
            }}>
              ฿{customer.totalSpent.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div style={{ padding: 16 }}>
          <h3 style={{
            fontSize: 13,
            fontWeight: 700,
            fontFamily: 'Prompt, sans-serif',
            marginBottom: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            <Calendar size={14} /> ประวัติทั้งหมด ({customer.events.length})
          </h3>

          {customer.events.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-dim)', fontSize: 12 }}>
              ไม่มีประวัติ
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {customer.events.map((e, i) => {
                const info = eventTypeInfo[e.type];
                const Icon = info.Icon;
                return (
                  <div key={i} style={{
                    display: 'flex',
                    gap: 10,
                    padding: 10,
                    background: 'var(--surface-2)',
                    borderRadius: 10,
                    borderLeft: `3px solid ${info.color}`,
                  }}>
                    <div style={{
                      width: 32, height: 32,
                      borderRadius: 8,
                      background: info.bg,
                      color: info.color,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <Icon size={14} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: info.color,
                      }}>
                        {info.label}
                      </div>
                      <div style={{
                        fontSize: 13,
                        fontWeight: 600,
                        fontFamily: 'Prompt, Sarabun, sans-serif',
                      }}>
                        {e.detail}
                      </div>
                      <div style={{
                        fontSize: 10,
                        color: 'var(--text-dim)',
                        marginTop: 2,
                      }}>
                        {e.date ? new Date(e.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                      </div>
                    </div>
                    <div style={{
                      fontSize: 13,
                      fontWeight: 700,
                      fontFamily: 'Prompt, sans-serif',
                      textAlign: 'right',
                    }}>
                      ฿{e.amount.toLocaleString()}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Actions */}
          {customer.phone && (
            <div style={{ marginTop: 14 }}>
              <a
                href={`tel:${customer.phone}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  padding: '12px',
                  background: 'var(--accent)',
                  color: '#fff',
                  borderRadius: 10,
                  textDecoration: 'none',
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                <Phone size={14} /> โทรหาลูกค้า
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: any) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.15)',
      borderRadius: 8,
      padding: '8px 6px',
      textAlign: 'center',
    }}>
      <div style={{
        fontSize: 18,
        fontWeight: 800,
        fontFamily: 'Prompt, sans-serif',
        lineHeight: 1,
      }}>
        {value}
      </div>
      <div style={{ fontSize: 9, opacity: 0.9, marginTop: 3 }}>
        {label}
      </div>
    </div>
  );
}

function EmptyState({ search }: any) {
  return (
    <div className="v3-card" style={{ textAlign: 'center', padding: 40 }}>
      <Users size={48} strokeWidth={1.2} style={{ margin: '0 auto 12px', color: 'var(--text-muted)' }} />
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
        {search ? 'ไม่พบลูกค้าตามที่ค้นหา' : 'ยังไม่มีข้อมูลลูกค้า'}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
        {search ? 'ลองค้นหาด้วยคำอื่น' : 'ข้อมูลจะแสดงเมื่อมีการรับจำนำ ผ่อน หรือซ่อมจากลูกค้า'}
      </div>
    </div>
  );
}
