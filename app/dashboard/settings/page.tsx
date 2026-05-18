'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase-client';
import Toast from '@/components/Toast';

export default function SettingsPage() {
  const supabase = createClient();
  const [shop, setShop] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [toast, setToast] = useState<{ title: string; msg: string; type: string } | null>(null);

  const [form, setForm] = useState({
    receipt_address: '',
    receipt_phone: '',
    receipt_tax_id: '',
    receipt_footer: '',
    receipt_logo_url: '',
    receipt_prefix: 'INV',
  });

  function showToast(title: string, msg: string, type: 'success' | 'danger' = 'success') {
    setToast({ title, msg, type });
    setTimeout(() => setToast(null), 2500);
  }

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data: p } = await supabase
        .from('profiles').select('*').eq('id', user.id).single();
      setProfile(p);

      if (p?.shop_id) {
        const { data: s } = await supabase
          .from('shops').select('*').eq('id', p.shop_id).single();
        setShop(s);
        if (s) {
          setForm({
            receipt_address: s.receipt_address || '',
            receipt_phone: s.receipt_phone || '',
            receipt_tax_id: s.receipt_tax_id || '',
            receipt_footer: s.receipt_footer || 'ขอบคุณที่ใช้บริการ',
            receipt_logo_url: s.receipt_logo_url || '',
            receipt_prefix: s.receipt_prefix || 'INV',
          });
        }
      }
      setLoading(false);
    }
    load();
  }, []);

  async function handleSave() {
    if (!shop) return;
    setSaving(true);

    const { error } = await supabase.from('shops').update({
      receipt_address: form.receipt_address || null,
      receipt_phone: form.receipt_phone || null,
      receipt_tax_id: form.receipt_tax_id || null,
      receipt_footer: form.receipt_footer || null,
      receipt_logo_url: form.receipt_logo_url || null,
      receipt_prefix: form.receipt_prefix || 'INV',
    }).eq('id', shop.id);

    setSaving(false);
    if (error) {
      showToast('บันทึกไม่สำเร็จ', error.message, 'danger');
      return;
    }
    showToast('บันทึกสำเร็จ', 'ตั้งค่าใบเสร็จอัพเดทแล้ว');
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !shop) return;

    if (file.size > 500 * 1024) {
      showToast('ไฟล์ใหญ่เกินไป', 'ไม่เกิน 500KB', 'danger');
      return;
    }

    setUploadingLogo(true);

    // Convert เป็น base64
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      // ขนาดเล็ก ใช้ base64 ใส่ใน DB เลย (ง่าย ไม่ต้องตั้ง storage)
      setForm({ ...form, receipt_logo_url: base64 });
      setUploadingLogo(false);
      showToast('อัพโหลดสำเร็จ', 'กดบันทึกเพื่อใช้โลโก้ใหม่');
    };
    reader.onerror = () => {
      setUploadingLogo(false);
      showToast('อัพโหลดไม่สำเร็จ', '', 'danger');
    };
    reader.readAsDataURL(file);
  }

  const isAdmin = profile?.role === 'admin';

  if (loading) {
    return (
      <>
        <div className="page-header">
          <h1>⚙️ ตั้งค่า</h1>
          <div className="desc">กำลังโหลด...</div>
        </div>
        <div className="skeleton skeleton-card"></div>
      </>
    );
  }

  if (!isAdmin) {
    return (
      <>
        <div className="page-header">
          <h1>⚙️ ตั้งค่า</h1>
        </div>
        <div className="form-card">
          <div className="empty">
            <div className="empty-icon">🔒</div>
            <div className="empty-title">เฉพาะเจ้าของร้าน</div>
            <div className="empty-sub">หน้านี้สำหรับ Admin เท่านั้น</div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-header">
        <h1>⚙️ ตั้งค่า <span className="badge-admin">ADMIN</span></h1>
        <div className="desc">ข้อมูลร้าน, ใบเสร็จ, และค่าเริ่มต้น</div>
      </div>

      <div className="form-card">
        <h3>🏪 ข้อมูลร้านบนใบเสร็จ</h3>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 16 }}>
          จะแสดงด้านบนของใบเสร็จ PDF
        </p>

        <div className="form-grid">
          <div className="field full">
            <label>ชื่อร้าน</label>
            <input type="text" value={shop?.name || ''} disabled />
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
              💡 ติดต่อแอดมินถ้าต้องการเปลี่ยนชื่อร้าน
            </div>
          </div>

          <div className="field full">
            <label>โลโก้ร้าน</label>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8 }}>
              {form.receipt_logo_url && (
                <div style={{
                  width: 80, height: 80,
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: '#fff',
                  overflow: 'hidden',
                }}>
                  <img src={form.receipt_logo_url} alt="logo" 
                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                </div>
              )}
              <div style={{ flex: 1 }}>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleLogoUpload}
                  disabled={uploadingLogo}
                  style={{ width: '100%', padding: 8, fontSize: 12 }}
                />
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
                  💡 รองรับ PNG, JPG, WebP ไม่เกิน 500KB
                </div>
                {form.receipt_logo_url && (
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, receipt_logo_url: '' })}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--danger)',
                      fontSize: 12,
                      cursor: 'pointer',
                      padding: '4px 0',
                      marginTop: 4,
                    }}
                  >
                    × ลบโลโก้
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="field full">
            <label>ที่อยู่</label>
            <input type="text" value={form.receipt_address}
              onChange={(e) => setForm({ ...form, receipt_address: e.target.value })}
              placeholder="123/45 ถ.สุขุมวิท แขวงคลองตัน เขตวัฒนา กรุงเทพฯ 10110" />
          </div>

          <div className="field">
            <label>เบอร์โทร</label>
            <input type="tel" value={form.receipt_phone}
              onChange={(e) => setForm({ ...form, receipt_phone: e.target.value })}
              placeholder="02-123-4567" />
          </div>

          <div className="field">
            <label>เลขผู้เสียภาษี (ถ้ามี)</label>
            <input type="text" value={form.receipt_tax_id}
              onChange={(e) => setForm({ ...form, receipt_tax_id: e.target.value })}
              placeholder="1234567890123" />
          </div>

          <div className="field">
            <label>คำนำหน้าเลขใบเสร็จ</label>
            <input type="text" value={form.receipt_prefix}
              onChange={(e) => setForm({ ...form, receipt_prefix: e.target.value.toUpperCase().substring(0, 10) })}
              placeholder="INV" />
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
              ตัวอย่าง: {form.receipt_prefix || 'INV'}-00001
            </div>
          </div>

          <div className="field">
            <label>เลขใบเสร็จล่าสุด</label>
            <input type="text" value={shop?.receipt_counter || 0} disabled />
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
              💡 จะเพิ่มอัตโนมัติเมื่อมีการขาย
            </div>
          </div>

          <div className="field full">
            <label>ข้อความท้ายใบเสร็จ</label>
            <input type="text" value={form.receipt_footer}
              onChange={(e) => setForm({ ...form, receipt_footer: e.target.value })}
              placeholder="ขอบคุณที่ใช้บริการ" />
          </div>
        </div>

        <div className="form-actions" style={{ marginTop: 20 }}>
          <button className="btn" onClick={handleSave} disabled={saving || uploadingLogo}>
            {saving ? 'กำลังบันทึก...' : '💾 บันทึก'}
          </button>
        </div>
      </div>

      {toast && <Toast {...toast} />}
    </>
  );
}
