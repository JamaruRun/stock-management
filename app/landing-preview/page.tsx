'use client';

import { useState } from 'react';

type Style = 'luxe' | 'dark' | 'pastel' | 'bold';

const STYLES: { id: Style; name: string; emoji: string; desc: string }[] = [
  { id: 'luxe', name: 'Apple Luxe', emoji: '🤍', desc: 'ขาว สะอาด มินิมอล Premium' },
  { id: 'dark', name: 'Dark Luxury', emoji: '🖤', desc: 'ดำ ทอง ดูแพง เหมือนแบรนด์หรู' },
  { id: 'pastel', name: 'Soft Pastel', emoji: '🌸', desc: 'อ่อนโยน เป็นมิตร friendly' },
  { id: 'bold', name: 'Bold Modern', emoji: '🌈', desc: 'สีสด gradient จัดจ้าน wow' },
];

export default function LandingPreview() {
  const [style, setStyle] = useState<Style>('luxe');

  return (
    <>
      {/* Style switcher - bar ด้านบน */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        background: 'rgba(15, 23, 42, 0.95)',
        backdropFilter: 'blur(20px)',
        zIndex: 100,
        padding: 12,
        display: 'flex',
        gap: 8,
        justifyContent: 'center',
        flexWrap: 'wrap',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
      }}>
        <div style={{ color: '#fff', fontSize: 11, opacity: 0.7, alignSelf: 'center', marginRight: 8 }}>
          🎨 ลองคลิกเลือกสไตล์:
        </div>
        {STYLES.map(s => (
          <button
            key={s.id}
            onClick={() => setStyle(s.id)}
            style={{
              padding: '8px 14px',
              background: style === s.id ? '#fff' : 'rgba(255,255,255,0.1)',
              color: style === s.id ? '#000' : '#fff',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600,
              fontFamily: 'inherit',
            }}
          >
            {s.emoji} {s.name}
          </button>
        ))}
      </div>

      <div style={{ paddingTop: 60 }}>
        {style === 'luxe' && <LuxeStyle />}
        {style === 'dark' && <DarkStyle />}
        {style === 'pastel' && <PastelStyle />}
        {style === 'bold' && <BoldStyle />}
      </div>
    </>
  );
}

// ════════════════════════════════════════
// STYLE 1: APPLE LUXE
// ════════════════════════════════════════
function LuxeStyle() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #fafafa 0%, #fff 50%, #f5f5f7 100%)',
      fontFamily: '-apple-system, "SF Pro Display", system-ui, sans-serif',
      color: '#1d1d1f',
    }}>
      {/* Hero */}
      <section style={{ padding: '60px 24px 40px', textAlign: 'center', maxWidth: 720, margin: '0 auto' }}>
        <div style={{
          display: 'inline-block',
          padding: '4px 14px',
          background: 'rgba(0,0,0,0.06)',
          borderRadius: 100,
          fontSize: 11,
          fontWeight: 500,
          letterSpacing: 1,
          textTransform: 'uppercase',
          marginBottom: 24,
        }}>
          STOCK MANAGER
        </div>
        <h1 style={{
          fontSize: 42,
          fontWeight: 700,
          letterSpacing: '-1.5px',
          lineHeight: 1.1,
          marginBottom: 16,
          background: 'linear-gradient(135deg, #000 0%, #555 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}>
          จัดการร้านมือถือ<br />อย่างมืออาชีพ
        </h1>
        <p style={{
          fontSize: 17,
          color: '#86868b',
          lineHeight: 1.5,
          marginBottom: 32,
          maxWidth: 480,
          margin: '0 auto 32px',
        }}>
          ระบบครบ ใช้ง่าย ตั้งแต่สต๊อก จำนำ ผ่อน ซ่อม ครบจบในที่เดียว
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button style={{
            padding: '14px 28px',
            background: '#000',
            color: '#fff',
            border: 'none',
            borderRadius: 100,
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            letterSpacing: 0.2,
          }}>
            ทดลองใช้ฟรี 30 วัน →
          </button>
          <button style={{
            padding: '14px 28px',
            background: 'rgba(0,0,0,0.05)',
            color: '#000',
            border: 'none',
            borderRadius: 100,
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
          }}>
            เข้าสู่ระบบ
          </button>
        </div>
      </section>

      {/* Features */}
      <section style={{ padding: '40px 16px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 14,
        }}>
          {[
            { icon: '📱', title: 'จัดการสต๊อกเครื่อง', desc: 'IMEI · barcode · multi-supplier' },
            { icon: '🛠️', title: 'รับซ่อม + ใช้อะไหล่', desc: 'ตัดสต๊อก auto · คำนวณกำไร' },
            { icon: '💰', title: 'จำนำ + ผ่อน', desc: 'ติดตามครบทุกใบ พร้อมแจ้งเตือน' },
          ].map((f, i) => (
            <div key={i} style={{
              padding: 28,
              background: '#fff',
              borderRadius: 18,
              border: '1px solid rgba(0,0,0,0.06)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}>
              <div style={{ fontSize: 36, marginBottom: 14 }}>{f.icon}</div>
              <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 6, letterSpacing: '-0.3px' }}>
                {f.title}
              </h3>
              <p style={{ fontSize: 14, color: '#86868b', lineHeight: 1.5 }}>
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section style={{ padding: '40px 16px', textAlign: 'center' }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: '#86868b', letterSpacing: 2, marginBottom: 12 }}>
          PRICING
        </p>
        <h2 style={{ fontSize: 28, fontWeight: 700, marginBottom: 24, letterSpacing: '-0.8px' }}>
          ราคาตรงไปตรงมา
        </h2>
        <div style={{
          display: 'inline-flex',
          gap: 4,
          padding: 4,
          background: 'rgba(0,0,0,0.05)',
          borderRadius: 100,
        }}>
          <div style={{ padding: '12px 24px', borderRadius: 100 }}>
            <div style={{ fontSize: 12, color: '#86868b' }}>เริ่มต้น</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>199฿/ด</div>
          </div>
          <div style={{ padding: '12px 24px', background: '#000', color: '#fff', borderRadius: 100 }}>
            <div style={{ fontSize: 12, opacity: 0.6 }}>Lifetime ⭐</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>7,900฿</div>
          </div>
        </div>
      </section>
    </div>
  );
}

// ════════════════════════════════════════
// STYLE 2: DARK LUXURY
// ════════════════════════════════════════
function DarkStyle() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse at top, #1a1410 0%, #0a0a0a 50%, #000 100%)',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      color: '#fff',
      overflow: 'hidden',
      position: 'relative',
    }}>
      {/* Glow effect */}
      <div style={{
        position: 'absolute',
        top: '10%',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 600,
        height: 600,
        background: 'radial-gradient(circle, rgba(212, 175, 55, 0.15) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <section style={{ padding: '60px 24px 40px', textAlign: 'center', maxWidth: 720, margin: '0 auto', position: 'relative' }}>
        <div style={{
          display: 'inline-block',
          padding: '6px 18px',
          background: 'linear-gradient(135deg, #d4af37, #f4e4a1, #d4af37)',
          borderRadius: 100,
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 2,
          color: '#1a1410',
          marginBottom: 28,
          textTransform: 'uppercase',
        }}>
          ✦ PREMIUM EDITION
        </div>
        <h1 style={{
          fontSize: 46,
          fontWeight: 800,
          letterSpacing: '-1.5px',
          lineHeight: 1.05,
          marginBottom: 18,
          background: 'linear-gradient(135deg, #fff 0%, #d4af37 50%, #fff 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}>
          ยกระดับร้านคุณ<br />ด้วยระบบระดับพรีเมียม
        </h1>
        <p style={{
          fontSize: 16,
          color: 'rgba(255,255,255,0.6)',
          lineHeight: 1.6,
          marginBottom: 32,
          maxWidth: 480,
          margin: '0 auto 32px',
        }}>
          ระบบจัดการร้านมือถือที่สวยงาม · ทรงพลัง · ใช้ง่าย
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button style={{
            padding: '14px 32px',
            background: 'linear-gradient(135deg, #d4af37, #f4e4a1)',
            color: '#1a1410',
            border: 'none',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 700,
            cursor: 'pointer',
            letterSpacing: 0.5,
            boxShadow: '0 8px 24px rgba(212, 175, 55, 0.3)',
          }}>
            ✦ ทดลองใช้ฟรี 30 วัน
          </button>
          <button style={{
            padding: '14px 32px',
            background: 'rgba(255,255,255,0.05)',
            color: '#fff',
            border: '1px solid rgba(212, 175, 55, 0.3)',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            backdropFilter: 'blur(10px)',
          }}>
            เข้าสู่ระบบ
          </button>
        </div>
      </section>

      <section style={{ padding: '40px 16px', maxWidth: 1100, margin: '0 auto', position: 'relative' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 14,
        }}>
          {[
            { icon: '📱', title: 'จัดการสต๊อกเครื่อง', desc: 'IMEI · barcode · multi-supplier' },
            { icon: '🛠️', title: 'รับซ่อม + ใช้อะไหล่', desc: 'ตัดสต๊อก auto · คำนวณกำไร' },
            { icon: '💰', title: 'จำนำ + ผ่อน', desc: 'ติดตามครบทุกใบ' },
          ].map((f, i) => (
            <div key={i} style={{
              padding: 28,
              background: 'linear-gradient(135deg, rgba(255,255,255,0.03), rgba(212, 175, 55, 0.05))',
              borderRadius: 16,
              border: '1px solid rgba(212, 175, 55, 0.15)',
              backdropFilter: 'blur(20px)',
            }}>
              <div style={{
                width: 56,
                height: 56,
                borderRadius: 14,
                background: 'linear-gradient(135deg, #d4af37, #b8941f)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 28,
                marginBottom: 16,
              }}>{f.icon}</div>
              <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>{f.title}</h3>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section style={{ padding: '40px 16px', textAlign: 'center', position: 'relative' }}>
        <p style={{ 
          fontSize: 10, 
          fontWeight: 700, 
          color: '#d4af37', 
          letterSpacing: 3, 
          marginBottom: 12,
        }}>
          ✦ INVESTMENT
        </p>
        <h2 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>
          Lifetime <span style={{ color: '#d4af37' }}>7,900฿</span>
        </h2>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
          จ่ายครั้งเดียว ใช้ตลอดชีพ
        </p>
      </section>
    </div>
  );
}

// ════════════════════════════════════════
// STYLE 3: SOFT PASTEL
// ════════════════════════════════════════
function PastelStyle() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #fce7f3 0%, #e0e7ff 50%, #fef3c7 100%)',
      fontFamily: '"Nunito", system-ui, sans-serif',
      color: '#374151',
      position: 'relative',
    }}>
      {/* Decorative bubbles */}
      <div style={{
        position: 'absolute',
        top: 100,
        right: 40,
        width: 120,
        height: 120,
        borderRadius: '50%',
        background: 'rgba(244, 114, 182, 0.2)',
        filter: 'blur(40px)',
      }} />
      <div style={{
        position: 'absolute',
        top: 200,
        left: 40,
        width: 80,
        height: 80,
        borderRadius: '50%',
        background: 'rgba(167, 139, 250, 0.2)',
        filter: 'blur(30px)',
      }} />

      <section style={{ padding: '60px 24px 40px', textAlign: 'center', maxWidth: 720, margin: '0 auto', position: 'relative' }}>
        <div style={{
          display: 'inline-block',
          padding: '6px 18px',
          background: 'rgba(255,255,255,0.7)',
          borderRadius: 100,
          fontSize: 12,
          fontWeight: 700,
          color: '#ec4899',
          marginBottom: 24,
          backdropFilter: 'blur(10px)',
        }}>
          🌸 ระบบใหม่ ใจดี ใช้ง่าย
        </div>
        <h1 style={{
          fontSize: 40,
          fontWeight: 800,
          lineHeight: 1.15,
          marginBottom: 18,
          color: '#1e1b4b',
        }}>
          เปลี่ยนร้านมือถือ<br />
          <span style={{
            background: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            ให้สนุกกว่าเดิม ✨
          </span>
        </h1>
        <p style={{
          fontSize: 16,
          color: '#6b7280',
          lineHeight: 1.6,
          marginBottom: 32,
          maxWidth: 480,
          margin: '0 auto 32px',
        }}>
          ระบบที่ออกแบบมาเพื่อคุณ ใช้ง่ายเหมือนเล่นเกม
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button style={{
            padding: '14px 30px',
            background: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)',
            color: '#fff',
            border: 'none',
            borderRadius: 100,
            fontSize: 14,
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 10px 30px rgba(236, 72, 153, 0.3)',
          }}>
            🎁 ทดลองฟรี 30 วัน
          </button>
          <button style={{
            padding: '14px 30px',
            background: 'rgba(255,255,255,0.8)',
            color: '#374151',
            border: '2px solid rgba(236, 72, 153, 0.2)',
            borderRadius: 100,
            fontSize: 14,
            fontWeight: 700,
            cursor: 'pointer',
          }}>
            เข้าสู่ระบบ
          </button>
        </div>
      </section>

      <section style={{ padding: '40px 16px', maxWidth: 1100, margin: '0 auto', position: 'relative' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 16,
        }}>
          {[
            { icon: '📱', title: 'จัดการสต๊อกเครื่อง', desc: 'IMEI · barcode · multi-supplier', color: '#fce7f3' },
            { icon: '🛠️', title: 'รับซ่อม + ใช้อะไหล่', desc: 'ตัดสต๊อก auto', color: '#e0e7ff' },
            { icon: '💰', title: 'จำนำ + ผ่อน', desc: 'ติดตามครบทุกใบ', color: '#fef3c7' },
          ].map((f, i) => (
            <div key={i} style={{
              padding: 28,
              background: 'rgba(255,255,255,0.7)',
              borderRadius: 24,
              border: '1px solid rgba(255,255,255,0.5)',
              backdropFilter: 'blur(10px)',
              boxShadow: '0 10px 30px rgba(0,0,0,0.04)',
            }}>
              <div style={{
                width: 56,
                height: 56,
                borderRadius: 16,
                background: f.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 28,
                marginBottom: 14,
              }}>{f.icon}</div>
              <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 6, color: '#1e1b4b' }}>
                {f.title}
              </h3>
              <p style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// ════════════════════════════════════════
// STYLE 4: BOLD MODERN
// ════════════════════════════════════════
function BoldStyle() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)',
      fontFamily: '"Inter", system-ui, sans-serif',
      color: '#fff',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Bold geometric shapes */}
      <div style={{
        position: 'absolute',
        top: -100,
        right: -100,
        width: 400,
        height: 400,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(255,255,255,0.2) 0%, transparent 70%)',
      }} />

      <section style={{ padding: '60px 24px 40px', textAlign: 'center', maxWidth: 720, margin: '0 auto', position: 'relative' }}>
        <div style={{
          display: 'inline-block',
          padding: '6px 18px',
          background: '#fff',
          borderRadius: 6,
          fontSize: 10,
          fontWeight: 800,
          color: '#764ba2',
          marginBottom: 28,
          letterSpacing: 2,
          textTransform: 'uppercase',
        }}>
          ⚡ NEW · STOCK MANAGER
        </div>
        <h1 style={{
          fontSize: 56,
          fontWeight: 900,
          lineHeight: 1,
          marginBottom: 20,
          letterSpacing: '-2px',
          textShadow: '0 10px 40px rgba(0,0,0,0.2)',
        }}>
          ระบบร้านมือถือ<br />
          <span style={{
            background: 'linear-gradient(135deg, #fff 0%, #f093fb 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            ที่ดีที่สุด.
          </span>
        </h1>
        <p style={{
          fontSize: 17,
          color: 'rgba(255,255,255,0.85)',
          lineHeight: 1.5,
          marginBottom: 32,
          maxWidth: 480,
          margin: '0 auto 32px',
          fontWeight: 500,
        }}>
          ครบ. เร็ว. แรง. ทุกฟีเจอร์ที่ร้านมือถือต้องการ
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button style={{
            padding: '16px 32px',
            background: '#fff',
            color: '#764ba2',
            border: 'none',
            borderRadius: 12,
            fontSize: 15,
            fontWeight: 800,
            cursor: 'pointer',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
          }}>
            🚀 เริ่มทดลองฟรี
          </button>
          <button style={{
            padding: '16px 32px',
            background: 'rgba(0,0,0,0.2)',
            color: '#fff',
            border: '2px solid rgba(255,255,255,0.3)',
            borderRadius: 12,
            fontSize: 15,
            fontWeight: 700,
            cursor: 'pointer',
            backdropFilter: 'blur(20px)',
          }}>
            ดูเดโม่ →
          </button>
        </div>
      </section>

      <section style={{ padding: '40px 16px', maxWidth: 1100, margin: '0 auto', position: 'relative' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 16,
        }}>
          {[
            { icon: '📱', title: 'STOCK', desc: 'IMEI · barcode · multi-supplier', color: 'linear-gradient(135deg, #f093fb, #f5576c)' },
            { icon: '🛠️', title: 'REPAIR', desc: 'ตัดสต๊อก auto · คำนวณกำไร', color: 'linear-gradient(135deg, #4facfe, #00f2fe)' },
            { icon: '💰', title: 'PAWN+', desc: 'ติดตามครบทุกใบ', color: 'linear-gradient(135deg, #fa709a, #fee140)' },
          ].map((f, i) => (
            <div key={i} style={{
              padding: 28,
              background: 'rgba(0,0,0,0.25)',
              borderRadius: 20,
              border: '1px solid rgba(255,255,255,0.15)',
              backdropFilter: 'blur(20px)',
            }}>
              <div style={{
                width: 60,
                height: 60,
                borderRadius: 16,
                background: f.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 30,
                marginBottom: 16,
                boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
              }}>{f.icon}</div>
              <h3 style={{ 
                fontSize: 22, 
                fontWeight: 900, 
                marginBottom: 6,
                letterSpacing: '-0.5px',
              }}>{f.title}</h3>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 1.6 }}>
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
