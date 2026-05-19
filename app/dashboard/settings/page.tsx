'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';
import Toast from '@/components/Toast';
import { sendLineNotify } from '@/lib/line-notify';

function SettingsPageContent() {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [shop, setShop] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [testingLine, setTestingLine] = useState(false);
  const [savingLine, setSavingLine] = useState(false);
  const [toast, setToast] = useState<{ title: string; msg: string; type: string } | null>(null);

  const [form, setForm] = useState({
    receipt_address: '',
    receipt_phone: '',
    receipt_tax_id: '',
    receipt_footer: '',
    receipt_logo_url: '',
    receipt_prefix: 'INV',
  });

  const [lineForm, setLineForm] = useState({
    line_notify_sale: true,
    line_notify_pawn: true,
    line_notify_goods: false,
    line_notify_installment: true,
    line_notify_low_stock: true,
  });
  const [disconnecting, setDisconnecting] = useState(false);
  const [otherAdmins, setOtherAdmins] = useState<any[]>([]);

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
          setLineForm({
            line_notify_sale: s.line_notify_sale !== false,
            line_notify_pawn: s.line_notify_pawn !== false,
            line_notify_goods: s.line_notify_goods === true,
            line_notify_installment: s.line_notify_installment !== false,
            line_notify_low_stock: s.line_notify_low_stock !== false,
          });
        }

        // โหลด admin อื่นในร้านที่ผูก LINE แล้ว (ไม่นับตัวเอง)
        const { data: others } = await supabase
          .from('profiles')
          .select('id, full_name, line_display_name, line_picture_url, line_connected_at')
          .eq('shop_id', p.shop_id)
          .eq('role', 'admin')
          .neq('id', user.id)
          .not('line_user_id', 'is', null);
        setOtherAdmins(others || []);
      }
      setLoading(false);
    }
    load();
  }, []);

  // จัดการผลลัพธ์หลังกลับจาก LINE OAuth
  useEffect(() => {
    const lineParam = searchParams.get('line');
    if (!lineParam) return;

    if (lineParam === 'connected') {
      showToast('เชื่อม LINE สำเร็จ ✓', 'ระบบพร้อมส่งแจ้งเตือนแล้ว');
    } else if (lineParam === 'cancelled') {
      showToast('ยกเลิกการเชื่อม', '', 'danger');
    } else if (lineParam === 'error') {
      const reason = searchParams.get('reason');
      showToast('เชื่อม LINE ไม่สำเร็จ', reason || 'ลองใหม่อีกครั้ง', 'danger');
    }

    // ล้าง URL params
    router.replace('/dashboard/settings');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  async function handleSaveLine() {
    if (!shop) return;
    setSavingLine(true);

    const { error } = await supabase.from('shops').update({
      line_notify_sale: lineForm.line_notify_sale,
      line_notify_pawn: lineForm.line_notify_pawn,
      line_notify_goods: lineForm.line_notify_goods,
      line_notify_installment: lineForm.line_notify_installment,
      line_notify_low_stock: lineForm.line_notify_low_stock,
    }).eq('id', shop.id);

    setSavingLine(false);
    if (error) {
      showToast('บันทึกไม่สำเร็จ', error.message, 'danger');
      return;
    }
    showToast('บันทึกสำเร็จ', 'การแจ้งเตือนอัพเดทแล้ว');
    
    const { data: s } = await supabase
      .from('shops').select('*').eq('id', shop.id).single();
    setShop(s);
  }

  async function handleTestLine() {
    if (!profile?.line_user_id) {
      showToast('ยังไม่ได้เชื่อม LINE', 'กดเชื่อม LINE ก่อน', 'danger');
      return;
    }
    
    setTestingLine(true);
    
    const now = new Date();
    const dateStr = now.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    const result = await sendLineNotify(
      `🎉 ทดสอบการแจ้งเตือน\n\n🏪 ร้าน: ${shop?.name || 'ของคุณ'}\n👤 ผู้รับ: ${profile?.full_name}\n📅 ${dateStr}\n🕐 ${timeStr} น.\n\n✅ การเชื่อมต่อสำเร็จ`,
      'test'
    );

    setTestingLine(false);

    if (result.success) {
      showToast('ส่งสำเร็จ ✓', `ส่งให้ ${profile.line_display_name}`);
    } else {
      showToast('ส่งไม่สำเร็จ', result.detail || result.error || 'ลองเชื่อม LINE ใหม่', 'danger');
    }
  }

  function handleConnectLine() {
    window.location.href = '/api/line/login';
  }

  async function handleDisconnectLine() {
    if (!confirm('ยืนยันยกเลิกการเชื่อม LINE?\n\nคุณจะไม่ได้รับแจ้งเตือนอีก\n(admin คนอื่นในร้านยังได้รับอยู่)')) return;
    
    setDisconnecting(true);
    try {
      const res = await fetch('/api/line/disconnect', { method: 'POST' });
      const data = await res.json();
      
      if (data.success) {
        showToast('ยกเลิกการเชื่อมแล้ว', '');
        // reload profile
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: p } = await supabase
            .from('profiles').select('*').eq('id', user.id).single();
          setProfile(p);
        }
      } else {
        showToast('ยกเลิกไม่สำเร็จ', data.error || '', 'danger');
      }
    } catch (e: any) {
      showToast('เกิดข้อผิดพลาด', e.message, 'danger');
    } finally {
      setDisconnecting(false);
    }
  }

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

      {/* LINE Notification - OAuth per admin */}
      <div className="form-card">
        <h3>🔔 แจ้งเตือนผ่าน LINE</h3>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 16 }}>
          รับแจ้งเตือนยอดขาย/จำนำ/ผ่อน เข้า LINE ของคุณ
          <br/>
          <span style={{ fontSize: 11 }}>
            💡 แต่ละ admin ผูก LINE แยกกัน - ทุกคนจะได้รับแจ้งเตือนพร้อมกัน
          </span>
        </p>

        {/* สถานะ LINE ของฉัน */}
        {profile?.line_user_id ? (
          <div style={{
            padding: 16,
            background: 'rgba(0, 195, 0, 0.06)',
            border: '1px solid rgba(0, 195, 0, 0.3)',
            borderRadius: 'var(--radius-sm)',
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 14,
          }}>
            {profile.line_picture_url ? (
              <img 
                src={profile.line_picture_url} 
                alt="LINE profile" 
                style={{ 
                  width: 56, 
                  height: 56, 
                  borderRadius: '50%',
                  border: '2px solid #00C300',
                }}
              />
            ) : (
              <div style={{
                width: 56, height: 56,
                borderRadius: '50%',
                background: '#00C300',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 28,
              }}>💬</div>
            )}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: '#00B900', fontWeight: 600, letterSpacing: 0.5 }}>
                ✓ คุณเชื่อมต่อ LINE แล้ว
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, marginTop: 2 }}>
                {profile.line_display_name || 'LINE User'}
              </div>
              {profile.line_connected_at && (
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
                  เชื่อมเมื่อ {new Date(profile.line_connected_at).toLocaleDateString('th-TH', {
                    day: 'numeric', month: 'short', year: 'numeric',
                  })}
                </div>
              )}
            </div>
            <button
              onClick={handleDisconnectLine}
              disabled={disconnecting}
              className="btn btn-sec"
              style={{ 
                width: 'auto', 
                padding: '8px 14px', 
                fontSize: 12,
                color: 'var(--danger)',
                borderColor: 'var(--danger)',
              }}
            >
              {disconnecting ? 'กำลังยกเลิก...' : 'ยกเลิก'}
            </button>
          </div>
        ) : (
          <div style={{ marginBottom: 16 }}>
            <button
              onClick={handleConnectLine}
              style={{
                width: '100%',
                padding: '14px 20px',
                background: '#00C300',
                color: '#fff',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 15,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                boxShadow: '0 2px 8px rgba(0, 195, 0, 0.3)',
              }}
              onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.98)'; }}
              onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
            >
              <span style={{ fontSize: 18 }}>💬</span>
              <span>เชื่อม LINE ของคุณ (Login ครั้งเดียวจบ)</span>
            </button>
            <div style={{ 
              fontSize: 11, 
              color: 'var(--text-dim)', 
              marginTop: 8, 
              textAlign: 'center',
            }}>
              🔒 ปลอดภัย • ใช้ LINE Login • ใช้เวลา 10 วินาที
            </div>
          </div>
        )}

        {/* แสดง admin คนอื่นในร้านที่ผูก LINE แล้ว */}
        {otherAdmins.length > 0 && (
          <div style={{
            padding: 12,
            background: 'var(--surface-2)',
            borderRadius: 'var(--radius-sm)',
            marginBottom: 16,
          }}>
            <div style={{ 
              fontSize: 11, 
              color: 'var(--text-dim)', 
              fontWeight: 600, 
              letterSpacing: 0.5, 
              marginBottom: 8,
              textTransform: 'uppercase',
            }}>
              👥 Admin คนอื่นในร้าน ({otherAdmins.length} คน)
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {otherAdmins.map((a) => (
                <div key={a.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 10px',
                  background: 'var(--surface)',
                  borderRadius: 6,
                  fontSize: 12,
                }}>
                  {a.line_picture_url ? (
                    <img 
                      src={a.line_picture_url} 
                      alt="" 
                      style={{ width: 32, height: 32, borderRadius: '50%' }}
                    />
                  ) : (
                    <div style={{
                      width: 32, height: 32,
                      borderRadius: '50%',
                      background: '#00C300',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 14,
                    }}>💬</div>
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{a.full_name}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                      LINE: {a.line_display_name}
                    </div>
                  </div>
                  <div style={{ 
                    fontSize: 10, 
                    color: '#00B900', 
                    fontWeight: 600,
                  }}>
                    ✓
                  </div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 8 }}>
              💡 ทุกคนข้างต้นจะได้รับแจ้งเตือนพร้อมกันเมื่อมีกิจกรรม
            </div>
          </div>
        )}

        {/* ปุ่มทดสอบ + Settings */}
        {profile?.line_user_id && (
          <>
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              <button
                onClick={handleTestLine}
                disabled={testingLine}
                className="btn btn-sec"
                style={{ width: 'auto', flex: 1 }}
              >
                {testingLine ? 'กำลังส่ง...' : '🧪 ส่งทดสอบให้ตัวเอง'}
              </button>
            </div>

            <div className="form-grid">
              <div className="field full">
                <label style={{ marginBottom: 10 }}>
                  เลือกประเภทการแจ้งเตือน
                  <span style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 400, marginLeft: 6 }}>
                    (มีผลกับทุก admin ในร้าน)
                  </span>
                </label>

                <NotifyCheckbox
                  checked={lineForm.line_notify_sale}
                  onChange={(v) => setLineForm({ ...lineForm, line_notify_sale: v })}
                  icon="📱"
                  title="ขายเครื่อง"
                  desc="แจ้งทุกครั้งที่ขายเครื่อง"
                />
                <NotifyCheckbox
                  checked={lineForm.line_notify_pawn}
                  onChange={(v) => setLineForm({ ...lineForm, line_notify_pawn: v })}
                  icon="💰"
                  title="จำนำ"
                  desc="รับจำนำ / ต่อดอก / ไถ่คืน / หลุดจำนำ"
                />
                <NotifyCheckbox
                  checked={lineForm.line_notify_installment}
                  onChange={(v) => setLineForm({ ...lineForm, line_notify_installment: v })}
                  icon="💳"
                  title="ผ่อน"
                  desc="เพิ่มผ่อน / รับชำระงวด / ปิดยอด"
                />
                <NotifyCheckbox
                  checked={lineForm.line_notify_goods}
                  onChange={(v) => setLineForm({ ...lineForm, line_notify_goods: v })}
                  icon="🎒"
                  title="ขายอุปกรณ์เสริม"
                  desc="อาจรกถ้าขายเยอะ - ปิดได้"
                />
                <NotifyCheckbox
                  checked={lineForm.line_notify_low_stock}
                  onChange={(v) => setLineForm({ ...lineForm, line_notify_low_stock: v })}
                  icon="📦"
                  title="สินค้าใกล้หมด"
                  desc="แจ้งเมื่อขายของแล้วเหลือน้อย"
                />
              </div>
            </div>

            <div className="form-actions" style={{ marginTop: 16 }}>
              <button className="btn" onClick={handleSaveLine} disabled={savingLine}>
                {savingLine ? 'กำลังบันทึก...' : '💾 บันทึก'}
              </button>
            </div>
          </>
        )}

        {/* คำอธิบายตอนยังไม่เชื่อม */}
        {!profile?.line_user_id && otherAdmins.length === 0 && (
          <div style={{
            padding: 12,
            background: 'var(--surface-2)',
            borderRadius: 'var(--radius-sm)',
            fontSize: 12,
            color: 'var(--text-dim)',
            lineHeight: 1.6,
          }}>
            💡 <strong style={{ color: 'var(--text)' }}>วิธีใช้:</strong> กดปุ่ม "เชื่อม LINE" → Login ด้วย LINE ของคุณ → อนุญาต → เสร็จ!
            <div style={{ marginTop: 8 }}>✓ ปลอดภัย ใช้ LINE Login Official</div>
            <div>✓ ไม่เก็บรหัสผ่าน LINE</div>
            <div>✓ แต่ละ admin ผูก LINE แยกกันได้</div>
          </div>
        )}
      </div>

      {toast && <Toast {...toast} />}
    </>
  );
}

function NotifyCheckbox({ 
  checked, 
  onChange, 
  icon, 
  title, 
  desc 
}: { 
  checked: boolean; 
  onChange: (v: boolean) => void; 
  icon: string; 
  title: string; 
  desc: string;
}) {
  return (
    <label style={{ 
      display: 'flex', alignItems: 'center', gap: 10, padding: 10,
      cursor: 'pointer', borderRadius: 6, marginBottom: 6,
      background: checked ? 'var(--accent-light)' : 'var(--surface-2)',
    }}>
      <input 
        type="checkbox" 
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ width: 18, height: 18, cursor: 'pointer' }}
      />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{icon} {title}</div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{desc}</div>
      </div>
    </label>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="loading"><div className="spinner"></div></div>}>
      <SettingsPageContent />
    </Suspense>
  );
}
