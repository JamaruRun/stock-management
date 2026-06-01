'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase-client';
import { X, Plus, Smartphone, Barcode, ImageIcon, Sparkles, Link as LinkIcon, Check, Loader2, Upload } from 'lucide-react';
import { searchImage } from '@/lib/image-search';
import { uploadStockImage } from '@/lib/image-upload';

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Image state
  const [imageUrl, setImageUrl] = useState('');
  const [imageSource, setImageSource] = useState<'wikipedia' | 'google' | 'upload' | 'manual' | null>(null);
  const [autoFetching, setAutoFetching] = useState(false);
  const [autoFetchHint, setAutoFetchHint] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlInputValue, setUrlInputValue] = useState('');
  const abortRef = useRef<AbortController | null>(null);

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

  // Auto-fetch image - Hybrid (Wikipedia → Google CSE)
  useEffect(() => {
    const m = form.model.trim();
    if (m.length < 3) {
      setAutoFetchHint(null);
      return;
    }
    if (imageUrl && imageSource !== null) return; // มีรูปแล้ว

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const timer = setTimeout(async () => {
      setAutoFetching(true);
      setAutoFetchHint(null);
      try {
        const result = await searchImage(m, ctrl.signal);
        if (ctrl.signal.aborted) return;
        if (result?.url) {
          setImageUrl(result.url);
          setImageSource(result.source);
          const sourceLabel = result.source === 'wikipedia' ? 'Wikipedia' : 'Google';
          setAutoFetchHint(`พบรูปจาก ${sourceLabel} ✓`);
        } else {
          setAutoFetchHint('ไม่พบรูป — อัปโหลดเองหรือวาง URL ได้');
        }
      } catch (e) {
        if (!ctrl.signal.aborted) {
          setAutoFetchHint('ดึงรูปไม่ได้');
        }
      } finally {
        if (!ctrl.signal.aborted) setAutoFetching(false);
      }
    }, 700);

    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [form.model, imageUrl, imageSource]);

  function clearImage() {
    setImageUrl('');
    setImageSource(null);
    setAutoFetchHint(null);
  }

  function applyUrlInput() {
    if (urlInputValue.trim()) {
      setImageUrl(urlInputValue.trim());
      setImageSource('manual');
      setShowUrlInput(false);
      setUrlInputValue('');
      setAutoFetchHint('ใช้รูปจาก URL ที่วาง ✓');
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!profile?.shop_id) {
      alert('โปรไฟล์ยังไม่พร้อม');
      return;
    }

    setUploading(true);
    try {
      const url = await uploadStockImage(file, profile.shop_id);
      setImageUrl(url);
      setImageSource('upload');
      setAutoFetchHint('อัปโหลดสำเร็จ ✓');
    } catch (err: any) {
      alert(err.message || 'อัปโหลดไม่สำเร็จ');
    } finally {
      setUploading(false);
      // reset file input
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

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
        image_url: imageUrl || null,
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

          {/* Image Preview Section */}
          <FormField label="รูปเครื่อง">
            <div style={{
              border: '1px dashed var(--border)',
              borderRadius: 12,
              padding: imageUrl ? 8 : 16,
              background: 'var(--surface-2)',
              transition: 'all 0.15s',
            }}>
              {imageUrl ? (
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <img
                    src={imageUrl}
                    alt="preview"
                    style={{
                      width: 70, height: 70,
                      objectFit: 'contain',
                      background: '#fff',
                      borderRadius: 8,
                      border: '1px solid var(--border)',
                    }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                      setAutoFetchHint('ไม่สามารถโหลดรูปได้');
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {autoFetchHint && (
                      <div style={{
                        fontSize: 11,
                        color: autoFetchHint.includes('✓') ? '#16a34a' : 'var(--text-dim)',
                        marginBottom: 4,
                        display: 'flex', alignItems: 'center', gap: 4,
                      }}>
                        {autoFetchHint.includes('✓') && <Check size={12} />}
                        {autoFetchHint}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={clearImage}
                        style={{
                          padding: '5px 10px',
                          fontSize: 11,
                          background: 'var(--surface)',
                          border: '1px solid var(--border)',
                          borderRadius: 6,
                          cursor: 'pointer',
                          color: 'var(--text-dim)',
                          fontFamily: 'inherit',
                          display: 'inline-flex', alignItems: 'center', gap: 3,
                        }}
                      >
                        <X size={11} /> ลบรูป
                      </button>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        style={{
                          padding: '5px 10px',
                          fontSize: 11,
                          background: 'var(--accent-light)',
                          border: '1px solid var(--accent)',
                          borderRadius: 6,
                          cursor: uploading ? 'wait' : 'pointer',
                          color: 'var(--accent-strong)',
                          fontFamily: 'inherit',
                          display: 'inline-flex', alignItems: 'center', gap: 3,
                          fontWeight: 600,
                        }}
                      >
                        <Upload size={11} /> {uploading ? 'กำลังอัปโหลด...' : 'อัปโหลดรูปเอง'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowUrlInput(true)}
                        style={{
                          padding: '5px 10px',
                          fontSize: 11,
                          background: 'var(--surface)',
                          border: '1px solid var(--border)',
                          borderRadius: 6,
                          cursor: 'pointer',
                          color: 'var(--text-dim)',
                          fontFamily: 'inherit',
                          display: 'inline-flex', alignItems: 'center', gap: 3,
                        }}
                      >
                        <LinkIcon size={11} /> วาง URL
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center' }}>
                  {autoFetching ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--text-dim)', fontSize: 12 }}>
                      <Loader2 size={16} className="v3-spin" />
                      กำลังค้นหารูป...
                    </div>
                  ) : (
                    <>
                      <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        gap: 6, marginBottom: 10,
                        color: 'var(--text-dim)', fontSize: 12,
                      }}>
                        <Sparkles size={14} />
                        {form.model.length >= 3
                          ? (autoFetchHint || 'ระบบจะค้นหารูปอัตโนมัติ')
                          : 'กรอกชื่อรุ่น — ระบบจะหารูปอัตโนมัติ'}
                      </div>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploading}
                          style={{
                            padding: '8px 14px',
                            fontSize: 12,
                            background: 'var(--accent)',
                            border: 'none',
                            borderRadius: 8,
                            cursor: uploading ? 'wait' : 'pointer',
                            color: '#fff',
                            fontFamily: 'inherit',
                            fontWeight: 600,
                            display: 'inline-flex', alignItems: 'center', gap: 5,
                          }}
                        >
                          <Upload size={13} /> {uploading ? 'กำลังอัปโหลด...' : 'อัปโหลดรูปเอง'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowUrlInput(true)}
                          style={{
                            padding: '8px 14px',
                            fontSize: 12,
                            background: 'var(--surface)',
                            border: '1px solid var(--border)',
                            borderRadius: 8,
                            cursor: 'pointer',
                            color: 'var(--text)',
                            fontFamily: 'inherit',
                            display: 'inline-flex', alignItems: 'center', gap: 5,
                          }}
                        >
                          <LinkIcon size={13} /> วาง URL
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />

              {/* URL input modal-like */}
              {showUrlInput && (
                <div style={{
                  marginTop: 10,
                  padding: 10,
                  background: 'var(--surface)',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                }}>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 6 }}>
                    วาง URL ของรูปเครื่อง (.jpg, .png, .webp)
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input
                      type="url"
                      value={urlInputValue}
                      onChange={(e) => setUrlInputValue(e.target.value)}
                      placeholder="https://..."
                      style={{ ...inputStyle, fontSize: 12, height: 34 }}
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          applyUrlInput();
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={applyUrlInput}
                      style={{
                        padding: '0 14px',
                        height: 34,
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
                      ใช้
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowUrlInput(false); setUrlInputValue(''); }}
                      style={{
                        padding: '0 10px',
                        height: 34,
                        background: 'var(--surface-2)',
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        cursor: 'pointer',
                        fontSize: 12,
                        color: 'var(--text-dim)',
                        fontFamily: 'inherit',
                      }}
                    >
                      ยกเลิก
                    </button>
                  </div>
                </div>
              )}
            </div>
          </FormField>

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
