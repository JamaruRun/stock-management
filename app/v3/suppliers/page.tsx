'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';
import {
  Truck, Plus, Search, Phone, User, MapPin, FileText,
  X, Edit2, Trash2, MoreVertical, AlertTriangle, CheckCircle2,
  DollarSign, Smartphone, Calendar, ChevronRight, Loader2,
  TrendingUp, TrendingDown, Wallet, Lock, History,
} from 'lucide-react';

interface Supplier {
  id: string;
  name: string;
  phone?: string | null;
  contact_person?: string | null;
  address?: string | null;
  note?: string | null;
  balance?: number | null;
  shop_id?: string | null;
  created_at?: string;
}

interface StockItem {
  id: string;
  imei: string;
  model: string;
  price: number;
  cost_price?: number | null;
  added_date: string;
  supplier_id?: string | null;
}

export default function V3SuppliersPage() {
  const supabase = createClient();
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [stockMap, setStockMap] = useState<Map<string, StockItem[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'debt' | 'credit' | 'clear'>('all');
  const [profile, setProfile] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [accessChecked, setAccessChecked] = useState(false);

  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [viewingHistory, setViewingHistory] = useState<Supplier | null>(null);

  async function loadData() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }

      const { data: p } = await supabase
        .from('profiles')
        .select('id, full_name, role, shop_id, is_super_admin')
        .eq('id', user.id)
        .single();
      setProfile(p);

      const admin = p?.role === 'admin' || p?.is_super_admin;
      setIsAdmin(!!admin);
      setAccessChecked(true);

      if (!admin) {
        setLoading(false);
        return;
      }

      const [sup, st] = await Promise.all([
        supabase.from('suppliers').select('*').order('name'),
        supabase.from('stock').select('id, imei, model, price, cost_price, added_date, supplier_id'),
      ]);

      setSuppliers((sup.data || []) as Supplier[]);

      // Group stock by supplier
      const m = new Map<string, StockItem[]>();
      (st.data || []).forEach((s: any) => {
        if (!s.supplier_id) return;
        if (!m.has(s.supplier_id)) m.set(s.supplier_id, []);
        m.get(s.supplier_id)!.push(s);
      });
      setStockMap(m);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  // Stats
  const stats = useMemo(() => {
    let totalDebt = 0;     // เราติด supplier
    let totalCredit = 0;   // supplier ติดเรา
    let debtCount = 0;
    let clearCount = 0;
    suppliers.forEach(s => {
      const b = Number(s.balance || 0);
      if (b < 0) { totalDebt += Math.abs(b); debtCount++; }
      else if (b > 0) { totalCredit += b; }
      else clearCount++;
    });
    return {
      total: suppliers.length,
      debtCount,
      clearCount,
      totalDebt,
      totalCredit,
    };
  }, [suppliers]);

  const filtered = useMemo(() => {
    let list = suppliers;
    if (activeFilter === 'debt') list = list.filter(s => Number(s.balance || 0) < 0);
    else if (activeFilter === 'credit') list = list.filter(s => Number(s.balance || 0) > 0);
    else if (activeFilter === 'clear') list = list.filter(s => Number(s.balance || 0) === 0);

    if (search) {
      const s = search.toLowerCase();
      list = list.filter(sup =>
        sup.name.toLowerCase().includes(s) ||
        (sup.phone || '').toLowerCase().includes(s) ||
        (sup.contact_person || '').toLowerCase().includes(s)
      );
    }

    return list;
  }, [suppliers, activeFilter, search]);

  async function handleDelete(sup: Supplier) {
    const stockCount = (stockMap.get(sup.id) || []).length;
    if (stockCount > 0) {
      alert(`ลบไม่ได้: ยังมีเครื่อง ${stockCount} ตัวที่ผูกกับ Supplier นี้\n\nให้ลบ/แก้ไขเครื่องก่อน หรือเปลี่ยน Supplier`);
      return;
    }
    if (!confirm(`ลบ Supplier "${sup.name}"?\n\nย้อนกลับไม่ได้`)) return;
    setMenuOpenId(null);
    const { error } = await supabase.from('suppliers').delete().eq('id', sup.id);
    if (error) { alert('ลบไม่สำเร็จ: ' + error.message); return; }
    loadData();
  }

  if (accessChecked && !isAdmin) {
    return (
      <div className="v3-card" style={{ padding: 40, textAlign: 'center' }}>
        <Lock size={48} strokeWidth={1.2} style={{ margin: '0 auto 12px', color: 'var(--text-muted)' }} />
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>เฉพาะแอดมิน</h2>
        <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>หน้า Supplier จำกัดให้แอดมินเท่านั้น</p>
      </div>
    );
  }

  return (
    <>
      <div className="v3-page-header v3-desktop-only">
        <div>
          <h1 className="v3-page-title">ซัพพลายเออร์</h1>
          <p className="v3-page-subtitle">{stats.total} เจ้า · ติดเขา ฿{stats.totalDebt.toLocaleString()}</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="v3-btn v3-btn-primary">
          <Plus size={16} strokeWidth={2.5} /> เพิ่ม Supplier
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
            ซัพพลายเออร์
          </h1>
          <p style={{ fontSize: 11, color: 'var(--text-dim)' }}>
            {stats.total} เจ้า · ติดเขา ฿{stats.totalDebt.toLocaleString()}
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          style={{
            width: 40, height: 40,
            borderRadius: 10,
            background: 'var(--accent)',
            color: '#fff',
            border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <Plus size={20} strokeWidth={2.5} />
        </button>
      </div>

      {/* 4 KPIs */}
      <div className="v3-sup-stats" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 10,
        marginBottom: 14,
      }}>
        <StatCard label="ทั้งหมด" value={stats.total} sub="เจ้า" color="#3b82f6" Icon={Truck} />
        <StatCard label="ติดหนี้" value={stats.debtCount} sub={`฿${stats.totalDebt.toLocaleString()}`} color="#ef4444" Icon={TrendingDown} />
        <StatCard label="Credit" value={stats.totalCredit > 0 ? `฿${stats.totalCredit.toLocaleString()}` : '-'} sub="Supplier ติดเรา" color="#22c55e" Icon={TrendingUp} />
        <StatCard label="เคลียร์แล้ว" value={stats.clearCount} sub="ไม่มียอดค้าง" color="#8b5cf6" Icon={CheckCircle2} />
      </div>

      {/* Search + Filter tabs */}
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
            placeholder="ค้นหา ชื่อ / เบอร์ / ผู้ติดต่อ..."
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
          <Tab active={activeFilter === 'all'} onClick={() => setActiveFilter('all')} label="ทั้งหมด" count={stats.total} />
          <Tab active={activeFilter === 'debt'} onClick={() => setActiveFilter('debt')} label="ติดหนี้" count={stats.debtCount} color="#ef4444" />
          <Tab active={activeFilter === 'credit'} onClick={() => setActiveFilter('credit')} label="มี Credit" count={suppliers.filter(s => Number(s.balance || 0) > 0).length} color="#22c55e" />
          <Tab active={activeFilter === 'clear'} onClick={() => setActiveFilter('clear')} label="เคลียร์" count={stats.clearCount} color="#8b5cf6" />
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="v3-card" style={{ padding: 60, textAlign: 'center', color: 'var(--text-dim)' }}>
          <Loader2 size={24} className="v3-spin" style={{ marginBottom: 10 }} />
          <div>กำลังโหลด...</div>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState hasFilters={!!(search || activeFilter !== 'all')} onAdd={() => setShowAddModal(true)} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(s => (
            <SupplierCard
              key={s.id}
              supplier={s}
              stockCount={(stockMap.get(s.id) || []).length}
              menuOpen={menuOpenId === s.id}
              onToggleMenu={() => setMenuOpenId(menuOpenId === s.id ? null : s.id)}
              onClose={() => setMenuOpenId(null)}
              onEdit={() => { setMenuOpenId(null); setEditingSupplier(s); }}
              onDelete={() => handleDelete(s)}
              onViewHistory={() => { setMenuOpenId(null); setViewingHistory(s); }}
            />
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {(showAddModal || editingSupplier) && (
        <SupplierFormModal
          supplier={editingSupplier}
          profile={profile}
          onClose={() => { setShowAddModal(false); setEditingSupplier(null); }}
          onSuccess={() => { setShowAddModal(false); setEditingSupplier(null); loadData(); }}
        />
      )}

      {/* History Modal */}
      {viewingHistory && (
        <SupplierHistoryModal
          supplier={viewingHistory}
          stockItems={stockMap.get(viewingHistory.id) || []}
          onClose={() => setViewingHistory(null)}
        />
      )}

      <style jsx>{`
        @media (max-width: 640px) {
          :global(.v3-sup-stats) {
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
        fontSize: 20, fontWeight: 800,
        fontFamily: 'Prompt, sans-serif',
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
    </button>
  );
}

function SupplierCard({ supplier, stockCount, menuOpen, onToggleMenu, onClose, onEdit, onDelete, onViewHistory }: any) {
  const balance = Number(supplier.balance || 0);
  const status = balance < 0 ? 'debt' : balance > 0 ? 'credit' : 'clear';
  const statusColor = balance < 0 ? '#ef4444' : balance > 0 ? '#22c55e' : '#94a3b8';
  const statusBg = balance < 0 ? '#fee2e2' : balance > 0 ? '#dcfce7' : '#f1f5f9';
  const statusLabel = balance < 0 ? 'ติดหนี้' : balance > 0 ? 'มี Credit' : 'เคลียร์';

  return (
    <button
      onClick={onViewHistory}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderLeft: `4px solid ${statusColor}`,
        borderRadius: 14,
        padding: 14,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        position: 'relative',
        cursor: 'pointer',
        fontFamily: 'inherit',
        textAlign: 'left',
        width: '100%',
      }}
    >
      <div style={{
        width: 48, height: 48,
        borderRadius: 24,
        background: `${statusColor}15`,
        color: statusColor,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
        fontWeight: 700,
        fontSize: 18,
        fontFamily: 'Prompt, sans-serif',
      }}>
        <Truck size={22} strokeWidth={2.2} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 14, fontWeight: 700,
          fontFamily: 'Prompt, Sarabun, sans-serif',
          marginBottom: 2,
        }}>
          {supplier.name}
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 10, color: 'var(--text-dim)' }}>
          {supplier.contact_person && (
            <span>
              <User size={9} style={{ display: 'inline', marginRight: 3, verticalAlign: '-1px' }} />
              {supplier.contact_person}
            </span>
          )}
          {supplier.phone && (
            <span>
              <Phone size={9} style={{ display: 'inline', marginRight: 3, verticalAlign: '-1px' }} />
              {supplier.phone}
            </span>
          )}
          {stockCount > 0 && (
            <span style={{ color: 'var(--accent)' }}>
              <Smartphone size={9} style={{ display: 'inline', marginRight: 3, verticalAlign: '-1px' }} />
              {stockCount} เครื่อง
            </span>
          )}
        </div>
        {Math.abs(balance) > 0 && (
          <div style={{
            display: 'inline-block',
            marginTop: 6,
            padding: '2px 8px',
            fontSize: 10,
            fontWeight: 700,
            borderRadius: 100,
            background: statusBg,
            color: statusColor,
          }}>
            {statusLabel} ฿{Math.abs(balance).toLocaleString()}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ position: 'relative' }}>
          <button
            onClick={onToggleMenu}
            style={{
              width: 32, height: 32,
              background: 'var(--surface-2)',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              color: 'var(--text-dim)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <MoreVertical size={15} />
          </button>
          {menuOpen && (
            <>
              <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 19 }} />
              <div style={{
                position: 'absolute',
                top: 36, right: 0,
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                boxShadow: 'var(--shadow-lg)',
                minWidth: 160,
                padding: 4,
                zIndex: 20,
              }}>
                <button onClick={onViewHistory} style={menuBtnStyle}>
                  <History size={13} /> ดูประวัติ
                </button>
                <button onClick={onEdit} style={menuBtnStyle}>
                  <Edit2 size={13} /> แก้ไข
                </button>
                <button onClick={onDelete} style={{ ...menuBtnStyle, color: 'var(--danger)' }}>
                  <Trash2 size={13} /> ลบ
                </button>
              </div>
            </>
          )}
        </div>
        <ChevronRight size={16} color="var(--text-muted)" />
      </div>
    </button>
  );
}

/* =========================
   Add / Edit Modal
========================= */

function SupplierFormModal({ supplier, profile, onClose, onSuccess }: any) {
  const supabase = createClient();
  const isEdit = !!supplier;
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: supplier?.name || '',
    phone: supplier?.phone || '',
    contact_person: supplier?.contact_person || '',
    address: supplier?.address || '',
    note: supplier?.note || '',
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      alert('กรุณาใส่ชื่อ Supplier');
      return;
    }

    setSubmitting(true);
    const payload: any = {
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      contact_person: form.contact_person.trim() || null,
      address: form.address.trim() || null,
      note: form.note.trim() || null,
    };

    let error;
    if (isEdit) {
      ({ error } = await supabase.from('suppliers').update(payload).eq('id', supplier.id));
    } else {
      payload.shop_id = profile?.shop_id || null;
      payload.balance = 0;
      ({ error } = await supabase.from('suppliers').insert(payload));
    }

    setSubmitting(false);
    if (error) { alert('บันทึกไม่สำเร็จ: ' + error.message); return; }
    onSuccess();
  }

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
          maxWidth: 460,
          width: '100%',
          padding: 18,
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}>
          <h2 style={{
            fontSize: 16, fontWeight: 700,
            fontFamily: 'Prompt, sans-serif',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <Truck size={18} color="#3b82f6" />
            {isEdit ? 'แก้ไข Supplier' : 'เพิ่ม Supplier'}
          </h2>
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32,
              background: 'var(--surface-2)',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Field label="ชื่อร้าน / ชื่อ Supplier" required>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="เช่น สมเกียรติโมบาย"
              style={inputStyle}
              autoFocus
            />
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="ผู้ติดต่อ">
              <input
                type="text"
                value={form.contact_person}
                onChange={(e) => setForm({ ...form, contact_person: e.target.value })}
                placeholder="คุณสมชาย"
                style={inputStyle}
              />
            </Field>
            <Field label="เบอร์โทร">
              <input
                type="text"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="0xx-xxx-xxxx"
                style={inputStyle}
              />
            </Field>
          </div>

          <Field label="ที่อยู่">
            <input
              type="text"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="ที่อยู่ของ Supplier"
              style={inputStyle}
            />
          </Field>

          <Field label="หมายเหตุ">
            <textarea
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              placeholder="เช่น เครดิต 30 วัน, ราคาขายส่ง, ฯลฯ"
              rows={2}
              style={{ ...inputStyle, padding: '10px 12px', minHeight: 60, resize: 'vertical' }}
            />
          </Field>

          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                padding: '11px',
                background: 'var(--surface-2)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={{
                flex: 1,
                padding: '11px',
                background: submitting ? 'var(--surface-2)' : 'var(--accent)',
                color: '#fff',
                border: 'none',
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 700,
                cursor: submitting ? 'wait' : 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {submitting ? 'กำลังบันทึก...' : (isEdit ? 'บันทึก' : '+ เพิ่ม')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* =========================
   History Modal
========================= */

function SupplierHistoryModal({ supplier, stockItems, onClose }: any) {
  const balance = Number(supplier.balance || 0);
  const totalCost = stockItems.reduce((s: number, x: any) => s + Number(x.cost_price || 0), 0);

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
          maxWidth: 560,
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
            <div style={{
              width: 64, height: 64,
              borderRadius: 16,
              background: 'rgba(255,255,255,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Truck size={30} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 20, fontWeight: 800,
                fontFamily: 'Prompt, sans-serif',
                marginBottom: 4,
              }}>
                {supplier.name}
              </div>
              {supplier.phone && (
                <a href={`tel:${supplier.phone}`} style={{
                  fontSize: 12,
                  color: 'rgba(255,255,255,0.9)',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}>
                  <Phone size={11} /> {supplier.phone}
                </a>
              )}
              {supplier.contact_person && (
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)', marginTop: 2 }}>
                  <User size={10} style={{ display: 'inline', marginRight: 3, verticalAlign: '-1px' }} />
                  {supplier.contact_person}
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

          {/* Balance */}
          <div style={{
            padding: 14,
            background: 'rgba(255,255,255,0.15)',
            borderRadius: 12,
            backdropFilter: 'blur(4px)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <div>
              <div style={{ fontSize: 11, opacity: 0.9 }}>
                {balance < 0 ? 'เราติด Supplier' : balance > 0 ? 'Supplier ติดเรา' : 'ยอดเคลียร์แล้ว'}
              </div>
              <div style={{
                fontSize: 24,
                fontWeight: 800,
                fontFamily: 'Prompt, sans-serif',
                marginTop: 2,
              }}>
                ฿{Math.abs(balance).toLocaleString()}
              </div>
            </div>
            <div style={{
              width: 44, height: 44,
              borderRadius: 12,
              background: 'rgba(255,255,255,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {balance < 0 ? <TrendingDown size={22} /> : balance > 0 ? <TrendingUp size={22} /> : <CheckCircle2 size={22} />}
            </div>
          </div>
        </div>

        <div style={{ padding: 16 }}>
          {/* Stats mini */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 8,
            marginBottom: 16,
          }}>
            <div style={{
              padding: 10,
              background: 'var(--surface-2)',
              borderRadius: 10,
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'Prompt, sans-serif' }}>
                {stockItems.length}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>
                เครื่องที่รับเข้า
              </div>
            </div>
            <div style={{
              padding: 10,
              background: 'var(--surface-2)',
              borderRadius: 10,
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'Prompt, sans-serif' }}>
                ฿{totalCost.toLocaleString()}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>
                ต้นทุนรวม
              </div>
            </div>
          </div>

          {/* Address & Note */}
          {(supplier.address || supplier.note) && (
            <div style={{
              marginBottom: 16,
              padding: 12,
              background: 'var(--surface-2)',
              borderRadius: 10,
            }}>
              {supplier.address && (
                <div style={{ fontSize: 11, color: 'var(--text)', marginBottom: 6 }}>
                  <MapPin size={11} style={{ display: 'inline', marginRight: 4, verticalAlign: '-1px' }} />
                  {supplier.address}
                </div>
              )}
              {supplier.note && (
                <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                  <FileText size={11} style={{ display: 'inline', marginRight: 4, verticalAlign: '-1px' }} />
                  {supplier.note}
                </div>
              )}
            </div>
          )}

          {/* Stock list */}
          <h3 style={{
            fontSize: 13,
            fontWeight: 700,
            fontFamily: 'Prompt, sans-serif',
            marginBottom: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            <Smartphone size={14} /> เครื่องที่รับจาก Supplier นี้ ({stockItems.length})
          </h3>

          {stockItems.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-dim)', fontSize: 12 }}>
              ยังไม่มีเครื่องจาก Supplier นี้
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {stockItems.slice(0, 50).map((s: any) => (
                <div key={s.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: 10,
                  background: 'var(--surface-2)',
                  borderRadius: 10,
                }}>
                  <div style={{
                    width: 32, height: 32,
                    borderRadius: 8,
                    background: 'var(--surface)',
                    color: 'var(--text-dim)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <Smartphone size={14} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 12,
                      fontWeight: 600,
                      fontFamily: 'Prompt, Sarabun, sans-serif',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {s.model}
                    </div>
                    <div style={{ fontSize: 9, color: 'var(--text-dim)', fontFamily: 'monospace' }}>
                      IMEI: {s.imei?.slice(-6)} · {s.added_date ? new Date(s.added_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }) : ''}
                    </div>
                  </div>
                  {s.cost_price && (
                    <div style={{ textAlign: 'right' }}>
                      <div style={{
                        fontSize: 12,
                        fontWeight: 700,
                        fontFamily: 'Prompt, sans-serif',
                        color: '#ef4444',
                      }}>
                        -฿{Number(s.cost_price).toLocaleString()}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {stockItems.length > 50 && (
                <div style={{ fontSize: 11, color: 'var(--text-dim)', textAlign: 'center', padding: 8 }}>
                  + อีก {stockItems.length - 50} รายการ
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, required, children }: any) {
  return (
    <div>
      <label style={{
        display: 'block',
        fontSize: 11,
        fontWeight: 600,
        marginBottom: 4,
        color: 'var(--text)',
      }}>
        {label} {required && <span style={{ color: '#ef4444' }}>*</span>}
      </label>
      {children}
    </div>
  );
}

function EmptyState({ hasFilters, onAdd }: any) {
  return (
    <div className="v3-card" style={{ textAlign: 'center', padding: 40 }}>
      <Truck size={48} strokeWidth={1.2} style={{ margin: '0 auto 12px', color: 'var(--text-muted)' }} />
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
        {hasFilters ? 'ไม่พบ Supplier ตามที่ค้นหา' : 'ยังไม่มี Supplier'}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 16 }}>
        {hasFilters ? 'ลองเปลี่ยนตัวกรอง' : 'เริ่มต้นโดยการเพิ่ม Supplier ใหม่'}
      </div>
      {!hasFilters && (
        <button onClick={onAdd} className="v3-btn v3-btn-primary">
          <Plus size={14} /> เพิ่ม Supplier
        </button>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  height: 38,
  padding: '0 12px',
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  color: 'var(--text)',
  fontSize: 13,
  fontFamily: 'inherit',
  outline: 'none',
};

const menuBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 10px',
  borderRadius: 6,
  color: 'var(--text)',
  fontSize: 12,
  border: 'none',
  background: 'transparent',
  width: '100%',
  textAlign: 'left',
  cursor: 'pointer',
  fontFamily: 'inherit',
};
