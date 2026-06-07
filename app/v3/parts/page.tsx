'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-client';
import {
  Plus, Search, Wrench, MoreVertical, Smartphone,
  AlertTriangle, Eye, Trash2, ShoppingCart,
  TrendingUp, Edit2, Box,
} from 'lucide-react';
import { PART_CATEGORIES, PART_GRADES, getCategoryLabel, getGradeInfo } from '@/lib/parts-constants';
import PartAddModal from './PartAddModal';
import PartSellModal from './PartSellModal';

interface PartItem {
  id: string;
  sku?: string | null;
  name: string;
  category: string;
  phone_model: string;
  grade?: string | null;
  cost_price?: number | null;
  sell_price: number;
  stock_qty: number;
  low_stock_alert?: number | null;
  note?: string | null;
  branch_id?: string;
  shop_id?: string;
}

export default function V3PartsPage() {
  const supabase = createClient();
  const [items, setItems] = useState<PartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [activeGrade, setActiveGrade] = useState<string>('all');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const sp = useSearchParams();
  const [showAdd, setShowAdd] = useState(sp.get('add') === '1');
  const [showSell, setShowSell] = useState(sp.get('sell') === '1');

  async function load() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: p } = await supabase
        .from('profiles')
        .select('role, is_super_admin')
        .eq('id', user.id)
        .single();
      setProfile(p);

      const { data } = await supabase
        .from('parts')
        .select('*')
        .order('phone_model', { ascending: true });
      setItems((data || []) as PartItem[]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const stats = useMemo(() => {
    let totalQty = 0;
    let totalValue = 0;
    let lowStock = 0;
    let outOfStock = 0;
    items.forEach(i => {
      const qty = Number(i.stock_qty || 0);
      totalQty += qty;
      totalValue += qty * Number(i.sell_price || 0);
      if (qty === 0) outOfStock++;
      else if (qty <= (i.low_stock_alert || 2)) lowStock++;
    });
    return { totalQty, totalValue, lowStock, outOfStock, totalSkus: items.length };
  }, [items]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: items.length };
    PART_CATEGORIES.forEach(c => {
      counts[c.id] = items.filter(i => i.category === c.id).length;
    });
    return counts;
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter(i => {
      if (activeCategory !== 'all' && i.category !== activeCategory) return false;
      if (activeGrade !== 'all' && i.grade !== activeGrade) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!i.name.toLowerCase().includes(s) &&
            !i.phone_model.toLowerCase().includes(s) &&
            !(i.sku || '').toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [items, activeCategory, activeGrade, search]);

  async function handleDelete(item: PartItem) {
    if (!confirm(`ลบอะไหล่ "${item.name}"?\n\nย้อนกลับไม่ได้`)) return;
    const { error } = await supabase.from('parts').delete().eq('id', item.id);
    if (error) { alert('ลบไม่สำเร็จ: ' + error.message); return; }
    setMenuOpenId(null);
    load();
  }

  const isAdmin = profile?.role === 'admin' || profile?.is_super_admin;

  return (
    <>
      <div className="v3-page-header v3-desktop-only">
        <div>
          <h1 className="v3-page-title">อะไหล่ซ่อม</h1>
          <p className="v3-page-subtitle">{stats.totalSkus} รายการ · {stats.totalQty} ชิ้น · มูลค่า ฿{stats.totalValue.toLocaleString()}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowSell(true)} className="v3-btn v3-btn-secondary" style={{ border: 'none', cursor: 'pointer' }}>
            <ShoppingCart size={16} /> ขาย
          </button>
          <button onClick={() => setShowAdd(true)} className="v3-btn v3-btn-primary" style={{ border: 'none', cursor: 'pointer' }}>
            <Plus size={16} strokeWidth={2.5} /> เพิ่มอะไหล่
          </button>
        </div>
      </div>

      <div className="v3-mobile-only" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
      }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, fontFamily: 'Prompt, sans-serif' }}>
            อะไหล่ซ่อม
          </h1>
          <p style={{ fontSize: 11, color: 'var(--text-dim)' }}>
            {stats.totalSkus} รายการ · {stats.totalQty} ชิ้น
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => setShowSell(true)} style={{
            width: 40, height: 40,
            borderRadius: 10,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            color: 'var(--text)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}>
            <ShoppingCart size={18} />
          </button>
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
      </div>

      <div className="v3-parts-stats" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 10,
        marginBottom: 14,
      }}>
        <StatCard label="ทั้งหมด" value={stats.totalSkus} sub={`${stats.totalQty} ชิ้น`} color="#ef4444" Icon={Wrench} />
        {isAdmin && (
          <StatCard label="มูลค่าสต๊อก" value={`฿${(stats.totalValue / 1000).toFixed(1)}k`} sub="ราคาขายรวม" color="#3b82f6" Icon={TrendingUp} />
        )}
        <StatCard label="ใกล้หมด" value={stats.lowStock} sub="ต่ำกว่าขั้นต่ำ" color="#f59e0b" Icon={AlertTriangle} />
        <StatCard label="หมดสต๊อก" value={stats.outOfStock} sub="ต้องเติม" color="#dc2626" Icon={Box} />
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
            placeholder="ค้นหา ชื่ออะไหล่ / รุ่นเครื่อง / SKU..."
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

        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 6, fontWeight: 600 }}>
            ประเภทอะไหล่
          </div>
          <div style={{
            display: 'flex',
            gap: 6,
            overflowX: 'auto',
            paddingBottom: 4,
          }}>
            <Tab
              active={activeCategory === 'all'}
              onClick={() => setActiveCategory('all')}
              label="ทั้งหมด"
              count={categoryCounts.all}
            />
            {PART_CATEGORIES.map(c => (
              <Tab
                key={c.id}
                active={activeCategory === c.id}
                onClick={() => setActiveCategory(c.id)}
                label={c.short}
                count={categoryCounts[c.id] || 0}
              />
            ))}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 6, fontWeight: 600 }}>
            เกรด
          </div>
          <div style={{
            display: 'flex',
            gap: 6,
            overflowX: 'auto',
            paddingBottom: 4,
          }}>
            <Tab
              active={activeGrade === 'all'}
              onClick={() => setActiveGrade('all')}
              label="ทุกเกรด"
              count={items.length}
            />
            {PART_GRADES.map(g => (
              <Tab
                key={g.id}
                active={activeGrade === g.id}
                onClick={() => setActiveGrade(g.id)}
                label={g.label}
                count={items.filter(i => i.grade === g.id).length}
                color={g.color}
              />
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="v3-card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-dim)' }}>
          กำลังโหลด...
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState hasFilters={!!(search || activeCategory !== 'all' || activeGrade !== 'all')} onAdd={() => setShowAdd(true)} />
      ) : (
        <div className="v3-parts-grid">
          {filtered.map(item => (
            <PartCard
              key={item.id}
              item={item}
              isAdmin={isAdmin}
              menuOpen={menuOpenId === item.id}
              onToggleMenu={() => setMenuOpenId(menuOpenId === item.id ? null : item.id)}
              onClose={() => setMenuOpenId(null)}
              onDelete={() => handleDelete(item)}
              onSell={() => { setMenuOpenId(null); setShowSell(true); }}
            />
          ))}
        </div>
      )}

      {showAdd && (
        <PartAddModal onClose={() => setShowAdd(false)} onSuccess={() => { setShowAdd(false); load(); }} />
      )}
      {showSell && (
        <PartSellModal onClose={() => setShowSell(false)} onSuccess={() => { setShowSell(false); load(); }} />
      )}

      <style jsx>{`
        :global(.v3-parts-grid) {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 10px;
        }
        @media (max-width: 640px) {
          :global(.v3-parts-stats) {
            grid-template-columns: 1fr 1fr !important;
          }
          :global(.v3-parts-grid) {
            grid-template-columns: 1fr 1fr;
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

function Tab({ active, onClick, label, count, color }: any) {
  return (
    <button
      onClick={onClick}
      style={{
        flexShrink: 0,
        padding: '6px 11px',
        borderRadius: 100,
        border: '1px solid',
        borderColor: active ? (color || 'var(--accent)') : 'var(--border)',
        background: active ? (color || 'var(--accent)') : 'var(--surface)',
        color: active ? '#fff' : 'var(--text)',
        fontSize: 11,
        fontWeight: 600,
        cursor: 'pointer',
        fontFamily: 'inherit',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
      <span style={{
        background: active ? 'rgba(255,255,255,0.25)' : 'var(--surface-2)',
        padding: '1px 6px',
        borderRadius: 100,
        fontSize: 9,
        fontWeight: 700,
      }}>
        {count}
      </span>
    </button>
  );
}

function PartCard({ item, isAdmin, menuOpen, onToggleMenu, onClose, onDelete, onSell }: any) {
  const qty = Number(item.stock_qty || 0);
  const lowAlert = Number(item.low_stock_alert || 2);
  const isOut = qty === 0;
  const isLow = qty > 0 && qty <= lowAlert;
  const gradeInfo = item.grade ? getGradeInfo(item.grade) : null;
  const profit = isAdmin && item.cost_price
    ? Number(item.sell_price) - Number(item.cost_price)
    : 0;

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid',
      borderColor: isOut ? '#fecaca' : isLow ? '#fde68a' : 'var(--border)',
      borderRadius: 14,
      padding: 12,
      position: 'relative',
      transition: 'all 0.15s',
    }}>
      {(isOut || isLow) && (
        <div style={{
          position: 'absolute',
          top: 8, left: 8,
          padding: '3px 8px',
          fontSize: 9,
          fontWeight: 700,
          borderRadius: 100,
          background: isOut ? '#fee2e2' : '#fef3c7',
          color: isOut ? '#991b1b' : '#92400e',
          zIndex: 2,
        }}>
          {isOut ? 'หมด' : 'ใกล้หมด'}
        </div>
      )}

      <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 3 }}>
        <button
          onClick={(e) => { e.stopPropagation(); onToggleMenu(); }}
          style={{
            width: 26, height: 26,
            background: 'var(--surface-2)',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            color: 'var(--text-dim)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <MoreVertical size={13} />
        </button>
        {menuOpen && (
          <>
            <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 19 }} />
            <div style={{
              position: 'absolute',
              top: 28, right: 0,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              boxShadow: 'var(--shadow-lg)',
              minWidth: 140,
              padding: 4,
              zIndex: 20,
            }}>
              <button onClick={onSell} style={{ ...menuLinkStyle, border: 'none', background: 'transparent', width: '100%', fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer', color: '#16a34a' }}>
                <ShoppingCart size={13} /> ขาย
              </button>
              <Link href={`/dashboard/parts/edit?id=${item.id}`} style={menuLinkStyle}>
                <Edit2 size={13} /> แก้ไข
              </Link>
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
                <Trash2 size={13} /> ลบ
              </button>
            </div>
          </>
        )}
      </div>

      <div style={{
        width: '100%',
        aspectRatio: '1',
        background: 'var(--surface-2)',
        borderRadius: 10,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 10,
        marginTop: 22,
        position: 'relative',
      }}>
        <Wrench size={36} color="#94a3b8" strokeWidth={1.5} />
        {gradeInfo && (
          <div style={{
            position: 'absolute',
            bottom: 6, right: 6,
            padding: '2px 8px',
            fontSize: 9,
            fontWeight: 700,
            borderRadius: 100,
            background: gradeInfo.color,
            color: '#fff',
          }}>
            {gradeInfo.label}
          </div>
        )}
      </div>

      <div style={{
        fontSize: 10,
        color: 'var(--text-dim)',
        marginBottom: 3,
        fontWeight: 600,
      }}>
        {getCategoryLabel(item.category)}
      </div>
      <div style={{
        fontSize: 13,
        fontWeight: 700,
        marginBottom: 2,
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
        lineHeight: 1.3,
        minHeight: 34,
      }}>
        {item.name}
      </div>

      <div style={{
        fontSize: 10,
        color: 'var(--text-dim)',
        marginBottom: 8,
      }}>
        <Smartphone size={9} style={{ display: 'inline', marginRight: 3, verticalAlign: '-1px' }} />
        {item.phone_model}
      </div>

      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        marginTop: 8,
        paddingTop: 8,
        borderTop: '1px dashed var(--border)',
      }}>
        <div>
          <div style={{
            fontSize: 16,
            fontWeight: 800,
            fontFamily: 'Prompt, sans-serif',
            color: 'var(--accent)',
            lineHeight: 1,
          }}>
            ฿{Number(item.sell_price).toLocaleString()}
          </div>
          {isAdmin && item.cost_price && Number(item.cost_price) > 0 && (
            <div style={{
              fontSize: 9,
              color: profit > 0 ? '#22c55e' : 'var(--text-muted)',
              marginTop: 2,
              fontWeight: 600,
            }}>
              กำไร ฿{profit.toLocaleString()}
            </div>
          )}
        </div>
        <div style={{
          fontSize: 11,
          fontWeight: 700,
          padding: '3px 8px',
          borderRadius: 6,
          background: isOut ? '#fef2f2' : isLow ? '#fffbeb' : 'var(--surface-2)',
          color: isOut ? '#991b1b' : isLow ? '#92400e' : 'var(--text)',
        }}>
          {qty} ชิ้น
        </div>
      </div>
    </div>
  );
}

function EmptyState({ hasFilters, onAdd }: any) {
  return (
    <div className="v3-card" style={{ textAlign: 'center', padding: 40 }}>
      <Wrench size={48} strokeWidth={1.2} style={{ margin: '0 auto 12px', color: 'var(--text-muted)' }} />
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
        {hasFilters ? 'ไม่พบอะไหล่ตามที่ค้นหา' : 'ยังไม่มีอะไหล่ในสต๊อก'}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 16 }}>
        {hasFilters ? 'ลองเปลี่ยนตัวกรอง' : 'เริ่มต้นโดยการเพิ่มอะไหล่ใหม่'}
      </div>
      {!hasFilters && (
        <button onClick={onAdd} className="v3-btn v3-btn-primary" style={{ border: 'none', cursor: 'pointer' }}>
          <Plus size={14} /> เพิ่มอะไหล่
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
