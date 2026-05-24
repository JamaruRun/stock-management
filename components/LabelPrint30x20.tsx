'use client';

import { useState, useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';

interface LabelItem {
  // ข้อมูลที่จะแสดง
  shopName?: string;        // ชื่อร้าน
  productName: string;      // ชื่อสินค้า (iPhone 13, แบต A12 ฯลฯ)
  variant?: string;         // รุ่น/สี/สเปค หรือ Used/New
  price?: number;           // ราคา
  code: string;             // รหัส (SKU/IMEI)
  showBarcode?: boolean;    // แสดง barcode
  showQR?: boolean;         // แสดง QR code
}

interface Props {
  items: LabelItem[];       // หลายป้าย → พิมพ์ทีเดียวได้
  copies?: number;          // จำนวนสำเนาต่อชิ้น
  onClose: () => void;
}

export default function LabelPrint30x20({ items, copies = 1, onClose }: Props) {
  const [labels, setLabels] = useState<Array<LabelItem & { barcodeUrl?: string; qrUrl?: string }>>([]);
  const [loading, setLoading] = useState(true);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function generate() {
      // ทำสำเนาตามจำนวน copies
      const allItems: LabelItem[] = [];
      for (const item of items) {
        for (let i = 0; i < copies; i++) {
          allItems.push(item);
        }
      }

      // Generate barcode + QR สำหรับแต่ละชิ้น
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
              console.warn('Barcode generation failed:', e);
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
              console.warn('QR generation failed:', e);
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

  function handlePrint() {
    window.print();
  }

  return (
    <>
      {/* CSS สำหรับการพิมพ์ - 30x20mm ต่อหน้า */}
      <style jsx global>{`
        @media print {
          /* ซ่อนทุกอย่างนอกจาก labels */
          body * {
            visibility: hidden;
          }
          #label-print-area, #label-print-area * {
            visibility: visible;
          }
          #label-print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 30mm;
          }
          
          @page {
            size: 30mm 20mm;
            margin: 0;
          }
          
          .label-page {
            width: 30mm !important;
            height: 20mm !important;
            page-break-after: always;
            page-break-inside: avoid;
            margin: 0 !important;
            padding: 0.5mm !important;
            box-sizing: border-box;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            overflow: hidden;
          }
          
          .label-page:last-child {
            page-break-after: auto;
          }
        }
        
        /* Preview style (บนหน้าจอ) */
        .label-preview {
          width: 30mm;
          height: 20mm;
          background: white;
          color: black;
          border: 1px dashed #999;
          padding: 0.5mm;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          overflow: hidden;
          font-family: Arial, 'Noto Sans Thai', sans-serif;
        }
      `}</style>

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
              <li>กดปุ่ม <strong>🖨️ ปริ้นป้าย</strong></li>
              <li>เลือก <strong>เครื่องพิมพ์ Easy Print</strong></li>
              <li>ตั้งค่ากระดาษ: <strong>30 × 20 mm</strong></li>
              <li>Margin: 0 / Scale: 100%</li>
            </ol>
          </div>

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
            </div>
          ) : (
            <>
              {/* Preview */}
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
                  {labels.slice(0, 10).map((label, idx) => (
                    <Label key={idx} label={label} isPreview />
                  ))}
                  {labels.length > 10 && (
                    <div style={{ 
                      width: '100%', 
                      textAlign: 'center', 
                      fontSize: 11, 
                      color: 'var(--text-dim)',
                      marginTop: 8,
                    }}>
                      ... และอีก {labels.length - 10} ดวง
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={onClose} className="btn btn-sec">
                  ยกเลิก
                </button>
                <button onClick={handlePrint} className="btn">
                  🖨️ ปริ้น {labels.length} ป้าย
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Print area - ซ่อนบนหน้าจอ */}
      <div id="label-print-area" style={{ display: loading ? 'none' : 'block', position: 'absolute', left: '-9999px' }}>
        {labels.map((label, idx) => (
          <div key={idx} className="label-page">
            <Label label={label} />
          </div>
        ))}
      </div>
    </>
  );
}

function Label({ label, isPreview }: { label: any; isPreview?: boolean }) {
  const cls = isPreview ? 'label-preview' : '';
  
  return (
    <div className={cls} style={!isPreview ? {
      width: '30mm',
      height: '20mm',
      padding: '0.5mm',
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      overflow: 'hidden',
      fontFamily: 'Arial, sans-serif',
      color: '#000',
      background: '#fff',
    } : undefined}>
      {/* Top: ชื่อร้าน + ชื่อสินค้า */}
      <div style={{ 
        textAlign: 'center', 
        lineHeight: 1.05,
        flex: '0 0 auto',
      }}>
        {label.shopName && (
          <div style={{ 
            fontSize: '5pt', 
            fontWeight: 700, 
            color: '#000',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {label.shopName}
          </div>
        )}
        <div style={{ 
          fontSize: '6pt', 
          fontWeight: 700, 
          color: '#000',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {label.productName}
        </div>
        {label.variant && (
          <div style={{ 
            fontSize: '4.5pt', 
            color: '#000',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {label.variant}
          </div>
        )}
      </div>

      {/* Middle: Barcode/QR */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        gap: '0.5mm',
        flex: '1 1 auto',
        minHeight: 0,
      }}>
        {label.barcodeUrl && (
          <img 
            src={label.barcodeUrl} 
            alt="barcode"
            style={{ 
              height: '6mm',
              maxWidth: label.qrUrl ? '18mm' : '28mm',
              objectFit: 'contain',
            }}
          />
        )}
        {label.qrUrl && (
          <img 
            src={label.qrUrl} 
            alt="qr"
            style={{ 
              height: '7mm',
              width: '7mm',
            }}
          />
        )}
      </div>

      {/* Bottom: ราคา + รหัส */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        flex: '0 0 auto',
        lineHeight: 1,
      }}>
        <div style={{ 
          fontSize: '4pt', 
          color: '#000', 
          fontFamily: 'monospace',
        }}>
          {label.code}
        </div>
        {label.price !== undefined && label.price > 0 && (
          <div style={{ 
            fontSize: '7pt', 
            fontWeight: 700, 
            color: '#000',
          }}>
            ฿{Number(label.price).toLocaleString()}
          </div>
        )}
      </div>

      {!isPreview && <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>}
    </div>
  );
}
