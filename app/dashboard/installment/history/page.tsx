'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase-client';
import { useRouter } from 'next/navigation';
import Toast from '@/components/Toast';

export default function InstallmentHistoryPage() {
  const supabase = createClient();
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [viewing, setViewing] = useState<any>(null);
  const [deleting, setDeleting] = useState<any>(null);
  const [toast, setToast] = useState<{ title: string; msg: string; type: string } | null>(null);

  function showToast(title: string, msg: string, type: 'success' | 'danger' = 'success') {
    setToast({ title, msg, type });
    setTimeout(() => setToast(null), 2500);
  }

  async function loadData() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data: profileData } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (profileData?.role !== 'admin') {
      router.push('/dashboard/installment/stock');
      return;
    }
    setProfile(profileData);

    const { data } = await supabase
      .from('installment_history')
      .select('*, added_by_profile:profiles!installment_history_added_by_fkey(full_name), closed_by_profile:profiles!installment_history_closed_by_fkey(full_name), branch:branches(name)')
      .order('completed_date', { ascending: false });

    setItems(data || []);
    setLoading(false);
  }

  useEffect(() => { loadData(); }, []);

  const filtered = items.filter((item) => {
    const s = search.toLowerCase();
    return !s ||
      item.imei.toLowerCase().includes(s) ||
      item.model.toLowerCase().includes(s) ||
      item.customer_name.toLowerCase().includes(s) ||
      item.customer_phone.includes(s) ||
      item.customer_id_card.includes(s);
  });

  const totalRevenue = items.reduce((sum, i) => 
    sum + Number(i.down_payment) + (Number(i.installment_amount) * i.total_periods), 0);

  const now = new Date();
  const thisMonth = items.filter((i) => {
    const d = new Date(i.completed_date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  async function handleDelete() {
    if (!deleting) return;
    const { error } = await supabase.from('installment_history').delete().eq('id', deleting.id);
    if (error) {
      showToast('เกิดข้อผิดพลาด', error.message, 'danger');
      return;
    }
    showToast('ลบแล้ว', '');
    setDeleting(null);
    loadData();
  }

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <div>กำลังโหลด...</div>
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <h2>ประวัติผ่อน <span className="badge-admin">ADMIN</span></h2>
        <div className="desc">เครื่องที่ผ่อนหมดและปิดยอดแล้ว</div>
      </div>

      <div className="stats">
        <div className="stat">
          <div className="label">// COMPLETED</div>
          <div className="value success">{items.length}</div>
        </div>
        <div className="stat">
          <div className="label">// REVENUE</div>
          <div className="value accent small">฿{totalRevenue.toLocaleString()}</div>
        </div>
        <div className="stat">
          <div className="label">// THIS MONTH</div>
          <div className="value">{thisMonth}</div>
        </div>
        <div className="stat">
          <div className="label">// LATEST</div>
          <div className="value small">{items[0]?.model || '-'}</div>
        </div>
      </div>

      <div className="toolbar">
        <div className="search-box">
          <input type="text" placeholder="ค้นหา IMEI, รุ่น, ลูกค้า, เบอร์, บัตรปชช..."
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">⌛</div>
          <div className="empty-title">ยังไม่มีประวัติ</div>
          <div className="empty-sub">{search ? 'ไม่พบที่ค้นหา' : 'ยังไม่มีเครื่องที่ปิดยอด'}</div>
        </div>
      ) : (
        <div className="item-list">
          {filtered.map((item) => {
            const totalRevenue = Number(item.down_payment) + (Number(item.installment_amount) * item.total_periods);
            return (
              <div key={item.id} className="item-card">
                <div className="top-row">
                  <div className="model">{item.model}</div>
                  <div className="price">฿{totalRevenue.toLocaleString()}</div>
                </div>
                <div className="imei">IMEI: {item.imei}</div>
                <div className="meta">
                  {item.color && <span className="tag">{item.color}</span>}
                  {item.spec && <span className="tag">{item.spec}</span>}
                  {item.branch?.name && <span className="tag">{item.branch.name}</span>}
                  <span className="tag" style={{ color: '#ffa502', borderColor: '#ffa502' }}>
                    👤 {item.customer_name}
                  </span>
                  <span className="tag success">
                    {item.total_periods} งวด ครบ
                  </span>
                </div>
                <div className="footer">
                  <div className="footer-info">
                    เริ่ม {item.start_date} → ครบ {item.completed_date}
                  </div>
                  <div className="actions">
                    <button className="icon-btn" onClick={() => setViewing(item)} title="ดู">ⓘ</button>
                    <button className="icon-btn danger" onClick={() => setDeleting(item)} title="ลบ">×</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {viewing && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setViewing(null)}>
          <div className="modal" style={{ maxWidth: 600 }}>
            <h3>รายละเอียดประวัติ</h3>
            <p className="modal-sub">{viewing.model} • {viewing.customer_name}</p>
            
            <div className="detail-grid" style={{ marginBottom: 16 }}>
              <div className="detail-item full">
                <div className="label">IMEI</div>
                <div className="value mono">{viewing.imei}</div>
              </div>
              <div className="detail-item">
                <div className="label">รุ่น</div>
                <div className="value">{viewing.model}</div>
              </div>
              <div className="detail-item">
                <div className="label">สี / สเปค</div>
                <div className="value">{[viewing.color, viewing.spec].filter(Boolean).join(' • ') || '-'}</div>
              </div>
              <div className="detail-item">
                <div className="label">ราคาเต็ม</div>
                <div className="value">฿{Number(viewing.full_price).toLocaleString()}</div>
              </div>
              <div className="detail-item">
                <div className="label">เงินดาวน์</div>
                <div className="value">฿{Number(viewing.down_payment).toLocaleString()}</div>
              </div>
              <div className="detail-item">
                <div className="label">ยอด/งวด</div>
                <div className="value">฿{Number(viewing.installment_amount).toLocaleString()}</div>
              </div>
              <div className="detail-item">
                <div className="label">จำนวนงวด</div>
                <div className="value">{viewing.total_periods} งวด</div>
              </div>
              <div className="detail-item">
                <div className="label">เริ่มผ่อน</div>
                <div className="value">{viewing.start_date}</div>
              </div>
              <div className="detail-item">
                <div className="label">ปิดยอด</div>
                <div className="value" style={{ color: 'var(--success)' }}>{viewing.completed_date}</div>
              </div>
              <div className="detail-item">
                <div className="label">ลูกค้า</div>
                <div className="value">{viewing.customer_name}</div>
              </div>
              <div className="detail-item">
                <div className="label">เบอร์</div>
                <div className="value">{viewing.customer_phone}</div>
              </div>
              <div className="detail-item full">
                <div className="label">บัตรประชาชน</div>
                <div className="value mono">{viewing.customer_id_card}</div>
              </div>
              {viewing.customer_address && (
                <div className="detail-item full">
                  <div className="label">ที่อยู่</div>
                  <div className="value">{viewing.customer_address}</div>
                </div>
              )}
            </div>

            {viewing.payment_history && Array.isArray(viewing.payment_history) && viewing.payment_history.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                  ประวัติการชำระ ({viewing.payment_history.length} งวด)
                </div>
                <div style={{ background: 'var(--surface-2)', padding: 12, maxHeight: 200, overflowY: 'auto' }}>
                  {viewing.payment_history.map((p: any, i: number) => (
                    <div key={i} style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      padding: '6px 0',
                      borderBottom: i < viewing.payment_history.length - 1 ? '1px solid var(--border)' : 'none',
                      fontSize: 12
                    }}>
                      <span>งวดที่ {p.period_number}</span>
                      <span style={{ color: 'var(--text-dim)' }}>{p.payment_date}</span>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--accent)' }}>
                        ฿{Number(p.amount).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="modal-actions">
              <button className="btn btn-sec" onClick={() => setViewing(null)}>ปิด</button>
            </div>
          </div>
        </div>
      )}

      {deleting && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setDeleting(null)}>
          <div className="modal">
            <h3 style={{ color: 'var(--danger)' }}>ยืนยันการลบ</h3>
            <p className="modal-sub">จะลบประวัติของ {deleting.model} ({deleting.customer_name})?</p>
            <div className="modal-actions">
              <button className="btn btn-danger" onClick={handleDelete}>ลบ</button>
              <button className="btn btn-sec" onClick={() => setDeleting(null)}>ยกเลิก</button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast {...toast} />}
    </>
  );
}
