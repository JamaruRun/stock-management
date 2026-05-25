'use client';

import { useState, useEffect } from 'react';
import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';

interface LabelItem {
  shopName?: string;
  productName: string;
  variant?: string;
  price?: number;
  code: string;
  showBarcode?: boolean;
  showQR?: boolean;
}

interface Props {
  items: LabelItem[];
  copies?: number;
  onClose: () => void;
}

export default function LabelPrint30x20({ items, copies: initialCopies = 1, onClose }: Props) {
  const [copies, setCopies] = useState(initialCopies);
  const [labels, setLabels] = useState<Array<LabelItem & { barcodeUrl?: string; qrUrl?: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function generate() {
      setLoading(true);
      const allItems: LabelItem[] = [];
      for (const item of items) {
        for (let i = 0; i < copies; i++) {
          allItems.push(item);
        }
      }

      const generated = await Promise.all(
        allItems.map(async (item) => {
          let barcodeUrl: string | undefined;
          let qrUrl: string | undefined;

          if (item.showBarcode !== false && item.code) {
            try {
              const canvas = document.createElement('canvas');
              JsBarcode(canvas, item.code, {
                format: 'CODE128',
                width: 1.4,
                height: 30,
                displayValue: false,
                margin: 0,
              });
              barcodeUrl = canvas.toDataURL('image/png');
            } catch (e) {
              console.warn('Barcode err:', e);
            }
          }

          if (item.showQR !== false && item.code) {
            try {
              qrUrl = await QRCode.toDataURL(item.code, {
                width: 100,
                margin: 0,
                errorCorrectionLevel: 'M',
              });
            } catch (e) {
              console.warn('QR err:', e);
            }
          }

          return { ...item, barcodeUrl, qrUrl };
        })
      );

      setLabels(generated);
      setLoading(false);
    }
    generate();
  }, [items, copies]);

  // ⭐ NEW: เปิดหน้า print window ใหม่ → ใช้ window.print() ในนั้น
  // วิธีนี้แก้ปัญหา CSS print กับ Next.js styled-jsx
  function handlePrint() {
    if (labels.length === 0) return;

    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (!printWindow) {
      alert('โปรดอนุญาต Pop-up ใน browser');
      return;
    }

    // สร้าง HTML ของป้ายทั้งหมด
    const labelsHtml = labels.map(label => `
      <div class="label-page">
        <div class="label-top">
          ${label.shopName ? `<div class="label-shop">${escapeHtml(label.shopName)}</div>` : ''}
          <div class="label-name">${escapeHtml(label.productName)}</div>
          ${label.variant ? `<div class="label-variant">${escapeHtml(label.variant)}</div>` : ''}
        </div>
        <div class="label-mid">
          ${label.barcodeUrl ? `<img class="label-barcode" src="${label.barcodeUrl}" />` : ''}
          ${label.qrUrl ? `<img class="label-qr" src="${label.qrUrl}" />` : ''}
        </div>
        <div class="label-bot">
          <span class="label-code">${escapeHtml(label.code)}</span>
          ${label.price !== undefined && label.price > 0 
            ? `<span class="label-price">฿${Number(label.price).toLocaleString()}</span>` 
            : ''}
        </div>
      </div>
    `).join('');

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Print Labels</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    @page {
      size: 30mm 20mm;
      margin: 0;
    }
    
    html, body {
      width: 30mm;
      margin: 0;
      padding: 0;
      background: white;
      font-family: Arial, "Noto Sans Thai", sans-serif;
    }
    
    .label-page {
      width: 30mm;
      height: 20mm;
      padding: 0.5mm;
      page-break-after: always;
      page-break-inside: avoid;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      overflow: hidden;
      color: #000;
      background: white;
    }
    
    .label-page:last-child {
      page-break-after: auto;
    }
    
    .label-top {
      text-align: center;
      line-height: 1.05;
      flex: 0 0 auto;
    }
    
    .label-shop {
      font-size: 5pt;
      font-weight: 700;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    .label-name {
      font-size: 6pt;
      font-weight: 700;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    .label-variant {
      font-size: 4.5pt;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    .label-mid {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5mm;
      flex: 1 1 auto;
      min-height: 0;
    }
    
    .label-barcode {
      height: 6mm;
      max-width: 18mm;
      object-fit: contain;
    }
    
    .label-qr {
      height: 7mm;
      width: 7mm;
    }
    
    .label-bot {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      flex: 0 0 auto;
      line-height: 1;
    }
    
    .label-code {
      font-size: 4pt;
      font-family: monospace;
    }
    
    .label-price {
      font-size: 7pt;
      font-weight: 700;
    }
    
    /* Toolbar ที่แสดงบนหน้าจอ - ไม่ปริ้น */
    .toolbar {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: #1e40af;
      color: white;
      padding: 12px;
      text-align: center;
      z-index: 9999;
      display: flex;
      gap: 8px;
      justify-content: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    }
    
    .toolbar button {
      padding: 8px 16px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 700;
    }
    
    .toolbar .btn-print {
      background: white;
      color: #1e40af;
    }
    
    .toolbar .btn-close {
      background: rgba(255,255,255,0.2);
      color: white;
    }
    
    body {
      padding-top: 60px;
    }
    
    /* แสดง preview ของแต่ละป้ายบนหน้าจอ */
    @media screen {
      body {
        background: #f3f4f6;
        padding: 70px 12px 20px;
        width: auto;
      }
      
      .label-page {
        margin: 0 auto 4px;
        border: 1px dashed #999;
        background: white;
      }
    }
    
    @media print {
      .toolbar { display: none !important; }
      body { padding: 0 !important; background: white !important; }
      .label-page { border: none !important; margin: 0 !important; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <button class="btn-print" onclick="window.print()">🖨️ ปริ้น ${labels.length} ป้าย</button>
    <button class="btn-close" onclick="window.close()">✕ ปิด</button>
  </div>
  ${labelsHtml}
  <script>
    // Auto open print dialog หลังโหลดเสร็จ
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 300);
    };
  </script>
</body>
</html>`;

    printWindow.document.write(html);
    printWindow.document.close();
  }

  return (
    <div className="modal-overlay" style={{ alignItems: 'center', padding: 12 }}>
      <div className="modal" style={{ 
        maxWidth: 540, 
        width: '100%',
        maxHeight: '95vh',
        overflow: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <div>
            <h3 style={{ margin: 0 }}>🏷️ ปริ้นป้ายราคา 30×20mm</h3>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-dim)' }}>
              ทั้งหมด {labels.length} ดวง • สำหรับเครื่อง Easy Print
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'var(--surface-2)',
              border: 'none',
              borderRadius: '50%',
              width: 32, height: 32,
              cursor: 'pointer',
              fontSize: 14,
              color: 'var(--text)',
              fontFamily: 'inherit',
            }}
          >✕</button>
        </div>

        {/* คำแนะนำ */}
        <div style={{
          padding: 12,
          background: 'rgba(59, 130, 246, 0.08)',
          borderLeft: '3px solid var(--accent)',
          borderRadius: 6,
          marginBottom: 14,
          fontSize: 12,
          lineHeight: 1.6,
        }}>
          <strong>💡 วิธีใช้:</strong>
          <ol style={{ marginLeft: 18, marginTop: 4 }}>
            <li>กดปุ่ม <strong>🖨️ เปิดหน้าปริ้น</strong></li>
            <li>หน้าต่างใหม่จะเปิด + แสดง preview ป้าย</li>
            <li>เลือก <strong>Easy Print</strong> + กระดาษ <strong>30×20mm</strong></li>
            <li>Margin: 0 / Scale: 100% → กด Print</li>
          </ol>
        </div>

        {/* Copies selector */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ 
            fontSize: 12, 
            fontWeight: 600, 
            color: 'var(--text)',
            display: 'block',
            marginBottom: 8,
          }}>
            🔢 จำนวนสำเนา/ชิ้น
          </label>
          <div style={{ 
            display: 'flex', 
            gap: 6, 
            alignItems: 'center',
            flexWrap: 'wrap',
          }}>
            {[1, 2, 3, 5, 10].map(n => (
              <button
                key={n}
                type="button"
                onClick={() => setCopies(n)}
                style={{
                  padding: '8px 16px',
                  background: copies === n ? 'var(--accent)' : 'var(--surface-2)',
                  color: copies === n ? '#fff' : 'var(--text)',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  fontSize: 13,
                  fontWeight: 600,
                  minWidth: 44,
                }}
              >×{n}</button>
            ))}
            <input
              type="number"
              value={copies}
              onChange={(e) => {
                const v = parseInt(e.target.value);
                if (v > 0 && v <= 100) setCopies(v);
              }}
              min="1"
              max="100"
              style={{
                width: 70,
                padding: 8,
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                color: 'var(--text)',
                fontFamily: 'inherit',
                fontSize: 13,
                textAlign: 'center',
              }}
            />
            <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
              = {items.length * copies} ป้ายรวม
            </span>
          </div>
        </div>

        {/* รายการ items */}
        {items.length > 1 && (
          <div style={{
            padding: 10,
            background: 'var(--surface-2)',
            borderRadius: 6,
            marginBottom: 14,
            maxHeight: 120,
            overflow: 'auto',
          }}>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 6, fontWeight: 600 }}>
              📦 จะปริ้น {items.length} รายการ
            </div>
            {items.map((it, i) => (
              <div key={i} style={{ 
                fontSize: 11, 
                padding: '4px 0',
                borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                display: 'flex',
                justifyContent: 'space-between',
              }}>
                <span>{it.productName}</span>
                <span style={{ color: 'var(--accent)' }}>×{copies}</span>
              </div>
            ))}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <div style={{
              width: 40, height: 40,
              margin: '0 auto 12px',
              border: '3px solid var(--border)',
              borderTopColor: 'var(--accent)',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }}/>
            <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>
              กำลังสร้างป้าย...
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : (
          <>
            {/* Preview - ใช้ inline div ธรรมดา */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8, fontWeight: 600 }}>
                👁️ ตัวอย่าง (ขนาดจริง)
              </div>
              <div style={{
                background: 'var(--surface-2)',
                padding: 16,
                borderRadius: 8,
                display: 'flex',
                flexWrap: 'wrap',
                gap: 8,
                justifyContent: 'center',
                maxHeight: 280,
                overflow: 'auto',
              }}>
                {labels.slice(0, 6).map((label, idx) => (
                  <PreviewLabel key={idx} label={label} />
                ))}
                {labels.length > 6 && (
                  <div style={{ 
                    width: '100%', 
                    textAlign: 'center', 
                    fontSize: 11, 
                    color: 'var(--text-dim)',
                    marginTop: 8,
                  }}>
                    ... และอีก {labels.length - 6} ดวง
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={onClose} className="btn btn-sec">
                ยกเลิก
              </button>
              <button onClick={handlePrint} className="btn">
                🖨️ เปิดหน้าปริ้น ({labels.length})
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function PreviewLabel({ label }: { label: any }) {
  return (
    <div style={{
      width: '30mm',
      height: '20mm',
      background: 'white',
      color: 'black',
      border: '1px dashed #999',
      padding: '0.5mm',
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      overflow: 'hidden',
      fontFamily: 'Arial, sans-serif',
    }}>
      <div style={{ textAlign: 'center', lineHeight: 1.05, flex: '0 0 auto' }}>
        {label.shopName && (
          <div style={{ fontSize: '5pt', fontWeight: 700, color: '#000', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {label.shopName}
          </div>
        )}
        <div style={{ fontSize: '6pt', fontWeight: 700, color: '#000', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {label.productName}
        </div>
        {label.variant && (
          <div style={{ fontSize: '4.5pt', color: '#000', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {label.variant}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5mm', flex: '1 1 auto', minHeight: 0 }}>
        {label.barcodeUrl && (
          <img src={label.barcodeUrl} alt="b" style={{ height: '6mm', maxWidth: label.qrUrl ? '18mm' : '28mm', objectFit: 'contain' }} />
        )}
        {label.qrUrl && (
          <img src={label.qrUrl} alt="q" style={{ height: '7mm', width: '7mm' }} />
        )}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flex: '0 0 auto', lineHeight: 1 }}>
        <div style={{ fontSize: '4pt', color: '#000', fontFamily: 'monospace' }}>
          {label.code}
        </div>
        {label.price !== undefined && label.price > 0 && (
          <div style={{ fontSize: '7pt', fontWeight: 700, color: '#000' }}>
            ฿{Number(label.price).toLocaleString()}
          </div>
        )}
      </div>
    </div>
  );
}
