'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase-client';
import Toast from '@/components/Toast';
import ImportExcel from '@/components/ImportExcel';

export default function PawnStockPage() {
  const supabase = createClient();
  const [items, setItems] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showImport, setShowImport] = useState(false);
  const [search, setSearch] = useState('');
  const [filterModel, setFilterModel] = useState('');
  const [filterBranch, setFilterBranch] = useState('');
  const [editing, setEditing] = useState<any>(null);
  const [deleting, setDeleting] = useState<any>(null);
  const [viewing, setViewing] = useState<any>(null);
  const [renewing, setRenewing] = useState<any>(null);
  const [forfeiting, setForfeiting] = useState<any>(null);
  const [renewForm, setRenewForm] = useState({ interestPaid: '', note: '' });
  const [showOverdueAlert, setShowOverdueAlert] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [toast, setToast] = useState<{ title: string; msg: string; type: string } | null>(null);

  function showToast(title: string, msg: string, type: 'success' | 'danger' = 'success') {
    setToast({ title, msg, type });
    setTimeout(() => setToast(null), 2500);
  }

  // คำนวณสถานะแต่ละรายการ
  function getItemStatus(item: any) {
    if (item.status === 'forfeited') {
      return { type: 'forfeited', label: 'หลุดจำนำ', color: '#ef4444', days: 0 };
    }
    if (!item.due_date) {
      // legacy - ใช้ pawn_date + 30
      const due = new Date(item.pawn_date);
      due.setDate(due.getDate() + 30);
      const days = Math.floor((due.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (days < 0) return { type: 'overdue', label: `เลย ${-days} วัน`, color: '#ef4444', days };
      if (days <= 3) return { type: 'soon', label: `เหลือ ${days} วัน`, color: '#f59e0b', days };
      return { type: 'active', label: `เหลือ ${days} วัน`, color: '#10b981', days };
    }
    const due = new Date(item.due_date);
    const days = Math.floor((due.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (days < 0) return { type: 'overdue', label: `เลย ${-days} วัน`, color: '#ef4444', days };
    if (days <= 3) return { type: 'soon', label: `เหลือ ${days} วัน`, color: '#f59e0b', days };
    return { type: 'active', label: `เหลือ ${days} วัน`, color: '#10b981', days };
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
      .select('*')
      .eq('id', user.id)
      .single();

    setProfile(profileData);

    const { data: stockData } = await supabase
      .from('pawn_stock')
      .select('*, added_by_profile:profiles!pawn_stock_added_by_fkey(full_name, username), branch:branches(name)')
      .order('created_at', { ascending: false });

    setItems(stockData || []);

    if (profileData?.role === 'admin') {
      const { data: branchesData } = await supabase.from('branches').select('*').order('name');
      setBranches(branchesData || []);
    }

    // เช็คมีรายการเลยกำหนดไหม - เปิด popup เตือน (ครั้งเดียวต่อ session)
    const sessionKey = 'pawn_overdue_alert_shown';
    if (!sessionStorage.getItem(sessionKey)) {
      const overdueCount = (stockData || []).filter((it: any) => {
        if (it.status === 'forfeited') return false;
        const due = it.due_date || new Date(new Date(it.pawn_date).getTime() + 30 * 86400000).toISOString().split('T')[0];
        return new Date(due) < new Date();
      }).length;
      if (overdueCount > 0) {
        setShowOverdueAlert(true);
        sessionStorage.setItem(sessionKey, '1');
      }
    }

    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  const isAdmin = profile?.role === 'admin';
  const models = Array.from(new Set(items.map((i) => i.model)));
  const countByBranch = branches.reduce((acc: any, b) => {
    acc[b.id] = items.filter((i) => i.branch_id === b.id).length;
    return acc;
  }, {});

  const filtered = items.filter((item) => {
    const s = search.toLowerCase();
    const matchSearch =
      !s ||
      item.imei.toLowerCase().includes(s) ||
      item.model.toLowerCase().includes(s) ||
      (item.color && item.color.toLowerCase().includes(s)) ||
      item.customer_name.toLowerCase().includes(s) ||
      (item.customer_phone && item.customer_phone.includes(s));
    const matchModel = !filterModel || item.model === filterModel;
    const matchBranch = !filterBranch || item.branch_id === filterBranch;
    
    // filter status
    const st = getItemStatus(item);
    const matchStatus = !filterStatus || st.type === filterStatus;
    
    return matchSearch && matchModel && matchBranch && matchStatus;
  });

  // นับสถานะ
  const statusCount = items.reduce((acc: any, it) => {
    const st = getItemStatus(it);
    acc[st.type] = (acc[st.type] || 0) + 1;
    return acc;
  }, { active: 0, soon: 0, overdue: 0, forfeited: 0 });

  // รายการเลยกำหนด (สำหรับ popup)
  const overdueItems = items.filter(it => {
    const st = getItemStatus(it);
    return st.type === 'overdue';
  });

  const totalValue = items.reduce((sum, i) => sum + Number(i.pawn_price), 0);
  const latestItem = items[0];

  async function handleSaveEdit() {
    if (!editing) return;

    const { error } = await supabase
      .from('pawn_stock')
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

    const { error } = await supabase.from('pawn_stock').delete().eq('id', deleting.id);

    if (error) {
      showToast('เกิดข้อผิดพลาด', error.message, 'danger');
      return;
    }

    showToast('ลบแล้ว', '');
    setDeleting(null);
    loadData();
  }

  async function handleRenew() {
    if (!renewing) return;
    const interestPaid = parseFloat(renewForm.interestPaid) || 0;
    if (interestPaid < 0) {
      showToast('ดอกเบี้ยติดลบไม่ได้', '', 'danger');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // คำนวณ due_date ใหม่
    const interestDays = renewing.interest_days || 30;
    const oldDue = renewing.due_date ? new Date(renewing.due_date) : new Date(renewing.pawn_date);
    const newDue = new Date(Math.max(oldDue.getTime(), Date.now())); // ถ้าเลยกำหนดแล้วใช้วันนี้
    newDue.setDate(newDue.getDate() + interestDays);
    const newDueStr = newDue.toISOString().split('T')[0];

    // 1. บันทึกประวัติการต่อ
    const { error: renewError } = await supabase.from('pawn_renewals').insert({
      pawn_id: renewing.id,
      renewal_date: new Date().toISOString().split('T')[0],
      interest_paid: interestPaid,
      old_due_date: renewing.due_date || null,
      new_due_date: newDueStr,
      note: renewForm.note || null,
      renewed_by: user.id,
      renewed_by_name: profile.full_name,
      branch_id: renewing.branch_id,
      shop_id: profile.shop_id,
    });

    if (renewError) {
      showToast('เกิดข้อผิดพลาด', renewError.message, 'danger');
      return;
    }

    // 2. อัพเดท pawn_stock
    const { error: updateError } = await supabase.from('pawn_stock').update({
      due_date: newDueStr,
      status: 'active',
      renew_count: (renewing.renew_count || 0) + 1,
    }).eq('id', renewing.id);

    if (updateError) {
      showToast('เกิดข้อผิดพลาด', updateError.message, 'danger');
      return;
    }

    showToast('ต่อดอกสำเร็จ', `ครบกำหนดใหม่: ${newDueStr}`);
    setRenewing(null);
    setRenewForm({ interestPaid: '', note: '' });
    loadData();
  }

  async function handleForfeit() {
    if (!forfeiting) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // 1. นับ total interest paid
    const { data: renewals } = await supabase
      .from('pawn_renewals')
      .select('interest_paid')
      .eq('pawn_id', forfeiting.id);
    const totalInterest = (renewals || []).reduce((s: number, r: any) => s + Number(r.interest_paid || 0), 0);

    // 2. ย้ายไป pawn_history พร้อม exit_status = 'forfeited'
    const { error: insertError } = await supabase.from('pawn_history').insert({
      imei: forfeiting.imei,
      model: forfeiting.model,
      color: forfeiting.color,
      spec: forfeiting.spec,
      pawn_price: forfeiting.pawn_price,
      pawn_date: forfeiting.pawn_date,
      customer_name: forfeiting.customer_name,
      customer_phone: forfeiting.customer_phone,
      customer_note: forfeiting.customer_note,
      added_by: forfeiting.added_by,
      added_by_name: forfeiting.added_by_name,
      redeemed_by: user.id,
      redeemed_by_name: profile.full_name,
      redeem_date: new Date().toISOString().split('T')[0],
      branch_id: forfeiting.branch_id,
      shop_id: profile.shop_id,
      interest_days: forfeiting.interest_days || 30,
      renew_count: forfeiting.renew_count || 0,
      total_interest_paid: totalInterest,
      exit_status: 'forfeited',
    });

    if (insertError) {
      showToast('เกิดข้อผิดพลาด', insertError.message, 'danger');
      return;
    }

    // 3. ลบจาก pawn_stock
    await supabase.from('pawn_stock').delete().eq('id', forfeiting.id);

    showToast('บันทึกหลุดจำนำแล้ว', `${forfeiting.model} • ${forfeiting.customer_name}`);
    setForfeiting(null);
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
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <h1>💰 สต๊อกจำนำ</h1>
          <div className="desc">เครื่องที่ลูกค้าจำนำอยู่</div>
        </div>
        {isAdmin && profile?.shop_id && profile?.branch_id && (
          <button
            onClick={() => setShowImport(true)}
            style={{
              padding: '6px 12px',
              background: 'transparent',
              border: '1px solid var(--border)',
              color: 'var(--text-dim)',
              fontFamily: 'inherit',
              fontSize: 11,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              alignSelf: 'flex-start',
            }}
            title="นำเข้าข้อมูลจาก Excel"
          >
            📥 นำเข้า Excel
          </button>
        )}
      </div>

      <div className="stats">
        <div className="stat">
          <div className="label">รวมทั้งหมด</div>
          <div className="value accent">{items.length}</div>
        </div>
        <div className="stat">
          <div className="label">ปกติ</div>
          <div className="value success">{statusCount.active}</div>
        </div>
        <div className="stat">
          <div className="label">ใกล้ครบกำหนด</div>
          <div className="value" style={{ color: '#f59e0b' }}>{statusCount.soon}</div>
        </div>
        <div className="stat">
          <div className="label">เลยกำหนด</div>
          <div className="value danger">{statusCount.overdue}</div>
        </div>
      </div>

      {showImport && profile?.shop_id && profile?.branch_id && (
        <ImportExcel
          type="pawn"
          branchId={profile.branch_id}
          shopId={profile.shop_id}
          userId={profile.id}
          userName={profile.full_name}
          onClose={() => setShowImport(false)}
          onSuccess={loadData}
        />
      )}

      {isAdmin && branches.length > 0 && (
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
            placeholder="ค้นหา IMEI, รุ่น, ลูกค้า, เบอร์..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="filter-select" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">ทุกสถานะ</option>
          <option value="active">🟢 ปกติ</option>
          <option value="soon">🟡 ใกล้ครบ</option>
          <option value="overdue">🔴 เลยกำหนด</option>
        </select>
        <select className="filter-select" value={filterModel} onChange={(e) => setFilterModel(e.target.value)}>
          <option value="">ทุกรุ่น</option>
          {models.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">💰</div>
          <div className="empty-title">ไม่มีเครื่องจำนำ</div>
          <div className="empty-sub">
            {search || filterModel ? 'ไม่พบรายการที่ค้นหา' : 'ยังไม่มีเครื่องที่รับจำนำ'}
          </div>
        </div>
      ) : (
        <div className="item-list">
          {filtered.map((item) => {
            const st = getItemStatus(item);
            return (
            <div key={item.id} className="item-card">
              <div className="top-row">
                <div className="model">{item.model}</div>
                <div className="price">฿{Number(item.pawn_price).toLocaleString()}</div>
              </div>
              <div className="imei">IMEI: {item.imei}</div>
              <div className="meta">
                <span className="tag" style={{ 
                  background: `${st.color}20`,
                  color: st.color, 
                  borderColor: st.color,
                  fontWeight: 600 
                }}>
                  {st.type === 'overdue' ? '🔴' : st.type === 'soon' ? '🟡' : st.type === 'forfeited' ? '⚫' : '🟢'} {st.label}
                </span>
                {item.due_date && (
                  <span className="tag">📅 ครบ {new Date(item.due_date).toLocaleDateString('th-TH')}</span>
                )}
                {item.renew_count > 0 && (
                  <span className="tag">🔄 ต่อ {item.renew_count} ครั้ง</span>
                )}
                {item.color && <span className="tag">{item.color}</span>}
                {item.spec && <span className="tag">{item.spec}</span>}
                {isAdmin && item.branch?.name && <span className="tag">{item.branch.name}</span>}
                <span className="tag" style={{ color: '#ffa502', borderColor: '#ffa502' }}>
                  👤 {item.customer_name}
                </span>
                {item.customer_phone && (
                  <span className="tag">📞 {item.customer_phone}</span>
                )}
              </div>
              <div className="footer">
                <div className="footer-info">
                  จำนำ {item.pawn_date} • {
                    item.added_by_profile?.full_name 
                      ? item.added_by_profile.full_name
                      : item.added_by_name 
                        ? `${item.added_by_name} (ลาออก)`
                        : '-'
                  }
                </div>
                <div className="actions">
                  <button 
                    className="icon-btn" 
                    onClick={() => { 
                      setRenewing(item); 
                      setRenewForm({ 
                        interestPaid: String(item.interest_amount || ''), 
                        note: '' 
                      }); 
                    }} 
                    title="ต่อดอก"
                    style={{ background: 'var(--accent-light)', color: 'var(--accent-text)' }}
                  >
                    🔄
                  </button>
                  <button className="icon-btn" onClick={() => setViewing(item)} title="ดู">ⓘ</button>
                  {isAdmin && (
                    <>
                      <button 
                        className="icon-btn" 
                        onClick={() => setForfeiting(item)} 
                        title="บันทึกหลุดจำนำ"
                        style={{ borderColor: 'var(--warning)', color: 'var(--warning)' }}
                      >
                        ⚠
                      </button>
                      <button className="icon-btn" onClick={() => setEditing({ ...item })} title="แก้ไข">✎</button>
                      <button className="icon-btn danger" onClick={() => setDeleting(item)} title="ลบ">×</button>
                    </>
                  )}
                </div>
              </div>
            </div>
            );
          })}
        </div>
      )}

      {viewing && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setViewing(null)}>
          <div className="modal">
            <h3>รายละเอียดการจำนำ</h3>
            <p className="modal-sub">ข้อมูลเครื่องและลูกค้า</p>
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
                <div className="label">วันที่รับจำนำ</div>
                <div className="value">{viewing.pawn_date}</div>
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
              <div className="detail-item full">
                <div className="label">เพิ่มโดย</div>
                <div className="value">
                  {viewing.added_by_profile?.full_name 
                    ? viewing.added_by_profile.full_name
                    : viewing.added_by_name 
                      ? `${viewing.added_by_name} (ลาออก)`
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
            <h3>แก้ไขข้อมูลจำนำ</h3>
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
              จะลบ {deleting.model} (IMEI: {deleting.imei}) ของ {deleting.customer_name}?
            </p>
            <div className="modal-actions">
              <button className="btn btn-danger" onClick={handleDelete}>ลบ</button>
              <button className="btn btn-sec" onClick={() => setDeleting(null)}>ยกเลิก</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: ต่อดอก */}
      {renewing && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setRenewing(null)}>
          <div className="modal">
            <h3>🔄 ต่อดอก</h3>
            <p className="modal-sub">{renewing.model} • {renewing.customer_name}</p>

            <div style={{
              background: 'var(--surface-2)',
              padding: 12,
              marginBottom: 16,
              fontSize: 13,
              borderLeft: '3px solid var(--accent)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ color: 'var(--text-dim)' }}>ครบกำหนดเดิม:</span>
                <span>{renewing.due_date ? new Date(renewing.due_date).toLocaleDateString('th-TH') : '-'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ color: 'var(--text-dim)' }}>จำนวนวันต่อดอก:</span>
                <span>{renewing.interest_days || 30} วัน</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-dim)' }}>ต่อมาแล้ว:</span>
                <span>{renewing.renew_count || 0} ครั้ง</span>
              </div>
            </div>

            <div className="form-grid">
              <div className="field full">
                <label>ดอกเบี้ยที่จ่าย (บาท) <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input type="number" inputMode="numeric"
                  value={renewForm.interestPaid}
                  onChange={(e) => setRenewForm({ ...renewForm, interestPaid: e.target.value })}
                  placeholder="500"
                  autoFocus />
              </div>
              <div className="field full">
                <label>หมายเหตุ</label>
                <input type="text"
                  value={renewForm.note}
                  onChange={(e) => setRenewForm({ ...renewForm, note: e.target.value })}
                  placeholder="ฯลฯ" />
              </div>
            </div>

            {renewForm.interestPaid && (
              <div style={{
                marginTop: 12, padding: 10,
                background: 'rgba(46, 213, 115, 0.1)',
                borderLeft: '3px solid var(--success)',
                fontSize: 13,
                color: 'var(--success)',
                fontWeight: 600,
              }}>
                ✓ ครบกำหนดใหม่จะเลื่อนไปอีก {renewing.interest_days || 30} วัน
              </div>
            )}

            <div className="modal-actions" style={{ marginTop: 20 }}>
              <button className="btn" onClick={handleRenew}>ยืนยันต่อดอก ✓</button>
              <button className="btn btn-sec" onClick={() => setRenewing(null)}>ยกเลิก</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: หลุดจำนำ */}
      {forfeiting && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setForfeiting(null)}>
          <div className="modal">
            <h3 style={{ color: 'var(--warning)' }}>⚠️ บันทึกหลุดจำนำ</h3>
            <p className="modal-sub">
              เครื่องนี้จะเข้าครอบครองร้าน (หลุดจำนำ) → ย้ายเข้าประวัติ
            </p>

            <div style={{
              background: 'var(--surface-2)',
              padding: 14,
              marginTop: 14, marginBottom: 16,
              fontSize: 13,
            }}>
              <div><strong>{forfeiting.model}</strong> ({forfeiting.imei})</div>
              <div style={{ marginTop: 4 }}>ลูกค้า: {forfeiting.customer_name}</div>
              <div style={{ marginTop: 4 }}>จำนำ: ฿{Number(forfeiting.pawn_price).toLocaleString()}</div>
              <div style={{ marginTop: 4 }}>ต่อแล้ว {forfeiting.renew_count || 0} ครั้ง</div>
            </div>

            <div style={{
              padding: 10,
              background: 'rgba(245, 158, 11, 0.1)',
              borderLeft: '3px solid var(--warning)',
              fontSize: 12,
              color: 'var(--warning-text)',
            }}>
              ⚠️ ลูกค้าไม่มาไถ่/ต่อดอกตามกำหนด เครื่องเข้าครอบครองร้าน
            </div>

            <div className="modal-actions" style={{ marginTop: 16 }}>
              <button className="btn" onClick={handleForfeit} style={{ background: 'var(--warning)' }}>
                ✓ ยืนยันหลุดจำนำ
              </button>
              <button className="btn btn-sec" onClick={() => setForfeiting(null)}>ยกเลิก</button>
            </div>
          </div>
        </div>
      )}

      {/* Popup: แจ้งเลยกำหนด (เปิดอัตโนมัติเมื่อเข้าหน้านี้) */}
      {showOverdueAlert && overdueItems.length > 0 && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowOverdueAlert(false)}>
          <div className="modal">
            <h3 style={{ color: 'var(--danger)' }}>🔴 แจ้งเตือน: มีเครื่องเลยกำหนด</h3>
            <p className="modal-sub">
              พบ <strong style={{ color: 'var(--danger)' }}>{overdueItems.length} รายการ</strong> ที่เลยกำหนดต่อดอก
            </p>

            <div style={{ maxHeight: 320, overflowY: 'auto', marginBottom: 16 }}>
              {overdueItems.slice(0, 10).map((item: any) => {
                const st = getItemStatus(item);
                return (
                  <div key={item.id} style={{
                    padding: 10,
                    borderBottom: '1px solid var(--border)',
                    fontSize: 13,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 600 }}>{item.customer_name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
                          {item.model} • {item.customer_phone || 'ไม่มีเบอร์'}
                        </div>
                      </div>
                      <div style={{ color: 'var(--danger)', fontWeight: 600, fontSize: 12 }}>
                        {st.label}
                      </div>
                    </div>
                  </div>
                );
              })}
              {overdueItems.length > 10 && (
                <div style={{ padding: 10, textAlign: 'center', fontSize: 12, color: 'var(--text-dim)' }}>
                  ...และอีก {overdueItems.length - 10} รายการ
                </div>
              )}
            </div>

            <div className="modal-actions">
              <button 
                className="btn" 
                onClick={() => { setShowOverdueAlert(false); setFilterStatus('overdue'); }}
              >
                ดูรายการเลยกำหนดทั้งหมด
              </button>
              <button className="btn btn-sec" onClick={() => setShowOverdueAlert(false)}>
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast {...toast} />}
    </>
  );
}
