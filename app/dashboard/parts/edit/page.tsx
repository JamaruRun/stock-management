'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-client';
import Toast from '@/components/Toast';
import { PART_CATEGORIES, PART_GRADES, COMMON_PHONE_MODELS, getCategoryLabel } from '@/lib/parts-constants';

function EditPartContent() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const partId = searchParams.get('id');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [toast, setToast] = useState<{ title: string; msg: string; type: string } | null>(null);

  const [form, setForm] = useState({
    name: '',
    category: 'battery',
    phone_model: '',
    grade: 'oem',
    cost_price: '',
    sell_price: '',
    low_stock_alert: '2',
    supplier_id: '',
    sku: '',
    note: '',
    stock_qty: 0,
  });

  function showToast(title: string, msg: string, type: 'success' | 'danger' = 'success') {
    setToast({ title, msg, type });
    setTimeout(() => setToast(null), 2500);
  }

  // 🆕 เฉพาะ admin เห็น/แก้ต้นทุน
  const isAdmin = profile?.role === 'admin';

  useEffect(() => {
    async function load() {
      if (!partId) {
        router.push('/dashboard/parts');
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: p } = await supabase
        .from('profiles').select('*').eq('id', user.id).single();
      setProfile(p);

      // Load part data
      const { data: part, error } = await supabase
        .from('parts').select('*').eq('id', partId).single();
      
      if (error || !part) {
        showToast('ไม่พบอะไหล่', '', 'danger');
        setTimeout(() => router.push('/dashboard/parts'), 1000);
        return;
      }

      setForm({
        name: part.name,
        category: part.category,
        phone_model: part.phone_model,
        grade: part.grade || '',
        cost_price: String(part.cost_price),
        sell_price: String(part.sell_price),
        low_stock_alert: String(part.low_stock_alert),
        supplier_id: part.supplier_id || '',
        sku: part.sku || '',
        note: part.note || '',
        stock_qty: part.stock_qty,
      });

      const { data: sup } = await supabase
        .from('suppliers').select('id, name').order('name');
      setSuppliers(sup || []);

      // Load transactions
      const { data: tx } = await supabase
        .from('part_transactions')
        .select('*')
        .eq('part_id', partId)
        .order('created_at', { ascending: false })
        .limit(50);
      setTransactions(tx || []);

      setLoading(false);
    }
    load();
  }, [partId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!partId || !profile) return;
    
    if (!form.name.trim() || !form.phone_model.trim()) {
      showToast('กรอกข้อมูลให้ครบ', '', 'danger');
      return;
    }

    setSaving(true);

    // สร้าง update object
    const updateData: any = {
      name: form.name.trim(),
      category: form.category,
      phone_model: form.phone_model.trim(),
      grade: form.grade || null,
      sell_price: parseFloat(form.sell_price) || 0,
      low_stock_alert: parseInt(form.low_stock_alert) || 2,
      supplier_id: form.supplier_id || null,
      sku: form.sku.trim() || null,
      note: form.note.trim() || null,
    };

    // 🆕 เฉพาะ admin เท่านั้นที่อัพเดท cost_price ได้
    // (staff แก้ข้อมูลอื่นได้ แต่ต้นทุนไม่ถูกแตะ)
    if (isAdmin) {
      updateData.cost_price = parseFloat(form.cost_price) || 0;
    }

    const { error } = await supabase
      .from('parts')
      .update(updateData)
      .eq('id', partId);

    if (error) {
      showToast('บันทึกไม่สำเร็จ', error.message, 'danger');
      setSaving(false);
      return;
    }

    showToast('บันทึกสำเร็จ', '');
    setTimeout(() => router.push('/dashboard/parts'), 600);
  }

  async function handleDelete() {
    if (!partId) return;
    if (!confirm(`ลบอะไหล่ "${form.name}"?\n\nประวัติการเคลื่อนไหวจะถูกลบไปด้วย\nการกระทำนี้ย้อนกลับไม่ได้`)) return;
    
    setDeleting(true);
    const { error } = await supabase
      .from('parts').delete().eq('id', partId);
    
    if (error) {
      showToast('ลบไม่สำเร็จ', error.message, 'danger');
      setDeleting(false);
      return;
    }

    showToast('ลบสำเร็จ', '');
    setTimeout(() => router.push('/dashboard/parts'), 600);
  }

  function formatDate(s: string) {
    return new Date(s).toLocaleString('th-TH', { 
      day: 'numeric', month: 'short', 
      hour: '2-digit', minute: '2-digit',
    });
  }

  function txLabel(type: string) {
    if (type === 'in') return { label: '➕ รับเข้า', color: '#10b981' };
    if (type === 'out') return { label: '➖ จ่ายออก', color: '#ef4444' };
    if (type === 'adjust') return { label: '🔄 ปรับ', color: '#3b82f6' };
    if (type === 'used_in_repair') return { label: '🔧 ใช้ในงานซ่อม', color: '#f59e0b' };
    return { label: type, color: 'var(--text-dim)' };
  }

  if (loading) {
    return (
      <>
        <div className="page-header"><h1>✏️ แก้ไขอะไหล่</h1></div>
        <div className="skeleton" style={{ height: 200 }}></div>
      </>
    );
  }

  return (
    <>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div>
          <h1>✏️ แก้ไขอะไหล่</h1>
          <div className="desc">คงเหลือ {form.stock_qty} ชิ้น</div>
        </div>
        <Link href="/dashboard/parts" style={{
          padding: '8px 14px',
          background: 'var(--surface-2)',
          color: 'var(--text)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          fontSize: 12,
          textDecoration: 'none',
        }}>← กลับ</Link>
      </div>

      <form onSubmit={handleSubmit} className="form-card">
        <h3>📦 ข้อมูลอะไหล่</h3>
        
        <div className="form-grid">
          <div className="field full">
            <label>ประเภทอะไหล่ <span style={{ color: 'var(--danger)' }}>*</span></label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 6 }}>
              {PART_CATEGORIES.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setForm({ ...form, category: c.id })}
                  style={{
                    padding: '10px 6px',
                    background: form.category === c.id ? 'var(--accent)' : 'var(--surface-2)',
                    color: form.category === c.id ? '#fff' : 'var(--text)',
                    border: 'none',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontSize: 12,
                    fontWeight: form.category === c.id ? 600 : 500,
                  }}
                >{c.label}</button>
              ))}
            </div>
          </div>

          <div className="field full">
            <label>รุ่นมือถือ <span style={{ color: 'var(--danger)' }}>*</span></label>
            <input
              type="text"
              value={form.phone_model}
              onChange={(e) => setForm({ ...form, phone_model: e.target.value })}
              list="phone-models"
              required
            />
            <datalist id="phone-models">
              {COMMON_PHONE_MODELS.map(m => <option key={m} value={m} />)}
            </datalist>
          </div>

          <div className="field full">
            <label>ชื่ออะไหล่ <span style={{ color: 'var(--danger)' }}>*</span></label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>

          <div className="field full">
            <label>เกรด</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {PART_GRADES.map(g => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setForm({ ...form, grade: form.grade === g.id ? '' : g.id })}
                  style={{
                    padding: '8px 14px',
                    background: form.grade === g.id ? g.color : 'var(--surface-2)',
                    color: form.grade === g.id ? '#fff' : 'var(--text)',
                    border: 'none',
                    borderRadius: 100,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >{g.label}</button>
              ))}
            </div>
          </div>

          {isAdmin && (
            <div className="field">
              <label>ต้นทุน/ชิ้น <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>(เฉพาะเจ้าของเห็น)</span></label>
              <input
                type="number"
                value={form.cost_price}
                onChange={(e) => setForm({ ...form, cost_price: e.target.value })}
                inputMode="decimal"
                step="0.01"
              />
            </div>
          )}

          <div className="field">
            <label>ราคาขาย/เปลี่ยน</label>
            <input
              type="number"
              value={form.sell_price}
              onChange={(e) => setForm({ ...form, sell_price: e.target.value })}
              inputMode="decimal"
              step="0.01"
            />
          </div>

          <div className="field">
            <label>จุดแจ้งเตือนขั้นต่ำ</label>
            <input
              type="number"
              value={form.low_stock_alert}
              onChange={(e) => setForm({ ...form, low_stock_alert: e.target.value })}
              inputMode="numeric"
              min="0"
            />
          </div>

          <div className="field">
            <label>Supplier</label>
            <select
              value={form.supplier_id}
              onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}
            >
              <option value="">- ไม่ระบุ -</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>SKU</label>
            <input
              type="text"
              value={form.sku}
              onChange={(e) => setForm({ ...form, sku: e.target.value })}
              style={{ fontFamily: 'JetBrains Mono, monospace' }}
            />
          </div>

          <div className="field">
            <label>หมายเหตุ</label>
            <input
              type="text"
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
            />
          </div>
        </div>

        <div className="form-actions" style={{ marginTop: 16, display: 'flex', gap: 8 }}>
          <button type="submit" className="btn" disabled={saving} style={{ flex: 1 }}>
            {saving ? 'กำลังบันทึก...' : '💾 บันทึก'}
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            style={{
              padding: '12px 16px',
              background: 'var(--surface)',
              color: '#ef4444',
              border: '1px solid #ef4444',
              borderRadius: 6,
              cursor: deleting ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            {deleting ? '...' : '🗑️ ลบ'}
          </button>
        </div>
      </form>

      {/* Transaction History */}
      <div className="form-card" style={{ marginTop: 16 }}>
        <div 
          onClick={() => setShowHistory(!showHistory)}
          style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            cursor: 'pointer',
          }}
        >
          <h3 style={{ margin: 0 }}>📜 ประวัติการเคลื่อนไหว ({transactions.length})</h3>
          <span style={{ color: 'var(--accent)', fontSize: 12 }}>
            {showHistory ? '▼' : '▶'}
          </span>
        </div>

        {showHistory && (
          <div style={{ marginTop: 12 }}>
            {transactions.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-dim)', textAlign: 'center', padding: 20 }}>
                ยังไม่มีประวัติ
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {transactions.map(tx => {
                  const info = txLabel(tx.type);
                  return (
                    <div
                      key={tx.id}
                      style={{
                        padding: 10,
                        background: 'var(--surface-2)',
                        borderRadius: 6,
                        fontSize: 12,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ color: info.color, fontWeight: 600, marginBottom: 2 }}>
                          {info.label}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                          {formatDate(tx.created_at)} 
                          {tx.done_by_name && ` • ${tx.done_by_name}`}
                        </div>
                        {tx.note && (
                          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>
                            "{tx.note}"
                          </div>
                        )}
                      </div>
                      <div style={{ 
                        fontSize: 16, 
                        fontWeight: 700,
                        color: tx.qty_change > 0 ? '#10b981' : '#ef4444',
                      }}>
                        {tx.qty_change > 0 ? '+' : ''}{tx.qty_change}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {toast && <Toast {...toast} />}
    </>
  );
}

export default function EditPartPage() {
  return (
    <Suspense fallback={<div className="loading"><div className="spinner"></div></div>}>
      <EditPartContent />
    </Suspense>
  );
}
