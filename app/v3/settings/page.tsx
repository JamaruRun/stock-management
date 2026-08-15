'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';
import { uploadStockImage } from '@/lib/image-upload';
import {
  User, Building2, Palette, Bell, Save, Check, X,
  KeyRound, Mail, Phone, MapPin, FileText, Hash,
  Image as ImageIcon, MessageSquare, Moon, Sun, Smartphone as Phone2,
  LogOut, AlertCircle, Loader2, UserPlus, QrCode, Copy,
  Users, Link2, Unlink, Send, ChevronDown,
} from 'lucide-react';
import QRCode from 'qrcode';
import { sendLineNotify } from '@/lib/line-notify';

type TabId = 'profile' | 'shop' | 'theme' | 'notify';

const TABS: { id: TabId; label: string; Icon: any; color: string }[] = [
  { id: 'profile', label: 'โปรไฟล์', Icon: User, color: '#3b82f6' },
  { id: 'shop', label: 'ข้อมูลร้าน', Icon: Building2, color: '#22c55e' },
  { id: 'theme', label: 'ธีม', Icon: Palette, color: '#8b5cf6' },
  { id: 'notify', label: 'แจ้งเตือน', Icon: Bell, color: '#f59e0b' },
];

const THEMES = [
  { id: 'modern-blue', name: 'StockCare Blue', desc: 'ฟ้า น้ำเงิน สด ดูเป็นมืออาชีพ', primary: '#2563EB', accent: '#3b82f6' },
  { id: 'dark-pro', name: 'Dark Pro', desc: 'มืดเข้ม ดูล้ำ ถนอมตา', primary: '#1e293b', accent: '#60a5fa' },
  { id: 'orange-shop', name: 'Orange Shop', desc: 'ส้มสด สดใส อบอุ่น', primary: '#ea580c', accent: '#f97316' },
];

export default function V3SettingsPage() {
  const supabase = createClient();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>('profile');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [shop, setShop] = useState<any>(null);
  const [currentTheme, setCurrentTheme] = useState('modern-blue');

  // Shop form
  const [shopForm, setShopForm] = useState({
    name: '',
    owner_name: '',
    owner_phone: '',
    shop_email: '',
    description: '',
    province: '',
    district: '',
    postal_code: '',
    social_link: '',
    receipt_address: '',
    receipt_phone: '',
    receipt_tax_id: '',
    receipt_footer: '',
    receipt_prefix: 'INV',
  });

  // LINE form
  const [lineForm, setLineForm] = useState({
    line_notify_sale: true,
    line_notify_pawn: true,
    line_notify_goods: false,
    line_notify_installment: true,
    line_notify_low_stock: true,
    line_notify_parts_low: true,
    pawn_forfeit_after_cycles: 3,
    pawn_summary_interval: 'off',
  });

  async function loadData() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }

      const { data: p } = await supabase
        .from('profiles')
        .select('*, branches(name)')
        .eq('id', user.id)
        .single();
      setProfile(p);

      if (p?.shop_id) {
        const { data: s } = await supabase
          .from('shops')
          .select('*')
          .eq('id', p.shop_id)
          .single();
        setShop(s);
        if (s) {
          setShopForm({
            name: s.name || '',
            owner_name: s.owner_name || '',
            owner_phone: s.owner_phone || '',
            shop_email: s.shop_email || '',
            description: s.description || '',
            province: s.province || '',
            district: s.district || '',
            postal_code: s.postal_code || '',
            social_link: s.social_link || '',
            receipt_address: s.receipt_address || '',
            receipt_phone: s.receipt_phone || '',
            receipt_tax_id: s.receipt_tax_id || '',
            receipt_footer: s.receipt_footer || '',
            receipt_prefix: s.receipt_prefix || 'INV',
          });
          setLineForm({
            line_notify_sale: s.line_notify_sale !== false,
            line_notify_pawn: s.line_notify_pawn !== false,
            line_notify_goods: s.line_notify_goods === true,
            line_notify_installment: s.line_notify_installment !== false,
            line_notify_low_stock: s.line_notify_low_stock !== false,
            line_notify_parts_low: s.line_notify_parts_low !== false,
            pawn_forfeit_after_cycles: s.pawn_forfeit_after_cycles ?? 3,
            pawn_summary_interval: s.pawn_summary_interval || 'off',
          });
        }
      }

      // Theme - อ่านจาก localStorage หรือ default
      const savedTheme = typeof window !== 'undefined' ? localStorage.getItem('v3-theme') : null;
      setCurrentTheme(savedTheme || 'modern-blue');
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  // กลับจาก LINE OAuth (?line=connected/cancelled/error) → เปิดแท็บแจ้งเตือนให้เลย
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (new URLSearchParams(window.location.search).get('line')) {
      setActiveTab('notify');
    }
  }, []);

  async function handleSaveShop() {
    if (!shop?.id) return;
    setSaving(true);
    const { error } = await supabase
      .from('shops')
      .update(shopForm)
      .eq('id', shop.id);
    setSaving(false);
    if (error) { alert('บันทึกไม่สำเร็จ: ' + error.message); return; }
    alert('บันทึกข้อมูลร้านสำเร็จ ✓');
    loadData();
  }

  async function handleSaveLine() {
    if (!shop?.id) return;
    setSaving(true);
    const { error } = await supabase
      .from('shops')
      .update(lineForm)
      .eq('id', shop.id);
    setSaving(false);
    if (error) { alert('บันทึกไม่สำเร็จ: ' + error.message); return; }
    alert('บันทึกการแจ้งเตือน LINE สำเร็จ ✓');
    loadData();
  }

  function handleChangeTheme(themeId: string) {
    setCurrentTheme(themeId);
    if (typeof window !== 'undefined') {
      document.documentElement.setAttribute('data-theme', themeId);
      localStorage.setItem('v3-theme', themeId);
    }
  }

  async function handleChangePassword() {
    const newPass = prompt('ใส่รหัสผ่านใหม่ (อย่างน้อย 6 ตัว):');
    if (!newPass) return;
    if (newPass.length < 6) { alert('รหัสผ่านต้องมีอย่างน้อย 6 ตัว'); return; }

    const { error } = await supabase.auth.updateUser({ password: newPass });
    if (error) { alert('เปลี่ยนไม่สำเร็จ: ' + error.message); return; }
    alert('เปลี่ยนรหัสผ่านสำเร็จ ✓');
  }

  async function handleLogout() {
    if (!confirm('ออกจากระบบ?')) return;
    await supabase.auth.signOut();
    router.push('/login');
  }

  if (loading) {
    return (
      <div className="v3-card" style={{ padding: 60, textAlign: 'center', color: 'var(--text-dim)' }}>
        <Loader2 size={24} className="v3-spin" style={{ marginBottom: 10 }} />
        <div>กำลังโหลด...</div>
      </div>
    );
  }

  const isAdmin = profile?.role === 'admin' || profile?.is_super_admin;

  return (
    <>
      <div className="v3-page-header v3-desktop-only">
        <div>
          <h1 className="v3-page-title">ตั้งค่า</h1>
          <p className="v3-page-subtitle">จัดการบัญชี · ร้าน · ธีม · แจ้งเตือน</p>
        </div>
      </div>

      <div className="v3-mobile-only" style={{ marginBottom: 12 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, fontFamily: 'Prompt, sans-serif' }}>
          ตั้งค่า
        </h1>
        <p style={{ fontSize: 11, color: 'var(--text-dim)' }}>
          จัดการบัญชี · ร้าน · ธีม · แจ้งเตือน
        </p>
      </div>

      <div className="v3-settings-layout">
        {/* Tabs sidebar */}
        <div className="v3-settings-tabs">
          {TABS.map(tab => (
            <TabBtn
              key={tab.id}
              active={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              Icon={tab.Icon}
              label={tab.label}
              color={tab.color}
            />
          ))}
        </div>

        {/* Content */}
        <div className="v3-settings-content">
          {activeTab === 'profile' && (
            <ProfileTab
              profile={profile}
              onChangePassword={handleChangePassword}
              onLogout={handleLogout}
            />
          )}
          {activeTab === 'shop' && (
            <ShopTab
              shop={shop}
              form={shopForm}
              setForm={setShopForm}
              saving={saving}
              onSave={handleSaveShop}
              isAdmin={isAdmin}
            />
          )}
          {activeTab === 'theme' && (
            <ThemeTab
              current={currentTheme}
              onChange={handleChangeTheme}
            />
          )}
          {activeTab === 'notify' && (
            <NotifyTab
              shop={shop}
              profile={profile}
              form={lineForm}
              setForm={setLineForm}
              saving={saving}
              onSave={handleSaveLine}
              isAdmin={isAdmin}
              reload={loadData}
            />
          )}
        </div>
      </div>

      <style jsx>{`
        :global(.v3-settings-layout) {
          display: grid;
          grid-template-columns: 240px 1fr;
          gap: 14px;
          align-items: start;
        }
        :global(.v3-settings-tabs) {
          display: flex;
          flex-direction: column;
          gap: 4px;
          background: var(--surface);
          padding: 6px;
          border-radius: 14px;
          border: 1px solid var(--border);
          position: sticky;
          top: 70px;
        }
        @media (max-width: 1024px) {
          :global(.v3-settings-layout) {
            grid-template-columns: 1fr;
          }
          :global(.v3-settings-tabs) {
            flex-direction: row;
            overflow-x: auto;
            position: static;
          }
        }
      `}</style>
    </>
  );
}

/* =========================
   Tab Button
========================= */

function TabBtn({ active, onClick, Icon, label, color }: any) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 12px',
        background: active ? `${color}15` : 'transparent',
        border: 'none',
        borderRadius: 10,
        color: active ? color : 'var(--text)',
        fontSize: 13,
        fontWeight: active ? 700 : 500,
        cursor: 'pointer',
        fontFamily: 'inherit',
        textAlign: 'left',
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      <Icon size={16} strokeWidth={active ? 2.4 : 2} />
      {label}
    </button>
  );
}

/* =========================
   Profile Tab
========================= */

function ProfileTab({ profile, onChangePassword, onLogout }: any) {
  if (!profile) return null;
  const isAdmin = profile.role === 'admin' || profile.is_super_admin;
  const roleColor = profile.is_super_admin ? '#8b5cf6' : (isAdmin ? '#f59e0b' : '#3b82f6');
  const roleLabel = profile.is_super_admin ? 'Super Admin' : (isAdmin ? 'แอดมิน' : 'พนักงาน');

  return (
    <div className="v3-card" style={{ padding: 20 }}>
      <SectionTitle Icon={User} label="ข้อมูลผู้ใช้" color="#3b82f6" />

      {/* Avatar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        marginBottom: 20,
      }}>
        <div style={{
          width: 64, height: 64,
          borderRadius: 32,
          background: `${roleColor}15`,
          color: roleColor,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700,
          fontSize: 26,
          fontFamily: 'Prompt, sans-serif',
        }}>
          {(profile.full_name || profile.username).charAt(0).toUpperCase()}
        </div>
        <div>
          <div style={{
            fontSize: 17,
            fontWeight: 700,
            fontFamily: 'Prompt, sans-serif',
          }}>
            {profile.full_name || 'ไม่มีชื่อ'}
          </div>
          <div style={{
            fontSize: 12,
            color: 'var(--text-dim)',
            fontFamily: 'monospace',
            marginTop: 2,
          }}>
            @{profile.username}
          </div>
          <span style={{
            display: 'inline-block',
            marginTop: 6,
            padding: '2px 9px',
            fontSize: 10,
            fontWeight: 700,
            borderRadius: 100,
            background: `${roleColor}15`,
            color: roleColor,
          }}>
            {roleLabel}
          </span>
        </div>
      </div>

      {/* Info rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <InfoRow label="สาขา" value={profile.branches?.name || '-'} Icon={MapPin} />
        <InfoRow label="สร้างเมื่อ" value={profile.created_at ? new Date(profile.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'} Icon={FileText} />
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
        {isAdmin && (
          <ActionRow
            Icon={KeyRound}
            label="เปลี่ยนรหัสผ่าน"
            desc="ตั้งรหัสผ่านใหม่สำหรับบัญชีนี้"
            color="#3b82f6"
            onClick={onChangePassword}
          />
        )}
        <ActionRow
          Icon={LogOut}
          label="ออกจากระบบ"
          desc="ออกจากบัญชี"
          color="#ef4444"
          onClick={onLogout}
        />
      </div>
      {!isAdmin && (
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10, textAlign: 'center' }}>
          การเปลี่ยนรหัสผ่านต้องให้แอดมินดำเนินการให้
        </p>
      )}
    </div>
  );
}

/* =========================
   Shop Tab
========================= */

function ShopLogoCard({ shop }: any) {
  const supabase = createClient();
  const [logoUrl, setLogoUrl] = useState<string>(shop?.receipt_logo_url || '');
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  function notify(text: string, ok = true) { setMsg({ text, ok }); setTimeout(() => setMsg(null), 2800); }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return notify('กรุณาเลือกไฟล์รูปภาพ', false);
    if (!shop?.id) return notify('ยังโหลดข้อมูลร้านไม่เสร็จ', false);
    setUploading(true);
    try {
      const url = await uploadStockImage(file, shop.id);
      const { error } = await supabase.from('shops').update({ receipt_logo_url: url }).eq('id', shop.id);
      if (error) throw error;
      setLogoUrl(url);
      notify('อัปเดตโลโก้แล้ว — จะขึ้นบนใบเสร็จ');
    } catch (err: any) {
      notify('อัปโหลดไม่สำเร็จ: ' + (err?.message || ''), false);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }
  async function removeLogo() {
    if (!shop?.id) return;
    if (!confirm('ลบโลโก้ร้านออกจากใบเสร็จ?')) return;
    await supabase.from('shops').update({ receipt_logo_url: null }).eq('id', shop.id);
    setLogoUrl('');
    notify('ลบโลโก้แล้ว');
  }

  return (
    <div className="v3-card" style={{ padding: 20 }}>
      <SectionTitle Icon={ImageIcon} label="โลโก้ร้าน (บนใบเสร็จ)" color="#8b5cf6" />
      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 16 }}>
        อัปโหลดโลโก้ร้าน จะแสดงด้านบนของใบเสร็จทุกใบเวลาพิมพ์
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ width: 88, height: 88, borderRadius: 14, border: '2px dashed var(--border)', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
          {logoUrl ? <img src={logoUrl} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <ImageIcon size={30} style={{ color: 'var(--text-muted)' }} />}
        </div>
        <div style={{ flex: 1, minWidth: 180, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px 16px', borderRadius: 10, background: 'linear-gradient(135deg,#8b5cf6,#6d28d9)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: uploading ? 'wait' : 'pointer' }}>
            {uploading ? <Loader2 size={16} className="v3-spin" /> : <ImageIcon size={16} />} {uploading ? 'กำลังอัปโหลด...' : (logoUrl ? 'เปลี่ยนโลโก้' : 'อัปโหลดโลโก้')}
            <input type="file" accept="image/*" onChange={handleFile} disabled={uploading} style={{ display: 'none' }} />
          </label>
          {logoUrl && <button onClick={removeLogo} style={{ padding: '9px 16px', borderRadius: 10, background: 'var(--surface-2)', color: '#ef4444', border: '1px solid var(--border)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>ลบโลโก้</button>}
          <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>รองรับ JPG/PNG · ระบบย่อขนาดให้อัตโนมัติ</div>
        </div>
      </div>
      {msg && <div style={{ marginTop: 12, fontSize: 12, fontWeight: 600, color: msg.ok ? '#16a34a' : '#dc2626' }}>{msg.text}</div>}
    </div>
  );
}

function ShopTab({ shop, form, setForm, saving, onSave, isAdmin }: any) {
  if (!isAdmin) {
    return (
      <div className="v3-card" style={{ padding: 40, textAlign: 'center' }}>
        <AlertCircle size={48} strokeWidth={1.2} style={{ margin: '0 auto 12px', color: 'var(--text-muted)' }} />
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
          ต้องเป็นแอดมินเท่านั้น
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
          เฉพาะแอดมินที่แก้ไขข้อมูลร้านได้
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Section 0: โลโก้ร้าน (ขึ้นใบเสร็จ) */}
      <ShopLogoCard shop={shop} />

      {/* Section 1: ข้อมูลร้าน */}
      <div className="v3-card" style={{ padding: 20 }}>
        <SectionTitle Icon={Building2} label="ข้อมูลร้าน" color="#22c55e" />

        <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 16 }}>
          ข้อมูลทั่วไปของร้าน — ใช้แสดงในระบบและใบเสร็จ
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <FormField label="ชื่อร้าน" Icon={Building2}>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="เช่น ร้านมือถือสมาร์ทเซอร์วิส"
              style={inputStyle}
            />
          </FormField>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <FormField label="ชื่อเจ้าของร้าน" Icon={User}>
              <input
                type="text"
                value={form.owner_name}
                onChange={(e) => setForm({ ...form, owner_name: e.target.value })}
                placeholder="ชื่อ-นามสกุล"
                style={inputStyle}
              />
            </FormField>
            <FormField label="เบอร์เจ้าของ" Icon={Phone}>
              <input
                type="text"
                value={form.owner_phone}
                onChange={(e) => setForm({ ...form, owner_phone: e.target.value })}
                placeholder="0xx-xxx-xxxx"
                style={inputStyle}
              />
            </FormField>
          </div>

          <FormField label="อีเมลร้าน" Icon={Mail}>
            <input
              type="email"
              value={form.shop_email}
              onChange={(e) => setForm({ ...form, shop_email: e.target.value })}
              placeholder="shop@example.com"
              style={inputStyle}
            />
          </FormField>

          <FormField label="คำอธิบายร้าน" Icon={FileText}>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="ร้านขาย ซ่อม รับจำนำมือถือทุกรุ่น..."
              rows={2}
              style={{ ...textareaStyle, minHeight: 60 }}
            />
          </FormField>

          <FormField label="Facebook / LINE OA" Icon={MessageSquare}>
            <input
              type="text"
              value={form.social_link}
              onChange={(e) => setForm({ ...form, social_link: e.target.value })}
              placeholder="@yourpage หรือ facebook.com/yourpage"
              style={inputStyle}
            />
          </FormField>
        </div>
      </div>

      {/* Section 2: ที่ตั้งร้าน */}
      <div className="v3-card" style={{ padding: 20 }}>
        <SectionTitle Icon={MapPin} label="ที่ตั้งร้าน" color="#3b82f6" />

        <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 16 }}>
          ที่อยู่ของร้าน — ใช้แสดงในใบเสร็จและรายงาน
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <FormField label="ที่อยู่" Icon={MapPin}>
            <textarea
              value={form.receipt_address}
              onChange={(e) => setForm({ ...form, receipt_address: e.target.value })}
              placeholder="123/45 ถ. สุขุมวิท ตำบล/แขวง..."
              rows={2}
              style={{ ...textareaStyle, minHeight: 60 }}
            />
          </FormField>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <FormField label="อำเภอ / เขต" Icon={MapPin}>
              <input
                type="text"
                value={form.district}
                onChange={(e) => setForm({ ...form, district: e.target.value })}
                placeholder="เช่น บางนา"
                style={inputStyle}
              />
            </FormField>
            <FormField label="จังหวัด" Icon={MapPin}>
              <input
                type="text"
                value={form.province}
                onChange={(e) => setForm({ ...form, province: e.target.value })}
                placeholder="เช่น กรุงเทพมหานคร"
                style={inputStyle}
              />
            </FormField>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <FormField label="รหัสไปรษณีย์" Icon={Hash}>
              <input
                type="text"
                value={form.postal_code}
                onChange={(e) => setForm({ ...form, postal_code: e.target.value.replace(/\D/g, '').slice(0, 5) })}
                placeholder="10260"
                maxLength={5}
                style={inputStyle}
              />
            </FormField>
            <FormField label="เบอร์โทรร้าน" Icon={Phone}>
              <input
                type="text"
                value={form.receipt_phone}
                onChange={(e) => setForm({ ...form, receipt_phone: e.target.value })}
                placeholder="0xx-xxx-xxxx"
                style={inputStyle}
              />
            </FormField>
          </div>
        </div>
      </div>

      {/* Section 3: ใบเสร็จ */}
      <div className="v3-card" style={{ padding: 20 }}>
        <SectionTitle Icon={FileText} label="ตั้งค่าใบเสร็จ" color="#f59e0b" />

        <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 16 }}>
          การตั้งค่าสำหรับการพิมพ์ใบเสร็จ
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <FormField label="เลขประจำตัวผู้เสียภาษี" Icon={Hash}>
              <input
                type="text"
                value={form.receipt_tax_id}
                onChange={(e) => setForm({ ...form, receipt_tax_id: e.target.value })}
                placeholder="0-1234-56789-01-1"
                style={inputStyle}
              />
            </FormField>
            <FormField label="รหัสนำหน้าใบเสร็จ" Icon={FileText}>
              <input
                type="text"
                value={form.receipt_prefix}
                onChange={(e) => setForm({ ...form, receipt_prefix: e.target.value.toUpperCase().slice(0, 6) })}
                placeholder="INV"
                maxLength={6}
                style={inputStyle}
              />
            </FormField>
          </div>

          <FormField label="ข้อความท้ายใบเสร็จ" Icon={MessageSquare}>
            <textarea
              value={form.receipt_footer}
              onChange={(e) => setForm({ ...form, receipt_footer: e.target.value })}
              placeholder="ขอบคุณที่ใช้บริการ"
              rows={2}
              style={{ ...textareaStyle, minHeight: 50 }}
            />
          </FormField>
        </div>
      </div>

      {/* Save button - ใหญ่ ติดกัน save ทุก section */}
      <button
        onClick={onSave}
        disabled={saving}
        style={{
          padding: '14px',
          background: saving ? 'var(--surface-2)' : 'linear-gradient(135deg, #22c55e, #16a34a)',
          color: '#fff',
          border: 'none',
          borderRadius: 12,
          fontSize: 14,
          fontWeight: 700,
          cursor: saving ? 'wait' : 'pointer',
          fontFamily: 'inherit',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          boxShadow: saving ? 'none' : '0 4px 12px rgba(34, 197, 94, 0.25)',
          position: 'sticky',
          bottom: 76,
          zIndex: 5,
        }}
      >
        <Save size={16} />
        {saving ? 'กำลังบันทึก...' : 'บันทึกข้อมูลทั้งหมด'}
      </button>
    </div>
  );
}

/* =========================
   Theme Tab
========================= */

function ThemeTab({ current, onChange }: any) {
  return (
    <div className="v3-card" style={{ padding: 20 }}>
      <SectionTitle Icon={Palette} label="เลือกธีม" color="#8b5cf6" />

      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 16 }}>
        เปลี่ยนธีมสีของระบบให้ตรงกับสไตล์ร้านคุณ
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {THEMES.map(theme => (
          <button
            key={theme.id}
            onClick={() => onChange(theme.id)}
            style={{
              padding: 14,
              background: current === theme.id ? `${theme.accent}10` : 'var(--surface)',
              border: '2px solid',
              borderColor: current === theme.id ? theme.accent : 'var(--border)',
              borderRadius: 14,
              cursor: 'pointer',
              fontFamily: 'inherit',
              textAlign: 'left',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              transition: 'all 0.15s',
            }}
          >
            {/* Color preview */}
            <div style={{
              width: 56, height: 56,
              borderRadius: 12,
              background: `linear-gradient(135deg, ${theme.primary}, ${theme.accent})`,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
            }}>
              <Palette size={22} />
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 14,
                fontWeight: 700,
                fontFamily: 'Prompt, sans-serif',
                marginBottom: 2,
              }}>
                {theme.name}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                {theme.desc}
              </div>
            </div>

            {current === theme.id && (
              <div style={{
                width: 24, height: 24,
                borderRadius: 12,
                background: theme.accent,
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Check size={14} strokeWidth={3} />
              </div>
            )}
          </button>
        ))}
      </div>

      <div style={{
        marginTop: 16,
        padding: 12,
        background: 'var(--surface-2)',
        borderRadius: 10,
        fontSize: 11,
        color: 'var(--text-dim)',
      }}>
        💡 ธีมเปลี่ยนทันที — ข้อมูลทุกอย่างยังอยู่ครบ
      </div>
    </div>
  );
}

/* =========================
   Notify Tab
========================= */

function NotifyTab({ shop, profile, form, setForm, saving, onSave, isAdmin, reload }: any) {
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  function notify(text: string, ok = true) { setMsg({ text, ok }); setTimeout(() => setMsg(null), 3500); }

  const [groupIdInput, setGroupIdInput] = useState('');
  const [savingGroup, setSavingGroup] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  // แสดงผลกลับจาก LINE OAuth (?line=connected/cancelled/error) แล้วล้าง URL
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const p = new URLSearchParams(window.location.search);
    const r = p.get('line');
    if (!r) return;
    if (r === 'connected') notify('เชื่อม LINE สำเร็จ — ระบบพร้อมส่งแจ้งเตือนแล้ว');
    else if (r === 'cancelled') notify('ยกเลิกการเชื่อม LINE', false);
    else notify('เชื่อม LINE ไม่สำเร็จ: ' + (p.get('reason') || 'ลองใหม่อีกครั้ง'), false);
    window.history.replaceState({}, '', '/v3/settings');
  }, []);

  async function handleSaveGroup() {
    const gid = groupIdInput.trim();
    if (!gid) return notify('ใส่ Group ID ก่อน', false);
    if (!gid.startsWith('C')) return notify('Group ID ต้องขึ้นต้นด้วย C', false);
    setSavingGroup(true);
    try {
      const res = await fetch('/api/line/group', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group_id: gid }),
      });
      const data = await res.json();
      if (data.success) { notify('เชื่อมกลุ่มสำเร็จ — เช็คใน LINE มีข้อความยืนยัน'); setGroupIdInput(''); reload?.(); }
      else notify('เชื่อมไม่สำเร็จ: ' + (data.error || ''), false);
    } catch (e: any) { notify('เกิดข้อผิดพลาด: ' + e.message, false); }
    finally { setSavingGroup(false); }
  }

  async function handleDisconnectGroup() {
    if (!confirm('ยกเลิกการเชื่อมกลุ่ม LINE?\n\nระบบจะกลับไปส่งหา admin แต่ละคนแทน')) return;
    setDisconnecting(true);
    try {
      const res = await fetch('/api/line/group', { method: 'DELETE' });
      const data = await res.json();
      if (data.success) { notify('ยกเลิกการเชื่อมกลุ่มแล้ว'); reload?.(); }
      else notify('ยกเลิกไม่สำเร็จ: ' + (data.error || ''), false);
    } catch (e: any) { notify('เกิดข้อผิดพลาด: ' + e.message, false); }
    finally { setDisconnecting(false); }
  }

  function handleConnectLine() { window.location.href = '/api/line/login'; }

  async function handleDisconnectLine() {
    if (!confirm('ยกเลิกการเชื่อม LINE ส่วนตัว?\n\nคุณจะไม่ได้รับแจ้งเตือนอีก (admin คนอื่นยังได้รับอยู่)')) return;
    setDisconnecting(true);
    try {
      const res = await fetch('/api/line/disconnect', { method: 'POST' });
      const data = await res.json();
      if (data.success) { notify('ยกเลิกการเชื่อมแล้ว'); reload?.(); }
      else notify('ยกเลิกไม่สำเร็จ: ' + (data.error || ''), false);
    } catch (e: any) { notify('เกิดข้อผิดพลาด: ' + e.message, false); }
    finally { setDisconnecting(false); }
  }

  async function handleTest() {
    setTesting(true);
    const now = new Date();
    const dateStr = now.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    const result = await sendLineNotify(
      `🎉 ทดสอบการแจ้งเตือน\n\n🏪 ร้าน: ${shop?.name || 'ของคุณ'}\n👤 ${profile?.full_name || ''}\n📅 ${dateStr} 🕐 ${timeStr} น.\n\n✅ การเชื่อมต่อสำเร็จ`,
      'test'
    );
    setTesting(false);
    if (result?.success) notify('ส่งข้อความทดสอบสำเร็จ — เช็คใน LINE');
    else notify('ส่งไม่สำเร็จ: ' + (result?.detail || result?.error || 'ยังไม่ได้เชื่อม LINE'), false);
  }

  if (!isAdmin) {
    return (
      <div className="v3-card" style={{ padding: 40, textAlign: 'center' }}>
        <AlertCircle size={48} strokeWidth={1.2} style={{ margin: '0 auto 12px', color: 'var(--text-muted)' }} />
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
          ต้องเป็นแอดมินเท่านั้น
        </div>
      </div>
    );
  }

  const groupConnected = !!shop?.line_group_id;
  const meConnected = !!profile?.line_user_id;

  return (
    <div className="v3-card" style={{ padding: 20 }}>
      <SectionTitle Icon={Bell} label="การแจ้งเตือน LINE" color="#f59e0b" />

      {msg && (
        <div style={{
          padding: '10px 12px', borderRadius: 10, marginBottom: 14, fontSize: 12, fontWeight: 600,
          background: msg.ok ? '#dcfce7' : '#fee2e2', color: msg.ok ? '#166534' : '#b91c1c',
        }}>{msg.text}</div>
      )}

      {/* ───── วิธี 1: เชื่อมกลุ่ม LINE (แนะนำ) ───── */}
      <div style={{
        padding: 14, borderRadius: 12, marginBottom: 14,
        background: groupConnected ? 'rgba(6,199,85,0.08)' : 'var(--surface-2)',
        border: `1px solid ${groupConnected ? 'rgba(6,199,85,0.35)' : 'var(--border)'}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <Users size={16} style={{ color: '#06c755' }} />
          <span style={{ fontSize: 13, fontWeight: 700 }}>ส่งเข้ากลุ่ม LINE</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#06c755', background: 'rgba(6,199,85,0.12)', padding: '2px 7px', borderRadius: 100 }}>แนะนำ</span>
          {groupConnected && <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: '#06c755' }}>✓ เชื่อมแล้ว</span>}
        </div>

        {groupConnected ? (
          <>
            <div style={{ padding: 10, background: 'var(--surface)', borderRadius: 8, fontFamily: 'monospace', fontSize: 11, color: 'var(--text-dim)', wordBreak: 'break-all', marginBottom: 10 }}>
              {shop.line_group_id}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 10 }}>
              💡 ส่ง 1 ข้อความ → ทุกคนในกลุ่มได้รับพร้อมกัน · ประหยัดโควต้า LINE
            </div>
            <button onClick={handleDisconnectGroup} disabled={disconnecting} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9,
              background: 'var(--surface)', color: '#ef4444', border: '1px solid var(--border)',
              fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}>
              <Unlink size={13} /> {disconnecting ? 'กำลังยกเลิก...' : 'ยกเลิกการเชื่อมกลุ่ม'}
            </button>
          </>
        ) : (
          <>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.6, marginBottom: 10 }}>
              ส่ง 1 ข้อความ → ทุก admin ในกลุ่มเห็น · ประหยัดโควต้า 🎯
            </div>
            <button onClick={() => setShowGuide(!showGuide)} style={{
              display: 'inline-flex', alignItems: 'center', gap: 4, background: 'transparent', border: 'none',
              color: 'var(--accent)', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: '2px 0',
              fontFamily: 'inherit', marginBottom: 10,
            }}>
              <ChevronDown size={14} style={{ transform: showGuide ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
              {showGuide ? 'ปิดวิธีทำ' : 'ดูวิธีทำ (3 นาที)'}
            </button>

            {showGuide && (
              <div style={{ padding: 12, background: 'var(--surface)', borderRadius: 8, fontSize: 12, lineHeight: 1.8, marginBottom: 10 }}>
                <strong>ขั้นตอน:</strong>
                <ol style={{ marginLeft: 18, marginTop: 4 }}>
                  <li>เปิด LINE → สร้างกลุ่มใหม่ ตั้งชื่อ "แจ้งเตือนร้าน"</li>
                  <li>เชิญ admin คนอื่นเข้ากลุ่ม</li>
                  <li>เชิญ <strong>LINE OA ของระบบ</strong> เข้ากลุ่ม</li>
                  <li>บอทจะส่ง <strong>"Group ID:"</strong> เข้ามาในกลุ่ม (ถ้าไม่ส่ง พิมพ์ <code>id</code> ในกลุ่ม)</li>
                  <li>คัดลอก Group ID (ขึ้นต้น C) → วางด้านล่าง → บันทึก</li>
                </ol>
              </div>
            )}

            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type="text"
                value={groupIdInput}
                onChange={(e) => setGroupIdInput(e.target.value)}
                placeholder="C1234567890abcdef..."
                style={{ ...inputStyle, height: 40, flex: 1, fontFamily: 'monospace', fontSize: 12 }}
              />
              <button onClick={handleSaveGroup} disabled={savingGroup} style={{
                padding: '0 16px', background: '#06c755', color: '#fff', border: 'none', borderRadius: 10,
                fontSize: 13, fontWeight: 700, cursor: savingGroup ? 'wait' : 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
              }}>
                {savingGroup ? '...' : 'บันทึก'}
              </button>
            </div>
          </>
        )}
      </div>

      {/* ───── วิธี 2: เชื่อม LINE ส่วนตัว (OAuth) ───── */}
      <div style={{
        padding: 14, borderRadius: 12, marginBottom: 14,
        background: meConnected ? 'rgba(6,199,85,0.08)' : 'var(--surface-2)',
        border: `1px solid ${meConnected ? 'rgba(6,199,85,0.35)' : 'var(--border)'}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <MessageSquare size={16} style={{ color: '#06c755' }} />
          <span style={{ fontSize: 13, fontWeight: 700 }}>เชื่อม LINE ส่วนตัวของคุณ</span>
        </div>

        {meConnected ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {profile.line_picture_url
              ? <img src={profile.line_picture_url} alt="" style={{ width: 48, height: 48, borderRadius: 24, border: '2px solid #06c755', flexShrink: 0 }} />
              : <div style={{ width: 48, height: 48, borderRadius: 24, background: '#06c755', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>💬</div>}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#06c755' }}>✓ เชื่อมต่อแล้ว</div>
              <div style={{ fontSize: 14, fontWeight: 700, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {profile.line_display_name || 'LINE User'}
              </div>
            </div>
            <button onClick={handleDisconnectLine} disabled={disconnecting} style={{
              display: 'inline-flex', alignItems: 'center', gap: 5, padding: '8px 12px', borderRadius: 9,
              background: 'var(--surface)', color: '#ef4444', border: '1px solid var(--border)',
              fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
            }}>
              <Unlink size={13} /> ยกเลิก
            </button>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.6, marginBottom: 10 }}>
              ใช้กรณีไม่ใช้กลุ่ม · ระบบจะส่งแจ้งเตือนเข้า LINE ส่วนตัวของคุณ
            </div>
            <button onClick={handleConnectLine} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%',
              padding: '13px 16px', background: '#06c755', color: '#fff', border: 'none', borderRadius: 10,
              fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              boxShadow: '0 2px 8px rgba(6,199,85,0.3)',
            }}>
              <Link2 size={17} /> เชื่อม LINE (Login ครั้งเดียวจบ)
            </button>
            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 8, textAlign: 'center' }}>
              🔒 ปลอดภัย ใช้ LINE Login · ไม่เก็บรหัสผ่าน
            </div>
          </>
        )}
      </div>

      {/* ปุ่มทดสอบ (มีเมื่อเชื่อมอย่างใดอย่างหนึ่ง) */}
      {(groupConnected || meConnected) && (
        <button onClick={handleTest} disabled={testing} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%',
          padding: '11px', background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)',
          borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: testing ? 'wait' : 'pointer', fontFamily: 'inherit', marginBottom: 14,
        }}>
          <Send size={14} /> {testing ? 'กำลังส่ง...' : 'ส่งข้อความทดสอบ'}
        </button>
      )}

      {/* เพิ่มเพื่อน LINE OA */}
      <LineAddFriend />

      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 12 }}>
        เลือกประเภทเหตุการณ์ที่ต้องการให้แจ้งเตือนเข้า LINE
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <ToggleRow
          label="📱 ขายเครื่อง"
          desc="แจ้งเตือนทุกครั้งที่ขายเครื่องสำเร็จ"
          checked={form.line_notify_sale}
          onChange={(v: boolean) => setForm({ ...form, line_notify_sale: v })}
        />
        <ToggleRow
          label="🪙 รับจำนำ"
          desc="แจ้งเตือนเมื่อรับจำนำหรือไถ่คืน"
          checked={form.line_notify_pawn}
          onChange={(v: boolean) => setForm({ ...form, line_notify_pawn: v })}
        />
        <ToggleRow
          label="💳 ผ่อนชำระ"
          desc="แจ้งเตือนเมื่อเพิ่มสัญญาผ่อนหรือรับงวด"
          checked={form.line_notify_installment}
          onChange={(v: boolean) => setForm({ ...form, line_notify_installment: v })}
        />
        <ToggleRow
          label="🛍️ ขายอุปกรณ์เสริม"
          desc="แจ้งเตือนทุกครั้งที่ขายของในร้าน"
          checked={form.line_notify_goods}
          onChange={(v: boolean) => setForm({ ...form, line_notify_goods: v })}
        />
        <ToggleRow
          label="⚠️ สินค้าใกล้หมด"
          desc="แจ้งเตือนเมื่ออุปกรณ์เสริมต่ำกว่าขั้นต่ำ"
          checked={form.line_notify_low_stock}
          onChange={(v: boolean) => setForm({ ...form, line_notify_low_stock: v })}
        />
        <ToggleRow
          label="🔧 อะไหล่ใกล้หมด"
          desc="แจ้งเตือนเมื่ออะไหล่ซ่อมต่ำกว่าขั้นต่ำ"
          checked={form.line_notify_parts_low}
          onChange={(v: boolean) => setForm({ ...form, line_notify_parts_low: v })}
        />
      </div>

      <div style={{ marginTop: 16, padding: 14, borderRadius: 12, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>🪙 ตั้งค่าจำนำเพิ่มเติม</div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>จำนวนงวดที่เลยกำหนดก่อนแจ้งเตือนหลุดจำนำ</label>
          <input type="number" min={1} value={form.pawn_forfeit_after_cycles}
            onChange={(e) => setForm({ ...form, pawn_forfeit_after_cycles: parseInt(e.target.value) || 1 })}
            style={{ width: 100, height: 40, padding: '0 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 14, fontFamily: 'inherit', outline: 'none' }} />
          <div style={{ fontSize: 10.5, color: 'var(--text-dim)', marginTop: 4 }}>
            นับเป็น N × ระยะเวลาต่อดอกของเครื่องนั้นๆ (เช่น 30 วัน/งวด × 3 งวด = แจ้งเตือนเมื่อเลยกำหนด 90 วัน) ระบบแจ้งเตือนอย่างเดียว ไม่หลุดจำนำอัตโนมัติ
          </div>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>รอบสรุปยอดรับจำนำ (แจ้งไลน์)</label>
          <select value={form.pawn_summary_interval}
            onChange={(e) => setForm({ ...form, pawn_summary_interval: e.target.value })}
            style={{ width: '100%', height: 40, padding: '0 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 14, fontFamily: 'inherit', outline: 'none' }}>
            <option value="off">ปิด</option>
            <option value="daily">รายวัน</option>
            <option value="weekly">รายสัปดาห์</option>
            <option value="monthly">รายเดือน</option>
          </select>
        </div>
      </div>

      <button
        onClick={onSave}
        disabled={saving}
        style={{
          marginTop: 16,
          padding: '12px',
          background: saving ? 'var(--surface-2)' : 'linear-gradient(135deg, #f59e0b, #d97706)',
          color: '#fff',
          border: 'none',
          borderRadius: 10,
          fontSize: 13,
          fontWeight: 700,
          cursor: saving ? 'wait' : 'pointer',
          fontFamily: 'inherit',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          width: '100%',
        }}
      >
        <Save size={15} />
        {saving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่าแจ้งเตือน'}
      </button>
    </div>
  );
}

/* =========================
   Subcomponents
========================= */

function LineAddFriend() {
  const oaId = (process.env.NEXT_PUBLIC_LINE_OA_ID || '').trim();
  const cleanId = oaId.replace(/^@/, '');
  const addUrl = cleanId ? `https://line.me/R/ti/p/@${cleanId}` : '';
  const [qr, setQr] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!addUrl) return;
    QRCode.toDataURL(addUrl, { width: 240, margin: 1 }).then(setQr).catch(() => {});
  }, [addUrl]);

  function copyId() {
    navigator.clipboard?.writeText(`@${cleanId}`).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  }

  if (!cleanId) {
    return (
      <div style={{ padding: 14, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700, color: '#92400e', marginBottom: 4 }}>
          <UserPlus size={15} /> ตั้งค่า LINE OA เพื่อให้ลูกค้าแอดเพื่อนได้
        </div>
        <div style={{ fontSize: 11, color: '#92400e', lineHeight: 1.6 }}>
          เพิ่ม Environment Variable ใน Vercel: <code style={{ background: '#fef3c7', padding: '1px 5px', borderRadius: 4 }}>NEXT_PUBLIC_LINE_OA_ID</code> = Basic ID ของ OA (เช่น <code style={{ background: '#fef3c7', padding: '1px 5px', borderRadius: 4 }}>@abc1234</code>) แล้ว deploy ใหม่ → ปุ่ม + QR จะขึ้นตรงนี้อัตโนมัติ
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 16, background: 'var(--surface-2)', borderRadius: 12, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
        <UserPlus size={16} style={{ color: '#06c755' }} /> เพิ่มเพื่อน LINE OA ก่อนรับแจ้งเตือน
      </div>
      <p style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 14, lineHeight: 1.6 }}>
        LINE บังคับให้ <strong>แอดบอทเป็นเพื่อนก่อน</strong> ถึงจะได้รับข้อความ — แอดทางปุ่ม (มือถือ) หรือสแกน QR (คอม)
      </p>

      <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        {qr && (
          <img src={qr} alt="LINE QR" width={110} height={110} style={{ borderRadius: 10, background: '#fff', padding: 6, flexShrink: 0 }} />
        )}
        <div style={{ flex: 1, minWidth: 180, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <a href={addUrl} target="_blank" rel="noopener noreferrer" style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '12px 16px', background: '#06c755', color: '#fff', borderRadius: 10,
            fontSize: 14, fontWeight: 700, textDecoration: 'none', fontFamily: 'inherit',
          }}>
            <UserPlus size={17} /> เพิ่มเพื่อน @{cleanId}
          </a>
          <button onClick={copyId} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '9px 12px', background: 'var(--surface)', color: 'var(--text)',
            border: '1px solid var(--border)', borderRadius: 10, fontSize: 12, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>
            {copied ? <><Check size={13} /> คัดลอกแล้ว</> : <><Copy size={13} /> คัดลอก ID: @{cleanId}</>}
          </button>
        </div>
      </div>

      <div style={{ marginTop: 14, padding: '10px 12px', background: 'var(--surface)', borderRadius: 10, fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.8 }}>
        <strong style={{ color: 'var(--text)' }}>ส่งเข้ากลุ่ม?</strong> เชิญบอท <strong>@{cleanId}</strong> เข้ากลุ่ม LINE ด้วย (เมนูกลุ่ม → เชิญ → เลือก OA) แล้วบอทถึงจะส่งข้อความเข้ากลุ่มได้
      </div>
    </div>
  );
}

function SectionTitle({ Icon, label, color }: any) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      marginBottom: 6,
    }}>
      <div style={{
        width: 32, height: 32,
        borderRadius: 8,
        background: `${color}15`,
        color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={16} />
      </div>
      <h2 style={{
        fontSize: 16,
        fontWeight: 700,
        fontFamily: 'Prompt, sans-serif',
      }}>
        {label}
      </h2>
    </div>
  );
}

function InfoRow({ label, value, Icon }: any) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: 10,
      background: 'var(--surface-2)',
      borderRadius: 10,
    }}>
      <div style={{
        width: 28, height: 28,
        borderRadius: 8,
        background: 'var(--surface)',
        color: 'var(--text-dim)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Icon size={13} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{label}</div>
        <div style={{ fontSize: 13, fontWeight: 600, marginTop: 1 }}>{value}</div>
      </div>
    </div>
  );
}

function ActionRow({ Icon, label, desc, color, onClick }: any) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: 12,
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        cursor: 'pointer',
        fontFamily: 'inherit',
        textAlign: 'left',
        width: '100%',
      }}
    >
      <div style={{
        width: 36, height: 36,
        borderRadius: 10,
        background: `${color}15`,
        color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Icon size={16} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 1 }}>{desc}</div>
      </div>
    </button>
  );
}

function FormField({ label, Icon, children }: any) {
  return (
    <div>
      <label style={{
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        fontSize: 11,
        fontWeight: 600,
        marginBottom: 5,
        color: 'var(--text)',
      }}>
        {Icon && <Icon size={11} />}
        {label}
      </label>
      {children}
    </div>
  );
}

function ToggleRow({ label, desc, checked, onChange }: any) {
  return (
    <div
      onClick={() => onChange(!checked)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: 12,
        background: 'var(--surface-2)',
        borderRadius: 10,
        cursor: 'pointer',
        transition: 'all 0.15s',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 1 }}>{desc}</div>
      </div>
      <Toggle checked={checked} />
    </div>
  );
}

function Toggle({ checked }: any) {
  return (
    <div style={{
      width: 42,
      height: 24,
      borderRadius: 100,
      background: checked ? '#22c55e' : 'var(--border)',
      position: 'relative',
      transition: 'background 0.2s',
      flexShrink: 0,
    }}>
      <div style={{
        position: 'absolute',
        top: 2,
        left: checked ? 20 : 2,
        width: 20,
        height: 20,
        borderRadius: 10,
        background: '#fff',
        transition: 'left 0.2s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }} />
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

const textareaStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  color: 'var(--text)',
  fontSize: 13,
  fontFamily: 'inherit',
  outline: 'none',
  resize: 'vertical',
};
