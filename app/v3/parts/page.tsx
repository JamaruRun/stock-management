'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-client';
import {
  Plus, Search, Wrench, MoreVertical, Smartphone,
  AlertTriangle, Eye, Trash2, ShoppingCart,
  TrendingUp, Edit2, Box, X, Loader2, PackagePlus,
} from 'lucide-react';
import { PART_CATEGORIES, PART_GRADES, getCategoryLabel, getGradeInfo } from '@/lib/parts-constants';
import { fetchAllRows } from '@/lib/db-utils';
import PartAddModal from './PartAddModal';
import PartSellModal from './PartSellModal';
import PartEditModal from './PartEditModal';
import PartRepairModal from './PartRepairModal';
import PartRestockModal from './PartRestockModal';

interface PartItem {
  id: string;
  sku?: string | null;
  name: string;
  category: string;
  phone_model: string;
  battery_model?: string | null;
  brand?: string | null;
  grade?: string | null;
  cost_price?: number | null;
  wholesale_price?: number | null;
  sell_price: number;
  stock_qty: number;
  low_stock_alert?: number | null;
  note?: string | null;
  supplier_id?: string | null;
  added_by_name?: string | null;
  created_at?: string;
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
  const [showRepair, setShowRepair] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [restockItem, setRestockItem] = useState<any>(null);
  const [viewItem, setViewItem] = useState<any>(null);
  const [modelsByPart, setModelsByPart] = useState<Record<string, string[]>>({});
  const [searchMode, setSearchMode] = useState<'part' | 'model'>('part');
  const [modelQuery, setModelQuery] = useState('');
  const [modelSuggestions, setModelSuggestions] = useState<{ id: string; model_name: string }[]>([]);
  const [selectedModel, setSelectedModel] = useState<{ id: string; model_name: string } | null>(null);
  const [viewMode, setViewMode] = useState<'active' | 'dead'>('active');
  const [lastMoveByPart, setLastMoveByPart] = useState<Record<string, string>>({});
  const [lastReceivedByPart, setLastReceivedByPart] = useState<Record<string, string>>({});
  const [deadStockDays, setDeadStockDays] = useState(90);

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

      // .select() ของ Supabase คืนได้สูงสุด 1000 แถวต่อครั้งเสมอ (แม้ไม่ได้ใส่ .limit() เอง) — ต้อง page ผ่าน fetchAllRows
      // ไม่งั้นพอร้านมีอะไหล่/ประวัติเกิน 1000 แถว รายการที่เพิ่มใหม่บางส่วนจะหายไปจากหน้าจอเงียบๆ ทั้งที่บันทึกลง DB สำเร็จแล้วจริงๆ
      const data = await fetchAllRows<PartItem>(() =>
        supabase.from('parts').select('*').order('phone_model', { ascending: true }).order('id', { ascending: true })
      );
      setItems(data);

      const compatRows = await fetchAllRows<any>(() =>
        supabase.from('part_compatibility').select('part_id, device_models(model_name)').order('part_id', { ascending: true })
      );
      const map: Record<string, string[]> = {};
      compatRows.forEach((r: any) => {
        const name = r.device_models?.model_name;
        if (!name) return;
        if (!map[r.part_id]) map[r.part_id] = [];
        map[r.part_id].push(name);
      });
      setModelsByPart(map);

      const txRows = await fetchAllRows<any>(() =>
        supabase.from('part_transactions').select('part_id, type, created_at').in('type', ['out', 'used_in_repair']).order('id', { ascending: true })
      );
      const lastMove: Record<string, string> = {};
      txRows.forEach((t: any) => {
        if (!t.part_id || !t.created_at) return;
        if (!lastMove[t.part_id] || t.created_at > lastMove[t.part_id]) lastMove[t.part_id] = t.created_at;
      });
      setLastMoveByPart(lastMove);

      const inRows = await fetchAllRows<any>(() =>
        supabase.from('part_transactions').select('part_id, created_at').eq('type', 'in').order('id', { ascending: true })
      );
      const lastReceived: Record<string, string> = {};
      inRows.forEach((t: any) => {
        if (!t.part_id || !t.created_at) return;
        if (!lastReceived[t.part_id] || t.created_at > lastReceived[t.part_id]) lastReceived[t.part_id] = t.created_at;
      });
      setLastReceivedByPart(lastReceived);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const q = modelQuery.trim();
    if (!q) { setModelSuggestions([]); return; }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from('device_models')
        .select('id, model_name')
        .ilike('model_name', `%${q}%`)
        .order('model_name')
        .limit(8);
      setModelSuggestions(data || []);
    }, 200);
    return () => clearTimeout(t);
  }, [modelQuery]);

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
      if (searchMode === 'model') {
        if (!selectedModel) return false;
        if (!(modelsByPart[i.id] || []).includes(selectedModel.model_name)) return false;
        return true;
      }
      if (search) {
        const s = search.toLowerCase();
        const compatModels = modelsByPart[i.id] || [];
        const matchesCompat = compatModels.some(m => m.toLowerCase().includes(s));
        if (!i.name.toLowerCase().includes(s) &&
            !i.phone_model.toLowerCase().includes(s) &&
            !(i.battery_model || '').toLowerCase().includes(s) &&
            !(i.brand || '').toLowerCase().includes(s) &&
            !matchesCompat &&
            !(i.sku || '').toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [items, activeCategory, activeGrade, search, searchMode, selectedModel, modelsByPart]);

  const deadStockItems = useMemo(() => {
    const cutoff = Date.now() - deadStockDays * 24 * 60 * 60 * 1000;
    return items
      .filter(i => Number(i.stock_qty || 0) > 0)
      .filter(i => {
        // ไม่เคยขาย/ใช้เลย ให้เทียบจากวันที่รับเข้าล่าสุด (หรือวันที่สร้างอะไหล่ ถ้าไม่มีประวัติรับเข้า) แทนการถือว่าตายทันที
        const baseline = lastMoveByPart[i.id] || lastReceivedByPart[i.id] || i.created_at;
        if (!baseline) return true;
        return new Date(baseline).getTime() < cutoff;
      })
      .map(i => ({ ...i, lastMoveAt: lastMoveByPart[i.id] || lastReceivedByPart[i.id] || i.created_at || null }))
      .sort((a, b) => (a.lastMoveAt || '').localeCompare(b.lastMoveAt || ''));
  }, [items, lastMoveByPart, lastReceivedByPart, deadStockDays]);

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
          <button
            onClick={() => setViewMode(viewMode === 'dead' ? 'active' : 'dead')}
            className="v3-btn v3-btn-secondary"
            style={{
              border: 'none', cursor: 'pointer',
              background: viewMode === 'dead' ? '#f59e0b' : undefined,
              color: viewMode === 'dead' ? '#fff' : undefined,
            }}
          >
            <Box size={16} /> เดดสต็อค{deadStockItems.length > 0 ? ` (${deadStockItems.length})` : ''}
          </button>
          <button onClick={() => setShowSell(true)} className="v3-btn v3-btn-secondary" style={{ border: 'none', cursor: 'pointer' }}>
            <ShoppingCart size={16} /> ขาย
          </button>
          <button onClick={() => setShowRepair(true)} className="v3-btn v3-btn-secondary" style={{ border: 'none', cursor: 'pointer' }}>
            <Wrench size={16} /> ซ่อม
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
          <button onClick={() => setViewMode(viewMode === 'dead' ? 'active' : 'dead')} style={{
            width: 40, height: 40,
            borderRadius: 10,
            background: viewMode === 'dead' ? '#f59e0b' : 'var(--surface)',
            border: '1px solid var(--border)',
            color: viewMode === 'dead' ? '#fff' : 'var(--text)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', position: 'relative',
          }}>
            <Box size={18} />
            {deadStockItems.length > 0 && (
              <span style={{ position: 'absolute', top: -4, right: -4, background: '#dc2626', color: '#fff', fontSize: 9, fontWeight: 700, borderRadius: 100, minWidth: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px' }}>
                {deadStockItems.length}
              </span>
            )}
          </button>
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
          <button onClick={() => setShowRepair(true)} style={{
            width: 40, height: 40,
            borderRadius: 10,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            color: 'var(--text)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}>
            <Wrench size={18} />
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

      {viewMode === 'dead' ? (
        <DeadStockView
          items={deadStockItems}
          days={deadStockDays}
          onDaysChange={setDeadStockDays}
          loading={loading}
          modelsByPart={modelsByPart}
        />
      ) : (
      <>
      <div className="v3-card" style={{ marginBottom: 12, padding: 10 }}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          <button
            type="button"
            onClick={() => { setSearchMode('part'); setSelectedModel(null); setModelQuery(''); }}
            style={{
              flex: 1, padding: '8px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
              background: searchMode === 'part' ? 'var(--accent)' : 'var(--surface-2)',
              color: searchMode === 'part' ? '#fff' : 'var(--text)',
            }}
          >อะไหล่ → รุ่น</button>
          <button
            type="button"
            onClick={() => { setSearchMode('model'); setSearch(''); }}
            style={{
              flex: 1, padding: '8px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
              background: searchMode === 'model' ? 'var(--accent)' : 'var(--surface-2)',
              color: searchMode === 'model' ? '#fff' : 'var(--text)',
            }}
          >รุ่น → อะไหล่</button>
        </div>

        {searchMode === 'part' ? (
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
        ) : (
          <div style={{ position: 'relative', marginBottom: 10 }}>
            <Smartphone size={16} style={{
              position: 'absolute', left: 12, top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)', pointerEvents: 'none',
            }} />
            <input
              type="text"
              value={selectedModel ? selectedModel.model_name : modelQuery}
              onChange={(e) => { setSelectedModel(null); setModelQuery(e.target.value); }}
              placeholder="ค้นหารุ่นเครื่อง..."
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
            {!selectedModel && modelQuery.trim() && modelSuggestions.length > 0 && (
              <div style={{
                position: 'absolute', top: 42, left: 0, right: 0, background: 'var(--surface)',
                border: '1px solid var(--border)', borderRadius: 8, boxShadow: 'var(--shadow-lg)',
                zIndex: 10, maxHeight: 220, overflowY: 'auto',
              }}>
                {modelSuggestions.map(m => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => { setSelectedModel(m); setModelQuery(''); }}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 12px', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 12.5, color: 'var(--text)', fontFamily: 'inherit' }}
                  >{m.model_name}</button>
                ))}
              </div>
            )}
            {!selectedModel && modelQuery.trim() && modelSuggestions.length === 0 && (
              <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text-dim)' }}>ไม่พบรุ่นที่ตรงกับคำค้นหา</div>
            )}
          </div>
        )}

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
      ) : searchMode === 'model' && !selectedModel ? (
        <div className="v3-card" style={{ textAlign: 'center', padding: 40 }}>
          <Smartphone size={48} strokeWidth={1.2} style={{ margin: '0 auto 12px', color: 'var(--text-muted)' }} />
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>เลือกรุ่นเครื่องด้านบน</div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>เพื่อดูอะไหล่ทั้งหมดที่ใช้ได้กับรุ่นนั้น</div>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState hasFilters={!!(search || selectedModel || activeCategory !== 'all' || activeGrade !== 'all')} onAdd={() => setShowAdd(true)} />
      ) : (
        <div className="v3-parts-grid">
          {filtered.map(item => (
            <PartCard
              key={item.id}
              item={item}
              compatModels={modelsByPart[item.id]}
              isAdmin={isAdmin}
              menuOpen={menuOpenId === item.id}
              onToggleMenu={() => setMenuOpenId(menuOpenId === item.id ? null : item.id)}
              onClose={() => setMenuOpenId(null)}
              onDelete={() => handleDelete(item)}
              onSell={() => { setMenuOpenId(null); setShowSell(true); }}
              onEdit={() => { setMenuOpenId(null); setEditItem(item); }}
              onRestock={() => { setMenuOpenId(null); setRestockItem(item); }}
              onView={() => { setMenuOpenId(null); setViewItem(item); }}
            />
          ))}
        </div>
      )}
      </>
      )}

      {showAdd && (
        <PartAddModal onClose={() => setShowAdd(false)} onSuccess={() => { setShowAdd(false); load(); }} />
      )}
      {showSell && (
        <PartSellModal onClose={() => setShowSell(false)} onSuccess={() => { setShowSell(false); load(); }} />
      )}
      {showRepair && (
        <PartRepairModal onClose={() => setShowRepair(false)} onSuccess={() => { setShowRepair(false); load(); }} />
      )}
      {editItem && (
        <PartEditModal item={editItem} onClose={() => setEditItem(null)} onSuccess={() => { setEditItem(null); load(); }} />
      )}
      {restockItem && (
        <PartRestockModal item={restockItem} onClose={() => setRestockItem(null)} onSuccess={() => { setRestockItem(null); load(); }} />
      )}
      {viewItem && (
        <PartDetailModal
          item={viewItem}
          isAdmin={isAdmin}
          onClose={() => setViewItem(null)}
          onEdit={() => { setViewItem(null); setEditItem(viewItem); }}
          onRestock={() => { setViewItem(null); setRestockItem(viewItem); }}
        />
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

function PartCard({ item, compatModels, isAdmin, menuOpen, onToggleMenu, onClose, onDelete, onSell, onEdit, onRestock, onView }: any) {
  const qty = Number(item.stock_qty || 0);
  const lowAlert = Number(item.low_stock_alert || 2);
  const isOut = qty === 0;
  const isLow = qty > 0 && qty <= lowAlert;
  const gradeInfo = item.grade ? getGradeInfo(item.grade) : null;
  const profit = isAdmin && item.cost_price
    ? Number(item.sell_price) - Number(item.cost_price)
    : 0;

  return (
    <div onClick={onView} style={{
      background: 'var(--surface)',
      border: '1px solid',
      borderColor: isOut ? '#fecaca' : isLow ? '#fde68a' : 'var(--border)',
      borderRadius: 14,
      padding: 12,
      position: 'relative',
      transition: 'all 0.15s',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      boxSizing: 'border-box',
      cursor: 'pointer',
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
            <div onClick={(e) => e.stopPropagation()} style={{
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
              <button onClick={onView} style={{ ...menuLinkStyle, border: 'none', background: 'transparent', width: '100%', fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer' }}>
                <Eye size={13} /> ดูรายละเอียด
              </button>
              <button onClick={onSell} style={{ ...menuLinkStyle, border: 'none', background: 'transparent', width: '100%', fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer', color: '#16a34a' }}>
                <ShoppingCart size={13} /> ขาย
              </button>
              <button onClick={onRestock} style={{ ...menuLinkStyle, border: 'none', background: 'transparent', width: '100%', fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer', color: '#0284c7' }}>
                <PackagePlus size={13} /> เติมสต๊อก
              </button>
              <button onClick={onEdit} style={{ ...menuLinkStyle, border: 'none', background: 'transparent', width: '100%', fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer' }}>
                <Edit2 size={13} /> แก้ไข
              </button>
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
        display: 'flex',
        flexWrap: 'wrap',
        gap: 3,
        marginBottom: 8,
        minHeight: 16,
      }}>
        {(compatModels && compatModels.length > 0 ? compatModels : [item.phone_model || 'ทั่วไป']).map((m: string, idx: number) => (
          <span key={idx} style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 3,
            fontSize: 9,
            color: 'var(--text-dim)',
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: 100,
            padding: '2px 7px',
            maxWidth: '100%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            <Smartphone size={8} style={{ flexShrink: 0 }} />
            {m}
          </span>
        ))}
      </div>

      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        marginTop: 'auto',
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

function PartDetailModal({ item, isAdmin, onClose, onEdit, onRestock }: any) {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [compatRows, setCompatRows] = useState<any[]>([]);
  const [customPrices, setCustomPrices] = useState<any[]>([]);
  const [supplierName, setSupplierName] = useState<string | null>(null);
  const gradeInfo = item.grade ? getGradeInfo(item.grade) : null;
  const profit = item.cost_price ? Number(item.sell_price) - Number(item.cost_price) : 0;

  useEffect(() => {
    async function load() {
      const [{ data: compat }, supplierRes, { data: custom }] = await Promise.all([
        supabase.from('part_compatibility').select('cost_price, labor_cost, sell_price, device_models(model_name)').eq('part_id', item.id),
        item.supplier_id ? supabase.from('suppliers').select('name').eq('id', item.supplier_id).single() : Promise.resolve({ data: null } as any),
        supabase.from('part_custom_prices').select('label, price').eq('part_id', item.id).order('sort_order'),
      ]);
      setCompatRows((compat || []).map((r: any) => ({ ...r, model_name: r.device_models?.model_name || '-' })));
      setSupplierName(supplierRes?.data?.name || null);
      setCustomPrices(custom || []);
      setLoading(false);
    }
    load();
  }, [item.id]);

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} className="v3-card" style={{ maxWidth: 480, width: '100%', padding: 0, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#fce7f3', color: '#ec4899', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Wrench size={18} /></div>
            <div style={{ minWidth: 0 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, fontFamily: 'Prompt, sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</h2>
              <p style={{ fontSize: 11, color: 'var(--text-dim)' }}>{getCategoryLabel(item.category)}{gradeInfo ? ` · ${gradeInfo.label}` : ''}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, background: 'var(--surface-2)', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><X size={16} /></button>
        </div>

        <div style={{ padding: 18, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <PriceBox label="ทุน" value={item.cost_price} />
            <PriceBox label="ส่ง" value={item.wholesale_price} />
            <PriceBox label="หน้าร้าน" value={item.sell_price} accent />
          </div>
          {isAdmin && item.cost_price > 0 && (
            <div style={{ fontSize: 12, color: profit > 0 ? '#16a34a' : 'var(--text-dim)', fontWeight: 600 }}>
              กำไร (ทุน→หน้าร้าน) ฿{profit.toLocaleString()}
            </div>
          )}

          {customPrices.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {customPrices.map((cp: any, idx: number) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12, background: 'var(--surface-2)', borderRadius: 8, padding: '7px 10px' }}>
                  <span style={{ color: 'var(--text-dim)' }}>{cp.label}</span>
                  <span style={{ fontWeight: 700 }}>฿{Number(cp.price || 0).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}

          <DetailRow label="คงเหลือ" value={`${item.stock_qty} ชิ้น`} />
          <DetailRow label="เตือนเมื่อเหลือ" value={`${item.low_stock_alert ?? 2} ชิ้น`} />
          {item.brand && <DetailRow label="ยี่ห้อ" value={item.brand} />}
          {item.battery_model && <DetailRow label="รุ่น/รหัสแบตเตอรี่" value={<span style={{ fontFamily: 'monospace' }}>{item.battery_model}</span>} />}
          {item.sku && <DetailRow label="SKU" value={<span style={{ fontFamily: 'monospace' }}>{item.sku}</span>} />}
          {supplierName && <DetailRow label="ซัพพลายเออร์" value={supplierName} />}
          {item.note && <DetailRow label="หมายเหตุ" value={item.note} />}
          {item.added_by_name && <DetailRow label="เพิ่มโดย" value={item.added_by_name} />}

          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 6 }}>รุ่นมือถือที่ใช้ได้</div>
            {loading ? (
              <div style={{ padding: 12, textAlign: 'center', color: 'var(--text-dim)' }}><Loader2 size={18} className="v3-spin" /></div>
            ) : compatRows.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{item.phone_model || 'ทั่วไป (ยังไม่ได้ผูกกับรุ่นเฉพาะ)'}</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {compatRows.map((r, idx) => (
                  <div key={idx} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.model_name}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-dim)', flexShrink: 0 }}>
                      ทุน ฿{Number(r.cost_price || 0).toLocaleString()} · ขาย ฿{Number(r.sell_price || 0).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ padding: 18, borderTop: '1px solid var(--border)', display: 'flex', gap: 8, flexShrink: 0 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 12, background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>ปิด</button>
          <button onClick={onRestock} style={{ flex: 2, padding: 12, color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'linear-gradient(135deg, #0ea5e9, #0284c7)' }}>
            <PackagePlus size={15} /> เติมสต๊อก
          </button>
          <button onClick={onEdit} style={{ flex: 2, padding: 12, color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'linear-gradient(135deg, #ec4899, #db2777)' }}>
            <Edit2 size={15} /> แก้ไข
          </button>
        </div>
      </div>
    </div>
  );
}
function PriceBox({ label, value, accent }: any) {
  return (
    <div style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '8px 10px', textAlign: 'center' }}>
      <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 800, fontFamily: 'Prompt, sans-serif', color: accent ? 'var(--accent)' : 'var(--text)' }}>
        ฿{Number(value || 0).toLocaleString()}
      </div>
    </div>
  );
}
function DetailRow({ label, value }: any) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13, borderBottom: '1px dashed var(--border)', paddingBottom: 8 }}>
      <span style={{ color: 'var(--text-dim)', flexShrink: 0 }}>{label}</span>
      <span style={{ fontWeight: 600, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

function DeadStockView({ items, days, onDaysChange, loading, modelsByPart }: any) {
  const options = [30, 60, 90, 180];
  return (
    <div>
      <div className="v3-card" style={{ marginBottom: 12, padding: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>📦 เดดสต็อค</div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 10 }}>
          อะไหล่ที่ยังมีสต๊อกอยู่ แต่ไม่มีการขาย/ใช้งานในรอบที่เลือก
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {options.map(d => (
            <button
              key={d}
              type="button"
              onClick={() => onDaysChange(d)}
              style={{
                padding: '6px 12px', borderRadius: 100, border: 'none', cursor: 'pointer',
                fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
                background: days === d ? '#f59e0b' : 'var(--surface-2)',
                color: days === d ? '#fff' : 'var(--text)',
              }}
            >{d} วัน</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="v3-card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-dim)' }}>กำลังโหลด...</div>
      ) : items.length === 0 ? (
        <div className="v3-card" style={{ textAlign: 'center', padding: 40 }}>
          <Box size={48} strokeWidth={1.2} style={{ margin: '0 auto 12px', color: 'var(--text-muted)' }} />
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>ไม่มีเดดสต็อค</div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>อะไหล่ทุกชิ้นมีการเคลื่อนไหวภายใน {days} วัน</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map((item: any) => {
            const models = modelsByPart[item.id] || (item.phone_model ? [item.phone_model] : []);
            const daysSince = item.lastMoveAt ? Math.floor((Date.now() - new Date(item.lastMoveAt).getTime()) / 86400000) : null;
            return (
              <div key={item.id} className="v3-card" style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Wrench size={18} color="#94a3b8" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {models.length > 0 ? models.join(' / ') : 'ทั่วไป'}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{item.stock_qty} ชิ้น</div>
                  <div style={{ fontSize: 9, color: '#dc2626', fontWeight: 600 }}>
                    {daysSince === null ? 'ไม่เคยขาย/ใช้เลย' : `ไม่เคลื่อนไหว ${daysSince} วัน`}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
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
