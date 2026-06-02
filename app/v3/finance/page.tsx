'use client';

import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase-client';
import {
  Wallet, TrendingUp, TrendingDown, DollarSign, Plus,
  Calendar, Receipt, Coffee, Zap, Home, Truck, Users,
  Hammer, MoreHorizontal, X, Loader2, ArrowDownRight, ArrowUpRight,
  PiggyBank, Calculator, Trash2, MoreVertical, Tag, Lock,
} from 'lucide-react';

type RangeId = 'today' | '7days' | '30days' | '90days' | 'all';

const EXPENSE_CATEGORIES = [
  { id: 'rent', label: 'ค่าเช่า', Icon: Home, color: '#3b82f6' },
  { id: 'utility', label: 'ค่าน้ำค่าไฟ', Icon: Zap, color: '#f59e0b' },
  { id: 'salary', label: 'เงินเดือน', Icon: Users, color: '#8b5cf6' },
  { id: 'transport', label: 'ค่าเดินทาง', Icon: Truck, color: '#06b6d4' },
  { id: 'food', label: 'อาหาร/เครื่องดื่ม', Icon: Coffee, color: '#ec4899' },
  { id: 'tools', label: 'อุปกรณ์/เครื่องมือ', Icon: Hammer, color: '#22c55e' },
  { id: 'tax', label: 'ภาษี/ค่าธรรมเนียม', Icon: Receipt, color: '#ef4444' },
  { id: 'other', label: 'อื่นๆ', Icon: MoreHorizontal, color: '#6b7280' },
];

function getCategoryInfo(id: string) {
  return EXPENSE_CATEGORIES.find(c => c.id === id) || EXPENSE_CATEGORIES[7];
}

interface Expense {
  id: string;
  category: string;
  description?: string | null;
  amount: number;
  expense_date: string;
  payment_method?: string | null;
  note?: string | null;
  added_by_name?: string | null;
}

export default function V3FinancePage() {
  const supabase = createClient();
  const [range, setRange] = useState<RangeId>('30days');
  const [loading, setLoading] = useState(true);
  const [income, setIncome] = useState(0);
  const [cost, setCost] = useState(0);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: p } = await supabase
        .from('profiles')
        .select('id, full_name, role, is_super_admin, shop_id')
        .eq('id', user.id)
        .single();
      setProfile(p);

      // ดึง data parallel
      const [stockRes, goodsRes, partsRes, instPayments, expRes] = await Promise.all([
        supabase
          .from('sales_history')
          .select('final_price, cost_price, sold_date')
          .order('sold_date', { ascending: false })
          .limit(2000),
        supabase
          .from('goods_sales')
          .select('subtotal, sold_date')
          .order('sold_date', { ascending: false })
          .limit(2000),
        supabase
          .from('parts_sales' as any)
          .select('*')
          .order('sold_date', { ascending: false })
          .limit(2000),
        supabase
          .from('installment_payments')
          .select('amount, payment_date')
          .order('payment_date', { ascending: false })
          .limit(2000),
        supabase
          .from('expenses' as any)
          .select('*')
          .order('expense_date', { ascending: false })
          .limit(1000),
      ]);

      // คำนวณรายได้
      let totalIncome = 0;
      let totalCost = 0;

      (stockRes.data || []).forEach((r: any) => {
        totalIncome += Number(r.final_price || 0);
        totalCost += Number(r.cost_price || 0);
      });

      (goodsRes.data || []).forEach((r: any) => {
        totalIncome += Number(r.subtotal || 0);
      });

      if (!partsRes.error) {
        (partsRes.data || []).forEach((r: any) => {
          totalIncome += Number(r.subtotal || r.unit_price * (r.quantity || 1) || 0);
        });
      }

      (instPayments.data || []).forEach((r: any) => {
        totalIncome += Number(r.amount || 0);
      });

      setIncome(totalIncome);
      setCost(totalCost);

      if (!expRes.error) {
        setExpenses((expRes.data || []) as Expense[]);
      } else {
        setExpenses([]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const isAdmin = profile?.role === 'admin' || profile?.is_super_admin;

  // Filter by date range
  const startISO = useMemo(() => {
    const now = new Date();
    const start = new Date();
    if (range === 'today') start.setHours(0, 0, 0, 0);
    else if (range === '7days') start.setDate(now.getDate() - 7);
    else if (range === '30days') start.setDate(now.getDate() - 30);
    else if (range === '90days') start.setDate(now.getDate() - 90);
    else return '0000-01-01';
    return start.toISOString().split('T')[0];
  }, [range]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => (e.expense_date || '') >= startISO);
  }, [expenses, startISO]);

  const totalExpenses = useMemo(() => {
    return filteredExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  }, [filteredExpenses]);

  // Expense by category
  const expensesByCategory = useMemo(() => {
    const map = new Map<string, number>();
    filteredExpenses.forEach(e => {
      const cur = map.get(e.category) || 0;
      map.set(e.category, cur + Number(e.amount || 0));
    });
    return EXPENSE_CATEGORIES
      .map(c => ({ ...c, total: map.get(c.id) || 0 }))
      .filter(c => c.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [filteredExpenses]);

  // Net profit = รายได้ - ต้นทุน - ค่าใช้จ่าย
  const grossProfit = income - cost;
  const netProfit = grossProfit - totalExpenses;

  async function handleDelete(exp: Expense) {
    if (!confirm(`ลบรายจ่าย "${exp.description || exp.category}"?\n\nย้อนกลับไม่ได้`)) return;
    const { error } = await supabase.from('expenses').delete().eq('id', exp.id);
    if (error) { alert('ลบไม่สำเร็จ: ' + error.message); return; }
    setMenuOpenId(null);
    load();
  }

  if (!loading && profile && !isAdmin) {
    return (
      <div className="v3-card" style={{ padding: 40, textAlign: 'center' }}>
        <Lock size={48} strokeWidth={1.2} style={{ margin: '0 auto 12px', color: 'var(--text-muted)' }} />
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>เฉพาะแอดมิน</h2>
        <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>หน้าการเงินจำกัดให้แอดมินเท่านั้น</p>
      </div>
    );
  }

  return (
    <>
      <div className="v3-page-header v3-desktop-only">
        <div>
          <h1 className="v3-page-title">การเงิน</h1>
          <p className="v3-page-subtitle">ภาพรวมเงินสด รายรับ รายจ่าย</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="v3-btn v3-btn-primary">
          <Plus size={16} strokeWidth={2.5} /> เพิ่มรายจ่าย
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
            การเงิน
          </h1>
          <p style={{ fontSize: 11, color: 'var(--text-dim)' }}>
            รายรับ · รายจ่าย · กำไรสุทธิ
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

      {/* Date Range */}
      <div className="v3-card" style={{ padding: 8, marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 4 }}>
          <RangeBtn active={range === 'today'} onClick={() => setRange('today')} label="วันนี้" />
          <RangeBtn active={range === '7days'} onClick={() => setRange('7days')} label="7 วัน" />
          <RangeBtn active={range === '30days'} onClick={() => setRange('30days')} label="30 วัน" />
          <RangeBtn active={range === '90days'} onClick={() => setRange('90days')} label="90 วัน" />
          <RangeBtn active={range === 'all'} onClick={() => setRange('all')} label="ทั้งหมด" />
        </div>
      </div>

      {loading ? (
        <div className="v3-card" style={{ padding: 60, textAlign: 'center', color: 'var(--text-dim)' }}>
          <Loader2 size={24} className="v3-spin" style={{ marginBottom: 10 }} />
          <div>กำลังคำนวณ...</div>
        </div>
      ) : (
        <>
          {/* Hero summary - กำไรสุทธิ */}
          <div style={{
            background: netProfit >= 0
              ? 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)'
              : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
            borderRadius: 18,
            padding: 18,
            marginBottom: 14,
            color: '#fff',
            boxShadow: netProfit >= 0 ? '0 8px 24px rgba(34, 197, 94, 0.25)' : '0 8px 24px rgba(239, 68, 68, 0.25)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 4 }}>
                  {netProfit >= 0 ? '💰 กำไรสุทธิ' : '⚠️ ขาดทุนสุทธิ'}
                </div>
                <div style={{
                  fontSize: 32, fontWeight: 800,
                  fontFamily: 'Prompt, sans-serif',
                  letterSpacing: '-0.5px',
                  lineHeight: 1,
                }}>
                  ฿{Math.abs(netProfit).toLocaleString()}
                </div>
                <div style={{ fontSize: 11, opacity: 0.85, marginTop: 6 }}>
                  รายรับ ฿{income.toLocaleString()} − ต้นทุน ฿{cost.toLocaleString()} − รายจ่าย ฿{totalExpenses.toLocaleString()}
                </div>
              </div>
              <div style={{
                width: 56, height: 56,
                borderRadius: 16,
                background: 'rgba(255,255,255,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                {netProfit >= 0 ? <PiggyBank size={28} /> : <TrendingDown size={28} />}
              </div>
            </div>
          </div>

          {/* 3 KPI cards */}
          <div className="v3-fin-stats" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 10,
            marginBottom: 14,
          }}>
            <FinCard
              label="รายรับรวม"
              value={`฿${income.toLocaleString()}`}
              sub="เงินเข้า"
              color="#22c55e"
              Icon={ArrowUpRight}
              direction="up"
            />
            <FinCard
              label="ต้นทุนสินค้า"
              value={`฿${cost.toLocaleString()}`}
              sub={`กำไรขั้นต้น ฿${grossProfit.toLocaleString()}`}
              color="#f59e0b"
              Icon={Calculator}
            />
            <FinCard
              label="รายจ่ายอื่น"
              value={`฿${totalExpenses.toLocaleString()}`}
              sub={`${filteredExpenses.length} รายการ`}
              color="#ef4444"
              Icon={ArrowDownRight}
              direction="down"
            />
          </div>

          {/* Expenses by category */}
          {expensesByCategory.length > 0 && (
            <div className="v3-card" style={{ padding: 16, marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div style={{
                  width: 30, height: 30,
                  borderRadius: 8,
                  background: '#fee2e2',
                  color: '#ef4444',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Tag size={16} />
                </div>
                <h3 style={{ fontSize: 14, fontWeight: 700, fontFamily: 'Prompt, sans-serif' }}>
                  รายจ่ายแยกตามหมวด
                </h3>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {expensesByCategory.map(cat => (
                  <CategoryRow
                    key={cat.id}
                    cat={cat}
                    maxTotal={expensesByCategory[0]?.total || 1}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Expense list */}
          <div className="v3-card" style={{ padding: 16, marginBottom: 14 }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 14,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 30, height: 30,
                  borderRadius: 8,
                  background: '#fef3c7',
                  color: '#f59e0b',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Receipt size={16} />
                </div>
                <h3 style={{ fontSize: 14, fontWeight: 700, fontFamily: 'Prompt, sans-serif' }}>
                  รายการรายจ่าย ({filteredExpenses.length})
                </h3>
              </div>
            </div>

            {filteredExpenses.length === 0 ? (
              <div style={{ padding: 30, textAlign: 'center' }}>
                <Receipt size={36} strokeWidth={1.5} style={{ margin: '0 auto 8px', color: 'var(--text-muted)' }} />
                <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 12 }}>
                  ยังไม่มีรายจ่ายในช่วงเวลานี้
                </div>
                <button
                  onClick={() => setShowAddModal(true)}
                  style={{
                    padding: '8px 16px',
                    background: 'var(--accent)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 600,
                    fontFamily: 'inherit',
                  }}
                >
                  + เพิ่มรายจ่ายแรก
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {filteredExpenses.map(exp => (
                  <ExpenseRow
                    key={exp.id}
                    exp={exp}
                    menuOpen={menuOpenId === exp.id}
                    onToggleMenu={() => setMenuOpenId(menuOpenId === exp.id ? null : exp.id)}
                    onClose={() => setMenuOpenId(null)}
                    onDelete={() => handleDelete(exp)}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {showAddModal && (
        <AddExpenseModal
          profile={profile}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => { setShowAddModal(false); load(); }}
        />
      )}

      <style jsx>{`
        @media (max-width: 640px) {
          :global(.v3-fin-stats) {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </>
  );
}

/* =========================
   Components
========================= */

function RangeBtn({ active, onClick, label }: any) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: '8px 10px',
        background: active ? 'var(--accent)' : 'transparent',
        color: active ? '#fff' : 'var(--text-dim)',
        border: 'none',
        borderRadius: 8,
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
        fontFamily: 'inherit',
      }}
    >
      {label}
    </button>
  );
}

function FinCard({ label, value, sub, color, Icon, direction }: any) {
  return (
    <div className="v3-card" style={{ padding: 14 }}>
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: 8,
      }}>
        <div style={{
          width: 34, height: 34,
          borderRadius: 10,
          background: `${color}15`,
          color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={18} strokeWidth={2.2} />
        </div>
        {direction && (
          <div style={{
            fontSize: 14,
            color,
            opacity: 0.7,
          }}>
            {direction === 'up' ? '↑' : '↓'}
          </div>
        )}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 3 }}>{label}</div>
      <div style={{
        fontSize: 20, fontWeight: 800,
        fontFamily: 'Prompt, sans-serif',
        lineHeight: 1.1,
      }}>
        {value}
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>{sub}</div>
    </div>
  );
}

function CategoryRow({ cat, maxTotal }: any) {
  const Icon = cat.Icon;
  const pct = (cat.total / maxTotal) * 100;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{
        width: 32, height: 32,
        borderRadius: 8,
        background: `${cat.color}15`,
        color: cat.color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Icon size={15} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 4,
        }}>
          <span style={{ fontSize: 12, fontWeight: 600 }}>{cat.label}</span>
          <span style={{
            fontSize: 13,
            fontWeight: 700,
            fontFamily: 'Prompt, sans-serif',
            color: cat.color,
          }}>
            ฿{cat.total.toLocaleString()}
          </span>
        </div>
        <div style={{
          height: 4,
          background: 'var(--surface-2)',
          borderRadius: 100,
          overflow: 'hidden',
        }}>
          <div style={{
            width: `${pct}%`,
            height: '100%',
            background: cat.color,
            borderRadius: 100,
          }} />
        </div>
      </div>
    </div>
  );
}

function ExpenseRow({ exp, menuOpen, onToggleMenu, onClose, onDelete }: any) {
  const info = getCategoryInfo(exp.category);
  const Icon = info.Icon;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: 10,
      background: 'var(--surface-2)',
      borderRadius: 10,
      borderLeft: `3px solid ${info.color}`,
    }}>
      <div style={{
        width: 36, height: 36,
        borderRadius: 8,
        background: `${info.color}15`,
        color: info.color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Icon size={16} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13,
          fontWeight: 600,
          fontFamily: 'Prompt, Sarabun, sans-serif',
          marginBottom: 2,
        }}>
          {exp.description || info.label}
        </div>
        <div style={{
          fontSize: 10,
          color: 'var(--text-dim)',
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
        }}>
          <span>{info.label}</span>
          <span>•</span>
          <span>{exp.expense_date ? new Date(exp.expense_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) : '-'}</span>
          {exp.added_by_name && <span>• {exp.added_by_name}</span>}
        </div>
      </div>
      <div style={{
        fontSize: 14,
        fontWeight: 800,
        fontFamily: 'Prompt, sans-serif',
        color: '#ef4444',
        whiteSpace: 'nowrap',
      }}>
        -฿{Number(exp.amount).toLocaleString()}
      </div>
      <div style={{ position: 'relative' }}>
        <button
          onClick={(e) => { e.stopPropagation(); onToggleMenu(); }}
          style={{
            width: 26, height: 26,
            background: 'transparent',
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
              minWidth: 120,
              padding: 4,
              zIndex: 20,
            }}>
              <button onClick={onDelete} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 10px',
                borderRadius: 6,
                color: 'var(--danger)',
                fontSize: 12,
                border: 'none',
                background: 'transparent',
                width: '100%',
                textAlign: 'left',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}>
                <Trash2 size={13} /> ลบ
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function AddExpenseModal({ profile, onClose, onSuccess }: any) {
  const supabase = createClient();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    category: 'rent',
    description: '',
    amount: '',
    expense_date: new Date().toISOString().split('T')[0],
    payment_method: 'cash',
    note: '',
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.amount || parseFloat(form.amount) <= 0) {
      alert('กรุณาใส่จำนวนเงินที่มากกว่า 0');
      return;
    }
    if (!profile?.shop_id) {
      alert('ไม่พบ shop_id');
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.from('expenses').insert({
      shop_id: profile.shop_id,
      branch_id: profile.branch_id || null,
      category: form.category,
      description: form.description.trim() || null,
      amount: parseFloat(form.amount),
      expense_date: form.expense_date,
      payment_method: form.payment_method,
      note: form.note.trim() || null,
      added_by: profile.id,
      added_by_name: profile.full_name,
    });
    setSubmitting(false);

    if (error) {
      alert('บันทึกไม่สำเร็จ: ' + error.message);
      return;
    }
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
            <Receipt size={18} color="#ef4444" /> เพิ่มรายจ่าย
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

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={labelStyle}>หมวดหมู่ *</label>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 6,
            }}>
              {EXPENSE_CATEGORIES.map(c => {
                const CatIcon = c.Icon;
                const isActive = form.category === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setForm({ ...form, category: c.id })}
                    style={{
                      padding: '10px 4px',
                      background: isActive ? `${c.color}15` : 'var(--surface-2)',
                      border: '1px solid',
                      borderColor: isActive ? c.color : 'var(--border)',
                      borderRadius: 10,
                      color: isActive ? c.color : 'var(--text)',
                      fontSize: 9,
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <CatIcon size={16} strokeWidth={isActive ? 2.4 : 2} />
                    <span style={{ lineHeight: 1.1 }}>{c.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label style={labelStyle}>รายละเอียด</label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="เช่น ค่าเช่าเดือนมิถุนายน"
              style={inputStyle}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle}>จำนวนเงิน *</label>
              <input
                type="number"
                inputMode="decimal"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="0"
                style={inputStyle}
                step="0.01"
                min="0.01"
              />
            </div>
            <div>
              <label style={labelStyle}>วันที่ *</label>
              <input
                type="date"
                value={form.expense_date}
                onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
                style={inputStyle}
              />
            </div>
          </div>

          <div>
            <label style={labelStyle}>ช่องทางชำระ</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
              {[
                { id: 'cash', label: '💵 เงินสด' },
                { id: 'transfer', label: '🔄 โอน' },
                { id: 'credit', label: '💳 บัตร' },
              ].map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setForm({ ...form, payment_method: p.id })}
                  style={{
                    padding: '8px',
                    background: form.payment_method === p.id ? 'var(--accent)' : 'var(--surface-2)',
                    color: form.payment_method === p.id ? '#fff' : 'var(--text)',
                    border: '1px solid',
                    borderColor: form.payment_method === p.id ? 'var(--accent)' : 'var(--border)',
                    borderRadius: 8,
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={labelStyle}>หมายเหตุ</label>
            <textarea
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              placeholder="(ไม่บังคับ)"
              rows={2}
              style={{ ...inputStyle, padding: '10px 12px', minHeight: 50, resize: 'vertical' }}
            />
          </div>

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
                background: submitting ? 'var(--surface-2)' : 'linear-gradient(135deg, #ef4444, #dc2626)',
                color: '#fff',
                border: 'none',
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 700,
                cursor: submitting ? 'wait' : 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {submitting ? 'กำลังบันทึก...' : '+ เพิ่มรายจ่าย'}
            </button>
          </div>
        </form>
      </div>
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

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 600,
  marginBottom: 4,
  color: 'var(--text)',
};
