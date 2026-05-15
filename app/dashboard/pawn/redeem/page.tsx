'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase-client';
import Toast from '@/components/Toast';
import BarcodeScanner from '@/components/BarcodeScanner';

export default function RedeemPage() {
  const supabase = createClient();
  const [imei, setImei] = useState('');
  const [searching, setSearching] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [foundItem, setFoundItem] = useState<any>(null);
  const [showScanner, setShowScanner] = useState(false);
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

    const { data: pawnItem } = await supabase
      .from('pawn_stock')
      .select('*, added_by_profile:profiles!pawn_stock_added_by_fkey(full_name, username)')
      .eq('imei', searchImei)
      .maybeSingle();

    setSearching(false);

    if (!pawnItem) {
      const { data: redeemed } = await supabase
        .from('pawn_history')
        .select('id')
        .eq('imei', searchImei)
        .maybeSingle();

      if (redeemed) {
        showToast('ไถ่คืนแล้ว', 'เครื่องนี้ถูกไถ่คืนไปแล้ว', 'danger');
      } else {
        showToast('ไม่พบเครื่อง', 'ไม่มีเครื่อง IMEI นี้ในสต๊อกจำนำ', 'danger');
      }
      return;
    }

    setFoundItem(pawnItem);
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

  async function confirmRedeem() {
    if (!foundItem) return;

    setConfirming(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      showToast('ไม่พบผู้ใช้', '', 'danger');
      setConfirming(false);
      return;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, shop_id')
      .eq('id', user.id)
      .single();

    const { error: insertError } = await supabase.from('pawn_history').insert({
      imei: foundItem.imei,
      model: foundItem.model,
      color: foundItem.color,
      spec: foundItem.spec,
      pawn_price: foundItem.pawn_price,
      pawn_date: foundItem.pawn_date,
      customer_name: foundItem.customer_name,
      customer_phone: foundItem.customer_phone,
      customer_note: foundItem.customer_note,
      added_by: foundItem.added_by,
      added_by_name: foundItem.added_by_name,
      redeemed_by: user.id,
      redeemed_by_name: profile?.full_name,
      redeem_date: new Date().toISOString().split('T')[0],
      branch_id: foundItem.branch_id,
      shop_id: profile?.shop_id,
    });

    if (insertError) {
      showToast('เกิดข้อผิดพลาด', insertError.message, 'danger');
      setConfirming(false);
      return;
    }

    const { error: deleteError } = await supabase
      .from('pawn_stock')
      .delete()
      .eq('id', foundItem.id);

    if (deleteError) {
      showToast('เกิดข้อผิดพลาด', deleteError.message, 'danger');
      setConfirming(false);
      return;
    }

    showToast('ไถ่คืนสำเร็จ', `${foundItem.model} - ${foundItem.customer_name}`);
    setFoundItem(null);
    setImei('');
    setConfirming(false);
  }

  return (
    <>
      <div className="page-header">
        <h2>ไถ่คืนเครื่อง</h2>
        <div className="desc">ใส่ IMEI ของเครื่องที่ลูกค้ามาไถ่</div>
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
            <h3>ยืนยันการไถ่คืน</h3>
            <p className="modal-sub">ตรวจสอบข้อมูลเครื่องและลูกค้า</p>
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
                <div className="label">ราคาจำนำ</div>
                <div className="value" style={{ color: 'var(--accent)' }}>
                  ฿{Number(foundItem.pawn_price).toLocaleString()}
                </div>
              </div>
              <div className="detail-item">
                <div className="label">วันที่จำนำ</div>
                <div className="value">{foundItem.pawn_date}</div>
              </div>
              <div className="detail-item">
                <div className="label">ลูกค้า</div>
                <div className="value">{foundItem.customer_name}</div>
              </div>
              <div className="detail-item">
                <div className="label">เบอร์</div>
                <div className="value">{foundItem.customer_phone || '-'}</div>
              </div>
              {foundItem.customer_note && (
                <div className="detail-item full">
                  <div className="label">หมายเหตุ</div>
                  <div className="value">{foundItem.customer_note}</div>
                </div>
              )}
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={confirmRedeem} disabled={confirming}>
                {confirming ? 'กำลังบันทึก...' : 'ยืนยันการไถ่คืน ✓'}
              </button>
              <button className="btn btn-sec" onClick={() => setFoundItem(null)} disabled={confirming}>
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}

      {showScanner && (
        <BarcodeScanner onScan={handleScan} onClose={() => setShowScanner(false)} mode="imei" />
      )}

      {toast && <Toast {...toast} />}
    </>
  );
}
