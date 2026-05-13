'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';
import Toast from '@/components/Toast';

function InstallmentDetailContent() {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = searchParams.get('id');

  const [item, setItem] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [toast, setToast] = useState<{ title: string; msg: string; type: string } | null>(null);

  // Form for new payment
  const [newPayment, setNewPayment] = useState({
    amount: '',
    paymentDate: new Date().toISOString().split('T')[0],
    note: '',
  });

  // Edit form
  const [editForm, setEditForm] = useState<any>({});

  function showToast(title: string, msg: string, type: 'success' | 'danger' = 'success') {
    setToast({ title, msg, type });
    setTimeout(() => setToast(null), 2500);
  }

  async function loadData() {
    if (!id) return;
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data: profileData } = await supabase
      .from('profiles').select('*').eq('id', user.id).single();
    setProfile(profileData);

    const { data: itemData } = await supabase
      .from('installment_stock')
      .select('*, added_by_profile:profiles!installment_stock_added_by_fkey(full_name), branch:branches(name)')
      .eq('id', id)
      .single();

    setItem(itemData);
    setEditForm(itemData);

    const { data: paymentsData } = await supabase
      .from('installment_payments')
      .select('*, paid_by_profile:profiles!installment_payments_paid_by_fkey(full_name)')
      .eq('installment_id', id)
      .order('period_number', { ascending: true });

    setPayments(paymentsData || []);
    setNewPayment(prev => ({ ...prev, amount: itemData?.installment_amount?.toString() || '' }));

    setLoading(false);
  }

  useEffect(() => { loadData(); }, [id]);

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <div>กำลังโหลด...</div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="empty">
        <div className="empty-icon">❌</div>
        <div className="empty-title">ไม่พบข้อมูล</div>
        <button className="btn" onClick={() => router.push('/dashboard/installment/stock')} style={{ marginTop: 16, maxWidth: 200, margin: '16px auto' }}>
          ← กลับไปสต๊อก
        </button>
      </div>
    );
  }

  const isAdmin = profile?.role === 'admin';
  const paidPeriods = payments.length;
  const remainingPeriods = item.total_periods - paidPeriods;
  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const totalToBePaid = Number(item.installment_amount) * item.total_periods;
  const remainingAmount = totalToBePaid - totalPaid;
  const isComplete = remainingPeriods <= 0;

  async function addPayment() {
    if (!newPayment.amount) {
      showToast('กรุณาใส่จำนวนเงิน', '', 'danger');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const periodNumber = paidPeriods + 1;

    // คำนวณวันครบกำหนดของงวดนี้ (เริ่มจาก start_date + เดือนที่เท่ากับ periodNumber)
    const startDate = new Date(item.start_date);
    const dueDate = new Date(startDate);
    dueDate.setMonth(dueDate.getMonth() + periodNumber);

    const { error } = await supabase.from('installment_payments').insert({
      installment_id: item.id,
      period_number: periodNumber,
      amount: parseFloat(newPayment.amount),
      payment_date: newPayment.paymentDate,
      due_date: dueDate.toISOString().split('T')[0],
      paid_by: user.id,
      paid_by_name: profile?.full_name,
      note: newPayment.note || null,
      shop_id: item.shop_id,
    });

    if (error) {
      showToast('เกิดข้อผิดพลาด', error.message, 'danger');
      return;
    }

    showToast('บันทึกการชำระแล้ว', `งวดที่ ${periodNumber}`);
    setShowAddPayment(false);
    setNewPayment({ amount: item.installment_amount.toString(), paymentDate: new Date().toISOString().split('T')[0], note: '' });
    loadData();
  }

  async function deletePayment(paymentId: string, periodNumber: number) {
    if (!confirm(`ลบการชำระงวดที่ ${periodNumber}?`)) return;

    const { error } = await supabase.from('installment_payments').delete().eq('id', paymentId);
    if (error) {
      showToast('เกิดข้อผิดพลาด', error.message, 'danger');
      return;
    }
    showToast('ลบการชำระแล้ว', '');
    loadData();
  }

  async function saveEdit() {
    const { error } = await supabase
      .from('installment_stock')
      .update({
        imei: editForm.imei,
        model: editForm.model,
        color: editForm.color,
        spec: editForm.spec,
        full_price: parseFloat(editForm.full_price),
        down_payment: parseFloat(editForm.down_payment),
        installment_amount: parseFloat(editForm.installment_amount),
        total_periods: parseInt(editForm.total_periods),
        customer_name: editForm.customer_name,
        customer_phone: editForm.customer_phone,
        customer_id_card: editForm.customer_id_card,
        customer_address: editForm.customer_address,
        customer_note: editForm.customer_note,
      })
      .eq('id', item.id);

    if (error) {
      showToast('เกิดข้อผิดพลาด', error.message, 'danger');
      return;
    }
    showToast('บันทึกสำเร็จ', '');
    setShowEdit(false);
    loadData();
  }

  async function closeInstallment() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // เพิ่มเข้าประวัติ
    const { error: insertError } = await supabase.from('installment_history').insert({
      imei: item.imei,
      model: item.model,
      color: item.color,
      spec: item.spec,
      full_price: item.full_price,
      down_payment: item.down_payment,
      installment_amount: item.installment_amount,
      total_periods: item.total_periods,
      start_date: item.start_date,
      completed_date: new Date().toISOString().split('T')[0],
      customer_name: item.customer_name,
      customer_phone: item.customer_phone,
      customer_id_card: item.customer_id_card,
      customer_address: item.customer_address,
      customer_note: item.customer_note,
      added_by: item.added_by,
      added_by_name: item.added_by_name,
      closed_by: user.id,
      closed_by_name: profile?.full_name,
      branch_id: item.branch_id,
      payment_history: payments,
      shop_id: item.shop_id,
    });

    if (insertError) {
      showToast('เกิดข้อผิดพลาด', insertError.message, 'danger');
      return;
    }

    // ลบจาก stock
    const { error: deleteError } = await supabase
      .from('installment_stock')
      .delete()
      .eq('id', item.id);

    if (deleteError) {
      showToast('เกิดข้อผิดพลาด', deleteError.message, 'danger');
      return;
    }

    showToast('ปิดยอดสำเร็จ', `${item.model} - ${item.customer_name}`);
    setShowCloseConfirm(false);
    router.push('/dashboard/installment/stock');
  }

  async function deleteItem() {
    const { error } = await supabase.from('installment_stock').delete().eq('id', item.id);
    if (error) {
      showToast('เกิดข้อผิดพลาด', error.message, 'danger');
      return;
    }
    showToast('ลบแล้ว', '');
    router.push('/dashboard/installment/stock');
  }

  return (
    <>
      <div className="page-header">
        <button onClick={() => router.push('/dashboard/installment/stock')}
          style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 13, marginBottom: 8, padding: 0, fontFamily: 'inherit' }}>
          ← กลับไปสต๊อก
        </button>
        <h2>{item.model}</h2>
        <div className="desc">{item.customer_name} • {item.customer_phone}</div>
      </div>

      {/* Summary */}
      <div className="stats">
        <div className="stat">
          <div className="label">// PROGRESS</div>
          <div className="value accent">{paidPeriods}/{item.total_periods}</div>
        </div>
        <div className="stat">
          <div className="label">// PAID</div>
          <div className="value small" style={{ color: 'var(--success)' }}>฿{totalPaid.toLocaleString()}</div>
        </div>
        <div className="stat">
          <div className="label">// REMAINING</div>
          <div className="value small" style={{ color: remainingAmount > 0 ? 'var(--warning)' : 'var(--success)' }}>
            ฿{remainingAmount.toLocaleString()}
          </div>
        </div>
        <div className="stat">
          <div className="label">// PER PERIOD</div>
          <div className="value small">฿{Number(item.installment_amount).toLocaleString()}</div>
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        {!isComplete && (
          <button className="btn" onClick={() => setShowAddPayment(true)} style={{ flex: '1 1 200px' }}>
            + บันทึกชำระงวดที่ {paidPeriods + 1}
          </button>
        )}
        {isComplete && (
          <button className="btn" onClick={() => setShowCloseConfirm(true)} style={{ flex: '1 1 200px', background: 'var(--success)', color: '#fff' }}>
            ✓ ปิดยอด (ผ่อนหมด)
          </button>
        )}
        {isAdmin && (
          <>
            <button className="btn btn-sec" onClick={() => setShowEdit(true)} style={{ flex: '1 1 100px' }}>
              ✎ แก้ไข
            </button>
            <button className="btn btn-danger" onClick={() => setShowDelete(true)} style={{ flex: '1 1 100px' }}>
              × ลบ
            </button>
          </>
        )}
      </div>

      {/* Device Info */}
      <div className="form-card">
        <h3>ข้อมูลเครื่อง</h3>
        <div className="detail-grid">
          <div className="detail-item full">
            <div className="label">IMEI</div>
            <div className="value mono">{item.imei}</div>
          </div>
          <div className="detail-item">
            <div className="label">รุ่น</div>
            <div className="value">{item.model}</div>
          </div>
          <div className="detail-item">
            <div className="label">สี</div>
            <div className="value">{item.color || '-'}</div>
          </div>
          <div className="detail-item">
            <div className="label">สเปค</div>
            <div className="value">{item.spec || '-'}</div>
          </div>
          <div className="detail-item">
            <div className="label">วันที่เริ่มผ่อน</div>
            <div className="value">{item.start_date}</div>
          </div>
        </div>
      </div>

      {/* Customer Info */}
      <div className="form-card">
        <h3>ข้อมูลลูกค้า</h3>
        <div className="detail-grid">
          <div className="detail-item">
            <div className="label">ชื่อ</div>
            <div className="value">{item.customer_name}</div>
          </div>
          <div className="detail-item">
            <div className="label">เบอร์โทร</div>
            <div className="value">
              <a href={`tel:${item.customer_phone}`} style={{ color: 'var(--accent)' }}>
                {item.customer_phone}
              </a>
            </div>
          </div>
          <div className="detail-item full">
            <div className="label">เลขบัตรประชาชน</div>
            <div className="value mono">{item.customer_id_card}</div>
          </div>
          {item.customer_address && (
            <div className="detail-item full">
              <div className="label">ที่อยู่</div>
              <div className="value">{item.customer_address}</div>
            </div>
          )}
          {item.customer_note && (
            <div className="detail-item full">
              <div className="label">หมายเหตุ</div>
              <div className="value">{item.customer_note}</div>
            </div>
          )}
        </div>
      </div>

      {/* Financial Info */}
      <div className="form-card">
        <h3>ข้อมูลการเงิน</h3>
        <div className="detail-grid">
          <div className="detail-item">
            <div className="label">ราคาเต็ม</div>
            <div className="value">฿{Number(item.full_price).toLocaleString()}</div>
          </div>
          <div className="detail-item">
            <div className="label">เงินดาวน์</div>
            <div className="value">฿{Number(item.down_payment).toLocaleString()}</div>
          </div>
          <div className="detail-item">
            <div className="label">ยอดผ่อน/งวด</div>
            <div className="value">฿{Number(item.installment_amount).toLocaleString()}</div>
          </div>
          <div className="detail-item">
            <div className="label">จำนวนงวด</div>
            <div className="value">{item.total_periods} งวด</div>
          </div>
          <div className="detail-item full">
            <div className="label">เพิ่มโดย</div>
            <div className="value">
              {item.added_by_profile?.full_name || (item.added_by_name ? `${item.added_by_name} (ลาออก)` : '-')}
            </div>
          </div>
        </div>
      </div>

      {/* Payment History */}
      <div className="form-card">
        <h3>ประวัติการชำระ ({paidPeriods}/{item.total_periods})</h3>
        {payments.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">📅</div>
            <div className="empty-title">ยังไม่มีการชำระ</div>
            <div className="empty-sub">กดปุ่ม "บันทึกชำระ" ด้านบน</div>
          </div>
        ) : (
          <div className="item-list">
            {payments.map((p) => (
              <div key={p.id} className="item-card">
                <div className="top-row">
                  <div className="model">งวดที่ {p.period_number}</div>
                  <div className="price">฿{Number(p.amount).toLocaleString()}</div>
                </div>
                <div className="meta">
                  <span className="tag">📅 จ่าย {p.payment_date}</span>
                  {p.due_date && <span className="tag">ครบ {p.due_date}</span>}
                  <span className="tag" style={{ color: '#ffa502', borderColor: '#ffa502' }}>
                    {p.paid_by_profile?.full_name || p.paid_by_name || '-'}
                  </span>
                </div>
                {p.note && (
                  <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8 }}>
                    หมายเหตุ: {p.note}
                  </div>
                )}
                {isAdmin && (
                  <div className="footer">
                    <div className="footer-info"></div>
                    <div className="actions">
                      <button className="icon-btn danger" onClick={() => deletePayment(p.id, p.period_number)} title="ลบ">×</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Payment Modal */}
      {showAddPayment && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowAddPayment(false)}>
          <div className="modal">
            <h3>บันทึกการชำระงวดที่ {paidPeriods + 1}</h3>
            <p className="modal-sub">บันทึกข้อมูลการรับเงินจากลูกค้า</p>
            <div className="form-grid">
              <div className="field">
                <label>จำนวนเงิน (บาท)</label>
                <input type="number" inputMode="numeric" value={newPayment.amount}
                  onChange={(e) => setNewPayment({ ...newPayment, amount: e.target.value })} />
              </div>
              <div className="field">
                <label>วันที่จ่าย</label>
                <input type="date" value={newPayment.paymentDate}
                  onChange={(e) => setNewPayment({ ...newPayment, paymentDate: e.target.value })} />
              </div>
              <div className="field full">
                <label>หมายเหตุ</label>
                <input type="text" value={newPayment.note}
                  onChange={(e) => setNewPayment({ ...newPayment, note: e.target.value })}
                  placeholder="(ไม่บังคับ)" />
              </div>
            </div>
            <div className="modal-actions" style={{ marginTop: 20 }}>
              <button className="btn" onClick={addPayment}>บันทึก ✓</button>
              <button className="btn btn-sec" onClick={() => setShowAddPayment(false)}>ยกเลิก</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEdit && isAdmin && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowEdit(false)}>
          <div className="modal" style={{ maxWidth: 600 }}>
            <h3>แก้ไขข้อมูล</h3>
            <p className="modal-sub">แก้ไขรายละเอียดเครื่องและลูกค้า</p>
            <div className="form-grid">
              <div className="field full">
                <label>IMEI</label>
                <input type="text" maxLength={15} value={editForm.imei || ''}
                  onChange={(e) => setEditForm({ ...editForm, imei: e.target.value })} />
              </div>
              <div className="field"><label>รุ่น</label>
                <input type="text" value={editForm.model || ''} onChange={(e) => setEditForm({ ...editForm, model: e.target.value })} /></div>
              <div className="field"><label>สี</label>
                <input type="text" value={editForm.color || ''} onChange={(e) => setEditForm({ ...editForm, color: e.target.value })} /></div>
              <div className="field full"><label>สเปค</label>
                <input type="text" value={editForm.spec || ''} onChange={(e) => setEditForm({ ...editForm, spec: e.target.value })} /></div>
              <div className="field"><label>ราคาเต็ม</label>
                <input type="number" value={editForm.full_price || ''} onChange={(e) => setEditForm({ ...editForm, full_price: e.target.value })} /></div>
              <div className="field"><label>เงินดาวน์</label>
                <input type="number" value={editForm.down_payment || ''} onChange={(e) => setEditForm({ ...editForm, down_payment: e.target.value })} /></div>
              <div className="field"><label>ยอดผ่อน/งวด</label>
                <input type="number" value={editForm.installment_amount || ''} onChange={(e) => setEditForm({ ...editForm, installment_amount: e.target.value })} /></div>
              <div className="field"><label>จำนวนงวด</label>
                <input type="number" value={editForm.total_periods || ''} onChange={(e) => setEditForm({ ...editForm, total_periods: e.target.value })} /></div>
              <div className="field"><label>ชื่อลูกค้า</label>
                <input type="text" value={editForm.customer_name || ''} onChange={(e) => setEditForm({ ...editForm, customer_name: e.target.value })} /></div>
              <div className="field"><label>เบอร์โทร</label>
                <input type="tel" value={editForm.customer_phone || ''} onChange={(e) => setEditForm({ ...editForm, customer_phone: e.target.value })} /></div>
              <div className="field full"><label>เลขบัตรประชาชน</label>
                <input type="text" maxLength={13} value={editForm.customer_id_card || ''} onChange={(e) => setEditForm({ ...editForm, customer_id_card: e.target.value })} /></div>
              <div className="field full"><label>ที่อยู่</label>
                <input type="text" value={editForm.customer_address || ''} onChange={(e) => setEditForm({ ...editForm, customer_address: e.target.value })} /></div>
              <div className="field full"><label>หมายเหตุ</label>
                <input type="text" value={editForm.customer_note || ''} onChange={(e) => setEditForm({ ...editForm, customer_note: e.target.value })} /></div>
            </div>
            <div className="modal-actions" style={{ marginTop: 20 }}>
              <button className="btn" onClick={saveEdit}>บันทึก ✓</button>
              <button className="btn btn-sec" onClick={() => setShowEdit(false)}>ยกเลิก</button>
            </div>
          </div>
        </div>
      )}

      {/* Close Confirm */}
      {showCloseConfirm && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowCloseConfirm(false)}>
          <div className="modal">
            <h3 style={{ color: 'var(--success)' }}>ยืนยันการปิดยอด</h3>
            <p className="modal-sub">
              ลูกค้า {item.customer_name} ผ่อนครบ {item.total_periods} งวดแล้ว<br/>
              ระบบจะย้ายข้อมูลไปยังประวัติ
            </p>
            <div className="modal-actions">
              <button className="btn" onClick={closeInstallment} style={{ background: 'var(--success)', color: '#fff' }}>
                ✓ ปิดยอด
              </button>
              <button className="btn btn-sec" onClick={() => setShowCloseConfirm(false)}>ยกเลิก</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {showDelete && isAdmin && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowDelete(false)}>
          <div className="modal">
            <h3 style={{ color: 'var(--danger)' }}>ยืนยันการลบ</h3>
            <p className="modal-sub">
              จะลบข้อมูลผ่อนของ {item.customer_name} ทั้งหมด?<br/>
              <strong style={{ color: 'var(--danger)' }}>ประวัติการชำระ {paidPeriods} งวด จะหายด้วย</strong>
            </p>
            <div className="modal-actions">
              <button className="btn btn-danger" onClick={deleteItem}>ลบ</button>
              <button className="btn btn-sec" onClick={() => setShowDelete(false)}>ยกเลิก</button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast {...toast} />}
    </>
  );
}

export default function InstallmentDetailPage() {
  return (
    <Suspense fallback={<div className="loading"><div className="spinner"></div><div>กำลังโหลด...</div></div>}>
      <InstallmentDetailContent />
    </Suspense>
  );
}
