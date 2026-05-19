'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase-client';
import Toast from '@/components/Toast';
import { sendLineNotify } from '@/lib/line-notify';

export default function SettingsPage() {
  const supabase = createClient();
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
    line_channel_access_token: '',
    line_user_id: '',
    line_notify_sale: true,
    line_notify_pawn: true,
    line_notify_goods: false,
    line_notify_installment: true,
    line_notify_low_stock: true,
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
          setLineForm({
            line_channel_access_token: s.line_channel_access_token || '',
            line_user_id: s.line_user_id || '',
            line_notify_sale: s.line_notify_sale !== false,
            line_notify_pawn: s.line_notify_pawn !== false,
            line_notify_goods: s.line_notify_goods === true,
            line_notify_installment: s.line_notify_installment !== false,
            line_notify_low_stock: s.line_notify_low_stock !== false,
          });
        }
      }
      setLoading(false);
    }
    load();
  }, []);

  async function handleSaveLine() {
    if (!shop) return;
    setSavingLine(true);

    const { error } = await supabase.from('shops').update({
      line_channel_access_token: lineForm.line_channel_access_token || null,
      line_user_id: lineForm.line_user_id || null,
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
    showToast('บันทึกสำเร็จ', 'ตั้งค่า LINE อัพเดทแล้ว');
    
    const { data: s } = await supabase
      .from('shops').select('*').eq('id', shop.id).single();
    setShop(s);
  }

  async function handleTestLine() {
    if (!lineForm.line_channel_access_token || !lineForm.line_user_id) {
      showToast('ใส่ Token + User ID ก่อน', '', 'danger');
      return;
    }
    
    setTestingLine(true);
    
    // บันทึกก่อนเทส
    await supabase.from('shops').update({
      line_channel_access_token: lineForm.line_channel_access_token,
      line_user_id: lineForm.line_user_id,
    }).eq('id', shop.id);

    const { sendLinePush } = await import('@/lib/line-notify');
    const now = new Date();
    const dateStr = now.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    const result = await sendLinePush(
      `🎉 ทดสอบ LINE Messaging API\n\n🏪 ร้าน: ${shop?.name || 'ของคุณ'}\n📅 วันที่: ${dateStr}\n🕐 เวลา: ${timeStr} น.\n\n✅ การเชื่อมต่อสำเร็จ\nระบบจะแจ้งเตือนคุณตามที่ตั้งค่าไว้`,
      'test'
    );

    setTestingLine(false);

    if (result.success) {
      showToast('ส่งสำเร็จ ✓', 'เช็คใน LINE ดู');
    } else {
      showToast('ส่งไม่สำเร็จ', result.detail || result.error || 'Token/User ID ไม่ถูก', 'danger');
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

      {/* LINE Messaging API Section */}
      <div className="form-card">
        <h3>🔔 LINE Messaging API</h3>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 16 }}>
          แจ้งเตือนยอดขาย/จำนำ/ผ่อน เข้า LINE ของเจ้าของแบบเรียลไทม์
        </p>

        <div style={{
          padding: 12,
          background: 'rgba(255, 158, 11, 0.08)',
          borderLeft: '3px solid var(--warning)',
          marginBottom: 12,
          fontSize: 12,
          lineHeight: 1.6,
        }}>
          <strong style={{ color: 'var(--warning-text)' }}>⚠️ LINE Notify ปิดบริการแล้ว</strong>
          <div style={{ marginTop: 4 }}>
            ตอนนี้ใช้ <strong>LINE Messaging API</strong> ผ่าน LINE Official Account แทน — ฟรี 200 ข้อความ/เดือน
          </div>
        </div>

        <div style={{
          padding: 14,
          background: 'rgba(0, 195, 0, 0.06)',
          border: '1px solid rgba(0, 195, 0, 0.3)',
          borderRadius: 'var(--radius-sm)',
          marginBottom: 16,
          fontSize: 12,
          lineHeight: 1.7,
        }}>
          <div style={{ fontWeight: 700, color: '#00B900', fontSize: 13, marginBottom: 10 }}>
            📌 วิธีตั้งค่า (10 นาที)
          </div>

          {/* ส่วนที่ 1 - สร้าง LINE OA */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontWeight: 700, marginBottom: 6, color: 'var(--text)' }}>
              ขั้นที่ 1: สร้าง LINE Official Account (LINE OA)
            </div>
            <ol style={{ marginLeft: 18, marginTop: 4 }}>
              <li>ไปที่ <a href="https://www.linebiz.com/th/entry/" target="_blank" rel="noopener" style={{ color: '#00B900', textDecoration: 'underline', fontWeight: 600 }}>linebiz.com/th/entry/</a></li>
              <li>กด <strong>"เริ่มต้นใช้งานฟรี"</strong> → Login ด้วย LINE ของเจ้าของร้าน</li>
              <li>กรอกข้อมูล:
                <ul style={{ marginLeft: 16, marginTop: 2 }}>
                  <li>ชื่อบัญชี: "ร้านของคุณ" (เปลี่ยนทีหลังได้)</li>
                  <li>ประเภทธุรกิจ: <strong>ร้านค้าปลีก</strong></li>
                  <li>หมวดหมู่: <strong>โทรศัพท์/อุปกรณ์อิเล็กทรอนิกส์</strong></li>
                </ul>
              </li>
              <li>กดสร้าง → ได้ LINE OA ใหม่ (ฟรี)</li>
            </ol>
          </div>

          {/* ส่วนที่ 2 - เปิด Messaging API */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontWeight: 700, marginBottom: 6, color: 'var(--text)' }}>
              ขั้นที่ 2: เปิด Messaging API
            </div>
            <ol style={{ marginLeft: 18, marginTop: 4 }}>
              <li>เข้า <a href="https://manager.line.biz/" target="_blank" rel="noopener" style={{ color: '#00B900', textDecoration: 'underline', fontWeight: 600 }}>LINE Official Account Manager</a></li>
              <li>เลือก LINE OA ที่เพิ่งสร้าง → ไปที่ <strong>"การตั้งค่า"</strong> (มุมขวาบน)</li>
              <li>เมนูซ้าย → <strong>"Messaging API"</strong></li>
              <li>กด <strong>"ใช้ Messaging API"</strong> → ยอมรับเงื่อนไข</li>
              <li>เลือก Provider (ถ้ายังไม่มี ให้สร้างใหม่ ชื่อร้านของคุณก็ได้)</li>
              <li>กดยืนยัน → ระบบเชื่อม OA กับ Messaging API แล้ว</li>
            </ol>
          </div>

          {/* ส่วนที่ 3 - เอา Token */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontWeight: 700, marginBottom: 6, color: 'var(--text)' }}>
              ขั้นที่ 3: Copy Channel Access Token
            </div>
            <ol style={{ marginLeft: 18, marginTop: 4 }}>
              <li>หลังเปิด Messaging API แล้ว → จะมีลิงก์ไป <strong>LINE Developers Console</strong> ให้กดเข้า</li>
              <li>หรือเข้าตรงๆ ที่ <a href="https://developers.line.biz/console/" target="_blank" rel="noopener" style={{ color: '#00B900', textDecoration: 'underline', fontWeight: 600 }}>developers.line.biz/console/</a></li>
              <li>เลือก Provider → เลือก Channel ของ OA คุณ</li>
              <li>เข้า tab <strong>"Messaging API"</strong> → scroll ลงสุด</li>
              <li>หา <strong>"Channel access token (long-lived)"</strong> → กด <strong>"Issue"</strong></li>
              <li>Copy token ที่ได้</li>
            </ol>
          </div>

          {/* ส่วนที่ 4 - Add บอทเป็นเพื่อน */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontWeight: 700, marginBottom: 6, color: 'var(--text)' }}>
              ขั้นที่ 4: เพิ่ม LINE OA เป็นเพื่อน
            </div>
            <ol style={{ marginLeft: 18, marginTop: 4 }}>
              <li>ใน LINE Developers → tab <strong>"Messaging API"</strong></li>
              <li>หา <strong>QR code</strong> ของ Bot (อยู่ใต้ Bot information)</li>
              <li>เปิดแอป LINE มือถือ → สแกน QR Code → <strong>เพิ่มเพื่อน</strong></li>
              <li>⚠️ <strong style={{ color: 'var(--danger)' }}>สำคัญ!</strong> ถ้าไม่เพิ่มเป็นเพื่อน บอทส่งข้อความหาคุณไม่ได้</li>
            </ol>
          </div>

          {/* ส่วนที่ 5 - เอา User ID */}
          <div>
            <div style={{ fontWeight: 700, marginBottom: 6, color: 'var(--text)' }}>
              ขั้นที่ 5: Copy User ID ของคุณ
            </div>
            <ol style={{ marginLeft: 18, marginTop: 4 }}>
              <li>ใน LINE Developers → tab <strong>"Basic settings"</strong></li>
              <li>Scroll ลงสุด → หา <strong>"Your user ID"</strong></li>
              <li>Copy User ID (ขึ้นต้นด้วย U เช่น <code style={{ fontSize: 11 }}>U1234567890abcdef...</code>)</li>
              <li>กลับมาที่หน้านี้ → วาง Token + User ID → กด <strong>🧪 ทดสอบ</strong></li>
            </ol>
          </div>
        </div>

        <div style={{
          padding: 10,
          background: 'rgba(59, 130, 246, 0.08)',
          borderLeft: '3px solid var(--accent)',
          marginBottom: 16,
          fontSize: 11,
          lineHeight: 1.6,
        }}>
          💡 <strong>หมายเหตุ:</strong> ทำครั้งเดียวจบ ใช้ได้ตลอด • ฟรี 200 ข้อความ/เดือน (พอสำหรับร้านเล็ก-กลาง)
        </div>

        <div className="form-grid">
          <div className="field full">
            <label>Channel Access Token (Long-lived)</label>
            <input 
              type="text" 
              value={lineForm.line_channel_access_token}
              onChange={(e) => setLineForm({ ...lineForm, line_channel_access_token: e.target.value })}
              placeholder="วาง Token ยาวๆ จาก LINE Developers"
              style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}
            />
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
              จากขั้นที่ 3 • Token จะยาวมากๆ (ประมาณ 170 ตัวอักษร)
            </div>
          </div>

          <div className="field full">
            <label>Your User ID</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input 
                type="text" 
                value={lineForm.line_user_id}
                onChange={(e) => setLineForm({ ...lineForm, line_user_id: e.target.value })}
                placeholder="U1234567890abcdef..."
                style={{ flex: 1, fontFamily: 'JetBrains Mono, monospace' }}
              />
              <button 
                type="button" 
                onClick={handleTestLine} 
                disabled={testingLine || !lineForm.line_channel_access_token || !lineForm.line_user_id}
                className="btn btn-sec"
                style={{ width: 'auto', padding: '0 16px', whiteSpace: 'nowrap' }}
              >
                {testingLine ? 'กำลังส่ง...' : '🧪 ทดสอบ'}
              </button>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
              จากขั้นที่ 5 • ขึ้นต้นด้วย U
            </div>
          </div>

          <div className="field full">
            <label style={{ marginBottom: 10 }}>เลือกการแจ้งเตือน</label>
            
            <label style={{ 
              display: 'flex', alignItems: 'center', gap: 10, padding: 10,
              cursor: 'pointer', borderRadius: 6, marginBottom: 6,
              background: lineForm.line_notify_sale ? 'var(--accent-light)' : 'var(--surface-2)',
            }}>
              <input 
                type="checkbox" 
                checked={lineForm.line_notify_sale}
                onChange={(e) => setLineForm({ ...lineForm, line_notify_sale: e.target.checked })}
                style={{ width: 18, height: 18, cursor: 'pointer' }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>📱 ขายเครื่อง</div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>แจ้งทุกครั้งที่ขายเครื่อง</div>
              </div>
            </label>

            <label style={{ 
              display: 'flex', alignItems: 'center', gap: 10, padding: 10,
              cursor: 'pointer', borderRadius: 6, marginBottom: 6,
              background: lineForm.line_notify_pawn ? 'var(--accent-light)' : 'var(--surface-2)',
            }}>
              <input 
                type="checkbox" 
                checked={lineForm.line_notify_pawn}
                onChange={(e) => setLineForm({ ...lineForm, line_notify_pawn: e.target.checked })}
                style={{ width: 18, height: 18, cursor: 'pointer' }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>💰 จำนำ</div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>รับจำนำ / ไถ่คืน / หลุดจำนำ</div>
              </div>
            </label>

            <label style={{ 
              display: 'flex', alignItems: 'center', gap: 10, padding: 10,
              cursor: 'pointer', borderRadius: 6, marginBottom: 6,
              background: lineForm.line_notify_installment ? 'var(--accent-light)' : 'var(--surface-2)',
            }}>
              <input 
                type="checkbox" 
                checked={lineForm.line_notify_installment}
                onChange={(e) => setLineForm({ ...lineForm, line_notify_installment: e.target.checked })}
                style={{ width: 18, height: 18, cursor: 'pointer' }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>💳 ผ่อน</div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>รับชำระงวด / ปิดยอด</div>
              </div>
            </label>

            <label style={{ 
              display: 'flex', alignItems: 'center', gap: 10, padding: 10,
              cursor: 'pointer', borderRadius: 6, marginBottom: 6,
              background: lineForm.line_notify_goods ? 'var(--accent-light)' : 'var(--surface-2)',
            }}>
              <input 
                type="checkbox" 
                checked={lineForm.line_notify_goods}
                onChange={(e) => setLineForm({ ...lineForm, line_notify_goods: e.target.checked })}
                style={{ width: 18, height: 18, cursor: 'pointer' }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>🎒 ขายของ (อุปกรณ์เสริม)</div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>อาจรกถ้าขายเยอะ - ปิดได้</div>
              </div>
            </label>

            <label style={{ 
              display: 'flex', alignItems: 'center', gap: 10, padding: 10,
              cursor: 'pointer', borderRadius: 6,
              background: lineForm.line_notify_low_stock ? 'var(--accent-light)' : 'var(--surface-2)',
            }}>
              <input 
                type="checkbox" 
                checked={lineForm.line_notify_low_stock}
                onChange={(e) => setLineForm({ ...lineForm, line_notify_low_stock: e.target.checked })}
                style={{ width: 18, height: 18, cursor: 'pointer' }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>📦 สินค้าใกล้หมด</div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>แจ้งเมื่อขายของแล้วเหลือน้อย</div>
              </div>
            </label>
          </div>
        </div>

        <div className="form-actions" style={{ marginTop: 16 }}>
          <button className="btn" onClick={handleSaveLine} disabled={savingLine}>
            {savingLine ? 'กำลังบันทึก...' : '💾 บันทึก'}
          </button>
        </div>
      </div>

      {toast && <Toast {...toast} />}
    </>
  );
}
