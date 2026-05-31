'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-client';
import {
  Plus, Search, Filter, Smartphone, Eye, Edit2, Tag,
  Package, CheckCircle2, Clock, Ban, ShoppingCart,
  ChevronDown, X,
} from 'lucide-react';

interface StockItem {
  id: string;
  imei: string;
  model: string;
  color?: string | null;
  spec?: string | null;
  price: number;
  cost_price?: number | null;
  device_condition?: string | null;
  added_date?: string;
  branch_id?: string;
  branches?: any;
}

export default function V3StockPage() {
  const supabase = createClient();
  const [items, setItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [search, setSearch] = useState('');
  const [filterCondition, setFilterCondition] = useState<string>(''); // 'new' | 'used' | ''
  const [filterModel, setFilterModel] = useState<string>('');
  const [filterColor, setFilterColor] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
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
          .from('stock')
          .select('*, branches(name)')
          .order('added_date', { ascending: false });

        setItems((data || []) as StockItem[]);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Filtered
  const filtered = useMemo(() => {
    return items.filter(it => {
      if (search) {
        const s = search.toLowerCase();
        const hit =
          it.imei.toLowerCase().includes(s) ||
          it.model.toLowerCase().includes(s) ||
          (it.color && it.color.toLowerCase().includes(s)) ||
          (it.spec && it.spec.toLowerCase().includes(s));
        if (!hit) return false;
      }
      if (filterCondition && it.device_condition !== filterCondition) return false;
      if (filterModel && !it.model.toLowerCase().includes(filterModel.toLowerCase())) return false;
      if (filterColor && it.color && !it.color.toLowerCase().includes(filterColor.toLowerCase())) return false;
      return true;
    });
  }, [items, search, filterCondition, filterModel, filterColor]);

  // Summary stats
  const stats = useMemo(() => {
    const total = items.length;
    const totalValue = items.reduce((s, i) => s + Number(i.price || 0), 0);
    const newCount = items.filter(i => i.device_condition === 'new').length;
    const usedCount = items.filter(i => i.device_condition === 'used').length;
    return { total, totalValue, newCount, usedCount };
  }, [items]);

  // Unique models/colors for filter
  const uniqueModels = useMemo(() => {
    const set = new Set(items.map(i => i.model).filter(Boolean));
    return Array.from(set).sort();
  }, [items]);

  const uniqueColors = useMemo(() => {
    const set = new Set(items.map(i => i.color).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [items]);

  function clearFilters() {
    setSearch('');
    setFilterCondition('');
    setFilterModel('');
    setFilterColor('');
  }

  const hasFilters = !!(search || filterCondition || filterModel || filterColor);

  return (
    <>
      {/* Header */}
      <div className="v3-page-header v3-desktop-only">
        <div>
          <h1 className="v3-page-title">📱 สต๊อกเครื่อง</h1>
          <p className="v3-page-subtitle">เครื่องในสต๊อกทั้งหมด {stats.total} เครื่อง</p>
        </div>
        <Link href="/dashboard/add" className="v3-btn v3-btn-primary" style={{ textDecoration: 'none' }}>
          <Plus size={16} strokeWidth={2.5} /> เพิ่มเครื่องใหม่
        </Link>
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
            สต๊อกเครื่อง
          </h1>
          <p style={{ fontSize: 11, color: 'var(--text-dim)' }}>
            ทั้งหมด {stats.total} เครื่อง
          </p>
        </div>
        <Link href="/dashboard/add" style={{
          width: 40, height: 40,
          borderRadius: 10,
          background: 'var(--accent)',
          color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          textDecoration: 'none',
        }}>
          <Plus size={20} strokeWidth={2.5} />
        </Link>
      </div>

      {/* Search + Filters */}
      <div className="v3-card" style={{ marginBottom: 14, padding: 12 }}>
        <div style={{ position: 'relative', marginBottom: 10 }}>
          <Search
            size={16}
            style={{
              position: 'absolute', left: 12, top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)', pointerEvents: 'none',
            }}
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหา IMEI, รุ่น, สี..."
            style={{
              width: '100%',
              height: 40,
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

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Condition */}
          <select
            value={filterCondition}
            onChange={(e) => setFilterCondition(e.target.value)}
            style={selectStyle}
          >
            <option value="">สภาพทั้งหมด</option>
            <option value="new">เครื่องใหม่</option>
            <option value="used">เครื่องมือสอง</option>
          </select>

          {/* Model */}
          <select
            value={filterModel}
            onChange={(e) => setFilterModel(e.target.value)}
            style={selectStyle}
          >
            <option value="">รุ่นทั้งหมด</option>
            {uniqueModels.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>

          {/* Color */}
          <select
            value={filterColor}
            onChange={(e) => setFilterColor(e.target.value)}
            style={selectStyle}
          >
            <option value="">สีทั้งหมด</option>
            {uniqueColors.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          {hasFilters && (
            <button
              onClick={clearFilters}
              style={{
                padding: '6px 10px',
                fontSize: 11,
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                cursor: 'pointer',
                color: 'var(--text-dim)',
                fontFamily: 'inherit',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <X size={12} /> ล้าง
            </button>
          )}

          <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-dim)' }}>
            พบ <strong style={{ color: 'var(--text)' }}>{filtered.length}</strong> รายการ
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: 10,
        marginBottom: 16,
      }}>
        <SummaryCard
          Icon={Package}
          label="ทั้งหมด"
          value={`${stats.total} เครื่อง`}
          color="#3b82f6"
        />
        {isAdmin && (
          <SummaryCard
            Icon={Tag}
            label="มูลค่าสต๊อก"
            value={`฿${stats.totalValue.toLocaleString()}`}
            color="#22c55e"
          />
        )}
        <SummaryCard
          Icon={CheckCircle2}
          label="เครื่องใหม่"
          value={`${stats.newCount} เครื่อง`}
          color="#06b6d4"
        />
        <SummaryCard
          Icon={Clock}
          label="เครื่องมือสอง"
          value={`${stats.usedCount} เครื่อง`}
          color="#f59e0b"
        />
      </div>

      {/* Stock Grid */}
      {loading ? (
        <div className="v3-card" style={{ textAlign: 'center', padding: 40, color: 'var(--text-dim)' }}>
          กำลังโหลด...
        </div>
      ) : filtered.length === 0 ? (
        <div className="v3-card" style={{ textAlign: 'center', padding: 40 }}>
          <Smartphone size={48} strokeWidth={1.2} style={{ margin: '0 auto 12px', color: 'var(--text-muted)' }} />
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
            {hasFilters ? 'ไม่พบเครื่องตามที่ค้นหา' : 'ยังไม่มีเครื่องในสต๊อก'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 16 }}>
            {hasFilters ? 'ลองล้างตัวกรอง' : 'เริ่มต้นโดยการเพิ่มเครื่องใหม่'}
          </div>
          {hasFilters ? (
            <button onClick={clearFilters} className="v3-btn v3-btn-secondary">
              <X size={14} /> ล้างตัวกรอง
            </button>
          ) : (
            <Link href="/dashboard/add" className="v3-btn v3-btn-primary" style={{ textDecoration: 'none' }}>
              <Plus size={14} /> เพิ่มเครื่อง
            </Link>
          )}
        </div>
      ) : (
        <div className="v3-stock-grid">
          {filtered.map(item => (
            <StockCard key={item.id} item={item} isAdmin={isAdmin} />
          ))}
        </div>
      )}

      <style jsx>{`
        :global(.v3-mobile-only) { display: none; }
        @media (max-width: 1024px) {
          :global(.v3-mobile-only) { display: flex !important; }
        }

        :global(.v3-stock-grid) {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
          gap: 12px;
        }
        @media (max-width: 640px) {
          :global(.v3-stock-grid) {
            grid-template-columns: 1fr 1fr;
            gap: 10px;
          }
        }
      `}</style>
    </>
  );
}

/* ============ Helper Components ============ */

const selectStyle: React.CSSProperties = {
  padding: '6px 24px 6px 10px',
  fontSize: 12,
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  cursor: 'pointer',
  color: 'var(--text)',
  fontFamily: 'inherit',
  outline: 'none',
};

function SummaryCard({ Icon, label, value, color }: any) {
  return (
    <div className="v3-card" style={{ padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 32, height: 32,
          borderRadius: 8,
          background: `${color}15`,
          color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Icon size={16} strokeWidth={2.2} />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{label}</div>
          <div style={{
            fontSize: 15, fontWeight: 700,
            fontFamily: 'Prompt, Sarabun, sans-serif',
            letterSpacing: '-0.3px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {value}
          </div>
        </div>
      </div>
    </div>
  );
}

function StockCard({ item, isAdmin }: { item: StockItem; isAdmin: boolean }) {
  const profit = (Number(item.price) || 0) - (Number(item.cost_price) || 0);
  const profitPct = item.cost_price ? ((profit / Number(item.cost_price)) * 100) : 0;

  return (
    <Link
      href={`/dashboard/stock`}
      style={{
        display: 'block',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        padding: 12,
        textDecoration: 'none',
        color: 'var(--text)',
        transition: 'all 0.15s',
      }}
    >
      {/* Phone Image Area */}
      <div style={{
        background: '#f8fafc',
        borderRadius: 10,
        padding: 12,
        marginBottom: 10,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: 110,
        position: 'relative',
      }}>
        <PhoneBigSVG model={item.model} color={item.color} />
        <span style={{
          position: 'absolute',
          top: 6, right: 6,
          fontSize: 9,
          fontWeight: 700,
          padding: '2px 6px',
          borderRadius: 100,
          background: item.device_condition === 'new' ? '#dcfce7' : '#fef3c7',
          color: item.device_condition === 'new' ? '#166534' : '#92400e',
        }}>
          {item.device_condition === 'new' ? 'ใหม่' : 'มือ2'}
        </span>
      </div>

      {/* Info */}
      <div style={{ marginBottom: 8 }}>
        <div style={{
          fontSize: 14, fontWeight: 700,
          fontFamily: 'Prompt, Sarabun, sans-serif',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {item.model}
        </div>
        {item.spec && (
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 1 }}>
            {item.spec}{item.color ? ` • ${item.color}` : ''}
          </div>
        )}
      </div>

      {/* IMEI */}
      <div style={{
        fontSize: 9,
        fontFamily: 'monospace',
        color: 'var(--text-muted)',
        background: 'var(--surface-2)',
        padding: '4px 8px',
        borderRadius: 6,
        marginBottom: 10,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}>
        IMEI: {item.imei}
      </div>

      {/* Price details */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11 }}>
        {isAdmin && item.cost_price && (
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-dim)' }}>
            <span>ต้นทุน</span>
            <span style={{ fontWeight: 600 }}>฿{Number(item.cost_price).toLocaleString()}</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--text-dim)' }}>ราคาขาย</span>
          <span style={{ fontWeight: 700, color: 'var(--accent)' }}>
            ฿{Number(item.price).toLocaleString()}
          </span>
        </div>
        {isAdmin && item.cost_price && profit !== 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-dim)' }}>กำไร</span>
            <span style={{
              fontWeight: 700,
              color: profit > 0 ? '#22c55e' : '#ef4444',
            }}>
              ฿{profit.toLocaleString()} {profitPct ? `(${profitPct.toFixed(0)}%)` : ''}
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}

function PhoneBigSVG({ model, color }: { model: string; color?: string | null }) {
  const m = (model || '').toLowerCase();
  const c = (color || '').toLowerCase();
  
  let bodyColor = '#1c1c1e';
  let screenColor = '#000';
  let hasDynamicIsland = false;
  let hasNotch = false;
  
  // Color from color field first
  if (c.includes('white') || c.includes('starlight') || c.includes('silver')) bodyColor = '#f5f5f7';
  else if (c.includes('blue') || c.includes('sierra')) bodyColor = '#1e40af';
  else if (c.includes('red')) bodyColor = '#dc2626';
  else if (c.includes('green')) bodyColor = '#16a34a';
  else if (c.includes('purple') || c.includes('violet')) bodyColor = '#7c3aed';
  else if (c.includes('pink') || c.includes('rose')) bodyColor = '#ec4899';
  else if (c.includes('gold')) bodyColor = '#f59e0b';
  else if (c.includes('midnight') || c.includes('black') || c.includes('graphite')) bodyColor = '#0f172a';
  
  // Notch/island detection from model
  if (m.match(/iphone\s*1[4-9]|iphone\s*2[0-9]/)) {
    if (m.includes('pro')) hasDynamicIsland = true;
    else hasNotch = true;
  } else if (m.match(/iphone\s*(x|11|12|13)/)) {
    hasNotch = true;
  }

  return (
    <svg width="56" height="86" viewBox="0 0 56 86" xmlns="http://www.w3.org/2000/svg">
      <rect
        x="2" y="2"
        width="52" height="82"
        rx="8" ry="8"
        fill={bodyColor}
        stroke="rgba(0,0,0,0.1)"
        strokeWidth="0.5"
      />
      <rect
        x="5" y="6"
        width="46" height="74"
        rx="5" ry="5"
        fill={screenColor}
      />
      {hasNotch && (
        <rect x="20" y="6" width="16" height="3" rx="1.5" fill={bodyColor} />
      )}
      {hasDynamicIsland && (
        <rect x="22" y="9" width="12" height="3" rx="1.5" fill="#000" />
      )}
      {!hasNotch && !hasDynamicIsland && (
        <rect x="24" y="9" width="8" height="1.2" rx="0.6" fill="rgba(255,255,255,0.2)" />
      )}
    </svg>
  );
}
