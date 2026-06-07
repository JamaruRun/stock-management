'use client';

import { useEffect, useState, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';
import {
  Plus, Search, Filter, Smartphone, X, MoreVertical,
  Package, CheckCircle2, Clock, ShoppingCart, Tag,
  Edit2, Trash2, Eye, Printer, Copy, Calendar,
  ChevronDown, ArrowLeft,
} from 'lucide-react';
import StockAddModal from './StockAddModal';
import StockDetailModal from './StockDetailModal';

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
  added_by_name?: string | null;
  branch_id?: string;
  supplier_id?: string | null;
  image_url?: string | null;
  branches?: any;
  suppliers?: any;
}

export default function V3StockPage() {
  return (
    <Suspense fallback={<div className="v3-card" style={{ padding: 40, textAlign: 'center' }}>กำลังโหลด...</div>}>
      <V3StockContent />
    </Suspense>
  );
}

function V3StockContent() {
  const searchParams = useSearchParams();
  const autoAdd = searchParams.get('add') === '1';
  const supabase = createClient();
  const [items, setItems] = useState<StockItem[]>([]);
  const [soldCount, setSoldCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterBrand, setFilterBrand] = useState<string>('');
  const [filterModel, setFilterModel] = useState<string>('');
  const [filterColor, setFilterColor] = useState<string>('');
  const [showAddModal, setShowAddModal] = useState(autoAdd);
  const [detailItem, setDetailItem] = useState<StockItem | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

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

      const [stockRes, salesRes] = await Promise.all([
        supabase
          .from('stock')
          .select('*, branches(name), suppliers(name)')
          .order('added_date', { ascending: false }),
        supabase
          .from('sales_history')
          .select('id', { count: 'exact', head: true }),
      ]);

      setItems((stockRes.data || []) as StockItem[]);
      setSoldCount(salesRes.count || 0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // Derived data
  const brands = useMemo(() => {
    const set = new Set<string>();
    items.forEach(i => {
      const b = detectBrand(i.model);
      if (b) set.add(b);
    });
    return Array.from(set).sort();
  }, [items]);

  const uniqueModels = useMemo(() => {
    return Array.from(new Set(items.map(i => i.model).filter(Boolean))).sort();
  }, [items]);

  const uniqueColors = useMemo(() => {
    return Array.from(new Set(items.map(i => i.color).filter(Boolean) as string[])).sort();
  }, [items]);

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
      if (filterStatus === 'new' && it.device_condition !== 'new') return false;
      if (filterStatus === 'used' && it.device_condition !== 'used') return false;
      if (filterBrand) {
        const b = detectBrand(it.model);
        if (b !== filterBrand) return false;
      }
      if (filterModel && it.model !== filterModel) return false;
      if (filterColor && it.color !== filterColor) return false;
      return true;
    });
  }, [items, search, filterStatus, filterBrand, filterModel, filterColor]);

  // Stats (5 cards ตาม ref)
  const stats = useMemo(() => {
    const total = items.length;
    const totalValue = items.reduce((s, i) => s + Number(i.price || 0), 0);
    const ready = items.length; // stock ทั้งหมด = พร้อมขาย
    return { total, totalValue, ready };
  }, [items]);

  function clearFilters() {
    setSearch('');
    setFilterStatus('');
    setFilterBrand('');
    setFilterModel('');
    setFilterColor('');
  }
  const hasFilters = !!(search || filterStatus || filterBrand || filterModel || filterColor);

  async function handleDelete(item: StockItem) {
    if (!confirm(`ลบเครื่อง ${item.model} (IMEI: ${item.imei})?\n\nการลบนี้ย้อนกลับไม่ได้`)) return;
    const { error } = await supabase.from('stock').delete().eq('id', item.id);
    if (error) {
      alert('ลบไม่สำเร็จ: ' + error.message);
      return;
    }
    setMenuOpenId(null);
    load();
  }

  return (
    <>
      {/* Desktop Page Header */}
      <div className="v3-page-header v3-desktop-only">
        <div>
          <h1 className="v3-page-title">สต๊อกเครื่อง</h1>
          <p className="v3-page-subtitle">เครื่องในสต๊อกทั้งหมด {stats.total} เครื่อง</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="v3-btn v3-btn-primary">
          <Plus size={16} strokeWidth={2.5} /> เพิ่มเครื่องใหม่
        </button>
      </div>

      {/* Mobile mini-header */}
      <div className="v3-mobile-only" style={mobileHeaderStyle}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, fontFamily: 'Prompt, sans-serif' }}>
            สต๊อกเครื่อง
          </h1>
          <p style={{ fontSize: 11, color: 'var(--text-dim)' }}>
            ทั้งหมด {stats.total} เครื่อง
          </p>
        </div>
        <button onClick={() => setShowAddModal(true)} style={mobileAddBtnStyle}>
          <Plus size={20} strokeWidth={2.5} />
        </button>
      </div>

      {/* Search + Filters - แถวเดียวเหมือน ref */}
      <div className="v3-card v3-filter-bar" style={{ marginBottom: 12, padding: 10 }}>
        <div className="v3-filter-row">
          {/* Search */}
          <div className="v3-filter-search">
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
              placeholder="ค้นหา IMEI, รุ่น, สี, ลูกค้า..."
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

          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={selectStyle}>
            <option value="">สถานะทั้งหมด</option>
            <option value="new">เครื่องใหม่</option>
            <option value="used">เครื่องมือสอง</option>
          </select>

          <select value={filterBrand} onChange={(e) => setFilterBrand(e.target.value)} style={selectStyle}>
            <option value="">ยี่ห้อ</option>
            {brands.map(b => <option key={b} value={b}>{b}</option>)}
          </select>

          <select value={filterModel} onChange={(e) => setFilterModel(e.target.value)} style={selectStyle}>
            <option value="">รุ่น</option>
            {uniqueModels.map(m => <option key={m} value={m}>{m}</option>)}
          </select>

          <select value={filterColor} onChange={(e) => setFilterColor(e.target.value)} style={selectStyle}>
            <option value="">สี</option>
            {uniqueColors.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          {hasFilters && (
            <button onClick={clearFilters} style={clearBtnStyle}>
              <X size={12} /> ล้างตัวกรอง
            </button>
          )}
        </div>

        {/* count result row */}
        <div style={{
          fontSize: 11, color: 'var(--text-dim)',
          marginTop: 8,
          textAlign: 'right',
        }}>
          พบ <strong style={{ color: 'var(--text)' }}>{filtered.length}</strong> รายการ
        </div>
      </div>

      {/* Summary 5 cards */}
      <div className="v3-summary-grid" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: 10,
        marginBottom: 14,
      }}>
        <SummaryCard Icon={Package} label="เครื่องทั้งหมด" value={`${stats.total}`} unit="เครื่อง" color="#3b82f6" />
        {isAdmin && (
          <SummaryCard Icon={Tag} label="มูลค่าสต๊อก" value={`฿${stats.totalValue.toLocaleString()}`} unit="" color="#22c55e" />
        )}
        <SummaryCard Icon={CheckCircle2} label="พร้อมขาย" value={`${stats.ready}`} unit="เครื่อง" color="#10b981" />
        <SummaryCard Icon={ShoppingCart} label="ขายแล้ว" value={`${soldCount}`} unit="เครื่อง" color="#f59e0b" />
        <SummaryCard Icon={Clock} label="รอตรวจสภาพ" value="0" unit="เครื่อง" color="#ef4444" />
      </div>

      {/* Stock Grid */}
      {loading ? (
        <div className="v3-card" style={{ textAlign: 'center', padding: 40, color: 'var(--text-dim)' }}>
          กำลังโหลด...
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState hasFilters={hasFilters} onClear={clearFilters} onAdd={() => setShowAddModal(true)} />
      ) : (
        <div className="v3-stock-grid">
          {filtered.map(item => (
            <StockCardV2
              key={item.id}
              item={item}
              isAdmin={isAdmin}
              onClick={() => setDetailItem(item)}
              menuOpen={menuOpenId === item.id}
              onToggleMenu={() => setMenuOpenId(menuOpenId === item.id ? null : item.id)}
              onDelete={() => handleDelete(item)}
              onClose={() => setMenuOpenId(null)}
            />
          ))}
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <StockAddModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => { setShowAddModal(false); load(); }}
        />
      )}

      {/* Detail Modal */}
      {detailItem && (
        <StockDetailModal
          item={detailItem}
          isAdmin={isAdmin}
          onClose={() => setDetailItem(null)}
          onDeleted={() => { setDetailItem(null); load(); }}
          onRefresh={() => load()}
        />
      )}

      <style jsx>{`
        :global(.v3-mobile-only) { display: none; }
        :global(.v3-desktop-only) { display: flex; }
        @media (max-width: 1024px) {
          :global(.v3-mobile-only) { display: flex !important; }
          :global(.v3-desktop-only) { display: none !important; }
        }

        :global(.v3-stock-grid) {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 12px;
        }
        @media (max-width: 640px) {
          :global(.v3-stock-grid) {
            grid-template-columns: 1fr;
            gap: 10px;
          }
        }

        /* Filter bar - ค้นหาเต็มแถว, dropdown ขึ้นบรรทัดใหม่ได้เสมอ (กันล้นกรอบ) */
        :global(.v3-filter-row) {
          display: flex;
          gap: 8px;
          align-items: center;
          flex-wrap: wrap;
        }
        :global(.v3-filter-search) {
          position: relative;
          flex: 1 1 100%;
          min-width: 0;
        }
        :global(.v3-filter-row select) {
          flex: 1 1 120px;
          min-width: 0;
          max-width: 100%;
        }

        @media (max-width: 1280px) {
          :global(.v3-filter-search) {
            flex: 1 1 100%;
            min-width: 0;
          }
        }

        /* Mobile - 2 columns dropdowns */
        @media (max-width: 640px) {
          :global(.v3-filter-row) {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
          }
          :global(.v3-filter-search) {
            grid-column: span 2;
          }
          :global(.v3-filter-row select) {
            width: 100%;
          }
          :global(.v3-filter-row > button) {
            grid-column: span 2;
          }
        }
      `}</style>
    </>
  );
}

/* =========================================================
   Components
========================================================= */

function SummaryCard({ Icon, label, value, unit, color }: any) {
  return (
    <div className="v3-card" style={{ padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 36, height: 36,
          borderRadius: 10,
          background: `${color}15`,
          color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Icon size={18} strokeWidth={2.2} />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 1 }}>{label}</div>
          <div style={{
            fontSize: 16, fontWeight: 700,
            fontFamily: 'Prompt, Sarabun, sans-serif',
            letterSpacing: '-0.3px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {value}{unit && <span style={{ fontSize: 10, color: 'var(--text-dim)', marginLeft: 4, fontWeight: 500 }}>{unit}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

function StockCardV2({ item, isAdmin, onClick, menuOpen, onToggleMenu, onDelete, onClose }: any) {
  const profit = (Number(item.price) || 0) - (Number(item.cost_price) || 0);

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        padding: 14,
        position: 'relative',
        transition: 'all 0.15s',
        cursor: 'pointer',
      }}
      onClick={onClick}
    >
      {/* Top row: image + info + menu */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
        {/* Phone image */}
        <div style={{
          width: 64,
          height: 80,
          background: '#f8fafc',
          borderRadius: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          overflow: 'hidden',
        }}>
          {item.image_url ? (
            <img
              src={item.image_url}
              alt={item.model}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                padding: 4,
              }}
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                const parent = target.parentElement;
                if (parent && !parent.querySelector('svg')) {
                  // Fallback ก็ใช้ SVG ก็จะถูก render โดย React lifecycle
                }
              }}
            />
          ) : (
            <PhoneSVG model={item.model} color={item.color} />
          )}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 15,
            fontWeight: 700,
            fontFamily: 'Prompt, Sarabun, sans-serif',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            paddingRight: 24,
          }}>
            {item.model}
          </div>
          {item.spec && (
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 1 }}>{item.spec}</div>
          )}
          {item.color && (
            <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{item.color}</div>
          )}
          <div style={{
            fontSize: 9,
            fontFamily: 'monospace',
            color: 'var(--text-muted)',
            marginTop: 4,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            IMEI: {item.imei}
          </div>
        </div>

        {/* Menu button */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggleMenu(); }}
          style={{
            position: 'absolute',
            top: 8, right: 8,
            width: 28, height: 28,
            background: 'transparent',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            color: 'var(--text-dim)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <MoreVertical size={16} />
        </button>

        {menuOpen && (
          <>
            <div
              onClick={(e) => { e.stopPropagation(); onClose(); }}
              style={{ position: 'fixed', inset: 0, zIndex: 19 }}
            />
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'absolute',
                top: 38, right: 8,
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                boxShadow: 'var(--shadow-lg)',
                minWidth: 140,
                padding: 4,
                zIndex: 20,
              }}
            >
              <MenuItem Icon={Eye} label="ดูรายละเอียด" onClick={() => { onClose(); onClick(); }} />
              <Link
                href={`/v3/sell?imei=${encodeURIComponent(item.imei)}`}
                style={menuLinkStyle}
                onClick={(e) => e.stopPropagation()}
              >
                <ShoppingCart size={14} /> ขายเครื่องนี้
              </Link>
              <MenuItem Icon={Trash2} label="ลบ" onClick={onDelete} danger />
            </div>
          </>
        )}
      </div>

      {/* Divider */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
        {isAdmin && (
          <PriceRow
            label="ต้นทุน"
            value={item.cost_price && Number(item.cost_price) > 0
              ? `฿${Number(item.cost_price).toLocaleString()}`
              : 'ไม่มี'}
            muted={!item.cost_price || Number(item.cost_price) === 0}
          />
        )}
        <PriceRow label="ราคาขาย" value={`฿${Number(item.price).toLocaleString()}`} accent />
        {isAdmin && (
          <PriceRow
            label="กำไร"
            value={item.cost_price && Number(item.cost_price) > 0
              ? `฿${profit.toLocaleString()}`
              : 'ไม่มี'}
            color={
              !item.cost_price || Number(item.cost_price) === 0
                ? undefined
                : profit > 0 ? '#22c55e' : profit < 0 ? '#ef4444' : undefined
            }
            muted={!item.cost_price || Number(item.cost_price) === 0}
          />
        )}
      </div>

      {/* Bottom: Status badge */}
      <div style={{
        marginTop: 10,
        paddingTop: 10,
        borderTop: '1px solid var(--border)',
      }}>
        <span style={{
          display: 'inline-block',
          padding: '4px 12px',
          background: '#dcfce7',
          color: '#166534',
          fontSize: 11,
          fontWeight: 600,
          borderRadius: 100,
        }}>
          พร้อมขาย
        </span>
      </div>
    </div>
  );
}

function PriceRow({ label, value, accent, color, muted }: any) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between',
      fontSize: 12,
      marginBottom: 4,
    }}>
      <span style={{ color: 'var(--text-dim)' }}>{label}</span>
      <span style={{
        fontWeight: accent ? 700 : 600,
        color: muted
          ? 'var(--text-muted)'
          : color || (accent ? 'var(--accent)' : 'var(--text)'),
        fontStyle: muted ? 'italic' : 'normal',
      }}>
        {value}
      </span>
    </div>
  );
}

function MenuItem({ Icon, label, onClick, danger }: any) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 10px',
        width: '100%',
        background: 'transparent',
        border: 'none',
        borderRadius: 6,
        color: danger ? 'var(--danger)' : 'var(--text)',
        fontSize: 12,
        fontFamily: 'inherit',
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      <Icon size={14} /> {label}
    </button>
  );
}

function EmptyState({ hasFilters, onClear, onAdd }: any) {
  return (
    <div className="v3-card" style={{ textAlign: 'center', padding: 40 }}>
      <Smartphone size={48} strokeWidth={1.2} style={{ margin: '0 auto 12px', color: 'var(--text-muted)' }} />
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
        {hasFilters ? 'ไม่พบเครื่องตามที่ค้นหา' : 'ยังไม่มีเครื่องในสต๊อก'}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 16 }}>
        {hasFilters ? 'ลองล้างตัวกรอง' : 'เริ่มต้นโดยการเพิ่มเครื่องใหม่'}
      </div>
      {hasFilters ? (
        <button onClick={onClear} className="v3-btn v3-btn-secondary">
          <X size={14} /> ล้างตัวกรอง
        </button>
      ) : (
        <button onClick={onAdd} className="v3-btn v3-btn-primary">
          <Plus size={14} /> เพิ่มเครื่อง
        </button>
      )}
    </div>
  );
}

/* Phone SVG */
function PhoneSVG({ model, color }: { model: string; color?: string | null }) {
  const m = (model || '').toLowerCase();
  const c = (color || '').toLowerCase();
  let bodyColor = '#1c1c1e';
  let hasNotch = false;
  let hasDynamicIsland = false;
  if (c.includes('white') || c.includes('starlight') || c.includes('silver')) bodyColor = '#f5f5f7';
  else if (c.includes('blue') || c.includes('sierra')) bodyColor = '#1e40af';
  else if (c.includes('red')) bodyColor = '#dc2626';
  else if (c.includes('green')) bodyColor = '#16a34a';
  else if (c.includes('purple') || c.includes('violet')) bodyColor = '#7c3aed';
  else if (c.includes('pink') || c.includes('rose')) bodyColor = '#ec4899';
  else if (c.includes('gold')) bodyColor = '#f59e0b';
  else if (c.includes('midnight') || c.includes('black') || c.includes('graphite')) bodyColor = '#0f172a';
  if (m.match(/iphone\s*1[4-9]|iphone\s*2[0-9]/) && m.includes('pro')) hasDynamicIsland = true;
  else if (m.match(/iphone\s*(x|11|12|13|14|15)/)) hasNotch = true;

  return (
    <svg width="40" height="60" viewBox="0 0 40 60">
      <rect x="2" y="2" width="36" height="56" rx="6" fill={bodyColor} stroke="rgba(0,0,0,0.1)" strokeWidth="0.5" />
      <rect x="4" y="5" width="32" height="50" rx="4" fill="#000" />
      {hasNotch && <rect x="14" y="5" width="12" height="2" rx="1" fill={bodyColor} />}
      {hasDynamicIsland && <rect x="16" y="7" width="8" height="2" rx="1" fill="#000" />}
    </svg>
  );
}

function detectBrand(model: string): string {
  const m = (model || '').toLowerCase();
  if (m.includes('iphone') || m.includes('ipad') || m.includes('apple')) return 'Apple';
  if (m.includes('samsung') || m.match(/galaxy|a\d{2}|s\d{2}/i)) return 'Samsung';
  if (m.includes('oppo')) return 'OPPO';
  if (m.includes('vivo')) return 'Vivo';
  if (m.includes('xiaomi') || m.includes('redmi') || m.includes('mi ')) return 'Xiaomi';
  if (m.includes('realme')) return 'Realme';
  if (m.includes('huawei')) return 'Huawei';
  return 'อื่นๆ';
}

/* Styles */
const mobileHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 12,
};

const mobileAddBtnStyle: React.CSSProperties = {
  width: 40, height: 40,
  borderRadius: 10,
  background: 'var(--accent)',
  color: '#fff',
  border: 'none',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer',
};

const searchInputStyle: React.CSSProperties = {
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
};

const selectStyle: React.CSSProperties = {
  padding: '0 24px 0 10px',
  height: 38,
  fontSize: 12,
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  cursor: 'pointer',
  color: 'var(--text)',
  fontFamily: 'inherit',
  outline: 'none',
  width: '100%',
  minWidth: 0,
  maxWidth: '100%',
  textOverflow: 'ellipsis',
  boxSizing: 'border-box',
};

const clearBtnStyle: React.CSSProperties = {
  padding: '0 12px',
  height: 38,
  fontSize: 11,
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  cursor: 'pointer',
  color: 'var(--text-dim)',
  fontFamily: 'inherit',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  whiteSpace: 'nowrap',
};

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
