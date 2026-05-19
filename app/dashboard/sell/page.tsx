'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase-client';
import Toast from '@/components/Toast';
import BarcodeScanner from '@/components/BarcodeScanner';
import ReceiptPDF from '@/components/ReceiptPDF';
import { sendLineNotify } from '@/lib/line-notify';

export default function SellPage() {
  const supabase = createClient();
  const [imei, setImei] = useState('');
  const [searching, setSearching] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [foundItem, setFoundItem] = useState<any>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [paymentType, setPaymentType] = useState<'cash' | 'installment'>('cash');
  const [discount, setDiscount] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [lastSale, setLastSale] = useState<any>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [toast, setToast] = useState<{ title: string; msg: string; type: string } | null>(null);

  function showToast(title: string, msg: string, type: 'success' | 'danger' = 'success') {
    setToast({ title, msg, type });
    setTimeout(() => setToast(null), 2500);
  }

  async function searchByImei(searchImei: string) {
    if (!searchImei) {
      showToast('ใส่ IMEI', '', 'danger');
      return;
    }

    setSearching(true);

    const { data: stockItem } = await supabase
      .from('stock')
      .select('*, added_by_profile:profiles!stock_added_by_fkey(full_name), branch:branches(name)')
      .eq('imei', searchImei)
      .maybeSingle();

    setSearching(false);

    if (!stockItem) {
      const { data: soldItem } = await supabase
        .from('sales_history').select('id').eq('imei', searchImei).maybeSingle();

      if (soldItem) {
        showToast('ขายไปแล้ว', 'เครื่องนี้ขายไปแล้ว', 'danger');
      } else {
        showToast('ไม่พบเครื่อง', 'IMEI นี้ไม่มีในสต๊อก', 'danger');
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
    await searchByImei(scannedImei);
  }

  async function confirmSell() {
    if (!foundItem) return;

    setConfirming(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setConfirming(false); return; }

    const discountValue = parseFloat(discount) || 0;
    const finalPrice = Number(foundItem.price) - discountValue;
    const costPrice = Number(foundItem.cost_price) || 0;
    const profit = finalPrice - costPrice;

    if (discountValue < 0) {
      showToast('ส่วนลดติดลบไม่ได้', '', 'danger');
      setConfirming(false);
      return;
    }
    if (finalPrice < 0) {
      showToast('ส่วนลดเกินราคา', '', 'danger');
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
      cost_price: costPrice,
      profit: profit,
      supplier_id: foundItem.supplier_id,
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

    await supabase.from('stock').delete().eq('id', foundItem.id);

    // สร้างเลขใบเสร็จ + บันทึก receipts
    const { data: receiptNoData } = await supabase
      .rpc('generate_receipt_no', { p_shop_id: profileWithShop?.shop_id });
    
    const receiptNo = receiptNoData || `INV-${Date.now()}`;

    await supabase.from('receipts').insert({
      receipt_no: receiptNo,
      type: 'stock_sale',
      shop_name: '',
      items: [{
        name: foundItem.model,
        detail: `IMEI: ${foundItem.imei}${foundItem.color ? ` • ${foundItem.color}` : ''}${foundItem.spec ? ` • ${foundItem.spec}` : ''}`,
        price: finalPrice,
        qty: 1,
      }],
      subtotal: Number(foundItem.price),
      discount: discountValue,
      total: finalPrice,
      payment_type: paymentType,
      issued_by: user.id,
      issued_by_name: profileWithShop?.full_name,
      branch_id: foundItem.branch_id,
      shop_id: profileWithShop?.shop_id,
    });

    // เก็บข้อมูลสำหรับใบเสร็จ
    setLastSale({
      receiptNo,
      item: foundItem,
      finalPrice,
      discount: discountValue,
      paymentType,
      issuedByName: profileWithShop?.full_name,
    });

    // 🔔 ส่ง LINE Notify
    const paymentTxt = paymentType === 'cash' ? 'เงินสด' : 'ผ่อน';
    const profitTxt = costPrice > 0 ? `\n💰 กำไร: ฿${profit.toLocaleString()}` : '';
    const colorTxt = foundItem.color ? `\n🎨 สี: ${foundItem.color}` : '';
    const lineMsg = `📱 ขายเครื่องสำเร็จ\n━━━━━━━━━━━━━\n📦 ${foundItem.model}${colorTxt}\n🔢 IMEI: ${foundItem.imei}\n━━━━━━━━━━━━━\n💵 ราคา: ฿${finalPrice.toLocaleString()}\n💳 ชำระ: ${paymentTxt}${profitTxt}\n👤 พนักงาน: ${profileWithShop?.full_name || '-'}`;
    sendLineNotify(lineMsg, 'sale').catch(() => {});

    showToast('ขายสำเร็จ', `${foundItem.model} • ฿${finalPrice.toLocaleString()}`);
    setShowConfirm(false);
    setConfirming(false);
    setShowReceipt(true);
  }

  const discountValue = parseFloat(discount) || 0;
  const finalPrice = foundItem ? Number(foundItem.price) - discountValue : 0;

  return (
    <>
      <div className="page-header">
        <h1>ขายเครื่อง</h1>
        <div className="desc">ใส่ IMEI ของเครื่องที่จะขาย</div>
      </div>

      <div className="form-card">
        <h3>🔍 ค้นหาเครื่อง</h3>
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
                placeholder="356789012345678"
                style={{ flex: 1, fontFamily: 'JetBrains Mono, monospace' }}
                autoFocus
              />
              <button type="button" className="btn btn-sec"
                onClick={() => setShowScanner(true)}
                style={{ width: 'auto', padding: '0 16px', whiteSpace: 'nowrap' }}>
                📷 สแกน
              </button>
            </div>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn" disabled={searching || imei.length !== 15}>
              {searching ? 'กำลังค้นหา...' : '🔍 ค้นหาเครื่อง'}
            </button>
          </div>
        </form>
      </div>

      {foundItem && (
        <>
          <div className="form-card">
            <h3>✅ พบเครื่อง</h3>
            <div style={{
              padding: 16,
              background: 'var(--surface-2)',
              borderRadius: 'var(--radius-sm)',
              marginBottom: 16,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{foundItem.model}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-dim)', fontFamily: 'JetBrains Mono, monospace', marginTop: 2 }}>
                    {foundItem.imei}
                  </div>
                </div>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent)' }}>
                  ฿{Number(foundItem.price).toLocaleString()}
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                {foundItem.color && <span className="tag">🎨 {foundItem.color}</span>}
                {foundItem.spec && <span className="tag">{foundItem.spec}</span>}
                {foundItem.device_condition === 'new' && <span className="tag success">✨ มือ 1</span>}
                {foundItem.device_condition === 'used' && <span className="tag">📱 มือ 2</span>}
                {foundItem.branch?.name && <span className="tag">📍 {foundItem.branch.name}</span>}
              </div>
            </div>

            <div className="form-grid">
              <div className="field full">
                <label>วิธีการชำระเงิน</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" onClick={() => setPaymentType('cash')}
                    style={{
                      flex: 1, padding: 12,
                      background: paymentType === 'cash' ? 'var(--accent)' : 'var(--surface-2)',
                      color: paymentType === 'cash' ? 'white' : 'var(--text)',
                      border: 'none', borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 600,
                    }}>
                    💵 เงินสด
                  </button>
                  <button type="button" onClick={() => setPaymentType('installment')}
                    style={{
                      flex: 1, padding: 12,
                      background: paymentType === 'installment' ? 'var(--accent)' : 'var(--surface-2)',
                      color: paymentType === 'installment' ? 'white' : 'var(--text)',
                      border: 'none', borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 600,
                    }}>
                    💳 ผ่อน
                  </button>
                </div>
              </div>

              <div className="field full">
                <label>ส่วนลด (บาท)</label>
                <input type="number" inputMode="numeric" value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  placeholder="0" />
              </div>
            </div>

            <div style={{
              background: 'linear-gradient(135deg, var(--accent-strong) 0%, var(--accent) 100%)',
              borderRadius: 'var(--radius)',
              padding: 16,
              marginTop: 16,
              color: 'white',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, opacity: 0.9, marginBottom: 4 }}>
                <span>ราคาเดิม:</span>
                <span>฿{Number(foundItem.price).toLocaleString()}</span>
              </div>
              {discountValue > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, opacity: 0.9, marginBottom: 4 }}>
                  <span>ส่วนลด:</span>
                  <span>-฿{discountValue.toLocaleString()}</span>
                </div>
              )}
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                fontSize: 24, fontWeight: 700,
                paddingTop: 10, marginTop: 8,
                borderTop: '1px solid rgba(255,255,255,0.3)',
              }}>
                <span>รวมจ่าย:</span>
                <span>฿{finalPrice.toLocaleString()}</span>
              </div>
              {foundItem.cost_price && Number(foundItem.cost_price) > 0 && (
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  fontSize: 12, opacity: 0.9,
                  paddingTop: 8, marginTop: 8,
                  borderTop: '1px dashed rgba(255,255,255,0.3)',
                }}>
                  <span>💰 กำไร:</span>
                  <span style={{ fontWeight: 700 }}>฿{(finalPrice - Number(foundItem.cost_price)).toLocaleString()}</span>
                </div>
              )}
            </div>

            <div className="form-actions">
              <button className="btn" onClick={() => setShowConfirm(true)} disabled={confirming}>
                ✓ ยืนยันการขาย
              </button>
              <button className="btn btn-sec" onClick={() => { setFoundItem(null); setImei(''); setDiscount(''); }}>
                ยกเลิก
              </button>
            </div>
          </div>
        </>
      )}

      {showScanner && <BarcodeScanner onScan={handleScan} onClose={() => setShowScanner(false)} mode="imei" />}

      {showConfirm && foundItem && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowConfirm(false)}>
          <div className="modal">
            <h3>ยืนยันการขาย?</h3>
            <p className="modal-sub">
              {foundItem.model}<br />
              <strong style={{ color: 'var(--accent)', fontSize: 20 }}>฿{finalPrice.toLocaleString()}</strong>
              {' '}({paymentType === 'cash' ? 'เงินสด' : 'ผ่อน'})
            </p>
            <div className="modal-actions">
              <button className="btn" onClick={confirmSell} disabled={confirming}>
                {confirming ? 'กำลังบันทึก...' : 'ยืนยัน ✓'}
              </button>
              <button className="btn btn-sec" onClick={() => setShowConfirm(false)}>ยกเลิก</button>
            </div>
          </div>
        </div>
      )}

      {showReceipt && lastSale && (
        <ReceiptPDF
          receiptNo={lastSale.receiptNo}
          type="stock_sale"
          items={[{
            name: lastSale.item.model,
            detail: `IMEI: ${lastSale.item.imei}${lastSale.item.color ? ` • ${lastSale.item.color}` : ''}${lastSale.item.spec ? ` • ${lastSale.item.spec}` : ''}`,
            price: lastSale.finalPrice,
            qty: 1,
          }]}
          subtotal={Number(lastSale.item.price)}
          discount={lastSale.discount}
          total={lastSale.finalPrice}
          paymentType={lastSale.paymentType}
          issuedByName={lastSale.issuedByName}
          onClose={() => {
            setShowReceipt(false);
            setLastSale(null);
            setFoundItem(null);
            setImei('');
            setDiscount('');
          }}
        />
      )}

      {toast && <Toast {...toast} />}
    </>
  );
}
