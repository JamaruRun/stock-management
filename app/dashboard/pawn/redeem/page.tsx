'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase-client';
import Toast from '@/components/Toast';
import { sendLineNotify } from '@/lib/line-notify';

export default function RedeemPage() {
  const supabase = createClient();
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [searched, setSearched] = useState(false);
  const [foundItem, setFoundItem] = useState<any>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [toast, setToast] = useState<{ title: string; msg: string; type: string } | null>(null);

  function showToast(title: string, msg: string, type: 'success' | 'danger' = 'success') {
    setToast({ title, msg, type });
    setTimeout(() => setToast(null), 2500);
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setSearched(true);
    setFoundItem(null);

    const q = query.trim();
    const { data } = await supabase
      .from('pawn_stock')
      .select('*, added_by_profile:profiles!pawn_stock_added_by_fkey(full_name), branch:branches(name)')
      .or(`customer_name.ilike.%${q}%,customer_phone.ilike.%${q}%`)
      .order('pawn_date', { ascending: false })
      .limit(20);

    setSearching(false);
    setResults(data || []);
  }

  async function confirmRedeem() {
    if (!foundItem) return;
    setConfirming(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setConfirming(false); return; }

    const { data: profile } = await supabase
      .from('profiles').select('full_name, shop_id').eq('id', user.id).single();

    // นับ total interest paid จาก pawn_renewals
    const { data: renewals } = await supabase
      .from('pawn_renewals')
      .select('interest_paid')
      .eq('pawn_id', foundItem.id);
    const totalInterest = (renewals || []).reduce((s: number, r: any) => s + Number(r.interest_paid || 0), 0);

    const { error: insertError } = await supabase.from('pawn_history').insert({
      imei: foundItem.imei || '',
      model: foundItem.model,
      color: foundItem.color,
      spec: foundItem.spec,
      device_password: foundItem.device_password,
      device_lock_type: foundItem.device_lock_type,
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
      interest_days: foundItem.interest_days || 30,
      renew_count: foundItem.renew_count || 0,
      total_interest_paid: totalInterest,
      exit_status: 'redeemed',
    });

    if (insertError) {
      showToast('เกิดข้อผิดพลาด', insertError.message, 'danger');
      setConfirming(false);
      return;
    }

    await supabase.from('pawn_stock').delete().eq('id', foundItem.id);

    showToast('ไถ่คืนสำเร็จ', `${foundItem.model} • ${foundItem.customer_name}`);

    // 🔔 LINE Notify
    const interestTxt = totalInterest > 0 ? `\n💰 ดอกเบี้ยที่จ่ายมาทั้งหมด: ฿${totalInterest.toLocaleString()}` : '';
    const lineMsg = `🔓 ไถ่คืนเครื่องจำนำ\n━━━━━━━━━━━━━\n📦 ${foundItem.model}\n━━━━━━━━━━━━━\n👤 ลูกค้า: ${foundItem.customer_name}\n💵 รับเงินคืน: ฿${Number(foundItem.pawn_price).toLocaleString()}${interestTxt}\n👨‍💼 รับโดย: ${profile?.full_name || '-'}`;
    sendLineNotify(lineMsg, 'pawn').catch(() => {});

    setFoundItem(null);
    setResults((r) => r.filter((i) => i.id !== foundItem.id));
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
            <label>ชื่อลูกค้า หรือ เบอร์โทร</label>
            <input type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="นายสมชาย ใจดี หรือ 0812345678"
              autoFocus />
          </div>
          <div className="form-actions">
            <button type="submit" className="btn" disabled={searching || !query.trim()}>
              {searching ? 'กำลังค้นหา...' : '🔍 ค้นหาเครื่อง'}
            </button>
          </div>
        </form>
      </div>

      {!foundItem && searched && !searching && (
        <div className="form-card">
          <h3>ผลการค้นหา ({results.length})</h3>
          {results.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">🔍</div>
              <div className="empty-title">ไม่พบรายการ</div>
              <div className="empty-sub">ไม่พบเครื่องจำนำของลูกค้ารายนี้</div>
            </div>
          ) : (
            <div className="item-list">
              {results.map((item) => (
                <div key={item.id} className="item-card" onClick={() => setFoundItem(item)} style={{ cursor: 'pointer' }}>
                  <div className="top-row">
                    <div className="model">{item.model}</div>
                    <div className="price">฿{Number(item.pawn_price).toLocaleString()}</div>
                  </div>
                  <div className="meta">
                    <span className="tag" style={{ color: '#ffa502', borderColor: '#ffa502' }}>
                      👤 {item.customer_name}
                    </span>
                    {item.customer_phone && <span className="tag">📞 {item.customer_phone}</span>}
                    {item.branch?.name && <span className="tag">📍 {item.branch.name}</span>}
                    {item.due_date && (
                      <span className="tag" style={{
                        background: new Date(item.due_date) < new Date() ? 'var(--danger-light)' : 'var(--success-light)',
                        color: new Date(item.due_date) < new Date() ? 'var(--danger-text)' : 'var(--success-text)',
                        borderColor: new Date(item.due_date) < new Date() ? 'var(--danger)' : 'var(--success)',
                      }}>
                        📅 ครบ {new Date(item.due_date).toLocaleDateString('th-TH')}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--warning)' }}>
                ฿{Number(foundItem.pawn_price).toLocaleString()}
              </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              {foundItem.color && <span className="tag">🎨 {foundItem.color}</span>}
              {foundItem.spec && <span className="tag">{foundItem.spec}</span>}
              {foundItem.branch?.name && <span className="tag">📍 {foundItem.branch.name}</span>}
              {foundItem.renew_count > 0 && (
                <span className="tag">🔄 ต่อ {foundItem.renew_count} ครั้ง</span>
              )}
              {foundItem.due_date && (
                <span className="tag" style={{
                  background: new Date(foundItem.due_date) < new Date() ? 'var(--danger-light)' : 'var(--success-light)',
                  color: new Date(foundItem.due_date) < new Date() ? 'var(--danger-text)' : 'var(--success-text)',
                  borderColor: new Date(foundItem.due_date) < new Date() ? 'var(--danger)' : 'var(--success)',
                }}>
                  📅 ครบ {new Date(foundItem.due_date).toLocaleDateString('th-TH')}
                </span>
              )}
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
            <button className="btn btn-sec" onClick={() => setFoundItem(null)}>
              กลับไปผลการค้นหา
            </button>
          </div>
        </div>
      )}

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
