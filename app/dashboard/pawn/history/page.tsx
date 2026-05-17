'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase-client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Toast from '@/components/Toast';

export default function PawnHistoryPage() {
  const supabase = createClient();
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [filterBranch, setFilterBranch] = useState('');
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<any>(null);
  const [deleting, setDeleting] = useState<any>(null);
  const [viewing, setViewing] = useState<any>(null);
  const [toast, setToast] = useState<{ title: string; msg: string; type: string } | null>(null);

  function showToast(title: string, msg: string, type: 'success' | 'danger' = 'success') {
    setToast({ title, msg, type });
    setTimeout(() => setToast(null), 2500);
  }

  async function loadData() {
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data: profileData } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileData?.role !== 'admin') {
      router.push('/dashboard/pawn/stock');
      return;
    }

    setProfile(profileData);

    const { data: historyData } = await supabase
      .from('pawn_history')
      .select(`
        *,
        added_by_profile:profiles!pawn_history_added_by_fkey(full_name, username),
        redeemed_by_profile:profiles!pawn_history_redeemed_by_fkey(full_name, username),
        branch:branches(name)
      `)
      .order('redeem_date', { ascending: false });

    setItems(historyData || []);

    const { data: branchesData } = await supabase.from('branches').select('*').order('name');
    setBranches(branchesData || []);

    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  const countByBranch = branches.reduce((acc: any, b) => {
    acc[b.id] = items.filter((i) => i.branch_id === b.id).length;
    return acc;
  }, {});

  const filtered = items.filter((item) => {
    const s = search.toLowerCase();
    const matchSearch = !s ||
      item.imei.toLowerCase().includes(s) ||
      item.model.toLowerCase().includes(s) ||
      item.customer_name.toLowerCase().includes(s) ||
      (item.customer_phone && item.customer_phone.includes(s));
    const matchBranch = !filterBranch || item.branch_id === filterBranch;
    return matchSearch && matchBranch;
  });

  const totalRedeemed = items.length;
  const totalValue = items.reduce((sum, i) => sum + Number(i.pawn_price), 0);

  const now = new Date();
  const thisMonth = items.filter((i) => {
    const d = new Date(i.redeem_date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  async function handleSaveEdit() {
    if (!editing) return;

    const { error } = await supabase
      .from('pawn_history')
      .update({
        imei: editing.imei,
        model: editing.model,
        color: editing.color,
        spec: editing.spec,
        pawn_price: parseFloat(editing.pawn_price),
        customer_name: editing.customer_name,
        customer_phone: editing.customer_phone,
        customer_note: editing.customer_note,
      })
      .eq('id', editing.id);

    if (error) {
      showToast('เกิดข้อผิดพลาด', error.message, 'danger');
      return;
    }

    showToast('บันทึกสำเร็จ', '');
    setEditing(null);
    loadData();
  }

  async function handleDelete() {
    if (!deleting) return;
    const { error } = await supabase.from('pawn_history').delete().eq('id', deleting.id);

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
        <Link href="/dashboard/pawn/stock" style={{ 
          fontSize: 12, color: 'var(--text-dim)', textDecoration: 'none', 
          display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 6,
        }}>
          ← กลับไปสต๊อก
        </Link>
        <h1>
          ประวัติการไถ่คืน <span className="badge-admin">ADMIN</span>
        </h1>
        <div className="desc">รายการเครื่องที่ลูกค้ามาไถ่คืนแล้ว</div>
      </div>

      <div className="stats">
        <div className="stat">
          <div className="label">ไถ่คืนแล้ว</div>
          <div className="value success">{totalRedeemed}</div>
        </div>
        <div className="stat">
          <div className="label">มูลค่ารวม</div>
          <div className="value accent small">฿{totalValue.toLocaleString()}</div>
        </div>
        <div className="stat">
          <div className="label">เดือนนี้</div>
          <div className="value">{thisMonth}</div>
        </div>
        <div className="stat">
          <div className="label">ล่าสุด</div>
          <div className="value small">{items[0]?.model || '-'}</div>
        </div>
      </div>

      {branches.length > 0 && (
        <div className="branch-tabs">
          <button
            className={`branch-tab ${filterBranch === '' ? 'active' : ''}`}
            onClick={() => setFilterBranch('')}
          >
            <span>ทุกสาขา</span>
            <span className="count">{items.length}</span>
          </button>
          {branches.map((b) => (
            <button
              key={b.id}
              className={`branch-tab ${filterBranch === b.id ? 'active' : ''}`}
              onClick={() => setFilterBranch(b.id)}
            >
              <span>{b.name}</span>
              <span className="count">{countByBranch[b.id] || 0}</span>
            </button>
          ))}
        </div>
      )}

      <div className="toolbar">
        <div className="search-box">
          <input
            type="text"
            placeholder="ค้นหา IMEI, รุ่น, ลูกค้า..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">⌛</div>
          <div className="empty-title">ยังไม่มีประวัติ</div>
          <div className="empty-sub">
            {search ? 'ไม่พบรายการที่ค้นหา' : 'ยังไม่มีเครื่องที่ถูกไถ่คืน'}
          </div>
        </div>
      ) : (
        <div className="item-list">
          {filtered.map((item) => (
            <div key={item.id} className="item-card">
              <div className="top-row">
                <div className="model">{item.model}</div>
                <div className="price">฿{Number(item.pawn_price).toLocaleString()}</div>
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
                  ไถ่โดย: {
                    item.redeemed_by_profile?.full_name
                      ? item.redeemed_by_profile.full_name
                      : item.redeemed_by_name
                        ? `${item.redeemed_by_name} (ลาออก)`
                        : '-'
                  }
                </span>
              </div>
              <div className="footer">
                <div className="footer-info">
                  จำนำ {item.pawn_date} → ไถ่ {item.redeem_date}
                </div>
                <div className="actions">
                  <button className="icon-btn" onClick={() => setViewing(item)} title="ดู">ⓘ</button>
                  <button className="icon-btn" onClick={() => setEditing({ ...item })} title="แก้ไข">✎</button>
                  <button className="icon-btn danger" onClick={() => setDeleting(item)} title="ลบ">×</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {viewing && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setViewing(null)}>
          <div className="modal">
            <h3>รายละเอียดประวัติ</h3>
            <p className="modal-sub">ข้อมูลการจำนำและไถ่คืน</p>
            <div className="detail-grid">
              <div className="detail-item full">
                <div className="label">IMEI</div>
                <div className="value mono">{viewing.imei}</div>
              </div>
              <div className="detail-item">
                <div className="label">รุ่น</div>
                <div className="value">{viewing.model}</div>
              </div>
              <div className="detail-item">
                <div className="label">สี</div>
                <div className="value">{viewing.color || '-'}</div>
              </div>
              <div className="detail-item">
                <div className="label">สเปค</div>
                <div className="value">{viewing.spec || '-'}</div>
              </div>
              <div className="detail-item">
                <div className="label">ราคาจำนำ</div>
                <div className="value" style={{ color: 'var(--accent)' }}>
                  ฿{Number(viewing.pawn_price).toLocaleString()}
                </div>
              </div>
              <div className="detail-item">
                <div className="label">วันที่จำนำ</div>
                <div className="value">{viewing.pawn_date}</div>
              </div>
              <div className="detail-item">
                <div className="label">วันที่ไถ่คืน</div>
                <div className="value" style={{ color: 'var(--success)' }}>{viewing.redeem_date}</div>
              </div>
              <div className="detail-item">
                <div className="label">สาขา</div>
                <div className="value">{viewing.branch?.name || '-'}</div>
              </div>
              <div className="detail-item">
                <div className="label">ลูกค้า</div>
                <div className="value">{viewing.customer_name}</div>
              </div>
              <div className="detail-item">
                <div className="label">เบอร์โทร</div>
                <div className="value">{viewing.customer_phone || '-'}</div>
              </div>
              {viewing.customer_note && (
                <div className="detail-item full">
                  <div className="label">หมายเหตุ</div>
                  <div className="value">{viewing.customer_note}</div>
                </div>
              )}
              <div className="detail-item">
                <div className="label">รับจำนำโดย</div>
                <div className="value">
                  {viewing.added_by_profile?.full_name 
                    ? viewing.added_by_profile.full_name
                    : viewing.added_by_name 
                      ? `${viewing.added_by_name} (ลาออก)`
                      : '-'}
                </div>
              </div>
              <div className="detail-item">
                <div className="label">ไถ่คืนโดย</div>
                <div className="value">
                  {viewing.redeemed_by_profile?.full_name 
                    ? viewing.redeemed_by_profile.full_name
                    : viewing.redeemed_by_name 
                      ? `${viewing.redeemed_by_name} (ลาออก)`
                      : '-'}
                </div>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-sec" onClick={() => setViewing(null)}>ปิด</button>
            </div>
          </div>
        </div>
      )}

      {editing && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setEditing(null)}>
          <div className="modal">
            <h3>แก้ไขประวัติจำนำ</h3>
            <p className="modal-sub">แก้ไขรายละเอียด</p>
            <div className="form-grid">
              <div className="field full">
                <label>IMEI</label>
                <input type="text" maxLength={15} value={editing.imei}
                  onChange={(e) => setEditing({ ...editing, imei: e.target.value })} />
              </div>
              <div className="field">
                <label>รุ่น</label>
                <input type="text" value={editing.model}
                  onChange={(e) => setEditing({ ...editing, model: e.target.value })} />
              </div>
              <div className="field">
                <label>สี</label>
                <input type="text" value={editing.color || ''}
                  onChange={(e) => setEditing({ ...editing, color: e.target.value })} />
              </div>
              <div className="field">
                <label>สเปค</label>
                <input type="text" value={editing.spec || ''}
                  onChange={(e) => setEditing({ ...editing, spec: e.target.value })} />
              </div>
              <div className="field">
                <label>ราคาจำนำ</label>
                <input type="number" value={editing.pawn_price}
                  onChange={(e) => setEditing({ ...editing, pawn_price: e.target.value })} />
              </div>
              <div className="field">
                <label>ชื่อลูกค้า</label>
                <input type="text" value={editing.customer_name}
                  onChange={(e) => setEditing({ ...editing, customer_name: e.target.value })} />
              </div>
              <div className="field">
                <label>เบอร์โทร</label>
                <input type="tel" value={editing.customer_phone || ''}
                  onChange={(e) => setEditing({ ...editing, customer_phone: e.target.value })} />
              </div>
              <div className="field full">
                <label>หมายเหตุ</label>
                <input type="text" value={editing.customer_note || ''}
                  onChange={(e) => setEditing({ ...editing, customer_note: e.target.value })} />
              </div>
            </div>
            <div className="modal-actions" style={{ marginTop: 20 }}>
              <button className="btn" onClick={handleSaveEdit}>บันทึก ✓</button>
              <button className="btn btn-sec" onClick={() => setEditing(null)}>ยกเลิก</button>
            </div>
          </div>
        </div>
      )}

      {deleting && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setDeleting(null)}>
          <div className="modal">
            <h3 style={{ color: 'var(--danger)' }}>ยืนยันการลบ</h3>
            <p className="modal-sub">
              จะลบประวัติของ {deleting.model} (IMEI: {deleting.imei})?
            </p>
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
