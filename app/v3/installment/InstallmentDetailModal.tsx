'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase-client';
import {
  CreditCard, X, Smartphone, User, Phone, Calendar, CheckCircle2, Loader2, Wallet,
} from 'lucide-react';

interface Props { itemId: string; onClose: () => void; onPay?: () => void; }

export default function InstallmentDetailModal({ itemId, onClose, onPay }: Props) {
  const supabase = createClient();
  const [item, setItem] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [itemRes, payRes] = await Promise.all([
        supabase.from('installment_stock').select('*').eq('id', itemId).single(),
        supabase.from('installment_payments').select('*').eq('installment_id', itemId).order('period_number', { ascending: true }),
      ]);
      setItem(itemRes.data);
      setPayments(payRes.data || []);
      setLoading(false);
    }
    load();
  }, [itemId]);

  const paidPeriods = payments.length;
  const totalPeriods = item?.total_periods || 0;
  const remainingPeriods = totalPeriods - paidPeriods;
  const totalPaid = payments.reduce((s, p) => s + Number(p.amount), 0) + Number(item?.down_payment || 0);
  const totalContract = Number(item?.full_price || 0);
  const remaining = Math.max(0, totalContract - totalPaid);
  const pct = totalPeriods > 0 ? Math.round((paidPeriods / totalPeriods) * 100) : 0;

  return (
    <div onClick={onClose} style={ov}>
      <div onClick={(e) => e.stopPropagation()} className="v3-card" style={{ maxWidth: 480, width: '100%', padding: 0, maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {loading || !item ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-dim)' }}><Loader2 size={24} className="v3-spin" /></div>
        ) : (
          <>
            <div style={headerSt}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#ede9fe', color: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><CreditCard size={18} /></div>
                <div style={{ minWidth: 0 }}>
                  <h2 style={{ fontSize: 15, fontWeight: 700, fontFamily: 'Prompt, sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.model}</h2>
                  <p style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'monospace' }}>{item.imei}</p>
                </div>
              </div>
              <button onClick={onClose} style={closeBtn}><X size={16} /></button>
            </div>

            <div style={{ overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* ลูกค้า */}
              <div style={{ fontSize: 12, color: 'var(--text-dim)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <span><User size={11} style={{ display: 'inline', verticalAlign: '-1px' }} /> {item.customer_name}</span>
                {item.customer_phone && <a href={`tel:${item.customer_phone}`} style={{ color: '#16a34a' }}><Phone size={11} style={{ display: 'inline', verticalAlign: '-1px' }} /> {item.customer_phone}</a>}
              </div>

              {/* progress */}
              <div style={{ background: 'var(--surface-2)', borderRadius: 12, padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                  <span style={{ fontWeight: 700 }}>ผ่อนแล้ว {paidPeriods}/{totalPeriods} งวด</span>
                  <span style={{ color: '#8b5cf6', fontWeight: 700 }}>{pct}%</span>
                </div>
                <div style={{ height: 8, background: 'var(--border)', borderRadius: 100, overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, #8b5cf6, #6d28d9)', borderRadius: 100 }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 12 }}>
                  <div><div style={{ color: 'var(--text-dim)', fontSize: 10 }}>ชำระแล้ว</div><div style={{ fontWeight: 700, color: '#16a34a' }}>฿{totalPaid.toLocaleString()}</div></div>
                  <div style={{ textAlign: 'center' }}><div style={{ color: 'var(--text-dim)', fontSize: 10 }}>ยอดเต็ม</div><div style={{ fontWeight: 700 }}>฿{totalContract.toLocaleString()}</div></div>
                  <div style={{ textAlign: 'right' }}><div style={{ color: 'var(--text-dim)', fontSize: 10 }}>คงเหลือ</div><div style={{ fontWeight: 700, color: remaining > 0 ? '#ef4444' : '#16a34a' }}>฿{remaining.toLocaleString()}</div></div>
                </div>
              </div>

              {/* ข้อมูลสัญญา */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <Info label="เงินดาวน์" value={`฿${Number(item.down_payment || 0).toLocaleString()}`} />
                <Info label="ค่างวด/เดือน" value={`฿${Number(item.installment_amount || 0).toLocaleString()}`} />
              </div>

              {/* รายการงวด */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>ประวัติการชำระ</div>
                {payments.length === 0 ? (
                  <div style={{ padding: 12, textAlign: 'center', fontSize: 12, color: 'var(--text-dim)', background: 'var(--surface-2)', borderRadius: 10 }}>ยังไม่มีการชำระงวด</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {payments.map(p => (
                      <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, background: 'var(--surface-2)', borderRadius: 10 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: '#dcfce7', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><CheckCircle2 size={15} /></div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>งวดที่ {p.period_number}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{p.payment_date ? new Date(p.payment_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) : '-'}</div>
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#16a34a' }}>฿{Number(p.amount).toLocaleString()}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {remainingPeriods > 0 && onPay && (
                <button onClick={onPay} style={{ width: '100%', padding: 14, background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)', color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <Wallet size={17} /> รับชำระงวดถัดไป (งวด {paidPeriods + 1})
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Info({ label, value }: any) {
  return (
    <div style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '8px 12px' }}>
      <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'Prompt, sans-serif' }}>{value}</div>
    </div>
  );
}

const ov: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 };
const headerSt: React.CSSProperties = { padding: '16px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 };
const closeBtn: React.CSSProperties = { width: 32, height: 32, background: 'var(--surface-2)', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 };
