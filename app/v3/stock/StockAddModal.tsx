'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase-client';
import { X, Plus, Smartphone, Barcode } from 'lucide-react';

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

export default function StockAddModal({ onClose, onSuccess }: Props) {
  const supabase = createClient();
  const [saving, setSaving] = useState(false);
  const [branches, setBranches] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);

  const [form, setForm] = useState({
    imei: '',
    model: '',
    color: '',
    spec: '',
    price: '',
    costPrice: '',
    supplierId: '',
    deviceCondition: 'new',
    addedDate: new Date().toISOString().split('T')[0],
    branchId: '',
  });

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { data: p } = await supabase
        .from('profiles')
        .select('id, full_name, shop_id, branch_id, role, is_super_admin')
        .eq('id', user.id)
        .single();
      
      setProfile(p);
      setForm(f => ({ ...f, branchId: p?.branch_id || '' }));

      const [bRes, sRes] = await Promise.all([
        supabase.from('branches').select('id, name').order('name'),
        supabase.from('suppliers').select('id, name').order('name'),
      ]);
      setBranches(bRes.data || []);
      setSuppliers(sRes.data || []);
    }
    init();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.imei.trim() || !form.model.trim() || !form.price) {
      alert('กรุณากรอก IMEI, รุ่น, และราคาให้ครบ');
      return;
    }
    if (!form.branchId) {
      alert('กรุณาเลือกสาขา');
      return;
    }

    setSaving(true);
    try {
      // Check duplicate IMEI
      const { data: existing } = await supabase
        .from('stock')
        .select('id')
        .eq('imei', form.imei)
        .maybeSingle();
      if (existing) {
        alert('IMEI นี้มีในระบบแล้ว');
        setSaving(false);
        return;
      }

      const costPrice = parseFloat(form.costPrice) || 0;

      const { error } = await supabase.from('stock').insert({
        imei: form.imei.trim(),
        model: form.model.trim(),
        color: form.color.trim() || null,
        spec: form.spec.trim() || null,
        price: parseFloat(form.price),
        cost_price: costPrice,
        supplier_id: form.supplierId || null,
        added_date: form.addedDate,
        added_by: profile?.id,
        added_by_name: profile?.full_name,
        branch_id: form.branchId,
        device_condition: form.deviceCondition,
        shop_id: profile?.shop_id,
      });

      if (error) {
        alert('บันทึกไม่สำเร็จ: ' + error.message);
        setSaving(false);
        return;
      }

      // ถ้ามี supplier + cost > 0 → บันทึก transaction
      if (form.supplierId && costPrice > 0) {
        await supabase.from('supplier_transactions').insert({
          supplier_id: form.supplierId,
          type: 'purchase',
          amount: costPrice,
          description: `รับ ${form.model} (${form.imei})`,
          reference_type: 'stock',
          transaction_date: form.addedDate,
          created_by: profile?.id,
          shop_id: profile?.shop_id,
        });
      }

      onSuccess();
    } catch (err: any) {
      alert('เกิดข้อผิดพลาด: ' + err.message);
      setSaving(false);
    }
  }

  return (
    <div onClick={onClose} style={overlayStyle}>
      <div onClick={(e) => e.stopPropagation()} style={modalStyle}>
        {/* Header */}
        <div style={headerStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36,
              borderRadius: 10,
              background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
              color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Plus size={20} strokeWidth={2.5} />
            </div>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, fontFamily: 'Prompt, sans-serif' }}>
                เพิ่มเครื่องใหม่
              </h3>
              <p style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                บันทึกเครื่องเข้าสต๊อก
              </p>
            </div>
          </div>
          <button onClick={onClose} style={closeBtnStyle}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} style={{ padding: 16, overflowY: 'auto' }}>
          {/* IMEI */}
          <FormField label="IMEI" required>
            <div style={{ position: 'relative' }}>
              <Barcode size={16} style={{
                position: 'absolute', left: 12, top: '50%',
                transform: 'translateY(-50%)', color: 'var(--text-muted)',
                pointerEvents: 'none',
              }} />
              <input
                type="text"
                value={form.imei}
                onChange={(e) => setForm({ ...form, imei: e.target.value.replace(/\D/g, '') })}
                placeholder="0000000000000000"
                maxLength={20}
                style={{ ...inputStyle, paddingLeft: 36, fontFamily: 'monospace' }}
                autoFocus
              />
            </div>
          </FormField>

          {/* Model + Color */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
            <FormField label="รุ่น" required>
              <input
                type="text"
                value={form.model}
                onChange={(e) => setForm({ ...form, model: e.target.value })}
                placeholder="iPhone 13 Pro Max"
                style={inputStyle}
              />
            </FormField>
            <FormField label="สี">
              <input
                type="text"
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
                placeholder="Midnight"
                style={inputStyle}
              />
            </FormField>
          </div>

          {/* Spec */}
          <FormField label="ความจุ / สเปก">
            <input
              type="text"
              value={form.spec}
              onChange={(e) => setForm({ ...form, spec: e.target.value })}
              placeholder="128GB"
              style={inputStyle}
            />
          </FormField>

          {/* Condition */}
          <FormField label="สภาพเครื่อง">
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { v: 'new', label: 'เครื่องใหม่ / มือ 1' },
                { v: 'used', label: 'เครื่องมือสอง' },
              ].map(opt => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => setForm({ ...form, deviceCondition: opt.v })}
                  style={{
                    flex: 1,
                    padding: '10px',
                    fontSize: 12,
                    fontWeight: 600,
                    borderRadius: 10,
                    border: '1px solid',
                    borderColor: form.deviceCondition === opt.v ? 'var(--accent)' : 'var(--border)',
                    background: form.deviceCondition === opt.v ? 'var(--accent-light)' : 'var(--surface)',
                    color: form.deviceCondition === opt.v ? 'var(--accent-strong)' : 'var(--text)',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </FormField>

          {/* Price + Cost */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <FormField label="ราคาขาย" required>
              <input
                type="number"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                placeholder="0"
                style={inputStyle}
              />
            </FormField>
            <FormField label="ต้นทุน">
              <input
                type="number"
                value={form.costPrice}
                onChange={(e) => setForm({ ...form, costPrice: e.target.value })}
                placeholder="0"
                style={inputStyle}
              />
            </FormField>
          </div>

          {/* Profit preview */}
          {form.price && form.costPrice && (
            <div style={{
              padding: 10,
              background: '#dcfce7',
              borderRadius: 10,
              marginBottom: 10,
              fontSize: 12,
              color: '#166534',
              fontWeight: 600,
            }}>
              กำไรเบื้องต้น: ฿{(parseFloat(form.price) - parseFloat(form.costPrice)).toLocaleString()}
            </div>
          )}

          {/* Branch */}
          <FormField label="สาขา" required>
            <select
              value={form.branchId}
              onChange={(e) => setForm({ ...form, branchId: e.target.value })}
              style={inputStyle}
            >
              <option value="">-- เลือกสาขา --</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </FormField>

          {/* Supplier */}
          <FormField label="ซัพพลายเออร์">
            <select
              value={form.supplierId}
              onChange={(e) => setForm({ ...form, supplierId: e.target.value })}
              style={inputStyle}
            >
              <option value="">ไม่ระบุ</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </FormField>

          {/* Date */}
          <FormField label="วันที่รับเครื่อง">
            <input
              type="date"
              value={form.addedDate}
              onChange={(e) => setForm({ ...form, addedDate: e.target.value })}
              style={inputStyle}
            />
          </FormField>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              style={{
                flex: 1,
                padding: '12px',
                fontSize: 14,
                fontWeight: 600,
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                color: 'var(--text)',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                flex: 2,
                padding: '12px',
                fontSize: 14,
                fontWeight: 700,
                background: 'var(--accent)',
                border: 'none',
                borderRadius: 10,
                color: '#fff',
                cursor: saving ? 'wait' : 'pointer',
                fontFamily: 'inherit',
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? 'กำลังบันทึก...' : '+ เพิ่มเครื่อง'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function FormField({ label, required, children }: any) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{
        display: 'block',
        fontSize: 11,
        fontWeight: 600,
        color: 'var(--text)',
        marginBottom: 5,
      }}>
        {label}
        {required && <span style={{ color: 'var(--danger)', marginLeft: 3 }}>*</span>}
      </label>
      {children}
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.5)',
  backdropFilter: 'blur(4px)',
  zIndex: 100,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 12,
};

const modalStyle: React.CSSProperties = {
  background: 'var(--surface)',
  borderRadius: 20,
  width: '100%',
  maxWidth: 480,
  maxHeight: '90vh',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '14px 16px',
  borderBottom: '1px solid var(--border)',
};

const closeBtnStyle: React.CSSProperties = {
  width: 32, height: 32,
  borderRadius: 8,
  background: 'var(--surface-2)',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--text)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  height: 40,
  padding: '0 12px',
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  color: 'var(--text)',
  fontSize: 13,
  fontFamily: 'inherit',
  outline: 'none',
};
