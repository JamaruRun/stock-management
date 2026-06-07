import {
  CONTACT_BRAND, CONTACT_LOGO, CONTACT_FB_URL, CONTACT_FB_DESC,
  CONTACT_PHONE, CONTACT_LINE_ID, CONTACT_LINE_URL,
} from '@/lib/contact';

interface Props {
  variant?: 'full' | 'compact'; // full = โลโก้+แบรนด์+ปุ่ม / compact = แค่ลิงก์ติดต่อ
  style?: React.CSSProperties;
}

/**
 * บล็อกข้อมูลติดต่อ — ใช้ซ้ำได้ทั้งหน้า login, ระงับ, หมดอายุ, ตั้งค่า
 * รองรับทั้ง Server & Client component (ไม่มี hook)
 */
export default function ContactBlock({ variant = 'full', style }: Props) {
  if (variant === 'compact') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, flexWrap: 'wrap', fontSize: 12, ...style }}>
        <a href={CONTACT_FB_URL} target="_blank" rel="noopener noreferrer" style={linkSt}>
          <FbIcon /> Facebook
        </a>
        {CONTACT_LINE_URL && (
          <a href={CONTACT_LINE_URL} target="_blank" rel="noopener noreferrer" style={{ ...linkSt, color: '#06c755' }}>
            <LineIcon /> LINE
          </a>
        )}
        {CONTACT_PHONE && (
          <a href={`tel:${CONTACT_PHONE.replace(/[-\s]/g, '')}`} style={{ ...linkSt, color: '#16a34a' }}>
            ☎ {CONTACT_PHONE}
          </a>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, ...style }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <img src={CONTACT_LOGO} alt={CONTACT_BRAND} width={32} height={32} style={{ borderRadius: 8, objectFit: 'contain' }} />
        <span style={{ fontFamily: 'Prompt, sans-serif', fontWeight: 700, fontSize: 15, color: 'var(--text, #0f172a)' }}>{CONTACT_BRAND}</span>
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-dim, #64748b)', margin: 0, textAlign: 'center' }}>{CONTACT_FB_DESC}</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
        <a href={CONTACT_FB_URL} target="_blank" rel="noopener noreferrer" style={btnSt('#1877f2')}>
          <FbIcon /> Facebook
        </a>
        {CONTACT_LINE_URL && (
          <a href={CONTACT_LINE_URL} target="_blank" rel="noopener noreferrer" style={btnSt('#06c755')}>
            <LineIcon /> เพิ่มเพื่อน LINE
          </a>
        )}
        {CONTACT_PHONE && (
          <a href={`tel:${CONTACT_PHONE.replace(/[-\s]/g, '')}`} style={btnSt('#16a34a')}>
            ☎ {CONTACT_PHONE}
          </a>
        )}
      </div>
    </div>
  );
}

const linkSt: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 5,
  color: '#1877f2', textDecoration: 'none', fontWeight: 600,
};
function btnSt(color: string): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '9px 16px', borderRadius: 10, background: color, color: '#fff',
    fontSize: 13, fontWeight: 700, textDecoration: 'none', fontFamily: 'inherit',
  };
}

function FbIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M22 12a10 10 0 10-11.5 9.9v-7H8v-2.9h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6v1.8H17l-.4 2.9h-2.3v7A10 10 0 0022 12z" /></svg>;
}
function LineIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.5 2 2 5.7 2 10.2c0 4 3.6 7.4 8.4 8 .3.1.8.2.9.5.1.3.1.7 0 1l-.1.9c0 .3-.2 1 .9.6s5.9-3.5 8-6c1.5-1.6 2-3.3 2-5C22 5.7 17.5 2 12 2z" /></svg>;
}
