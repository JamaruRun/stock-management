'use client';

import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { createClient } from '@/lib/supabase-client';
import Toast from '@/components/Toast';

export type ImportType = 'pawn' | 'installment' | 'stock';

interface Props {
  type: ImportType;
  branchId: string;
  shopId: string;
  userId: string;
  userName: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface PawnRow {
  imei: string;
  model: string;
  color?: string;
  spec?: string;
  pawn_price: number;
  pawn_date: string;
  customer_name: string;
  customer_phone?: string;
  customer_note?: string;
  _error?: string;
  _row?: number;
}

interface InstallmentRow {
  imei: string;
  model: string;
  color?: string;
  spec?: string;
  full_price: number;
  down_payment: number;
  installment_amount: number;
  total_periods: number;
  start_date: string;
  customer_name: string;
  customer_phone: string;
  customer_id_card: string;
  customer_address?: string;
  customer_note?: string;
  _error?: string;
  _row?: number;
}

interface StockRow {
  imei: string;
  model: string;
  color?: string;
  spec?: string;
  price: number;
  cost_price?: number;
  device_condition: 'new' | 'used';
  supplier_name?: string;
  note?: string;
  _error?: string;
  _row?: number;
}

// Template สำหรับดาวน์โหลด
const TEMPLATES = {
  pawn: {
    title: 'รายการจำนำ',
    headers: ['IMEI', 'รุ่น', 'สี', 'สเปค', 'ราคาจำนำ', 'วันที่จำนำ (YYYY-MM-DD)', 'ชื่อลูกค้า', 'เบอร์โทร', 'หมายเหตุ'],
    sample: [
      ['356789012345678', 'iPhone 15 Pro Max', 'Natural Titanium', '256GB', 25000, '2026-05-01', 'นายสมชาย ใจดี', '0812345678', 'ทอง 2 บาท'],
      ['357890123456789', 'Samsung S24 Ultra', 'Black', '512GB', 18000, '2026-05-02', 'นางสาวสมหญิง สวยใส', '0823456789', ''],
    ],
  },
  installment: {
    title: 'รายการผ่อน',
    headers: ['IMEI', 'รุ่น', 'สี', 'สเปค', 'ราคาเต็ม', 'ดาวน์', 'ค่างวด', 'จำนวนงวด', 'วันที่เริ่ม (YYYY-MM-DD)', 'ชื่อลูกค้า', 'เบอร์โทร', 'บัตรประชาชน', 'ที่อยู่', 'หมายเหตุ'],
    sample: [
      ['356789012345678', 'iPhone 15 Pro Max', 'Natural Titanium', '256GB', 50000, 10000, 2500, 18, '2026-05-01', 'นายสมชาย ใจดี', '0812345678', '1234567890123', 'กรุงเทพ', ''],
      ['357890123456789', 'Samsung S24', 'Black', '256GB', 30000, 5000, 2000, 14, '2026-05-02', 'นางสาวสมหญิง', '0823456789', '1234567890124', 'นนทบุรี', 'นัดเก็บงวดวันที่ 10'],
    ],
  },
  stock: {
    title: 'สต๊อกเครื่อง',
    headers: ['IMEI', 'รุ่น', 'สี', 'สเปค', 'ราคาขาย', 'ราคาทุน', 'สภาพ (new/used)', 'Supplier', 'หมายเหตุ'],
    sample: [
      ['356789012345678', 'iPhone 15 Pro Max', 'Natural Titanium', '256GB', 48500, 42000, 'new', 'TH Mobile', 'มือ 1 ประกันศูนย์'],
      ['357890123456789', 'Samsung S24 Ultra', 'Black', '512GB', 38000, 32500, 'new', '', ''],
      ['358901234567890', 'iPhone 14 Pro', 'Deep Purple', '128GB', 28000, 23000, 'used', 'มือสองเชียงราย', 'รอยขีดเล็กน้อย'],
    ],
  },
};

export default function ImportExcel({ type, branchId, shopId, userId, userName, onClose, onSuccess }: Props) {
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, success: 0, failed: 0 });
  const [toast, setToast] = useState<{ title: string; msg: string; type: string } | null>(null);

  const template = TEMPLATES[type];

  function showToast(title: string, msg: string, type: 'success' | 'danger' = 'success') {
    setToast({ title, msg, type });
    setTimeout(() => setToast(null), 2500);
  }

  function handleDownloadTemplate() {
    const ws = XLSX.utils.aoa_to_sheet([template.headers, ...template.sample]);
    // ปรับความกว้างคอลัมน์
    ws['!cols'] = template.headers.map(h => ({ wch: Math.max(h.length, 15) }));
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, template.title);
    
    const filename = `template_${type === 'pawn' ? 'จำนำ' : type === 'installment' ? 'ผ่อน' : 'สต๊อก'}.xlsx`;
    XLSX.writeFile(wb, filename);
    showToast('ดาวน์โหลดแล้ว', filename);
  }

  function parseDate(value: any): string {
    if (!value) return '';
    
    // ถ้าเป็น Date object
    if (value instanceof Date) {
      return value.toISOString().split('T')[0];
    }
    
    // ถ้าเป็น Excel number (serial date)
    if (typeof value === 'number') {
      // Excel: days since 1900-01-01 (มี bug ของ Excel ที่ +1)
      const date = new Date((value - 25569) * 86400 * 1000);
      return date.toISOString().split('T')[0];
    }
    
    // ถ้าเป็น string
    const str = String(value).trim();
    
    // YYYY-MM-DD
    if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(str)) {
      const [y, m, d] = str.split('-');
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    
    // DD/MM/YYYY
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(str)) {
      const [d, m, y] = str.split('/');
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    
    // ลอง parse แบบทั่วไป
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
    
    return '';
  }

  function validatePawnRow(r: any, idx: number): PawnRow {
    const row: PawnRow = {
      imei: String(r[0] || '').trim(),
      model: String(r[1] || '').trim(),
      color: String(r[2] || '').trim() || undefined,
      spec: String(r[3] || '').trim() || undefined,
      pawn_price: parseFloat(r[4]) || 0,
      pawn_date: parseDate(r[5]),
      customer_name: String(r[6] || '').trim(),
      customer_phone: String(r[7] || '').trim() || undefined,
      customer_note: String(r[8] || '').trim() || undefined,
      _row: idx + 2, // +2 เพราะ header + 1-indexed
    };

    const errors: string[] = [];
    if (!row.imei) errors.push('ไม่มี IMEI');
    if (!row.model) errors.push('ไม่มีรุ่น');
    if (!row.pawn_price || row.pawn_price <= 0) errors.push('ราคาผิด');
    if (!row.pawn_date) errors.push('วันที่ผิด');
    if (!row.customer_name) errors.push('ไม่มีชื่อลูกค้า');
    
    if (errors.length > 0) row._error = errors.join(', ');
    return row;
  }

  function validateInstallmentRow(r: any, idx: number): InstallmentRow {
    const row: InstallmentRow = {
      imei: String(r[0] || '').trim(),
      model: String(r[1] || '').trim(),
      color: String(r[2] || '').trim() || undefined,
      spec: String(r[3] || '').trim() || undefined,
      full_price: parseFloat(r[4]) || 0,
      down_payment: parseFloat(r[5]) || 0,
      installment_amount: parseFloat(r[6]) || 0,
      total_periods: parseInt(r[7]) || 0,
      start_date: parseDate(r[8]),
      customer_name: String(r[9] || '').trim(),
      customer_phone: String(r[10] || '').trim(),
      customer_id_card: String(r[11] || '').trim(),
      customer_address: String(r[12] || '').trim() || undefined,
      customer_note: String(r[13] || '').trim() || undefined,
      _row: idx + 2,
    };

    const errors: string[] = [];
    if (!row.imei) errors.push('ไม่มี IMEI');
    if (!row.model) errors.push('ไม่มีรุ่น');
    if (!row.full_price || row.full_price <= 0) errors.push('ราคาเต็มผิด');
    if (!row.installment_amount || row.installment_amount <= 0) errors.push('ค่างวดผิด');
    if (!row.total_periods || row.total_periods <= 0) errors.push('จำนวนงวดผิด');
    if (!row.start_date) errors.push('วันที่เริ่มผิด');
    if (!row.customer_name) errors.push('ไม่มีชื่อลูกค้า');
    if (!row.customer_phone) errors.push('ไม่มีเบอร์');
    if (!row.customer_id_card) errors.push('ไม่มีบัตรประชาชน');
    
    if (errors.length > 0) row._error = errors.join(', ');
    return row;
  }

  function validateStockRow(r: any, idx: number): StockRow {
    const conditionRaw = String(r[6] || '').trim().toLowerCase();
    const condition: 'new' | 'used' = 
      conditionRaw === 'used' || conditionRaw === 'มือสอง' || conditionRaw === 'มือ2'
        ? 'used' : 'new';

    const row: StockRow = {
      imei: String(r[0] || '').trim(),
      model: String(r[1] || '').trim(),
      color: String(r[2] || '').trim() || undefined,
      spec: String(r[3] || '').trim() || undefined,
      price: parseFloat(r[4]) || 0,
      cost_price: parseFloat(r[5]) || 0,
      device_condition: condition,
      supplier_name: String(r[7] || '').trim() || undefined,
      note: String(r[8] || '').trim() || undefined,
      _row: idx + 2,
    };

    const errors: string[] = [];
    if (!row.imei) errors.push('ไม่มี IMEI');
    if (!/^\d{14,16}$/.test(row.imei.replace(/\D/g, ''))) errors.push('IMEI ต้องเป็นตัวเลข 14-16 หลัก');
    if (!row.model) errors.push('ไม่มีรุ่น');
    if (!row.price || row.price <= 0) errors.push('ราคาขายผิด');
    
    if (errors.length > 0) row._error = errors.join(', ');
    return row;
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array', cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });
        
        // Skip header row
        const dataRows = json.slice(1).filter(r => r.some((c: any) => String(c).trim() !== ''));
        
        if (dataRows.length === 0) {
          showToast('ไฟล์ว่าง', 'ไม่มีข้อมูลในไฟล์', 'danger');
          return;
        }

        // Validate
        const parsed = dataRows.map((r, i) => 
          type === 'pawn' ? validatePawnRow(r, i) : 
          type === 'installment' ? validateInstallmentRow(r, i) :
          validateStockRow(r, i)
        );

        setRows(parsed);
        showToast('อ่านไฟล์สำเร็จ', `พบ ${parsed.length} แถว`);
      } catch (err: any) {
        showToast('อ่านไฟล์ไม่ได้', err.message, 'danger');
      }
    };
    reader.readAsArrayBuffer(file);
  }

  async function handleImport() {
    if (rows.length === 0) return;

    const validRows = rows.filter(r => !r._error);
    if (validRows.length === 0) {
      showToast('ไม่มีข้อมูลที่ใช้ได้', 'แก้ไขไฟล์ Excel แล้วลองใหม่', 'danger');
      return;
    }

    if (!confirm(`จะนำเข้า ${validRows.length} รายการ\n(ข้าม ${rows.length - validRows.length} รายการที่ผิด)\n\nยืนยัน?`)) {
      return;
    }

    setImporting(true);
    setProgress({ current: 0, total: validRows.length, success: 0, failed: 0 });

    let success = 0;
    let failed = 0;

    // โหลด suppliers ของร้านเพื่อแมป supplier_name → supplier_id (สำหรับ stock)
    let supplierMap: Record<string, string> = {};
    if (type === 'stock') {
      const { data: sups } = await supabase
        .from('suppliers').select('id, name').eq('shop_id', shopId);
      (sups || []).forEach((s: any) => {
        supplierMap[s.name.toLowerCase().trim()] = s.id;
      });
    }

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      setProgress({ current: i + 1, total: validRows.length, success, failed });

      try {
        if (type === 'pawn') {
          const { error } = await supabase.from('pawn_stock').insert({
            imei: row.imei,
            model: row.model,
            color: row.color || null,
            spec: row.spec || null,
            pawn_price: row.pawn_price,
            pawn_date: row.pawn_date,
            customer_name: row.customer_name,
            customer_phone: row.customer_phone || null,
            customer_note: row.customer_note || null,
            added_by: userId,
            added_by_name: userName,
            branch_id: branchId,
            shop_id: shopId,
          });
          if (error) {
            failed++;
            row._error = error.message;
          } else {
            success++;
          }
        } else if (type === 'installment') {
          const { error } = await supabase.from('installment_stock').insert({
            imei: row.imei,
            model: row.model,
            color: row.color || null,
            spec: row.spec || null,
            full_price: row.full_price,
            down_payment: row.down_payment,
            installment_amount: row.installment_amount,
            total_periods: row.total_periods,
            start_date: row.start_date,
            customer_name: row.customer_name,
            customer_phone: row.customer_phone,
            customer_id_card: row.customer_id_card,
            customer_address: row.customer_address || null,
            customer_note: row.customer_note || null,
            added_by: userId,
            added_by_name: userName,
            branch_id: branchId,
            shop_id: shopId,
          });
          if (error) {
            failed++;
            row._error = error.message;
          } else {
            success++;
          }
        } else {
          // stock
          // หา supplier_id จากชื่อ (ถ้าไม่เจอ → สร้างใหม่)
          let supplierId: string | null = null;
          if (row.supplier_name) {
            const key = row.supplier_name.toLowerCase().trim();
            if (supplierMap[key]) {
              supplierId = supplierMap[key];
            } else {
              // สร้าง supplier ใหม่
              const { data: newSup } = await supabase
                .from('suppliers').insert({
                  shop_id: shopId,
                  name: row.supplier_name,
                }).select('id').single();
              if (newSup) {
                supplierId = newSup.id;
                supplierMap[key] = newSup.id;
              }
            }
          }

          const { error } = await supabase.from('stock').insert({
            imei: row.imei,
            model: row.model,
            color: row.color || null,
            spec: row.spec || null,
            price: row.price,
            cost_price: row.cost_price || 0,
            device_condition: row.device_condition,
            supplier_id: supplierId,
            added_by: userId,
            added_by_name: userName,
            branch_id: branchId,
            shop_id: shopId,
          });
          if (error) {
            failed++;
            row._error = error.message;
          } else {
            success++;
          }
        }
      } catch (e: any) {
        failed++;
        row._error = e.message;
      }
    }

    setProgress({ current: validRows.length, total: validRows.length, success, failed });
    setImporting(false);

    if (success > 0) {
      showToast('นำเข้าสำเร็จ', `${success} รายการ • ผิดพลาด ${failed}`);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } else {
      showToast('นำเข้าไม่สำเร็จ', `ทั้งหมด ${failed} รายการล้มเหลว`, 'danger');
    }
  }

  const validCount = rows.filter(r => !r._error).length;
  const errorCount = rows.length - validCount;

  return (
    <div className="modal-overlay" onClick={(e) => !importing && e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 720 }}>
        <h3>📥 นำเข้า{template.title}จาก Excel</h3>
        <p className="modal-sub">
          อัพโหลดไฟล์ Excel เพื่อเพิ่มหลายรายการพร้อมกัน
        </p>

        {/* Step 1: Download Template */}
        <div style={{
          background: 'var(--surface-2)',
          padding: 14,
          marginBottom: 16,
          borderLeft: '3px solid var(--accent)',
        }}>
          <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 13 }}>
            📄 ขั้นที่ 1: ดาวน์โหลด Template
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 10 }}>
            กรอกข้อมูลลงในไฟล์ template ที่ดาวน์โหลด แล้วอัพโหลดกลับมา
          </div>
          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="btn btn-sec"
            disabled={importing}
            style={{ width: 'auto' }}
          >
            📄 ดาวน์โหลด Template
          </button>
        </div>

        {/* Step 2: Upload */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 13 }}>
            📂 ขั้นที่ 2: เลือกไฟล์ Excel
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            disabled={importing}
            style={{ 
              padding: 8, 
              background: 'var(--surface-2)', 
              border: '1px solid var(--border)', 
              color: 'var(--text)',
              width: '100%',
            }}
          />
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
            รองรับ .xlsx และ .xls
          </div>
        </div>

        {/* Preview */}
        {rows.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>
                👀 ขั้นที่ 3: ตรวจข้อมูลก่อนนำเข้า
              </div>
              <div style={{ fontSize: 11 }}>
                <span style={{ color: 'var(--success)', marginRight: 8 }}>✓ {validCount}</span>
                {errorCount > 0 && <span style={{ color: 'var(--danger)' }}>✗ {errorCount}</span>}
              </div>
            </div>
            
            <div style={{ maxHeight: 260, overflowY: 'auto', border: '1px solid var(--border)' }}>
              {rows.map((r, idx) => (
                <div key={idx} style={{
                  padding: 10,
                  borderBottom: '1px solid var(--border)',
                  background: r._error ? 'rgba(255, 71, 87, 0.06)' : 'transparent',
                  fontSize: 12,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600 }}>
                        แถว {r._row}: {r.model || '(ไม่มีรุ่น)'}
                      </div>
                      <div style={{ color: 'var(--text-dim)', fontSize: 11, marginTop: 2, fontFamily: 'JetBrains Mono, monospace' }}>
                        {r.imei || '(ไม่มี IMEI)'} • {r.customer_name || '(ไม่มีชื่อ)'}
                      </div>
                      {r._error && (
                        <div style={{ color: 'var(--danger)', fontSize: 11, marginTop: 4 }}>
                          ⚠️ {r._error}
                        </div>
                      )}
                    </div>
                    <div style={{ marginLeft: 8 }}>
                      {r._error ? (
                        <span style={{ color: 'var(--danger)' }}>✗</span>
                      ) : (
                        <span style={{ color: 'var(--success)' }}>✓</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Progress */}
        {importing && (
          <div style={{
            padding: 12,
            background: 'var(--surface-2)',
            marginBottom: 16,
            borderLeft: '3px solid var(--accent)',
          }}>
            <div style={{ fontSize: 13, marginBottom: 8 }}>
              กำลังนำเข้า... {progress.current}/{progress.total}
            </div>
            <div style={{ background: 'var(--border)', height: 6, overflow: 'hidden' }}>
              <div style={{
                background: 'var(--accent)',
                height: '100%',
                width: `${(progress.current / progress.total) * 100}%`,
                transition: 'width 0.2s',
              }}/>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 6 }}>
              สำเร็จ {progress.success} • ผิดพลาด {progress.failed}
            </div>
          </div>
        )}

        <div className="modal-actions">
          {validCount > 0 && (
            <button className="btn" onClick={handleImport} disabled={importing}>
              {importing ? `กำลังนำเข้า ${progress.current}/${progress.total}...` : `นำเข้า ${validCount} รายการ`}
            </button>
          )}
          <button className="btn btn-sec" onClick={onClose} disabled={importing}>
            {rows.length > 0 ? 'ยกเลิก' : 'ปิด'}
          </button>
        </div>

        {toast && <Toast {...toast} />}
      </div>
    </div>
  );
}
