'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';
import BarcodeScanner from '@/components/BarcodeScanner';
import ReceiptPDF from '@/components/ReceiptPDF';
import {
  Search, ShoppingCart, Smartphone, Barcode, X,
  Wallet, ArrowRightLeft, CreditCard, Calendar, Printer,
  CheckCircle2, AlertTriangle,
} from 'lucide-react';

export default function V3SellPage() {
  return (
    <Suspense fallback={<div className="v3-card" style={{ padding: 40, textAlign: 'center' }}>กำลังโหลด...</div>}>
      <V3SellContent />
    </Suspense>
  );
}

function V3SellContent() {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const imeiFromUrl = searchParams.get('imei') || '';
  const inputRef = useRef<HTMLInputElement>(null);

  const [imeiInput, setImeiInput] = useState(imeiFromUrl);
  const [showScanner, setShowScanner] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [item, setItem] = useState<any>(null);

  const [discount, setDiscount] = useState('');
  const [paymentType, setPaymentType] = useState<'cash' | 'transfer' | 'credit' | 'installment'>('cash');
  const [confirming, setConfirming] = useState(false);
  const [success, setSuccess] = useState<{ receipt: string; price: number } | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [soldSnapshot, setSoldSnapshot] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, shop_id, role, is_super_admin')
        .eq('id', user.id)
        .single();
      setProfile(data);
    })();
  }, []);

  useEffect(() => {
    if (imeiFromUrl && imeiFromUrl.length >= 14) {
      searchByImei(imeiFromUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imeiFromUrl]);

  useEffect(() => {
    if (!item) inputRef.current?.focus();
  }, [item]);

  async function searchByImei(searchImei: string) {
    if (!searchImei || searchImei.length < 14) {
      setSearchError('IMEI ต้องมี 14-15 หลัก');
      return;
    }

    setSearching(true);
    setSearchError(null);
    setItem(null);

    const { data, error } = await supabase
      .from('stock')
      .select('*, branches(name), suppliers(name)')
      .eq('imei', searchImei)
      .maybeSingle();

    if (error) {
      setSearchError('เกิดข้อผิดพลาดในการค้นหา');
      setSearching(false);
      return;
    }

    if (!data) {
      const { data: sold } = await supabase
        .from('sales_history')
        .select('id, model, sold_date')
        .eq('imei', searchImei)
        .maybeSingle();

      if (sold) {
        setSearchError(`เครื่องนี้ขายไปแล้ว เมื่อ ${new Date(sold.sold_date).toLocaleDateString('th-TH')}`);
      } else {
        setSearchError('ไม่พบเครื่องนี้ในระบบ');
      }
      setSearching(false);
      return;
    }

    setItem(data);
    setDiscount('');
    setSearching(false);
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    searchByImei(imeiInput.trim());
  }

  function reset() {
    setItem(null);
    setImeiInput('');
    setDiscount('');
    setPaymentType('cash');
    setSearchError(null);
    setSuccess(null);
    setTimeout(() => inputRef.current?.focus(), 100);
  }

  async function confirmSale() {
    if (!item || !profile) return;
    const discountValue = parseFloat(discount) || 0;
    const finalPrice = Number(item.price) - discountValue;

    if (discountValue < 0) { alert('ส่วนลดต้องไม่ติดลบ'); return; }
    if (finalPrice < 0) { alert('ราคาสุทธิติดลบ'); return; }

    if (!confirm(`ยืนยันการขาย ${item.model} ในราคา ฿${finalPrice.toLocaleString()}?`)) return;

    setConfirming(true);
    try {
      const costPrice = Number(item.cost_price) || 0;
      const profit = finalPrice - costPrice;

      const { error: insertError } = await supabase.from('sales_history').insert({
        imei: item.imei,
        model: item.model,
        color: item.color,
        spec: item.spec,
        price: item.price,
        cost_price: costPrice,
        profit: profit,
        supplier_id: item.supplier_id,
        discount: discountValue,
        final_price: finalPrice,
        added_date: item.added_date,
        added_by: item.added_by,
        added_by_name: item.added_by_name,
        sold_by: profile.id,
        sold_by_name: profile.full_name,
        sold_date: new Date().toISOString().split('T')[0],
        branch_id: item.branch_id,
        device_condition: item.device_condition,
        payment_type: paymentType === 'installment' ? 'installment' : 'cash',
        shop_id: profile.shop_id,
        image_url: item.image_url || null,
      });

      if (insertError) {
        alert('บันทึกไม่สำเร็จ: ' + insertError.message);
        setConfirming(false);
        return;
      }

      await supabase.from('stock').delete().eq('id', item.id);

      const { data: receiptNoData } = await supabase
        .rpc('generate_receipt_no', { p_shop_id: profile.shop_id });
      const receiptNo = receiptNoData || `INV-${Date.now()}`;

      try {
        await supabase.from('receipts').insert({
          receipt_no: receiptNo,
          type: 'stock_sale',
          shop_name: '',
          items: [{
            name: item.model,
            detail: `IMEI: ${item.imei}${item.color ? ` • ${item.color}` : ''}${item.spec ? ` • ${item.spec}` : ''}`,
            qty: 1,
            price: Number(item.price),
            discount: discountValue,
            subtotal: finalPrice,
          }],
          subtotal: Number(item.price),
          discount: discountValue,
          total: finalPrice,
          customer_name: '',
          payment_method: paymentType,
          created_by: profile.id,
          created_by_name: profile.full_name,
          branch_id: item.branch_id,
          shop_id: profile.shop_id,
        });
      } catch (e) { console.warn('receipt save failed:', e); }

      setSoldSnapshot({
        receiptNo, model: item.model,
        detail: `IMEI: ${item.imei}${item.color ? ` • ${item.color}` : ''}${item.spec ? ` • ${item.spec}` : ''}`,
        price: Number(item.price), discount: discountValue, total: finalPrice,
        paymentType, issuedBy: profile.full_name,
      });
      setSuccess({ receipt: receiptNo, price: finalPrice });
      setConfirming(false);
    } catch (e: any) {
      alert('เกิดข้อผิดพลาด: ' + e.message);
      setConfirming(false);
    }
  }

  const discountValue = parseFloat(discount) || 0;
  const finalPrice = item ? Number(item.price) - discountValue : 0;
  const profit = item ? finalPrice - (Number(item.cost_price) || 0) : 0;
  const isAdmin = profile?.role === 'admin' || profile?.is_super_admin;

  if (success) {
    return (
      <div className="v3-card" style={{ padding: 40, textAlign: 'center', maxWidth: 480, margin: '0 auto' }}>
        <div style={{
          width: 80, height: 80,
          margin: '0 auto 16px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #22c55e, #16a34a)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff',
        }}>
          <CheckCircle2 size={44} strokeWidth={2.5} />
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 800, fontFamily: 'Prompt, sans-serif', marginBottom: 8 }}>
          ขายสำเร็จ! 🎉
        </h2>
        <p style={{ color: 'var(--text-dim)', fontSize: 13, marginBottom: 6 }}>
          เลขใบเสร็จ: <strong style={{ color: 'var(--text)' }}>{success.receipt}</strong>
        </p>
        <p style={{
          fontSize: 36, fontWeight: 800,
          fontFamily: 'Prompt, sans-serif',
          color: 'var(--accent)',
          margin: '14px 0',
        }}>
          ฿{success.price.toLocaleString()}
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => setShowReceipt(true)} className="v3-btn" style={{ background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', color: '#fff', border: 'none' }}>
            <Printer size={14} /> พิมพ์ใบเสร็จ
          </button>
          <button onClick={reset} className="v3-btn v3-btn-primary">
            <ShoppingCart size={14} /> ขายเครื่องถัดไป
          </button>
          <Link href="/v3/stock" className="v3-btn v3-btn-secondary" style={{ textDecoration: 'none' }}>
            กลับสต๊อก
          </Link>
        </div>
        {showReceipt && soldSnapshot && (
          <ReceiptPDF
            receiptNo={soldSnapshot.receiptNo}
            type="stock_sale"
            items={[{ name: soldSnapshot.model, detail: soldSnapshot.detail, qty: 1, price: soldSnapshot.price }]}
            subtotal={soldSnapshot.price}
            discount={soldSnapshot.discount}
            total={soldSnapshot.total}
            paymentType={soldSnapshot.paymentType}
            issuedByName={soldSnapshot.issuedBy}
            onClose={() => setShowReceipt(false)}
          />
        )}
      </div>
    );
  }

  return (
    <>
      <div className="v3-page-header v3-desktop-only">
        <div>
          <h1 className="v3-page-title">ขายสินค้า</h1>
          <p className="v3-page-subtitle">สแกน IMEI หรือ Barcode เพื่อเริ่มขาย</p>
        </div>
      </div>

      <div className="v3-mobile-only" style={{ marginBottom: 12 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, fontFamily: 'Prompt, sans-serif' }}>ขายสินค้า</h1>
        <p style={{ fontSize: 11, color: 'var(--text-dim)' }}>สแกนหรือพิมพ์ IMEI เพื่อเริ่ม</p>
      </div>

      <div className="v3-card" style={{ padding: 12, marginBottom: 14 }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Barcode size={18} style={{
              position: 'absolute', left: 12, top: '50%',
              transform: 'translateY(-50%)', color: 'var(--text-muted)',
              pointerEvents: 'none',
            }} />
            <input
              ref={inputRef}
              type="text"
              value={imeiInput}
              onChange={(e) => {
                setImeiInput(e.target.value.replace(/\D/g, ''));
                setSearchError(null);
              }}
              placeholder="สแกน IMEI หรือพิมพ์เอง..."
              maxLength={20}
              style={{
                width: '100%',
                height: 44,
                padding: '0 12px 0 40px',
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                color: 'var(--text)',
                fontSize: 14,
                fontFamily: 'monospace',
                outline: 'none',
              }}
            />
          </div>
          <button
            type="button"
            onClick={() => setShowScanner(true)}
            title="สแกนด้วยกล้อง"
            style={{
              width: 44, height: 44, flexShrink: 0,
              background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 10,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            }}
          >
            <Barcode size={20} />
          </button>
          <button
            type="submit"
            disabled={searching || imeiInput.length < 14}
            style={{
              padding: '0 18px',
              height: 44,
              background: imeiInput.length >= 14 ? 'var(--accent)' : 'var(--surface-2)',
              color: imeiInput.length >= 14 ? '#fff' : 'var(--text-muted)',
              border: 'none',
              borderRadius: 10,
              fontWeight: 700,
              fontSize: 13,
              cursor: imeiInput.length >= 14 ? 'pointer' : 'not-allowed',
              fontFamily: 'inherit',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
          >
            <Search size={16} /> ค้นหา
          </button>
        </form>

        {searchError && (
          <div style={{
            marginTop: 10,
            padding: 10,
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 10,
            color: '#991b1b',
            fontSize: 12,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <AlertTriangle size={14} />
            {searchError}
          </div>
        )}
      </div>

      {!item && !searchError && !searching && (
        <div className="v3-card" style={{ padding: 40, textAlign: 'center' }}>
          <div style={{
            width: 64, height: 64,
            margin: '0 auto 14px',
            borderRadius: '50%',
            background: 'var(--surface-2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-muted)',
          }}>
            <Barcode size={32} strokeWidth={1.5} />
          </div>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>
            เริ่มการขาย
          </h3>
          <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>
            สแกนหรือพิมพ์ IMEI เครื่องที่ต้องการขาย
          </p>
        </div>
      )}

      {searching && (
        <div className="v3-card" style={{ padding: 30, textAlign: 'center', color: 'var(--text-dim)' }}>
          กำลังค้นหา...
        </div>
      )}

      {item && (
        <div className="v3-sell-grid">
          <div className="v3-card" style={{ padding: 16 }}>
            <div style={{ display: 'flex', gap: 14 }}>
              <div style={{
                width: 100, height: 130,
                background: '#f8fafc',
                borderRadius: 12,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
                overflow: 'hidden',
              }}>
                {item.image_url ? (
                  <img
                    src={item.image_url}
                    alt={item.model}
                    style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 8 }}
                  />
                ) : (
                  <Smartphone size={48} color="#94a3b8" strokeWidth={1.5} />
                )}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{
                  fontSize: 18, fontWeight: 700,
                  fontFamily: 'Prompt, Sarabun, sans-serif',
                  marginBottom: 4,
                }}>
                  {item.model}
                </h3>
                {item.spec && (
                  <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 2 }}>{item.spec}</div>
                )}
                {item.color && (
                  <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8 }}>🎨 {item.color}</div>
                )}
                <div style={{
                  fontSize: 11,
                  fontFamily: 'monospace',
                  color: 'var(--text-muted)',
                  background: 'var(--surface-2)',
                  padding: '4px 8px',
                  borderRadius: 6,
                  marginBottom: 10,
                  display: 'inline-block',
                  maxWidth: '100%',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  IMEI: {item.imei}
                </div>
                <div>
                  <span style={{
                    display: 'inline-block',
                    padding: '4px 10px',
                    background: '#dcfce7',
                    color: '#166534',
                    fontSize: 10,
                    fontWeight: 600,
                    borderRadius: 100,
                  }}>
                    ✓ พร้อมขาย
                  </span>
                </div>
              </div>

              <button
                onClick={reset}
                style={{
                  width: 32, height: 32,
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  cursor: 'pointer',
                  color: 'var(--text-dim)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}
                title="ค้นหาเครื่องอื่น"
              >
                <X size={16} />
              </button>
            </div>

            {isAdmin && (
              <div style={{
                marginTop: 14,
                paddingTop: 14,
                borderTop: '1px dashed var(--border)',
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 10,
                fontSize: 11,
              }}>
                <div>
                  <div style={{ color: 'var(--text-dim)', marginBottom: 2 }}>ต้นทุน</div>
                  <div style={{
                    fontWeight: 700,
                    fontFamily: 'Prompt, sans-serif',
                    color: item.cost_price && Number(item.cost_price) > 0 ? 'var(--text)' : 'var(--text-muted)',
                    fontStyle: !item.cost_price ? 'italic' : 'normal',
                    fontSize: 14,
                  }}>
                    {item.cost_price && Number(item.cost_price) > 0
                      ? `฿${Number(item.cost_price).toLocaleString()}`
                      : 'ไม่มี'}
                  </div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-dim)', marginBottom: 2 }}>ราคาขาย</div>
                  <div style={{ fontWeight: 700, fontFamily: 'Prompt, sans-serif', color: 'var(--accent)', fontSize: 14 }}>
                    ฿{Number(item.price).toLocaleString()}
                  </div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-dim)', marginBottom: 2 }}>กำไรคาด</div>
                  <div style={{
                    fontWeight: 700,
                    fontFamily: 'Prompt, sans-serif',
                    color: item.cost_price && Number(item.cost_price) > 0
                      ? (profit > 0 ? '#22c55e' : '#ef4444')
                      : 'var(--text-muted)',
                    fontStyle: !item.cost_price ? 'italic' : 'normal',
                    fontSize: 14,
                  }}>
                    {item.cost_price && Number(item.cost_price) > 0
                      ? `฿${profit.toLocaleString()}`
                      : 'ไม่มี'}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="v3-card" style={{ padding: 16 }}>
            <h3 style={{
              fontSize: 15, fontWeight: 700,
              fontFamily: 'Prompt, sans-serif',
              marginBottom: 12,
            }}>
              สรุปการขาย
            </h3>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 5 }}>
                ส่วนลด (บาท)
              </label>
              <input
                type="number"
                inputMode="numeric"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                placeholder="0"
                min="0"
                max={Number(item.price)}
                style={{
                  width: '100%',
                  height: 40,
                  padding: '0 12px',
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  color: 'var(--text)',
                  fontSize: 14,
                  fontFamily: 'inherit',
                  outline: 'none',
                }}
              />
            </div>

            <div style={{
              background: 'var(--surface-2)',
              borderRadius: 12,
              padding: 12,
              marginBottom: 14,
            }}>
              <Row label="ราคาสินค้า" value={`฿${Number(item.price).toLocaleString()}`} />
              {discountValue > 0 && (
                <Row label="ส่วนลด" value={`-฿${discountValue.toLocaleString()}`} color="#ef4444" />
              )}
              <div style={{
                borderTop: '1px dashed var(--border)',
                marginTop: 8,
                paddingTop: 10,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
              }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>รวมทั้งหมด</span>
                <span style={{
                  fontSize: 24, fontWeight: 800,
                  color: 'var(--accent)',
                  fontFamily: 'Prompt, Sarabun, sans-serif',
                }}>
                  ฿{finalPrice.toLocaleString()}
                </span>
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 6 }}>
                ช่องทางการชำระเงิน
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
                <PaymentButton active={paymentType === 'cash'} onClick={() => setPaymentType('cash')} Icon={Wallet} label="เงินสด" color="#22c55e" />
                <PaymentButton active={paymentType === 'transfer'} onClick={() => setPaymentType('transfer')} Icon={ArrowRightLeft} label="โอน" color="#3b82f6" />
                <PaymentButton active={paymentType === 'credit'} onClick={() => setPaymentType('credit')} Icon={CreditCard} label="บัตรเครดิต" color="#8b5cf6" />
                <PaymentButton active={paymentType === 'installment'} onClick={() => setPaymentType('installment')} Icon={Calendar} label="ผ่อน" color="#f59e0b" />
              </div>
            </div>

            <button
              onClick={confirmSale}
              disabled={confirming || finalPrice <= 0}
              style={{
                width: '100%',
                padding: '14px',
                background: confirming || finalPrice <= 0
                  ? 'var(--surface-2)'
                  : 'linear-gradient(135deg, #3b82f6, #2563eb)',
                color: confirming || finalPrice <= 0 ? 'var(--text-muted)' : '#fff',
                border: 'none',
                borderRadius: 12,
                fontSize: 15,
                fontWeight: 700,
                fontFamily: 'inherit',
                cursor: confirming || finalPrice <= 0 ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                boxShadow: confirming || finalPrice <= 0 ? 'none' : '0 4px 12px rgba(59, 130, 246, 0.3)',
              }}
            >
              <CheckCircle2 size={18} />
              {confirming ? 'กำลังบันทึก...' : `บันทึกการขาย ฿${finalPrice.toLocaleString()}`}
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        :global(.v3-sell-grid) {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        @media (max-width: 900px) {
          :global(.v3-sell-grid) {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      {showScanner && (
        <BarcodeScanner
          mode="imei"
          onScan={(code) => {
            const clean = code.replace(/\D/g, '').substring(0, 20);
            setImeiInput(clean);
            setShowScanner(false);
            if (clean.length >= 14) searchByImei(clean);
          }}
          onClose={() => setShowScanner(false)}
        />
      )}
    </>
  );
}

function Row({ label, value, color }: any) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: 12,
      padding: '3px 0',
    }}>
      <span style={{ color: 'var(--text-dim)' }}>{label}</span>
      <span style={{ fontWeight: 600, color: color || 'var(--text)' }}>{value}</span>
    </div>
  );
}

function PaymentButton({ active, onClick, Icon, label, color }: any) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '10px 8px',
        background: active ? `${color}15` : 'var(--surface)',
        border: '1px solid',
        borderColor: active ? color : 'var(--border)',
        borderRadius: 10,
        color: active ? color : 'var(--text)',
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
        fontFamily: 'inherit',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        transition: 'all 0.15s',
      }}
    >
      <Icon size={18} strokeWidth={active ? 2.4 : 2} />
      <span>{label}</span>
    </button>
  );
}
