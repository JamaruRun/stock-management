'use client';

import { useEffect, useState, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';
import {
  Plus, Search, Filter, Smartphone, X, MoreVertical,
  Package, CheckCircle2, Clock, ShoppingCart, Tag,
  Edit2, Trash2, Eye, Printer, Copy, Calendar,
  ChevronDown, ArrowLeft, Truck, Send, RefreshCw, Ban,
} from 'lucide-react';
import StockAddModal from './StockAddModal';
import StockDetailModal from './StockDetailModal';
import StockEditModal from './StockEditModal';

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

interface BranchOption {
  id: string;
  name: string;
}

interface StockTransfer {
  id: string;
  item_type?: 'stock' | 'parts' | 'goods';
  status: 'pending' | 'received' | 'cancelled';
  from_branch_id: string;
  to_branch_id: string;
  requested_by_name?: string | null;
  received_by_name?: string | null;
  cancelled_by_name?: string | null;
  stock_items: any[];
  item_count: number;
  note?: string | null;
  created_at: string;
  received_at?: string | null;
  cancelled_at?: string | null;
  from_branch?: { id?: string; name?: string } | null;
  to_branch?: { id?: string; name?: string } | null;
}

type TransferItemType = 'stock' | 'parts' | 'goods';

const TRANSFER_TYPES: Record<TransferItemType, { label: string; unit: string }> = {
  stock: { label: 'เครื่องในสต๊อก', unit: 'เครื่อง' },
  parts: { label: 'อะไหล่', unit: 'รายการ' },
  goods: { label: 'สินค้า', unit: 'รายการ' },
};

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
  const [profile, setProfile] = useState<any>(null);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState('all');

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterBrand, setFilterBrand] = useState<string>('');
  const [filterModel, setFilterModel] = useState<string>('');
  const [filterColor, setFilterColor] = useState<string>('');
  const [showAddModal, setShowAddModal] = useState(autoAdd);
  const [detailItem, setDetailItem] = useState<StockItem | null>(null);
  const [editItem, setEditItem] = useState<StockItem | null>(null);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferSeedItem, setTransferSeedItem] = useState<StockItem | null>(null);
  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [transferBusyId, setTransferBusyId] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  async function loadTransfers() {
    try {
      const res = await fetch('/api/stock-transfers', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setTransfers(data.transfers || []);
    } catch (e) {
      console.warn('load transfers failed:', e);
    }
  }

  async function load() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, is_super_admin, branch_id, shop_id')
        .eq('id', user.id)
        .single();

      const admin = profile?.role === 'admin' || profile?.is_super_admin;
      const effectiveBranchId = admin
        ? (selectedBranchId === 'all' ? null : selectedBranchId)
        : profile?.branch_id;

      setProfile(profile);
      setIsAdmin(!!admin);

      let stockQuery = supabase
        .from('stock')
        .select('*, branches(name), suppliers(name)')
        .order('added_date', { ascending: false });

      let salesQuery = supabase
        .from('sales_history')
        .select('id', { count: 'exact', head: true });

      if (effectiveBranchId) {
        stockQuery = stockQuery.eq('branch_id', effectiveBranchId);
        salesQuery = salesQuery.eq('branch_id', effectiveBranchId);
      }

      const [stockRes, salesRes, branchRes] = await Promise.all([
        stockQuery,
        salesQuery,
        supabase.from('branches').select('id, name').order('name'),
      ]);

      setItems((stockRes.data || []) as StockItem[]);
      setSoldCount(salesRes.count || 0);
      setBranches((branchRes.data || []) as BranchOption[]);
      loadTransfers();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [selectedBranchId]);

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
    if (!isAdmin) {
      alert('เฉพาะเจ้าของร้านหรือแอดมินเท่านั้นที่ลบ/แก้ไขข้อมูลเครื่องได้');
      return;
    }
    if (!confirm(`ลบเครื่อง ${item.model} (IMEI: ${item.imei})?\n\nการลบนี้ย้อนกลับไม่ได้`)) return;
    const { error } = await supabase.from('stock').delete().eq('id', item.id);
    if (error) {
      alert('ลบไม่สำเร็จ: ' + error.message);
      return;
    }
    setMenuOpenId(null);
    load();
  }

  function openTransfer(item?: StockItem) {
    setTransferSeedItem(item || null);
    setMenuOpenId(null);
    setShowTransferModal(true);
  }

  async function handleTransferAction(transfer: StockTransfer, action: 'receive' | 'cancel') {
    const okText = action === 'receive'
      ? 'ยืนยันรับของเข้าสต๊อกสาขานี้?'
      : 'ยกเลิกคำขอย้ายรายการนี้?';
    if (!confirm(okText)) return;

    setTransferBusyId(transfer.id);
    try {
      const res = await fetch('/api/stock-transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, transferId: transfer.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || 'ทำรายการไม่สำเร็จ');
        return;
      }
      await load();
      await loadTransfers();
    } finally {
      setTransferBusyId(null);
    }
  }

  const pendingIncoming = useMemo(() => {
    return transfers.filter(t => t.status === 'pending' && (isAdmin || t.to_branch_id === profile?.branch_id));
  }, [transfers, isAdmin, profile?.branch_id]);

  const pendingOutgoing = useMemo(() => {
    return transfers.filter(t => t.status === 'pending' && t.from_branch_id === profile?.branch_id);
  }, [transfers, profile?.branch_id]);

  const transferHistory = useMemo(() => {
    const relevant = isAdmin
      ? transfers
      : transfers.filter(t => t.from_branch_id === profile?.branch_id || t.to_branch_id === profile?.branch_id);
    return relevant.slice(0, 30);
  }, [transfers, isAdmin, profile?.branch_id]);

  return (
    <>
      {/* Desktop Page Header */}
      <div className="v3-page-header v3-desktop-only">
        <div>
          <h1 className="v3-page-title">สต๊อกเครื่อง</h1>
          <p className="v3-page-subtitle">เครื่องในสต๊อกทั้งหมด {stats.total} เครื่อง</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        <button onClick={() => openTransfer()} className="v3-btn v3-btn-secondary">
          <Truck size={16} strokeWidth={2.5} /> ย้ายสต๊อก
        </button>
        <button onClick={() => setShowAddModal(true)} className="v3-btn v3-btn-primary">
          <Plus size={16} strokeWidth={2.5} /> เพิ่มเครื่องใหม่
        </button>
        </div>
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
        <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => openTransfer()} style={{ ...mobileAddBtnStyle, background: 'var(--surface-2)', color: 'var(--text)' }}>
          <Truck size={19} strokeWidth={2.5} />
        </button>
        <button onClick={() => setShowAddModal(true)} style={mobileAddBtnStyle}>
          <Plus size={20} strokeWidth={2.5} />
        </button>
        </div>
      </div>

      <div className="v3-card" style={{ padding: 10, marginBottom: 12 }}>
        <button
          onClick={() => openTransfer()}
          className="v3-btn v3-btn-secondary"
          style={{
            width: '100%',
            justifyContent: 'center',
            minHeight: 42,
            fontWeight: 800,
            borderStyle: 'dashed',
          }}
        >
          <Truck size={17} strokeWidth={2.5} />
          ย้าย / รับโอนสต๊อก
        </button>
        <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-dim)', textAlign: 'center' }}>
          ย้ายได้ทั้งเครื่องในสต๊อก อะไหล่ และสินค้า
        </div>
      </div>

      {(pendingIncoming.length > 0 || pendingOutgoing.length > 0) && (
        <TransferPanel
          incoming={pendingIncoming}
          outgoing={pendingOutgoing}
          busyId={transferBusyId}
          onReceive={(t: StockTransfer) => handleTransferAction(t, 'receive')}
          onCancel={(t: StockTransfer) => handleTransferAction(t, 'cancel')}
        />
      )}

      {isAdmin && transferHistory.length > 0 && (
        <TransferHistoryPanel transfers={transferHistory} />
      )}

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

          <button
            type="button"
            onClick={() => openTransfer()}
            className="v3-btn v3-btn-secondary"
            style={{
              height: 38,
              justifyContent: 'center',
              fontSize: 12,
              fontWeight: 800,
              whiteSpace: 'nowrap',
            }}
          >
            <Truck size={15} strokeWidth={2.5} />
            ย้ายสต๊อก
          </button>

          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={selectStyle}>
            <option value="">สถานะทั้งหมด</option>
            <option value="new">เครื่องใหม่</option>
            <option value="used">เครื่องมือสอง</option>
          </select>

          {isAdmin ? (
            <select value={selectedBranchId} onChange={(e) => setSelectedBranchId(e.target.value)} style={selectStyle}>
              <option value="all">สต๊อกทุกสาขา</option>
              {branches.map(b => <option key={b.id} value={b.id}>สาขา: {b.name}</option>)}
            </select>
          ) : profile?.branch_id && (
            <select value={profile.branch_id} disabled style={{ ...selectStyle, opacity: 0.75, cursor: 'not-allowed' }}>
              <option value={profile.branch_id}>
                {branches.find(b => b.id === profile.branch_id)?.name || 'สาขาของฉัน'}
              </option>
            </select>
          )}

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
              onTransfer={() => openTransfer(item)}
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
          onEdit={() => { setEditItem(detailItem); setDetailItem(null); }}
          onDeleted={() => { setDetailItem(null); load(); }}
          onRefresh={() => load()}
        />
      )}

      {/* Edit Modal */}
      {editItem && (
        <StockEditModal
          item={editItem}
          onClose={() => setEditItem(null)}
          onSuccess={() => { setEditItem(null); load(); }}
        />
      )}

      {showTransferModal && (
        <StockTransferModal
          items={items}
          branches={branches}
          profile={profile}
          seedItem={transferSeedItem}
          onClose={() => { setShowTransferModal(false); setTransferSeedItem(null); }}
          onSuccess={() => {
            setShowTransferModal(false);
            setTransferSeedItem(null);
            load();
            loadTransfers();
          }}
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

function TransferPanel({ incoming, outgoing, busyId, onReceive, onCancel }: any) {
  return (
    <div className="v3-card" style={{ padding: 12, marginBottom: 12, borderColor: '#f59e0b' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: '#fef3c7', color: '#b45309', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Truck size={18} />
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, fontFamily: 'Prompt, sans-serif' }}>รายการย้ายสต๊อก</div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>รับของปลายทางก่อน ระบบจึงจะเปลี่ยนสาขาในสต๊อก</div>
        </div>
      </div>

      {incoming.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: outgoing.length ? 10 : 0 }}>
          {incoming.map((t: StockTransfer) => (
            <TransferRow key={t.id} transfer={t} busy={busyId === t.id} mode="incoming" onReceive={onReceive} onCancel={onCancel} />
          ))}
        </div>
      )}

      {outgoing.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {outgoing.map((t: StockTransfer) => (
            <TransferRow key={t.id} transfer={t} busy={busyId === t.id} mode="outgoing" onReceive={onReceive} onCancel={onCancel} />
          ))}
        </div>
      )}
    </div>
  );
}

function TransferRow({ transfer, busy, mode, onReceive, onCancel }: any) {
  const items = transfer.stock_items || [];
  const typeInfo = TRANSFER_TYPES[(transfer.item_type as TransferItemType) || 'stock'] || TRANSFER_TYPES.stock;
  const title = mode === 'incoming'
    ? `รอรับจาก ${transfer.from_branch?.name || '-'}`
    : `กำลังย้ายไป ${transfer.to_branch?.name || '-'}`;

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 10, background: 'var(--surface-2)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>{title}</div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
            หมวด: {typeInfo.label} · ผู้ทำรายการ: {transfer.requested_by_name || '-'} · {transfer.item_count} {typeInfo.unit}
          </div>
          <div style={{ marginTop: 7, display: 'flex', flexDirection: 'column', gap: 3 }}>
            {items.slice(0, 4).map((it: any, idx: number) => (
              <div key={it.id || idx} style={{ fontSize: 11, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {idx + 1}. {it.model || it.name || '-'} {it.imei ? `· ${it.imei}` : ''}{it.sku ? `· ${it.sku}` : ''}
              </div>
            ))}
            {items.length > 4 && <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>และอีก {items.length - 4} รายการ</div>}
          </div>
        </div>

        {mode === 'incoming' ? (
          <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button onClick={() => onCancel(transfer)} disabled={busy} className="v3-btn v3-btn-secondary" style={{ height: 34, padding: '0 10px', fontSize: 11 }}>
              {busy ? <RefreshCw size={13} className="v3-spin" /> : <Ban size={13} />} ยกเลิก
            </button>
            <button onClick={() => onReceive(transfer)} disabled={busy} className="v3-btn v3-btn-primary" style={{ height: 34, padding: '0 10px', fontSize: 11 }}>
              {busy ? <RefreshCw size={13} className="v3-spin" /> : <CheckCircle2 size={13} />} รับของแล้ว
            </button>
          </div>
        ) : (
          <span style={{ padding: '5px 10px', borderRadius: 999, background: '#fef3c7', color: '#92400e', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
            รอปลายทางรับ
          </span>
        )}
      </div>
    </div>
  );
}

function TransferHistoryPanel({ transfers }: { transfers: StockTransfer[] }) {
  return (
    <div className="v3-card" style={{ padding: 12, marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: '#e0f2fe', color: '#0369a1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Clock size={18} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, fontFamily: 'Prompt, sans-serif' }}>ประวัติการโอนย้ายสต๊อก</div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>เจ้าของร้านเห็นทุก action ของทุกสาขา</div>
          </div>
        </div>
        <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{transfers.length} รายการล่าสุด</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {transfers.map(t => <TransferHistoryRow key={t.id} transfer={t} />)}
      </div>
    </div>
  );
}

function TransferHistoryRow({ transfer }: { transfer: StockTransfer }) {
  const status = getTransferStatus(transfer);
  const actorLine = transfer.status === 'received'
    ? `ผู้รับ: ${transfer.received_by_name || '-'}`
    : transfer.status === 'cancelled'
      ? `ผู้ยกเลิก: ${transfer.cancelled_by_name || '-'}`
      : `ผู้ทำรายการ: ${transfer.requested_by_name || '-'}`;
  const statusTime = transfer.status === 'received'
    ? transfer.received_at
    : transfer.status === 'cancelled'
      ? transfer.cancelled_at
      : transfer.created_at;

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 10, background: 'var(--surface)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 4 }}>
            <span style={{ padding: '3px 8px', borderRadius: 999, background: status.bg, color: status.color, fontSize: 10, fontWeight: 800 }}>
              {status.label}
            </span>
            <span style={{ fontSize: 12, fontWeight: 700 }}>
              {transfer.from_branch?.name || '-'} ไป {transfer.to_branch?.name || '-'}
            </span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.5 }}>
            เริ่มโดย: {transfer.requested_by_name || '-'} · {actorLine}<br />
            หมวด: {TRANSFER_TYPES[(transfer.item_type as TransferItemType) || 'stock']?.label || 'เครื่องในสต๊อก'} · จำนวน {transfer.item_count} {TRANSFER_TYPES[(transfer.item_type as TransferItemType) || 'stock']?.unit || 'เครื่อง'} · {formatTransferDate(statusTime)}
          </div>
          <div style={{ marginTop: 7, display: 'flex', flexDirection: 'column', gap: 3 }}>
            {(transfer.stock_items || []).slice(0, 3).map((it: any, idx: number) => (
              <div key={it.id || idx} style={{ fontSize: 11, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {idx + 1}. {it.model || it.name || '-'} {it.imei ? `· ${it.imei}` : ''}{it.sku ? `· ${it.sku}` : ''}
              </div>
            ))}
            {(transfer.stock_items || []).length > 3 && (
              <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>และอีก {(transfer.stock_items || []).length - 3} รายการ</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function getTransferStatus(transfer: StockTransfer) {
  if (transfer.status === 'received') {
    return { label: 'สำเร็จ', color: '#166534', bg: '#dcfce7' };
  }
  if (transfer.status === 'cancelled') {
    return { label: 'ยกเลิก', color: '#991b1b', bg: '#fee2e2' };
  }
  return { label: 'กำลังย้าย', color: '#92400e', bg: '#fef3c7' };
}

function formatTransferDate(value?: string | null) {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleString('th-TH', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
}

function StockTransferModal({ items, branches, profile, seedItem, onClose, onSuccess }: any) {
  const [selectedIds, setSelectedIds] = useState<string[]>(seedItem ? [seedItem.id] : []);
  const [itemType, setItemType] = useState<TransferItemType>('stock');
  const [transferItems, setTransferItems] = useState<any[]>(items);
  const [loadingItems, setLoadingItems] = useState(false);
  const [toBranchId, setToBranchId] = useState('');
  const [note, setNote] = useState('');
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const supabase = createClient();

  useEffect(() => {
    if (itemType === 'stock') {
      setTransferItems(items);
      return;
    }

    let alive = true;
    async function loadCategoryItems() {
      setLoadingItems(true);
      setSelectedIds([]);
      setToBranchId('');
      try {
        const table = itemType === 'parts' ? 'parts' : 'goods';
        const select = itemType === 'parts'
          ? 'id, sku, name, category, phone_model, grade, stock_qty, sell_price, branch_id, shop_id'
          : 'id, sku, name, category, stock_qty, sell_price, branch_id, shop_id, branch:branches(name)';
        let query = supabase.from(table).select(select).order('name', { ascending: true });
        if (profile?.shop_id) query = query.eq('shop_id', profile.shop_id);
        if (!(profile?.role === 'admin' || profile?.is_super_admin) && profile?.branch_id) {
          query = query.eq('branch_id', profile.branch_id);
        }
        const { data } = await query;
        if (alive) setTransferItems(data || []);
      } finally {
        if (alive) setLoadingItems(false);
      }
    }
    loadCategoryItems();
    return () => { alive = false; };
  }, [itemType, profile?.shop_id, profile?.branch_id, profile?.role, profile?.is_super_admin]);

  const selectedItems = useMemo(() => transferItems.filter((i: any) => selectedIds.includes(i.id)), [transferItems, selectedIds]);
  const fromBranchId = selectedItems[0]?.branch_id || profile?.branch_id || '';
  const availableBranches = branches.filter((b: BranchOption) => b.id !== fromBranchId);
  const visibleItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return transferItems.filter((i: any) => {
      if (selectedItems.length > 0 && i.branch_id !== fromBranchId) return false;
      if (!q) return true;
      return [i.model, i.imei, i.color, i.spec, i.name, i.sku, i.category, i.phone_model].some(v => String(v || '').toLowerCase().includes(q));
    });
  }, [transferItems, search, fromBranchId, selectedItems.length]);

  function changeItemType(next: TransferItemType) {
    setItemType(next);
    setSelectedIds([]);
    setToBranchId('');
    setSearch('');
  }

  function toggle(id: string) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (selectedIds.length === 0) return setError('กรุณาเลือกเครื่องที่จะย้าย');
    if (!toBranchId) return setError('กรุณาเลือกสาขาปลายทาง');

    setSaving(true);
    try {
      const res = await fetch('/api/stock-transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', itemType, itemIds: selectedIds, toBranchId, note }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'สร้างคำขอย้ายไม่สำเร็จ');
        return;
      }
      onSuccess();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div onClick={onClose} style={modalOverlayStyle}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="v3-card" style={{ width: '100%', maxWidth: 760, maxHeight: '90vh', overflow: 'hidden', padding: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: 16, borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ width: 38, height: 38, borderRadius: 11, background: '#dbeafe', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Truck size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 800, fontFamily: 'Prompt, sans-serif' }}>ย้ายสต๊อกไปสาขาอื่น</h2>
              <p style={{ fontSize: 11, color: 'var(--text-dim)' }}>เลือกหมวดหมู่ แล้วให้ปลายทางกดรับของก่อน ระบบจึงจะเปลี่ยนสาขาให้</p>
            </div>
          </div>
          <button type="button" onClick={onClose} style={{ width: 34, height: 34, borderRadius: 9, border: 'none', background: 'var(--surface-2)', color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <X size={17} />
          </button>
        </div>

        <div style={{ padding: 16, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'minmax(0, 1.35fr) minmax(240px, 0.65fr)', gap: 14 }}>
          <div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 10, overflowX: 'auto' }}>
              {(Object.keys(TRANSFER_TYPES) as TransferItemType[]).map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => changeItemType(type)}
                  style={{
                    padding: '7px 11px',
                    borderRadius: 999,
                    border: '1px solid',
                    borderColor: itemType === type ? 'var(--accent)' : 'var(--border)',
                    background: itemType === type ? 'var(--accent)' : 'var(--surface)',
                    color: itemType === type ? '#fff' : 'var(--text)',
                    fontSize: 12,
                    fontWeight: 700,
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {TRANSFER_TYPES[type].label}
                </button>
              ))}
            </div>
            <div style={{ position: 'relative', marginBottom: 10 }}>
              <Search size={15} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหารุ่น / IMEI / SKU / ชื่อสินค้า" style={{ ...searchInputStyle, height: 38, paddingLeft: 34 }} />
            </div>
            <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '8px 10px', background: 'var(--surface-2)', fontSize: 11, color: 'var(--text-dim)', display: 'flex', justifyContent: 'space-between' }}>
                <span>เลือก{TRANSFER_TYPES[itemType].label}</span>
                <strong>{selectedIds.length} {TRANSFER_TYPES[itemType].unit}</strong>
              </div>
              <div style={{ maxHeight: 360, overflowY: 'auto', overflowX: 'hidden' }}>
                {loadingItems ? (
                  <div style={{ padding: 24, textAlign: 'center', fontSize: 12, color: 'var(--text-dim)' }}>กำลังโหลด...</div>
                ) : visibleItems.length === 0 ? (
                  <div style={{ padding: 24, textAlign: 'center', fontSize: 12, color: 'var(--text-dim)' }}>ไม่พบรายการที่เลือกได้</div>
                ) : visibleItems.map((item: any) => {
                  const checked = selectedIds.includes(item.id);
                  const title = itemType === 'stock'
                    ? (item.model || item.imei || 'ไม่ระบุรุ่น')
                    : (item.name || item.sku || 'ไม่ระบุชื่อสินค้า');
                  const sub = itemType === 'stock'
                    ? [
                        item.imei ? `IMEI: ${item.imei}` : null,
                        item.color ? `สี: ${item.color}` : null,
                        item.spec ? `สเปก: ${item.spec}` : null,
                      ].filter(Boolean).join(' · ')
                    : [
                        item.sku ? `SKU: ${item.sku}` : null,
                        `คงเหลือ: ${item.stock_qty ?? 0}`,
                        item.category ? `หมวด: ${item.category}` : null,
                      ].filter(Boolean).join(' · ');
                  const priceLine = itemType === 'stock'
                    ? `ราคาขาย ${Number(item.price || 0).toLocaleString()} บาท`
                    : `ราคาขาย ${Number(item.sell_price || 0).toLocaleString()} บาท`;
                  const branchName = item.branches?.name || item.branch?.name || branches.find((b: BranchOption) => b.id === item.branch_id)?.name || '-';
                  return (
                    <label
                      key={item.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '22px minmax(0, 1fr)',
                        gap: 10,
                        alignItems: 'start',
                        padding: '10px 12px',
                        borderTop: '1px solid var(--border)',
                        cursor: 'pointer',
                        background: checked ? 'var(--accent-light)' : 'var(--surface)',
                        maxWidth: '100%',
                        boxSizing: 'border-box',
                      }}
                    >
                      <input type="checkbox" checked={checked} onChange={() => toggle(item.id)} style={{ marginTop: 3 }} />
                      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                            {title}
                          </div>
                          <span style={{ flexShrink: 0, padding: '2px 7px', borderRadius: 999, background: 'var(--surface-2)', color: 'var(--text-dim)', fontSize: 10, fontWeight: 700 }}>
                            {branchName}
                          </span>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.45, wordBreak: 'break-word' }}>
                          {sub || 'ไม่มีรายละเอียดเพิ่มเติม'}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 700 }}>
                          {priceLine}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <FormMini label="สาขาปลายทาง">
              <select value={toBranchId} onChange={(e) => setToBranchId(e.target.value)} style={inputMiniStyle}>
                <option value="">-- เลือกสาขาปลายทาง --</option>
                {availableBranches.map((b: BranchOption) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </FormMini>
            <FormMini label="หมายเหตุ">
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="เช่น ส่งให้ลูกค้ารับที่สาขาปลายทาง" style={{ ...inputMiniStyle, height: 'auto', padding: 10, resize: 'vertical' }} />
            </FormMini>
            <div style={{ padding: 10, borderRadius: 12, background: 'var(--surface-2)', fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.6 }}>
              สถานะหลังยืนยัน: กำลังดำเนินการ<br />
              รายการจะยังอยู่สาขาเดิมจนกว่าสาขาปลายทางจะกด “รับของแล้ว”<br />
              สินค้า/อะไหล่จะย้ายทั้งจำนวนของรายการนั้น
            </div>
            {error && <div style={{ padding: 10, borderRadius: 10, background: '#fef2f2', color: '#991b1b', fontSize: 12 }}>{error}</div>}
          </div>
        </div>

        <div style={{ padding: 14, borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
          <button type="button" onClick={onClose} className="v3-btn v3-btn-secondary" style={{ flex: 1 }}>ยกเลิก</button>
          <button type="submit" disabled={saving} className="v3-btn v3-btn-primary" style={{ flex: 2 }}>
            {saving ? <RefreshCw size={15} className="v3-spin" /> : <Send size={15} />} {saving ? 'กำลังทำรายการ...' : 'ยืนยันย้ายสต๊อก'}
          </button>
        </div>
      </form>
      <style jsx>{`
        @media (max-width: 760px) {
          form > div:nth-child(2) {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}

function FormMini({ label, children }: any) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 11, fontWeight: 700 }}>
      {label}
      {children}
    </label>
  );
}

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

function StockCardV2({ item, isAdmin, onClick, menuOpen, onToggleMenu, onDelete, onTransfer, onClose }: any) {
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
              <MenuItem Icon={Truck} label="ย้ายเครื่องนี้" onClick={onTransfer} />
              {isAdmin && <MenuItem Icon={Trash2} label="ลบ" onClick={onDelete} danger />}
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

const modalOverlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.55)',
  backdropFilter: 'blur(4px)',
  zIndex: 120,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 14,
};

const inputMiniStyle: React.CSSProperties = {
  width: '100%',
  minHeight: 40,
  padding: '0 10px',
  borderRadius: 10,
  border: '1px solid var(--border)',
  background: 'var(--surface-2)',
  color: 'var(--text)',
  fontSize: 13,
  fontFamily: 'inherit',
  outline: 'none',
  boxSizing: 'border-box',
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
