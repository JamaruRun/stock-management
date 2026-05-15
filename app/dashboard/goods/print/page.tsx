'use client';

import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/lib/supabase-client';
import Toast from '@/components/Toast';
import JsBarcode from 'jsbarcode';

type LabelSize = 'small' | 'medium' | 'large';

// ปรับขนาดให้ barcode ใหญ่ขึ้น เส้นหนาขึ้น margin มากขึ้น
const LABEL_CONFIGS = {
  small: { 
    perRow: 3,        // ลดจาก 4 → 3 ให้ป้ายใหญ่ขึ้น
    perPage: 18,      // 18 ใบ/หน้า
    width: '65mm',
    height: '30mm',
    barcodeWidth: 1.8,    // เพิ่มจาก 1
    barcodeHeight: 35,    // เพิ่มจาก 25
    fontSize: 11,
    label: 'เล็ก (18/หน้า A4)' 
  },
  medium: { 
    perRow: 2,        // ลดจาก 3 → 2
    perPage: 10,      // 10 ใบ/หน้า
    width: '95mm',
    height: '40mm',
    barcodeWidth: 2.5,    // เพิ่มจาก 1.5
    barcodeHeight: 50,    // เพิ่มจาก 35
    fontSize: 14,
    label: 'กลาง (10/หน้า A4) ⭐ แนะนำ' 
  },
  large: { 
    perRow: 2,
    perPage: 6,       // 6 ใบ/หน้า
    width: '95mm',
    height: '60mm',
    barcodeWidth: 3,      // เพิ่มจาก 2
    barcodeHeight: 70,    // เพิ่มจาก 45
    fontSize: 16,
    label: 'ใหญ่ (6/หน้า A4) สแกนง่ายสุด' 
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

  // Render barcode preview
  useEffect(() => {
    if (!selected || !previewRef.current) return;
    
    const config = LABEL_CONFIGS[labelSize];
    const labels = Array.from({ length: Math.min(quantity, config.perPage) });
    
    previewRef.current.innerHTML = '';
    
    labels.forEach(() => {
      const label = document.createElement('div');
      label.style.cssText = `
        width: ${config.width};
        height: ${config.height};
        border: 1px dashed #ccc;
        padding: 6px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: space-between;
        background: white;
        color: black;
        font-family: Arial, sans-serif;
        box-sizing: border-box;
      `;
      
      const nameEl = document.createElement('div');
      nameEl.style.cssText = `
        font-size: ${config.fontSize - 2}px;
        font-weight: bold;
        text-align: center;
        line-height: 1.2;
        max-height: 26px;
        overflow: hidden;
      `;
      nameEl.textContent = selected.name;
      label.appendChild(nameEl);
      
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      label.appendChild(svg);
      
      try {
        JsBarcode(svg, selected.sku, {
          format: 'CODE128',
          width: config.barcodeWidth,
          height: config.barcodeHeight,
          fontSize: config.fontSize,
          margin: 4,
          displayValue: true,
          background: '#ffffff',
          lineColor: '#000000',
          textMargin: 2,
        });
      } catch (e) {
        console.error('barcode error', e);
      }
      
      const priceEl = document.createElement('div');
      priceEl.style.cssText = `
        font-size: ${config.fontSize}px;
        font-weight: bold;
      `;
      priceEl.textContent = `฿${Number(selected.sell_price).toLocaleString()}`;
      label.appendChild(priceEl);
      
      previewRef.current!.appendChild(label);
    });
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
          <div class="name">${selected.name}</div>
          <svg class="barcode" id="bc-${i}"></svg>
          <div class="price">฿${Number(selected.sell_price).toLocaleString()}</div>
        </div>
      `;
    }

    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Barcode - ${selected.name}</title>
        <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
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
            flex-direction: column;
            align-items: center;
            justify-content: space-between;
            page-break-inside: avoid;
            background: white;
          }
          .name {
            font-size: ${config.fontSize - 2}pt;
            font-weight: bold;
            text-align: center;
            line-height: 1.2;
            max-height: 30px;
            overflow: hidden;
            margin-bottom: 2mm;
          }
          .barcode { 
            width: 100%; 
            display: block;
          }
          .price {
            font-size: ${config.fontSize}pt;
            font-weight: bold;
            margin-top: 1mm;
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
          window.addEventListener('load', function() {
            const sku = ${JSON.stringify(selected.sku)};
            for (let i = 0; i < ${quantity}; i++) {
              try {
                JsBarcode('#bc-' + i, sku, {
                  format: 'CODE128',
                  width: ${config.barcodeWidth},
                  height: ${config.barcodeHeight},
                  fontSize: ${config.fontSize},
                  margin: 4,
                  displayValue: true,
                  background: '#ffffff',
                  lineColor: '#000000',
                  textMargin: 2,
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
        <h2>ปริ้น Barcode 🖨️</h2>
        <div className="desc">เลือกสินค้า → กำหนดจำนวนใบ → ปริ้น</div>
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

            <div style={{ 
              marginTop: 12, 
              padding: 12, 
              background: 'rgba(46, 213, 115, 0.08)',
              borderLeft: '3px solid var(--success)',
              fontSize: 12,
              lineHeight: 1.6,
            }}>
              <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--success)' }}>
                💡 Tips ให้สแกนติดง่าย:
              </div>
              <div>• เลือก <strong>ขนาดกลางหรือใหญ่</strong> (สแกนง่ายกว่า)</div>
              <div>• ปริ้นบนกระดาษ <strong>สีขาวสว่าง</strong></div>
              <div>• ตั้งคุณภาพการปริ้น <strong>สูงสุด/Best</strong></div>
              <div>• หากใช้เครื่องปริ้นเลเซอร์ <strong>ใช้โหมด ดำเข้ม</strong></div>
              <div>• อย่าซูม/ย่อ ตอนปริ้น (Scale 100%)</div>
              <div>• ตอนสแกน: <strong>ห่าง 15-20cm</strong> + นิ่ง 2 วินาที</div>
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
              🖨️ ปริ้น Barcode ({quantity} ใบ)
            </button>
            <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-dim)' }}>
              💡 ระบบจะเปิดหน้าต่างใหม่ → กดปริ้น (Ctrl+P) → เลือก "Save as PDF" หรือปริ้นจริงได้
            </div>
          </div>
        </>
      )}

      {toast && <Toast {...toast} />}
    </>
  );
}
