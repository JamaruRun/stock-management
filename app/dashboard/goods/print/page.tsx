'use client';

import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/lib/supabase-client';
import Toast from '@/components/Toast';
import JsBarcode from 'jsbarcode';

type LabelSize = 'small' | 'medium' | 'large';

const LABEL_CONFIGS = {
  small: { 
    perRow: 3,
    perPage: 18,
    width: '65mm',
    height: '35mm',
    qrSize: 60,
    barcodeWidth: 1.6,
    barcodeHeight: 25,
    fontSize: 10,
    label: 'เล็ก (18/หน้า A4)' 
  },
  medium: { 
    perRow: 2,
    perPage: 12,
    width: '95mm',
    height: '40mm',
    qrSize: 75,
    barcodeWidth: 2,
    barcodeHeight: 35,
    fontSize: 12,
    label: 'กลาง (12/หน้า A4) ⭐ แนะนำ' 
  },
  large: { 
    perRow: 2,
    perPage: 8,
    width: '95mm',
    height: '55mm',
    qrSize: 100,
    barcodeWidth: 2.5,
    barcodeHeight: 50,
    fontSize: 14,
    label: 'ใหญ่ (8/หน้า A4)' 
  },
};

// สร้าง QR Code เป็น Data URL (base64 PNG)
async function generateQRDataUrl(text: string, size: number): Promise<string> {
  // โหลด qrcode lib
  if (!(window as any).QRCode) {
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/qrcode@1.5.4/build/qrcode.min.js';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('โหลด QR lib ไม่สำเร็จ'));
      document.head.appendChild(script);
    });
  }

  const QRCode = (window as any).QRCode;
  return await QRCode.toDataURL(text, {
    width: size * 2, // 2x สำหรับ retina
    margin: 1,
    errorCorrectionLevel: 'M',
    color: { dark: '#000000', light: '#ffffff' },
  });
}

// สร้าง Barcode เป็น SVG string
function generateBarcodeSvg(text: string, width: number, height: number): string {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  try {
    JsBarcode(svg, text, {
      format: 'CODE128',
      width,
      height,
      fontSize: 10,
      margin: 2,
      displayValue: true,
      background: '#ffffff',
      lineColor: '#000000',
    });
    return new XMLSerializer().serializeToString(svg);
  } catch (e) {
    return '';
  }
}

export default function PrintBarcodePage() {
  const supabase = createClient();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string>('');
  const [quantity, setQuantity] = useState(10);
  const [labelSize, setLabelSize] = useState<LabelSize>('medium');
  const [search, setSearch] = useState('');
  const [printing, setPrinting] = useState(false);
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
      const config = LABEL_CONFIGS[labelSize];
      const labels = Array.from({ length: Math.min(quantity, config.perPage) });
      
      // สร้าง QR Code Data URL ครั้งเดียว
      const qrDataUrl = await generateQRDataUrl(selected!.sku, config.qrSize);
      const barcodeSvg = generateBarcodeSvg(selected!.sku, config.barcodeWidth, config.barcodeHeight);
      
      previewRef.current!.innerHTML = '';
      
      for (const _ of labels) {
        const label = document.createElement('div');
        label.style.cssText = `
          width: ${config.width};
          height: ${config.height};
          border: 1px dashed #ccc;
          padding: 4px;
          display: flex;
          gap: 5px;
          background: white;
          color: black;
          font-family: Arial, sans-serif;
          box-sizing: border-box;
        `;
        
        // QR Code (ซ้าย)
        const qrImg = document.createElement('img');
        qrImg.src = qrDataUrl;
        qrImg.style.cssText = `width: ${config.qrSize}px; height: ${config.qrSize}px; flex-shrink: 0; object-fit: contain;`;
        label.appendChild(qrImg);
        
        // Info + Barcode (ขวา)
        const right = document.createElement('div');
        right.style.cssText = `
          flex: 1; min-width: 0; overflow: hidden;
          display: flex; flex-direction: column; justify-content: space-between;
        `;
        right.innerHTML = `
          <div>
            <div style="font-size: ${config.fontSize}px; font-weight: bold; line-height: 1.2; overflow: hidden; max-height: ${config.fontSize * 2.5}px;">
              ${selected!.name}
            </div>
            <div style="font-size: ${config.fontSize + 2}px; font-weight: bold; margin-top: 2px;">
              ฿${Number(selected!.sell_price).toLocaleString()}
            </div>
          </div>
          <div style="width: 100%;">${barcodeSvg}</div>
        `;
        label.appendChild(right);
        
        previewRef.current!.appendChild(label);
      }
    }

    render();
  }, [selected, quantity, labelSize]);

  async function handlePrint() {
    if (!selected) {
      showToast('เลือกสินค้าก่อน', '', 'danger');
      return;
    }

    setPrinting(true);

    try {
      const config = LABEL_CONFIGS[labelSize];
      
      // 1. สร้าง QR + Barcode ในหน้านี้ (ที่ library โหลดแล้ว)
      const qrDataUrl = await generateQRDataUrl(selected.sku, config.qrSize);
      const barcodeSvg = generateBarcodeSvg(selected.sku, config.barcodeWidth, config.barcodeHeight);

      // 2. เปิดหน้าต่างใหม่ + ใส่ HTML ที่มี QR เป็น img + Barcode เป็น SVG inline
      const win = window.open('', '_blank');
      if (!win) {
        showToast('Popup ถูกบล็อค', 'อนุญาต popup ในเบราว์เซอร์', 'danger');
        setPrinting(false);
        return;
      }

      let labelsHtml = '';
      for (let i = 0; i < quantity; i++) {
        labelsHtml += `
          <div class="label">
            <img class="qr" src="${qrDataUrl}" alt="QR" />
            <div class="info">
              <div class="top">
                <div class="name">${selected.name}</div>
                <div class="price">฿${Number(selected.sell_price).toLocaleString()}</div>
              </div>
              <div class="barcode-wrap">${barcodeSvg}</div>
            </div>
          </div>
        `;
      }

      win.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Label - ${selected.name}</title>
          <style>
            @page { size: A4; margin: 8mm; }
            * { box-sizing: border-box; }
            body { 
              margin: 0; padding: 0;
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
              padding: 2mm;
              display: flex;
              gap: 2mm;
              page-break-inside: avoid;
              background: white;
            }
            .qr {
              width: ${config.qrSize}px;
              height: ${config.qrSize}px;
              flex-shrink: 0;
              object-fit: contain;
            }
            .info {
              flex: 1; min-width: 0; overflow: hidden;
              display: flex; flex-direction: column; justify-content: space-between;
            }
            .name {
              font-size: ${config.fontSize}pt;
              font-weight: bold;
              line-height: 1.2;
              overflow: hidden;
              max-height: ${config.fontSize * 2.5}pt;
            }
            .price {
              font-size: ${config.fontSize + 2}pt;
              font-weight: bold;
              margin-top: 1mm;
            }
            .barcode-wrap { width: 100%; margin-top: 1mm; }
            .barcode-wrap svg { width: 100%; height: auto; max-height: ${config.barcodeHeight + 14}px; }
            @media print {
              .label { border: none; }
              body { margin: 0; }
            }
          </style>
        </head>
        <body>
          <div class="grid">${labelsHtml}</div>
          <script>
            // รอ img โหลดเสร็จก่อนพิมพ์
            const imgs = document.querySelectorAll('img');
            let loaded = 0;
            const total = imgs.length;
            function check() {
              loaded++;
              if (loaded >= total) {
                setTimeout(() => window.print(), 300);
              }
            }
            imgs.forEach(img => {
              if (img.complete) check();
              else {
                img.onload = check;
                img.onerror = check;
              }
            });
            // fallback - ถ้าไม่มี img หรือมีปัญหา
            if (total === 0) setTimeout(() => window.print(), 500);
          </script>
        </body>
        </html>
      `);
      win.document.close();
    } catch (e: any) {
      showToast('เกิดข้อผิดพลาด', e.message, 'danger');
    } finally {
      setPrinting(false);
    }
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
        <h2>ปริ้นป้ายสินค้า 🖨️</h2>
        <div className="desc">QR Code + Barcode บนป้ายเดียวกัน</div>
      </div>

      <div className="form-card" style={{ background: 'rgba(46, 213, 115, 0.08)', borderLeft: '3px solid var(--success)' }}>
        <div style={{ fontSize: 13, lineHeight: 1.6 }}>
          <div style={{ fontWeight: 600, marginBottom: 4, color: 'var(--success)' }}>
            ✨ ป้ายใหม่: QR Code + Barcode
          </div>
          <div>📱 <strong>มือถือ:</strong> สแกน QR Code (อ่านง่ายมาก)</div>
          <div>🖥️ <strong>เครื่องสแกน USB:</strong> ยิงที่ Barcode ด้านล่าง</div>
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
                display: 'block', width: '100%', padding: '12px',
                background: selectedId === item.id ? 'var(--accent)' : 'transparent',
                color: selectedId === item.id ? 'var(--bg)' : 'var(--text)',
                border: 'none', borderBottom: '1px solid var(--border)',
                textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
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
            <button className="btn" onClick={handlePrint} disabled={printing} style={{ marginTop: 16 }}>
              {printing ? 'กำลังเตรียม...' : `🖨️ ปริ้น ${quantity} ใบ`}
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
