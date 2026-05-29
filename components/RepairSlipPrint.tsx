'use client';

import { useEffect, useState } from 'react';
import JsBarcode from 'jsbarcode';

interface RepairJob {
  job_no: string;
  customer_name: string;
  customer_phone?: string | null;
  customer_line_id?: string | null;
  device_brand?: string | null;
  device_model: string;
  device_color?: string | null;
  device_imei?: string | null;
  device_password?: string | null;
  device_accessories?: string | null;
  device_condition_note?: string | null;
  problem_description: string;
  diagnosis?: string | null;
  labor_cost?: number | null;
  received_date: string;
  estimated_done_date?: string | null;
  technician_name?: string | null;
}

interface Props {
  job: RepairJob;
  shopName?: string;
  shopPhone?: string;
  onClose: () => void;
}

export default function RepairSlipPrint({ job, shopName, shopPhone, onClose }: Props) {
  const [barcodeUrl, setBarcodeUrl] = useState<string>('');

  useEffect(() => {
    try {
      const canvas = document.createElement('canvas');
      JsBarcode(canvas, job.job_no, {
        format: 'CODE128',
        width: 1.8,
        height: 50,
        displayValue: false,
        margin: 8,
      });
      setBarcodeUrl(canvas.toDataURL('image/png'));
    } catch (e) {
      console.warn('Barcode err:', e);
    }
  }, [job.job_no]);

  function formatDate(d?: string | null) {
    if (!d) return '-';
    try {
      return new Date(d).toLocaleDateString('th-TH', { 
        day: '2-digit', month: '2-digit', year: '2-digit' 
      });
    } catch {
      return d;
    }
  }

  function handlePrint() {
    const printWindow = window.open('', '_blank', 'width=400,height=700');
    if (!printWindow) {
      alert('โปรดอนุญาต Pop-up ใน browser');
      return;
    }

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>ใบรับซ่อม ${escapeHtml(job.job_no)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    @page {
      size: 80mm auto;
      margin: 0;
    }
    
    html, body {
      width: 80mm;
      font-family: 'Sarabun', 'Loma', 'Noto Sans Thai', sans-serif;
      font-size: 11pt;
      line-height: 1.4;
      color: #000;
      background: #fff;
    }
    
    .slip {
      width: 80mm;
      padding: 4mm;
    }
    
    /* Header */
    .header {
      text-align: center;
      border-bottom: 2px dashed #000;
      padding-bottom: 6px;
      margin-bottom: 8px;
    }
    
    .shop-name {
      font-size: 12pt;
      font-weight: 700;
      margin-bottom: 2px;
    }
    
    .shop-phone {
      font-size: 9pt;
    }
    
    .receipt-title {
      font-size: 14pt;
      font-weight: 700;
      margin-top: 4px;
      padding: 3px 0;
      background: #000;
      color: #fff;
    }
    
    /* Job Number - ตัวใหญ่ */
    .job-no-box {
      text-align: center;
      margin: 8px 0;
      padding: 6px 4px;
      border: 2px solid #000;
    }
    
    .job-no-label {
      font-size: 9pt;
      margin-bottom: 2px;
    }
    
    .job-no {
      font-size: 22pt;
      font-weight: 800;
      letter-spacing: 1px;
      font-family: 'Courier New', monospace;
    }
    
    .barcode {
      width: 100%;
      max-height: 50px;
      margin-top: 4px;
    }
    
    /* Sections */
    .section {
      margin-bottom: 8px;
      padding-bottom: 6px;
      border-bottom: 1px dashed #999;
    }
    
    .section:last-child {
      border-bottom: none;
    }
    
    .section-title {
      font-size: 9pt;
      font-weight: 700;
      background: #f0f0f0;
      padding: 2px 4px;
      margin-bottom: 4px;
    }
    
    .row {
      display: flex;
      gap: 4px;
      margin-bottom: 2px;
      font-size: 10pt;
      align-items: flex-start;
    }
    
    .row-label {
      font-weight: 600;
      flex-shrink: 0;
      width: 22mm;
    }
    
    .row-value {
      flex: 1;
      word-break: break-word;
    }
    
    /* Highlight - อาการ + รหัสปลดล็อค */
    .highlight-box {
      border: 1.5px solid #000;
      padding: 4px 6px;
      margin: 4px 0;
      background: #fffacd;
    }
    
    .highlight-title {
      font-size: 9pt;
      font-weight: 700;
      margin-bottom: 2px;
    }
    
    .highlight-value {
      font-size: 11pt;
      font-weight: 600;
      word-break: break-word;
    }
    
    .unlock-box {
      border: 2px solid #d00;
      padding: 4px 6px;
      margin: 4px 0;
      background: #ffebeb;
    }
    
    .unlock-title {
      font-size: 9pt;
      font-weight: 700;
      color: #d00;
      margin-bottom: 2px;
    }
    
    .unlock-value {
      font-size: 14pt;
      font-weight: 800;
      font-family: 'Courier New', monospace;
      letter-spacing: 2px;
      text-align: center;
    }
    
    /* Footer */
    .footer {
      text-align: center;
      font-size: 8pt;
      margin-top: 10px;
      padding-top: 6px;
      border-top: 2px dashed #000;
      line-height: 1.5;
    }
    
    /* Toolbar */
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
      font-family: inherit;
    }
    
    .toolbar .btn-print {
      background: white;
      color: #1e40af;
    }
    
    .toolbar .btn-close {
      background: rgba(255,255,255,0.2);
      color: white;
    }
    
    @media screen {
      body {
        background: #e5e7eb;
        padding: 70px 12px 30px;
      }
      
      .slip {
        background: white;
        margin: 0 auto;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      }
    }
    
    @media print {
      .toolbar { display: none !important; }
      body { padding: 0 !important; background: white !important; }
      .slip { box-shadow: none !important; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <button class="btn-print" onclick="window.print()">🖨️ ปริ้น</button>
    <button class="btn-close" onclick="window.close()">✕ ปิด</button>
  </div>

  <div class="slip">
    <!-- Header -->
    <div class="header">
      ${shopName ? `<div class="shop-name">${escapeHtml(shopName)}</div>` : ''}
      ${shopPhone ? `<div class="shop-phone">📞 ${escapeHtml(shopPhone)}</div>` : ''}
      <div class="receipt-title">🛠️ ใบรับซ่อม</div>
    </div>

    <!-- Job No + Barcode -->
    <div class="job-no-box">
      <div class="job-no-label">เลขที่ใบงาน</div>
      <div class="job-no">${escapeHtml(job.job_no)}</div>
      ${barcodeUrl ? `<img class="barcode" src="${barcodeUrl}" />` : ''}
    </div>

    <!-- ลูกค้า -->
    <div class="section">
      <div class="section-title">👤 ลูกค้า</div>
      <div class="row">
        <span class="row-label">ชื่อ:</span>
        <span class="row-value">${escapeHtml(job.customer_name)}</span>
      </div>
      ${job.customer_phone ? `
        <div class="row">
          <span class="row-label">เบอร์:</span>
          <span class="row-value">${escapeHtml(job.customer_phone)}</span>
        </div>
      ` : ''}
      ${job.customer_line_id ? `
        <div class="row">
          <span class="row-label">LINE:</span>
          <span class="row-value">${escapeHtml(job.customer_line_id)}</span>
        </div>
      ` : ''}
    </div>

    <!-- เครื่อง -->
    <div class="section">
      <div class="section-title">📱 เครื่อง</div>
      <div class="row">
        <span class="row-label">รุ่น:</span>
        <span class="row-value">${escapeHtml(job.device_brand || '')} ${escapeHtml(job.device_model)}${job.device_color ? ' (' + escapeHtml(job.device_color) + ')' : ''}</span>
      </div>
      ${job.device_imei ? `
        <div class="row">
          <span class="row-label">IMEI:</span>
          <span class="row-value" style="font-family: monospace; font-size: 9pt;">${escapeHtml(job.device_imei)}</span>
        </div>
      ` : ''}
      ${job.device_accessories ? `
        <div class="row">
          <span class="row-label">ของแถม:</span>
          <span class="row-value">${escapeHtml(job.device_accessories)}</span>
        </div>
      ` : ''}
      ${job.device_condition_note ? `
        <div class="row">
          <span class="row-label">สภาพ:</span>
          <span class="row-value">${escapeHtml(job.device_condition_note)}</span>
        </div>
      ` : ''}
    </div>

    ${job.device_password ? `
      <!-- รหัสปลดล็อค - เน้นแดง -->
      <div class="unlock-box">
        <div class="unlock-title">🔓 รหัสปลดล็อค</div>
        <div class="unlock-value">${escapeHtml(job.device_password)}</div>
      </div>
    ` : ''}

    <!-- อาการ - เน้นเหลือง -->
    <div class="highlight-box">
      <div class="highlight-title">⚠️ อาการที่ลูกค้าแจ้ง</div>
      <div class="highlight-value">${escapeHtml(job.problem_description)}</div>
    </div>

    ${job.diagnosis ? `
      <div class="section">
        <div class="section-title">🔍 วิเคราะห์เบื้องต้น</div>
        <div style="font-size: 10pt; padding: 2px 4px;">${escapeHtml(job.diagnosis)}</div>
      </div>
    ` : ''}

    <!-- กำหนดการ -->
    <div class="section">
      <div class="section-title">📅 กำหนดการ</div>
      <div class="row">
        <span class="row-label">วันรับ:</span>
        <span class="row-value">${formatDate(job.received_date)}</span>
      </div>
      ${job.estimated_done_date ? `
        <div class="row">
          <span class="row-label">วันนัดรับ:</span>
          <span class="row-value" style="font-weight: 700;">${formatDate(job.estimated_done_date)}</span>
        </div>
      ` : ''}
      ${job.labor_cost ? `
        <div class="row">
          <span class="row-label">ค่าแรง:</span>
          <span class="row-value" style="font-weight: 700;">฿${Number(job.labor_cost).toLocaleString()}</span>
        </div>
      ` : ''}
      ${job.technician_name ? `
        <div class="row">
          <span class="row-label">ช่าง:</span>
          <span class="row-value">${escapeHtml(job.technician_name)}</span>
        </div>
      ` : ''}
    </div>

    <!-- Footer -->
    <div class="footer">
      📌 ใบนี้สำหรับติดเครื่อง<br>
      📞 โทรสอบถาม / นัดรับ ตามเบอร์ข้างต้น<br>
      <span style="font-size: 7pt; color: #666;">
        พิมพ์เมื่อ ${new Date().toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}
      </span>
    </div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() { window.print(); }, 300);
    };
  </script>
</body>
</html>`;

    printWindow.document.write(html);
    printWindow.document.close();
  }

  return (
    <div className="modal-overlay" style={{ alignItems: 'center', padding: 12 }}>
      <div className="modal" style={{ maxWidth: 460, width: '100%', maxHeight: '95vh', overflow: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <div>
            <h3 style={{ margin: 0 }}>🏷️ ใบรับซ่อม</h3>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-dim)' }}>
              สำหรับติดเครื่อง • กระดาษ 80mm
            </p>
          </div>
          <button onClick={onClose} style={{
            background: 'var(--surface-2)',
            border: 'none',
            borderRadius: '50%',
            width: 32, height: 32,
            cursor: 'pointer',
            fontSize: 14,
            color: 'var(--text)',
            fontFamily: 'inherit',
          }}>✕</button>
        </div>

        {/* Info */}
        <div style={{
          padding: 12,
          background: 'rgba(59, 130, 246, 0.08)',
          borderLeft: '3px solid var(--accent)',
          borderRadius: 6,
          marginBottom: 14,
          fontSize: 12,
          lineHeight: 1.6,
        }}>
          <strong>💡 ใช้ทำอะไร:</strong>
          <ul style={{ marginLeft: 18, marginTop: 4 }}>
            <li>ติดเครื่องลูกค้า ระหว่างรอซ่อม</li>
            <li>ช่างเห็นชัด - อาการ + รหัสปลดล็อก</li>
            <li>สแกน barcode เช็คใบงานได้</li>
          </ul>
        </div>

        {/* Preview */}
        <div style={{
          background: '#e5e7eb',
          padding: 16,
          borderRadius: 8,
          display: 'flex',
          justifyContent: 'center',
          marginBottom: 14,
        }}>
          <div style={{
            width: '80mm',
            background: 'white',
            padding: '4mm',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            color: '#000',
            fontSize: '11pt',
            fontFamily: 'Sarabun, sans-serif',
            lineHeight: 1.4,
          }}>
            {/* Header */}
            <div style={{ textAlign: 'center', borderBottom: '2px dashed #000', paddingBottom: 6, marginBottom: 8 }}>
              {shopName && <div style={{ fontSize: '12pt', fontWeight: 700 }}>{shopName}</div>}
              {shopPhone && <div style={{ fontSize: '9pt' }}>📞 {shopPhone}</div>}
              <div style={{ 
                fontSize: '14pt', 
                fontWeight: 700, 
                marginTop: 4, 
                padding: '3px 0', 
                background: '#000', 
                color: '#fff',
              }}>
                🛠️ ใบรับซ่อม
              </div>
            </div>

            {/* Job No */}
            <div style={{ textAlign: 'center', margin: '8px 0', padding: '6px 4px', border: '2px solid #000' }}>
              <div style={{ fontSize: '9pt' }}>เลขที่ใบงาน</div>
              <div style={{ fontSize: '22pt', fontWeight: 800, fontFamily: 'monospace' }}>
                {job.job_no}
              </div>
              {barcodeUrl && (
                <img src={barcodeUrl} alt="" style={{ width: '100%', maxHeight: 50, marginTop: 4 }} />
              )}
            </div>

            {/* Customer */}
            <div style={{ marginBottom: 8, paddingBottom: 6, borderBottom: '1px dashed #999' }}>
              <div style={{ fontSize: '9pt', fontWeight: 700, background: '#f0f0f0', padding: '2px 4px', marginBottom: 4 }}>
                👤 ลูกค้า
              </div>
              <div style={{ fontSize: '10pt' }}>
                <strong>ชื่อ:</strong> {job.customer_name}
              </div>
              {job.customer_phone && (
                <div style={{ fontSize: '10pt' }}>
                  <strong>เบอร์:</strong> {job.customer_phone}
                </div>
              )}
            </div>

            {/* Device */}
            <div style={{ marginBottom: 8, paddingBottom: 6, borderBottom: '1px dashed #999' }}>
              <div style={{ fontSize: '9pt', fontWeight: 700, background: '#f0f0f0', padding: '2px 4px', marginBottom: 4 }}>
                📱 เครื่อง
              </div>
              <div style={{ fontSize: '10pt' }}>
                {job.device_brand} {job.device_model}
                {job.device_color && ` (${job.device_color})`}
              </div>
              {job.device_imei && (
                <div style={{ fontSize: '9pt', fontFamily: 'monospace' }}>
                  IMEI: {job.device_imei}
                </div>
              )}
            </div>

            {/* Unlock */}
            {job.device_password && (
              <div style={{
                border: '2px solid #d00',
                padding: '4px 6px',
                margin: '4px 0',
                background: '#ffebeb',
              }}>
                <div style={{ fontSize: '9pt', fontWeight: 700, color: '#d00' }}>
                  🔓 รหัสปลดล็อค
                </div>
                <div style={{
                  fontSize: '14pt',
                  fontWeight: 800,
                  fontFamily: 'monospace',
                  letterSpacing: 2,
                  textAlign: 'center',
                }}>
                  {job.device_password}
                </div>
              </div>
            )}

            {/* Problem */}
            <div style={{
              border: '1.5px solid #000',
              padding: '4px 6px',
              margin: '4px 0',
              background: '#fffacd',
            }}>
              <div style={{ fontSize: '9pt', fontWeight: 700 }}>
                ⚠️ อาการที่ลูกค้าแจ้ง
              </div>
              <div style={{ fontSize: '11pt', fontWeight: 600 }}>
                {job.problem_description}
              </div>
            </div>

            {/* Dates */}
            <div style={{ fontSize: '10pt' }}>
              <div style={{ fontSize: '9pt', fontWeight: 700, background: '#f0f0f0', padding: '2px 4px', marginBottom: 4 }}>
                📅 กำหนดการ
              </div>
              <div><strong>วันรับ:</strong> {formatDate(job.received_date)}</div>
              {job.estimated_done_date && (
                <div><strong>วันนัดรับ:</strong> {formatDate(job.estimated_done_date)}</div>
              )}
              {job.labor_cost && job.labor_cost > 0 && (
                <div><strong>ค่าแรง:</strong> ฿{Number(job.labor_cost).toLocaleString()}</div>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} className="btn btn-sec">
            ปิด
          </button>
          <button onClick={handlePrint} className="btn">
            🖨️ ปริ้นใบรับซ่อม
          </button>
        </div>
      </div>
    </div>
  );
}

function escapeHtml(s: string | null | undefined): string {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
