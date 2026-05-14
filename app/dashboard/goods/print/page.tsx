'use client';

import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/lib/supabase-client';
import Toast from '@/components/Toast';
import JsBarcode from 'jsbarcode';

type LabelSize = 'small' | 'medium' | 'large';

const LABEL_CONFIGS = {
  small: { perRow: 4, perPage: 24, width: '50mm', height: '25mm', label: 'เล็ก (24/หน้า)' },
  medium: { perRow: 3, perPage: 18, width: '65mm', height: '30mm', label: 'กลาง (18/หน้า)' },
  large: { perRow: 2, perPage: 10, width: '95mm', height: '50mm', label: 'ใหญ่ (10/หน้า)' },
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
    
    labels.forEach((_, idx) => {
      const label = document.createElement('div');
      label.className = 'barcode-label';
      label.style.cssText = `
        width: ${config.width};
        height: ${config.height};
        border: 1px dashed #ccc;
        padding: 4px;
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
        font-size: ${labelSize === 'small' ? '8px' : labelSize === 'medium' ? '10px' : '12px'};
        font-weight: bold;
        text-align: center;
        line-height: 1.2;
        max-height: ${labelSize === 'small' ? '20px' : '30px'};
        overflow: hidden;
      `;
      nameEl.textContent = selected.name;
      label.appendChild(nameEl);
      
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      label.appendChild(svg);
      
      try {
        JsBarcode(svg, selected.sku, {
          format: 'CODE128',
          width: labelSize === 'small' ? 1 : labelSize === 'medium' ? 1.5 : 2,
          height: labelSize === 'small' ? 25 : labelSize === 'medium' ? 35 : 45,
          fontSize: labelSize === 'small' ? 9 : labelSize === 'medium' ? 11 : 13,
          margin: 2,
          displayValue: true,
        });
      } catch (e) {
        console.error('barcode error', e);
      }
      
      const priceEl = document.createElement('div');
      priceEl.style.cssText = `
        font-size: ${labelSize === 'small' ? '10px' : labelSize === 'medium' ? '12px' : '14px'};
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

    // สร้าง HTML สำหรับปริ้น
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
          @page { size: A4; margin: 5mm; }
          * { box-sizing: border-box; }
          body { 
            margin: 0; 
            padding: 0;
            font-family: Arial, sans-serif;
          }
          .grid {
            display: grid;
            grid-template-columns: repeat(${config.perRow}, 1fr);
            gap: 2mm;
            padding: 2mm;
          }
          .label {
            width: ${config.width};
            height: ${config.height};
            border: 1px solid #ddd;
            padding: 2mm;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: space-between;
            page-break-inside: avoid;
            background: white;
          }
          .name {
            font-size: ${labelSize === 'small' ? '8pt' : labelSize === 'medium' ? '10pt' : '12pt'};
            font-weight: bold;
            text-align: center;
            line-height: 1.2;
            max-height: ${labelSize === 'small' ? '20px' : '30px'};
            overflow: hidden;
          }
          .barcode { width: 100%; }
          .price {
            font-size: ${labelSize === 'small' ? '10pt' : labelSize === 'medium' ? '12pt' : '14pt'};
            font-weight: bold;
          }
          @media print {
            .label { border: none; }
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
                  width: ${labelSize === 'small' ? 1 : labelSize === 'medium' ? 1.5 : 2},
                  height: ${labelSize === 'small' ? 25 : labelSize === 'medium' ? 35 : 45},
                  fontSize: ${labelSize === 'small' ? 9 : labelSize === 'medium' ? 11 : 13},
                  margin: 2,
                  displayValue: true,
                });
              } catch (e) { console.error(e); }
            }
            setTimeout(() => window.print(), 500);
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
            <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-dim)' }}>
              💡 จะปริ้นบนกระดาษ A4 — เลือกขนาดป้ายตามความเหมาะสมกับสติ๊กเกอร์ที่มี
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
