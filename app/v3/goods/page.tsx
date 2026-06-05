'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-client';
import {
  Plus, Search, ShoppingBag, MoreVertical,
  Package, AlertTriangle, Tag, Eye, Trash2, ShoppingCart,
  TrendingUp, Edit2, Box,
} from 'lucide-react';
import GoodsAddModal from './GoodsAddModal';

interface GoodsItem {
  id: string;
  sku: string;
  name: string;
  category?: string | null;
  cost_price?: number | null;
  sell_price: number;
  stock_qty: number;
  low_stock_alert?: number | null;
  note?: string | null;
  branch_id?: string;
  branch?: any;
  shop_id?: string;
}

export default function V3GoodsPage() {
  const supabase = createClient();
  const [items, setItems] = useState<GoodsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [showAdd, setShowAdd] = useState(false);

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
        .from('goods')
        .select('*, branch:branches(name)')
        .order('name', { ascending: true });
      setItems((data || []) as GoodsItem[]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  // Categories list
  const categories = useMemo(() => {
    const set = new Set<string>();
    items.forEach(i => { if (i.category) set.add(i.category); });
    return ['all', ...Array.from(set).sort()];
  }, [items]);

  // Counts/stats
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
      else if (qty <= (i.low_stock_alert || 5)) lowStock++;
    });
    return { totalQty, totalValue, lowStock, outOfStock, totalSkus: items.length };
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter(i => {
      if (activeCategory !== 'all' && i.category !== activeCategory) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!i.name.toLowerCase().includes(s) &&
            !(i.sku || '').toLowerCase().includes(s) &&
            !(i.category || '').toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [items, activeCategory, search]);

  async function handleDelete(item: GoodsItem) {
    if (!confirm(`ลบสินค้า "${item.name}"?\n\nย้อนกลับไม่ได้`)) return;
    const { error } = await supabase.from('goods').delete().eq('id', item.id);
    if (error) { alert('ลบไม่สำเร็จ: ' + error.message); return; }
    setMenuOpenId(null);
    load();
  }

  const isAdmin = profile?.role === 'admin' || profile?.is_super_admin;

  return (
    <>
      <div className="v3-page-header v3-desktop-only">
        <div>
          <h1 className="v3-page-title">อุปกรณ์เสริม</h1>
          <p className="v3-page-subtitle">{stats.totalSkus} รายการ · {stats.totalQty} ชิ้น · มูลค่า ฿{stats.totalValue.toLocaleString()}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href="/dashboard/goods/sell" className="v3-btn v3-btn-secondary" style={{ textDecoration: 'none' }}>
            <ShoppingCart size={16} /> ขาย
          </Link>
          <button onClick={() => setShowAdd(true)} className="v3-btn v3-btn-primary" style={{ border: 'none', cursor: 'pointer' }}>
            <Plus size={16} strokeWidth={2.5} /> เพิ่มสินค้า
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
            อุปกรณ์เสริม
          </h1>
          <p style={{ fontSize: 11, color: 'var(--text-dim)' }}>
            {stats.totalSkus} รายการ · {stats.totalQty} ชิ้น
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <Link href="/dashboard/goods/sell" style={{
            width: 40, height: 40,
            borderRadius: 10,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            color: 'var(--text)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            textDecoration: 'none',
          }}>
            <ShoppingCart size={18} />
          </Link>
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

      {/* KPI Stats */}
      <div className="v3-goods-stats" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 10,
        marginBottom: 14,
      }}>
        <StatCard label="ทั้งหมด" value={stats.totalSkus} sub={`${stats.totalQty} ชิ้น`} color="#06b6d4" Icon={ShoppingBag} />
        {isAdmin && (
          <StatCard label="มูลค่าสต๊อก" value={`฿${(stats.totalValue / 1000).toFixed(1)}k`} sub="ราคาขายรวม" color="#3b82f6" Icon={TrendingUp} />
        )}
        <StatCard label="ใกล้หมด" value={stats.lowStock} sub="ต่ำกว่าขั้นต่ำ" color="#f59e0b" Icon={AlertTriangle} />
        <StatCard label="หมดสต๊อก" value={stats.outOfStock} sub="ต้องเติม" color="#ef4444" Icon={Box} />
      </div>

      {/* Search + Category Tabs */}
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
            placeholder="ค้นหา SKU / ชื่อสินค้า / หมวดหมู่..."
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
          {categories.map(cat => (
            <Tab
              key={cat}
              active={activeCategory === cat}
              onClick={() => setActiveCategory(cat)}
              label={cat === 'all' ? 'ทั้งหมด' : cat}
              count={cat === 'all' ? items.length : items.filter(i => i.category === cat).length}
            />
          ))}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="v3-card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-dim)' }}>
          กำลังโหลด...
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState hasFilters={!!(search || activeCategory !== 'all')} />
      ) : (
        <div className="v3-goods-grid">
          {filtered.map(item => (
            <GoodsCard
              key={item.id}
              item={item}
              isAdmin={isAdmin}
              menuOpen={menuOpenId === item.id}
              onToggleMenu={() => setMenuOpenId(menuOpenId === item.id ? null : item.id)}
              onClose={() => setMenuOpenId(null)}
              onDelete={() => handleDelete(item)}
            />
          ))}
        </div>
      )}

      {showAdd && (
        <GoodsAddModal onClose={() => setShowAdd(false)} onSuccess={() => { setShowAdd(false); load(); }} />
      )}

      <style jsx>{`
        :global(.v3-goods-grid) {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
          gap: 10px;
        }
        @media (max-width: 640px) {
          :global(.v3-goods-stats) {
            grid-template-columns: 1fr 1fr !important;
          }
          :global(.v3-goods-grid) {
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

function Tab({ active, onClick, label, count }: any) {
  return (
    <button
      onClick={onClick}
      style={{
        flexShrink: 0,
        padding: '7px 12px',
        borderRadius: 100,
        border: '1px solid',
        borderColor: active ? 'var(--accent)' : 'var(--border)',
        background: active ? 'var(--accent)' : 'var(--surface)',
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

function GoodsCard({ item, isAdmin, menuOpen, onToggleMenu, onClose, onDelete }: any) {
  const qty = Number(item.stock_qty || 0);
  const lowAlert = Number(item.low_stock_alert || 5);
  const isOut = qty === 0;
  const isLow = qty > 0 && qty <= lowAlert;
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
      {/* Status badge top right */}
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

      {/* Menu */}
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
              <Link href={`/dashboard/goods/sell`} style={menuLinkStyle}>
                <ShoppingCart size={13} /> ขาย
              </Link>
              <Link href={`/dashboard/goods/stock`} style={menuLinkStyle}>
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

      {/* Icon */}
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
      }}>
        <Package size={36} color="#94a3b8" strokeWidth={1.5} />
      </div>

      {/* Info */}
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

      {item.category && (
        <div style={{
          fontSize: 10,
          color: 'var(--text-dim)',
          marginBottom: 6,
        }}>
          <Tag size={9} style={{ display: 'inline', marginRight: 3, verticalAlign: '-1px' }} />
          {item.category}
        </div>
      )}

      {/* Price + Qty */}
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

function EmptyState({ hasFilters }: any) {
  return (
    <div className="v3-card" style={{ textAlign: 'center', padding: 40 }}>
      <ShoppingBag size={48} strokeWidth={1.2} style={{ margin: '0 auto 12px', color: 'var(--text-muted)' }} />
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
        {hasFilters ? 'ไม่พบสินค้าตามที่ค้นหา' : 'ยังไม่มีสินค้าในสต๊อก'}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 16 }}>
        {hasFilters ? 'ลองเปลี่ยนตัวกรอง' : 'เริ่มต้นโดยการเพิ่มสินค้าใหม่'}
      </div>
      {!hasFilters && (
        <Link href="/dashboard/goods/add" className="v3-btn v3-btn-primary" style={{ textDecoration: 'none' }}>
          <Plus size={14} /> เพิ่มสินค้า
        </Link>
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
