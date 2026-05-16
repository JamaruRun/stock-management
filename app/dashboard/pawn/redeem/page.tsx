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
  const [showConfirm, setShowConfirm] = useState(false);
  const [toast, setToast] = useState<{ title: string; msg: string; type: string } | null>(null);

  function showToast(title: string, msg: string, type: 'success' | 'danger' = 'success') {
    setToast({ title, msg, type });
    setTimeout(() => setToast(null), 2500);
  }

  async function searchByImei(searchImei: string) {
    if (!searchImei) return;
    setSearching(true);

    const { data: item } = await supabase
      .from('pawn_stock')
      .select('*, added_by_profile:profiles!pawn_stock_added_by_fkey(full_name), branch:branches(name)')
      .eq('imei', searchImei)
      .maybeSingle();

    setSearching(false);

    if (!item) {
      showToast('ไม่พบเครื่อง', 'IMEI นี้ไม่มีในสต๊อกจำนำ', 'danger');
      return;
    }
    setFoundItem(item);
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

  async function confirmRedeem() {
    if (!foundItem) return;
    setConfirming(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setConfirming(false); return; }

    const { data: profile } = await supabase
      .from('profiles').select('full_name, shop_id').eq('id', user.id).single();

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

    await supabase.from('pawn_stock').delete().eq('id', foundItem.id);

    showToast('ไถ่คืนสำเร็จ', `${foundItem.model} • ${foundItem.customer_name}`);
    setFoundItem(null);
    setImei('');
    setShowConfirm(false);
    setConfirming(false);
  }

  return (
    <>
      <div className="page-header">
        <h1>🔓 ไถ่คืนเครื่อง</h1>
        <div className="desc">ลูกค้านำเงินมาไถ่เครื่องคืน</div>
      </div>

      <div className="form-card">
        <h3>🔍 ค้นหาเครื่อง</h3>
        <form onSubmit={handleSearch}>
          <div className="field">
            <label>IMEI</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="text" inputMode="numeric" maxLength={15}
                value={imei}
                onChange={(e) => setImei(e.target.value.replace(/\D/g, ''))}
                placeholder="356789012345678"
                style={{ flex: 1, fontFamily: 'JetBrains Mono, monospace' }}
                autoFocus />
              <button type="button" className="btn btn-sec"
                onClick={() => setShowScanner(true)}
                style={{ width: 'auto', padding: '0 16px' }}>
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
        <div className="form-card">
          <h3>✅ พบเครื่องจำนำ</h3>
          <div style={{
            padding: 16,
            background: 'var(--surface-2)',
            borderRadius: 'var(--radius-sm)',
            marginBottom: 16,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{foundItem.model}</div>
                <div style={{ fontSize: 12, color: 'var(--text-dim)', fontFamily: 'JetBrains Mono, monospace', marginTop: 2 }}>
                  {foundItem.imei}
                </div>
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--warning)' }}>
                ฿{Number(foundItem.pawn_price).toLocaleString()}
              </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              {foundItem.color && <span className="tag">🎨 {foundItem.color}</span>}
              {foundItem.spec && <span className="tag">{foundItem.spec}</span>}
              {foundItem.branch?.name && <span className="tag">📍 {foundItem.branch.name}</span>}
            </div>

            <div style={{
              borderTop: '1px solid var(--border)',
              paddingTop: 10,
              fontSize: 13,
              color: 'var(--text-dim)',
            }}>
              <div><strong style={{ color: 'var(--text)' }}>👤 ลูกค้า:</strong> {foundItem.customer_name}</div>
              {foundItem.customer_phone && (
                <div style={{ marginTop: 4 }}>
                  📞 {foundItem.customer_phone}
                </div>
              )}
              {foundItem.customer_note && (
                <div style={{ marginTop: 4 }}>
                  📝 {foundItem.customer_note}
                </div>
              )}
              <div style={{ marginTop: 4 }}>
                📅 จำนำเมื่อ {new Date(foundItem.pawn_date).toLocaleDateString('th-TH')}
              </div>
            </div>
          </div>

          <div className="form-actions">
            <button className="btn" onClick={() => setShowConfirm(true)} disabled={confirming}>
              🔓 ยืนยันการไถ่คืน
            </button>
            <button className="btn btn-sec" onClick={() => { setFoundItem(null); setImei(''); }}>
              ยกเลิก
            </button>
          </div>
        </div>
      )}

      {showScanner && <BarcodeScanner onScan={handleScan} onClose={() => setShowScanner(false)} mode="imei" />}

      {showConfirm && foundItem && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowConfirm(false)}>
          <div className="modal">
            <h3>ยืนยันการไถ่คืน?</h3>
            <p className="modal-sub">
              เครื่อง: <strong>{foundItem.model}</strong><br />
              ลูกค้า: <strong>{foundItem.customer_name}</strong><br />
              ราคาไถ่: <strong style={{ color: 'var(--warning)' }}>฿{Number(foundItem.pawn_price).toLocaleString()}</strong>
            </p>
            <div className="modal-actions">
              <button className="btn" onClick={confirmRedeem} disabled={confirming}>
                {confirming ? 'กำลังบันทึก...' : 'ยืนยัน ✓'}
              </button>
              <button className="btn btn-sec" onClick={() => setShowConfirm(false)}>ยกเลิก</button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast {...toast} />}
    </>
  );
}
