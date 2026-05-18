'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase-client';
import jsPDF from 'jspdf';

interface ReceiptItem {
  name: string;
  detail?: string;
  qty?: number;
  price: number;
}

interface Props {
  receiptNo?: string;
  type: 'stock_sale' | 'goods_sale' | 'pawn' | 'pawn_redeem' | 'installment_payment';
  customerName?: string;
  customerPhone?: string;
  items: ReceiptItem[];
  subtotal: number;
  discount?: number;
  total: number;
  paymentType?: string;
  issuedByName?: string;
  onClose: () => void;
}

export default function ReceiptPDF({
  receiptNo,
  type,
  customerName,
  customerPhone,
  items,
  subtotal,
  discount = 0,
  total,
  paymentType,
  issuedByName,
  onClose,
}: Props) {
  const supabase = createClient();
  const [shop, setShop] = useState<any>(null);
  const [branch, setBranch] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { data: profile } = await supabase
        .from('profiles').select('shop_id, branch_id').eq('id', user.id).single();
      
      if (profile) {
        const [shopRes, branchRes] = await Promise.all([
          supabase.from('shops').select('*').eq('id', profile.shop_id).single(),
          profile.branch_id 
            ? supabase.from('branches').select('*').eq('id', profile.branch_id).single() 
            : Promise.resolve({ data: null }),
        ]);
        setShop(shopRes.data);
        setBranch(branchRes.data);
      }
      setLoading(false);
    }
    load();
  }, []);

  const typeLabel: Record<string, string> = {
    stock_sale: 'ใบเสร็จขายมือถือ',
    goods_sale: 'ใบเสร็จขายสินค้า',
    pawn: 'ใบรับจำนำ',
    pawn_redeem: 'ใบไถ่คืน',
    installment_payment: 'ใบเสร็จค่างวด',
  };

  async function downloadPDF() {
    if (!shop) return;

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [80, 200], // ใบเสร็จขนาด 80mm
    });

    // ใช้ font ไทย - jspdf default ไม่รองรับไทย → ใช้ภาษาอังกฤษ + เลขไทย
    // หรือใช้ html2canvas แปลง HTML element เป็นรูป แล้วใส่ใน PDF
    const printArea = document.getElementById('receipt-print-area');
    if (!printArea) return;

    // ใช้ html2canvas แทน
    const html2canvas = (await import('html2canvas-pro')).default;
    const canvas = await html2canvas(printArea, {
      scale: 3,
      backgroundColor: '#ffffff',
      logging: false,
    });

    const imgData = canvas.toDataURL('image/png');
    const imgWidth = 76; // 80mm - margin 2mm each side
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    doc.addImage(imgData, 'PNG', 2, 2, imgWidth, imgHeight);
    doc.save(`receipt-${receiptNo || Date.now()}.pdf`);
  }

  function printReceipt() {
    const printArea = document.getElementById('receipt-print-area');
    if (!printArea) return;

    const win = window.open('', '_blank');
    if (!win) {
      alert('Popup ถูกบล็อก กรุณาอนุญาต popup');
      return;
    }

    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${typeLabel[type]}</title>
        <meta charset="utf-8" />
        <style>
          @page { size: 80mm auto; margin: 0; }
          body { margin: 0; padding: 4mm; font-family: 'Sarabun', 'TH Sarabun New', sans-serif; }
          ${printArea.querySelector('style')?.textContent || ''}
        </style>
      </head>
      <body>
        ${printArea.innerHTML}
        <script>
          setTimeout(() => { window.print(); }, 300);
        </script>
      </body>
      </html>
    `);
    win.document.close();
  }

  if (loading || !shop) {
    return (
      <div className="modal-overlay">
        <div className="modal">
          <div className="loading">
            <div className="spinner"></div>
            <div>กำลังเตรียมใบเสร็จ...</div>
          </div>
        </div>
      </div>
    );
  }

  const now = new Date();
  const dateStr = now.toLocaleDateString('th-TH');
  const timeStr = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 380 }}>
        <h3>📄 ใบเสร็จ</h3>
        <p className="modal-sub">{typeLabel[type]}</p>

        {/* Receipt Preview */}
        <div style={{
          background: '#fff',
          color: '#000',
          padding: 16,
          marginBottom: 16,
          maxHeight: 400,
          overflowY: 'auto',
          border: '1px solid #ddd',
          borderRadius: 4,
        }}>
          <div id="receipt-print-area" style={{
            fontFamily: "'Sarabun', sans-serif",
            fontSize: 12,
            lineHeight: 1.5,
            color: '#000',
            background: '#fff',
          }}>
            {/* Logo */}
            {shop.receipt_logo_url && (
              <div style={{ textAlign: 'center', marginBottom: 8 }}>
                <img src={shop.receipt_logo_url} alt="logo" style={{ maxWidth: 60, maxHeight: 60 }} />
              </div>
            )}

            {/* Shop Name */}
            <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
              {shop.name}
            </div>

            {branch?.name && (
              <div style={{ textAlign: 'center', fontSize: 11, color: '#444' }}>
                สาขา {branch.name}
              </div>
            )}

            {shop.receipt_address && (
              <div style={{ textAlign: 'center', fontSize: 10, color: '#666', marginTop: 4 }}>
                {shop.receipt_address}
              </div>
            )}

            {shop.receipt_phone && (
              <div style={{ textAlign: 'center', fontSize: 10, color: '#666' }}>
                โทร {shop.receipt_phone}
              </div>
            )}

            {shop.receipt_tax_id && (
              <div style={{ textAlign: 'center', fontSize: 10, color: '#666' }}>
                เลขผู้เสียภาษี {shop.receipt_tax_id}
              </div>
            )}

            <div style={{ borderTop: '1px dashed #000', margin: '8px 0' }}></div>

            <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
              {typeLabel[type]}
            </div>

            <div style={{ fontSize: 11, marginBottom: 4 }}>
              <strong>เลขที่:</strong> {receiptNo || '-'}
            </div>
            <div style={{ fontSize: 11, marginBottom: 4 }}>
              <strong>วันที่:</strong> {dateStr} {timeStr}
            </div>

            {customerName && (
              <div style={{ fontSize: 11, marginBottom: 4 }}>
                <strong>ลูกค้า:</strong> {customerName}
              </div>
            )}

            {customerPhone && (
              <div style={{ fontSize: 11, marginBottom: 4 }}>
                <strong>โทร:</strong> {customerPhone}
              </div>
            )}

            <div style={{ borderTop: '1px dashed #000', margin: '8px 0' }}></div>

            {/* Items */}
            {items.map((item, i) => (
              <div key={i} style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 600 }}>{item.name}</div>
                {item.detail && (
                  <div style={{ fontSize: 10, color: '#444', marginLeft: 8 }}>
                    {item.detail}
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginTop: 2 }}>
                  <span>{item.qty && item.qty > 1 ? `${item.qty} x ฿${(item.price / item.qty).toLocaleString()}` : ''}</span>
                  <span style={{ fontWeight: 600 }}>฿{item.price.toLocaleString()}</span>
                </div>
              </div>
            ))}

            <div style={{ borderTop: '1px dashed #000', margin: '8px 0' }}></div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
              <span>ยอดรวม:</span>
              <span>฿{subtotal.toLocaleString()}</span>
            </div>

            {discount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                <span>ส่วนลด:</span>
                <span>-฿{discount.toLocaleString()}</span>
              </div>
            )}

            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              fontSize: 14, 
              fontWeight: 700,
              borderTop: '1px solid #000',
              paddingTop: 6,
              marginTop: 4,
            }}>
              <span>รวมจ่าย:</span>
              <span>฿{total.toLocaleString()}</span>
            </div>

            {paymentType && (
              <div style={{ fontSize: 10, color: '#666', textAlign: 'center', marginTop: 8 }}>
                ชำระโดย: {paymentType === 'cash' ? 'เงินสด' : paymentType === 'installment' ? 'ผ่อน' : paymentType}
              </div>
            )}

            <div style={{ borderTop: '1px dashed #000', margin: '8px 0' }}></div>

            {issuedByName && (
              <div style={{ fontSize: 10, color: '#666', textAlign: 'center' }}>
                ออกใบเสร็จโดย: {issuedByName}
              </div>
            )}

            {shop.receipt_footer && (
              <div style={{ textAlign: 'center', fontSize: 10, color: '#444', marginTop: 12, fontStyle: 'italic' }}>
                {shop.receipt_footer}
              </div>
            )}
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn" onClick={printReceipt}>🖨️ พิมพ์</button>
          <button className="btn btn-sec" onClick={downloadPDF}>📥 ดาวน์โหลด PDF</button>
          <button className="btn btn-sec" onClick={onClose}>ปิด</button>
        </div>
      </div>
    </div>
  );
}
