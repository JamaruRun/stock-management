'use client';

import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/lib/supabase-client';
import Toast from '@/components/Toast';

type LabelSize = 'small' | 'medium' | 'large';

const LABEL_CONFIGS = {
  small: { 
    perRow: 4,
    perPage: 24,
    width: '47mm',
    height: '30mm',
    qrSize: 60,
    fontSize: 9,
    label: 'เล็ก (24/หน้า A4)' 
  },
  medium: { 
    perRow: 3,
    perPage: 15,
    width: '65mm',
    height: '40mm',
    qrSize: 85,
    fontSize: 11,
    label: 'กลาง (15/หน้า A4) ⭐ แนะนำ' 
  },
  large: { 
    perRow: 2,
    perPage: 8,
    width: '95mm',
    height: '50mm',
    qrSize: 110,
    fontSize: 14,
    label: 'ใหญ่ (8/หน้า A4)' 
  },
};

export default function PrintBarcodePage() {
  const supabase = createClient();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string>('');
  const [quantity, setQuantity] = useState(10);
  const [labelSize, setLabelSize] = useState<LabelSize>('medium');
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState<{ title: string; msg: string; type: string } | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  function showToast(title: string, msg: string, type: 'success' | 'danger' = 'success') {
    setToast({ title, msg, type });
    setTimeout(() => setToast(null), 2500);
  }

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('goods')
        .select('id, sku, name, sell_price, stock_qty')
        .order('name');
      setItems(data || []);
      setLoading(false);
    }
    load();
  }, []);

  const selected = items.find(i => i.id === selectedId);

  // Render preview
  useEffect(() => {
    if (!selected || !previewRef.current) return;

    async function render() {
      // โหลด qrcode library
      if (!(window as any).QRCode) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/npm/qrcode@1.5.4/build/qrcode.min.js';
          script.onload = () => resolve();
          script.onerror = () => reject();
          document.head.appendChild(script);
        });
      }

      const QRCode = (window as any).QRCode;
      const config = LABEL_CONFIGS[labelSize];
      const labels = Array.from({ length: Math.min(quantity, config.perPage) });
      
      previewRef.current!.innerHTML = '';
      
      for (const _ of labels) {
        const label = document.createElement('div');
        label.style.cssText = `
          width: ${config.width};
          height: ${config.height};
          border: 1px dashed #ccc;
          padding: 5px;
          display: flex;
          align-items: center;
          gap: 6px;
          background: white;
          color: black;
          font-family: Arial, sans-serif;
          box-sizing: border-box;
        `;
        
        // QR Code canvas
        const canvas = document.createElement('canvas');
        canvas.style.cssText = `width: ${config.qrSize}px; height: ${config.qrSize}px; flex-shrink: 0;`;
        label.appendChild(canvas);
        
        try {
          await QRCode.toCanvas(canvas, selected!.sku, {
            width: config.qrSize,
            margin: 1,
            errorCorrectionLevel: 'M',
            color: { dark: '#000000', light: '#ffffff' },
          });
        } catch (e) {
          console.error('QR error', e);
        }
        
        // Info ขวา
        const info = document.createElement('div');
        info.style.cssText = `flex: 1; min-width: 0; overflow: hidden;`;
        info.innerHTML = `
          <div style="font-size: ${config.fontSize}px; font-weight: bold; line-height: 1.2; margin-bottom: 4px; overflow: hidden;">
            ${selected!.name}
          </div>
          <div style="font-size: ${config.fontSize - 1}px; font-family: monospace; color: #666; margin-bottom: 4px;">
            ${selected!.sku}
          </div>
          <div style="font-size: ${config.fontSize + 2}px; font-weight: bold;">
            ฿${Number(selected!.sell_price).toLocaleString()}
          </div>
        `;
        label.appendChild(info);
        
        previewRef.current!.appendChild(label);
      }
    }

    render();
  }, [selected, quantity, labelSize]);

  function handlePrint() {
    if (!selected) {
      showToast('เลือกสินค้าก่อน', '', 'danger');
      return;
    }

    const config = LABEL_CONFIGS[labelSize];
    const win = window.open('', '_blank');
    if (!win) {
      showToast('Popup ถูกบล็อค', 'อนุญาต popup ในเบราว์เซอร์', 'danger');
      return;
    }

    let labelsHtml = '';
    for (let i = 0; i < quantity; i++) {
      labelsHtml += `
        <div class="label">
          <canvas id="qr-${i}" class="qr"></canvas>
          <div class="info">
            <div class="name">${selected.name}</div>
            <div class="sku">${selected.sku}</div>
            <div class="price">฿${Number(selected.sell_price).toLocaleString()}</div>
          </div>
        </div>
      `;
    }

    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>QR Code - ${selected.name}</title>
        <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.4/build/qrcode.min.js"></script>
        <style>
          @page { size: A4; margin: 8mm; }
          * { box-sizing: border-box; }
          body { 
            margin: 0; 
            padding: 0;
            font-family: Arial, sans-serif;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .grid {
            display: grid;
            grid-template-columns: repeat(${config.perRow}, 1fr);
            gap: 3mm;
            padding: 2mm;
          }
          .label {
            width: ${config.width};
            height: ${config.height};
            border: 1px solid #eee;
            padding: 3mm;
            display: flex;
            align-items: center;
            gap: 3mm;
            page-break-inside: avoid;
            background: white;
          }
          .qr {
            flex-shrink: 0;
            width: ${config.qrSize}px !important;
            height: ${config.qrSize}px !important;
          }
          .info { flex: 1; min-width: 0; overflow: hidden; }
          .name {
            font-size: ${config.fontSize}pt;
            font-weight: bold;
            line-height: 1.2;
            margin-bottom: 2mm;
            overflow: hidden;
          }
          .sku {
            font-size: ${config.fontSize - 1}pt;
            font-family: monospace;
            color: #666;
            margin-bottom: 2mm;
          }
          .price {
            font-size: ${config.fontSize + 2}pt;
            font-weight: bold;
          }
          @media print {
            .label { border: none; }
            body { margin: 0; }
          }
        </style>
      </head>
      <body>
        <div class="grid">${labelsHtml}</div>
        <script>
          window.addEventListener('load', async function() {
            const sku = ${JSON.stringify(selected.sku)};
            for (let i = 0; i < ${quantity}; i++) {
              try {
                await QRCode.toCanvas(document.getElementById('qr-' + i), sku, {
                  width: ${config.qrSize},
                  margin: 1,
                  errorCorrectionLevel: 'M',
                  color: { dark: '#000000', light: '#ffffff' },
                });
              } catch (e) { console.error(e); }
            }
            setTimeout(() => window.print(), 700);
          });
        </script>
      </body>
      </html>
    `);
    win.document.close();
  }

  const filtered = items.filter(i => {
    const s = search.toLowerCase();
    return !s || i.name.toLowerCase().includes(s) || i.sku.toLowerCase().includes(s);
  });

  if (loading) {
    return <div className="loading"><div className="spinner"></div><div>กำลังโหลด...</div></div>;
  }

  return (
    <>
      <div className="page-header">
        <h2>ปริ้น QR Code 🖨️</h2>
        <div className="desc">เลือกสินค้า → กำหนดจำนวนใบ → ปริ้น</div>
      </div>

      <div className="form-card" style={{ background: 'rgba(46, 213, 115, 0.08)', borderLeft: '3px solid var(--success)' }}>
        <div style={{ fontSize: 13, lineHeight: 1.6 }}>
          <div style={{ fontWeight: 600, marginBottom: 4, color: 'var(--success)' }}>
            ✨ เปลี่ยนเป็น QR Code แล้ว!
          </div>
          <div>QR Code อ่านง่ายกว่า barcode มาก — สแกนติดทันที ไม่ต้องปริ้นคุณภาพสูง</div>
        </div>
      </div>

      <div className="form-card">
        <h3>1. เลือกสินค้า</h3>
        <div className="search-box" style={{ marginBottom: 12 }}>
          <input type="text" placeholder="ค้นหา ชื่อ หรือ SKU..."
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div style={{ maxHeight: 280, overflowY: 'auto', border: '1px solid var(--border)' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-dim)' }}>
              ไม่พบสินค้า
            </div>
          ) : filtered.map(item => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelectedId(item.id)}
              style={{
                display: 'block',
                width: '100%',
                padding: '12px',
                background: selectedId === item.id ? 'var(--accent)' : 'transparent',
                color: selectedId === item.id ? 'var(--bg)' : 'var(--text)',
                border: 'none',
                borderBottom: '1px solid var(--border)',
                textAlign: 'left',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 14 }}>{item.name}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2, fontSize: 11 }}>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', opacity: 0.7 }}>{item.sku}</span>
                <span>฿{Number(item.sell_price).toLocaleString()} • คงเหลือ {item.stock_qty}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {selected && (
        <>
          <div className="form-card">
            <h3>2. ตั้งค่าการปริ้น</h3>
            <div className="form-grid">
              <div className="field">
                <label>จำนวนใบ</label>
                <input type="number" min="1" max="500" value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value) || 1)} />
              </div>
              <div className="field">
                <label>ขนาดป้าย</label>
                <select value={labelSize} onChange={(e) => setLabelSize(e.target.value as LabelSize)}>
                  {Object.entries(LABEL_CONFIGS).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="form-card">
            <h3>3. ตัวอย่างป้าย (แสดง {Math.min(quantity, LABEL_CONFIGS[labelSize].perPage)} จาก {quantity} ใบ)</h3>
            <div ref={previewRef} style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${LABEL_CONFIGS[labelSize].perRow}, 1fr)`,
              gap: 8,
              padding: 12,
              background: '#f5f5f5',
              maxHeight: 400,
              overflowY: 'auto',
            }}></div>
            <button className="btn" onClick={handlePrint} style={{ marginTop: 16 }}>
              🖨️ ปริ้น QR Code ({quantity} ใบ)
            </button>
            <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-dim)' }}>
              💡 ระบบจะเปิดหน้าต่างใหม่ → กดปริ้น (Ctrl+P)
            </div>
          </div>
        </>
      )}

      {toast && <Toast {...toast} />}
    </>
  );
}
