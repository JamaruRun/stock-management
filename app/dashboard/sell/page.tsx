'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase-client';
import Toast from '@/components/Toast';
import BarcodeScanner from '@/components/BarcodeScanner';

export default function SellPage() {
  const supabase = createClient();
  const [imei, setImei] = useState('');
  const [searching, setSearching] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [foundItem, setFoundItem] = useState<any>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [paymentType, setPaymentType] = useState<'cash' | 'installment'>('cash');
  const [discount, setDiscount] = useState('');
  const [toast, setToast] = useState<{ title: string; msg: string; type: string } | null>(null);

  function showToast(title: string, msg: string, type: 'success' | 'danger' = 'success') {
    setToast({ title, msg, type });
    setTimeout(() => setToast(null), 2500);
  }

  async function searchByImei(searchImei: string) {
    if (!searchImei) {
      showToast('กรุณาใส่ IMEI', '', 'danger');
      return;
    }

    setSearching(true);

    const { data: stockItem } = await supabase
      .from('stock')
      .select('*, added_by_profile:profiles!stock_added_by_fkey(full_name, username)')
      .eq('imei', searchImei)
      .maybeSingle();

    setSearching(false);

    if (!stockItem) {
      const { data: soldItem } = await supabase
        .from('sales_history')
        .select('id')
        .eq('imei', searchImei)
        .maybeSingle();

      if (soldItem) {
        showToast('ขายไปแล้ว', 'เครื่องนี้ขายไปแล้ว', 'danger');
      } else {
        showToast('ไม่พบเครื่อง', 'ไม่มีเครื่อง IMEI นี้ในสต๊อก', 'danger');
      }
      return;
    }

    setFoundItem(stockItem);
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    await searchByImei(imei);
  }

  async function handleScan(scannedImei: string) {
    setImei(scannedImei);
    setShowScanner(false);
    showToast('สแกนสำเร็จ', `กำลังค้นหา ${scannedImei}`);
    await searchByImei(scannedImei);
  }

  async function confirmSell() {
    if (!foundItem) return;

    setConfirming(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      showToast('ไม่พบผู้ใช้', '', 'danger');
      setConfirming(false);
      return;
    }

    const discountValue = parseFloat(discount) || 0;
    const finalPrice = Number(foundItem.price) - discountValue;

    if (discountValue < 0) {
      showToast('ส่วนลดต้องไม่ติดลบ', '', 'danger');
      setConfirming(false);
      return;
    }

    if (finalPrice < 0) {
      showToast('ส่วนลดเกินราคา', 'ส่วนลดมากกว่าราคาขาย', 'danger');
      setConfirming(false);
      return;
    }

    const { data: profileWithShop } = await supabase
      .from('profiles').select('full_name, shop_id').eq('id', user.id).single();

    const { error: insertError } = await supabase.from('sales_history').insert({
      imei: foundItem.imei,
      model: foundItem.model,
      color: foundItem.color,
      spec: foundItem.spec,
      price: foundItem.price,
      discount: discountValue,
      final_price: finalPrice,
      added_date: foundItem.added_date,
      added_by: foundItem.added_by,
      added_by_name: foundItem.added_by_name,
      sold_by: user.id,
      sold_by_name: profileWithShop?.full_name,
      sold_date: new Date().toISOString().split('T')[0],
      branch_id: foundItem.branch_id,
      device_condition: foundItem.device_condition,
      payment_type: paymentType,
      shop_id: profileWithShop?.shop_id,
    });

    if (insertError) {
      showToast('เกิดข้อผิดพลาด', insertError.message, 'danger');
      setConfirming(false);
      return;
    }

    const { error: deleteError } = await supabase
      .from('stock')
      .delete()
      .eq('id', foundItem.id);

    if (deleteError) {
      showToast('เกิดข้อผิดพลาด', deleteError.message, 'danger');
      setConfirming(false);
      return;
    }

    showToast('ขายสำเร็จ', `${foundItem.model} - ฿${finalPrice.toLocaleString()}`);
    setFoundItem(null);
    setImei('');
    setDiscount('');
    setConfirming(false);
  }

  return (
    <>
      <div className="page-header">
        <h2>ขายเครื่อง</h2>
        <div className="desc">ใส่ IMEI ของเครื่องที่จะขาย</div>
      </div>

      <div className="form-card">
        <h3>ค้นหาเครื่อง</h3>
        <form onSubmit={handleSearch}>
          <div className="field">
            <label>IMEI</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                inputMode="numeric"
                maxLength={15}
                value={imei}
                onChange={(e) => setImei(e.target.value.replace(/\D/g, ''))}
                placeholder="ใส่เลข IMEI 15 หลัก"
                style={{ flex: 1 }}
              />
              <button
                type="button"
                className="btn btn-sec"
                onClick={() => setShowScanner(true)}
                style={{ width: 'auto', padding: '0 16px', minWidth: 100, whiteSpace: 'nowrap' }}
              >
                📷 สแกน
              </button>
            </div>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn" disabled={searching}>
              {searching ? 'กำลังค้นหา...' : 'ค้นหาเครื่อง →'}
            </button>
          </div>
        </form>
      </div>

      {foundItem && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setFoundItem(null)}>
          <div className="modal">
            <h3>ยืนยันการขาย</h3>
            <p className="modal-sub">ตรวจสอบข้อมูลเครื่องก่อนยืนยัน</p>
            <div className="detail-grid">
              <div className="detail-item full">
                <div className="label">IMEI</div>
                <div className="value mono">{foundItem.imei}</div>
              </div>
              <div className="detail-item">
                <div className="label">รุ่น</div>
                <div className="value">{foundItem.model}</div>
              </div>
              <div className="detail-item">
                <div className="label">สี</div>
                <div className="value">{foundItem.color || '-'}</div>
              </div>
              <div className="detail-item">
                <div className="label">สเปค</div>
                <div className="value">{foundItem.spec || '-'}</div>
              </div>
              <div className="detail-item">
                <div className="label">ราคา</div>
                <div className="value" style={{ color: 'var(--accent)' }}>
                  ฿{Number(foundItem.price).toLocaleString()}
                </div>
              </div>
              <div className="detail-item">
                <div className="label">วันที่ลงสต๊อก</div>
                <div className="value">{foundItem.added_date}</div>
              </div>
              {foundItem.device_condition && (
                <div className="detail-item">
                  <div className="label">สภาพเครื่อง</div>
                  <div className="value">
                    {foundItem.device_condition === 'new' && '✨ มือ 1 (ใหม่)'}
                    {foundItem.device_condition === 'used' && '📱 มือ 2 (มือสอง)'}
                  </div>
                </div>
              )}
              <div className="detail-item full">
                <div className="label">เพิ่มโดย</div>
                <div className="value">{foundItem.added_by_profile?.full_name || '-'}</div>
              </div>
            </div>

            {/* Discount Input */}
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
              <label style={{ 
                display: 'block', 
                fontSize: 11, 
                color: 'var(--text-dim)', 
                fontFamily: 'JetBrains Mono, monospace', 
                letterSpacing: 1, 
                marginBottom: 8 
              }}>
                // ส่วนลด (ถ้ามี)
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="number"
                  inputMode="numeric"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  placeholder="0"
                  min="0"
                  style={{ 
                    width: '100%',
                    paddingRight: 50,
                  }}
                />
                <span style={{ 
                  position: 'absolute', 
                  right: 14, 
                  top: '50%', 
                  transform: 'translateY(-50%)',
                  color: 'var(--text-dim)',
                  fontSize: 12,
                  fontFamily: 'JetBrains Mono, monospace',
                  pointerEvents: 'none',
                }}>
                  บาท
                </span>
              </div>
              
              {/* Price Summary */}
              <div style={{ 
                marginTop: 12,
                padding: 12,
                background: 'var(--surface-2)',
                borderLeft: '3px solid var(--accent)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                  <span style={{ color: 'var(--text-dim)' }}>ราคาเดิม:</span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                    ฿{Number(foundItem.price).toLocaleString()}
                  </span>
                </div>
                {parseFloat(discount) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                    <span style={{ color: 'var(--danger)' }}>ส่วนลด:</span>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--danger)' }}>
                      -฿{parseFloat(discount).toLocaleString()}
                    </span>
                  </div>
                )}
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  fontSize: 15, 
                  fontWeight: 700,
                  paddingTop: 8,
                  borderTop: '1px solid var(--border)',
                }}>
                  <span>ราคาขายจริง:</span>
                  <span style={{ 
                    color: 'var(--accent)',
                    fontFamily: 'JetBrains Mono, monospace',
                  }}>
                    ฿{(Number(foundItem.price) - (parseFloat(discount) || 0)).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Payment Type Selector */}
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
              <label style={{ 
                display: 'block', 
                fontSize: 11, 
                color: 'var(--text-dim)', 
                fontFamily: 'JetBrains Mono, monospace', 
                letterSpacing: 1, 
                marginBottom: 8 
              }}>
                // ประเภทการชำระ
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setPaymentType('cash')}
                  style={{
                    flex: 1,
                    padding: '14px',
                    background: paymentType === 'cash' ? 'var(--success)' : 'var(--surface-2)',
                    color: paymentType === 'cash' ? '#fff' : 'var(--text)',
                    border: `1px solid ${paymentType === 'cash' ? 'var(--success)' : 'var(--border)'}`,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontSize: 14,
                    fontWeight: 600,
                    transition: 'all 0.15s',
                  }}
                >
                  💵 เงินสด
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentType('installment')}
                  style={{
                    flex: 1,
                    padding: '14px',
                    background: paymentType === 'installment' ? '#3742fa' : 'var(--surface-2)',
                    color: paymentType === 'installment' ? '#fff' : 'var(--text)',
                    border: `1px solid ${paymentType === 'installment' ? '#3742fa' : 'var(--border)'}`,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontSize: 14,
                    fontWeight: 600,
                    transition: 'all 0.15s',
                  }}
                >
                  💳 ผ่อน
                </button>
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn" onClick={confirmSell} disabled={confirming}>
                {confirming ? 'กำลังบันทึก...' : 'ยืนยันการขาย ✓'}
              </button>
              <button className="btn btn-sec" onClick={() => setFoundItem(null)} disabled={confirming}>
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}

      {showScanner && (
        <BarcodeScanner onScan={handleScan} onClose={() => setShowScanner(false)} />
      )}

      {toast && <Toast {...toast} />}
    </>
  );
}
