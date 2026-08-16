'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-client';
import Toast from '@/components/Toast';
import ImportExcel from '@/components/ImportExcel';
import { sendLineNotify } from '@/lib/line-notify';
import PatternLockPad from '@/components/PatternLockPad';
import { Eye, EyeOff } from 'lucide-react';

function parsePattern(str: string | null | undefined): number[] {
  return (str || '').split(',').map((n) => parseInt(n)).filter((n) => !isNaN(n));
}

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
  const [renewForm, setRenewForm] = useState({ interestPaid: '', note: '', newDueDate: '' });
  const [showOverdueAlert, setShowOverdueAlert] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [editingRenewal, setEditingRenewal] = useState<any>(null);
  const [renewalEditForm, setRenewalEditForm] = useState({ renewalDate: '', interestPaid: '', note: '' });
  const [addingRenewal, setAddingRenewal] = useState(false);
  const [newRenewalForm, setNewRenewalForm] = useState({ date: new Date().toISOString().split('T')[0], interestPaid: '', note: '' });
  const [toast, setToast] = useState<{ title: string; msg: string; type: string } | null>(null);
  const [renewals, setRenewals] = useState<any[]>([]);
  const [showViewPassword, setShowViewPassword] = useState(false);

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
      (item.imei || '').toLowerCase().includes(s) ||
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

    const interestDays = parseInt(editing.interest_days) || 30;
    
    // ถ้าวันจำนำเปลี่ยน หรือ interest_days เปลี่ยน → คำนวณ due_date ใหม่
    let dueDate = editing.due_date;
    if (editing.recalculate_due && editing.pawn_date) {
      const d = new Date(editing.pawn_date);
      d.setDate(d.getDate() + interestDays);
      dueDate = d.toISOString().split('T')[0];
    }

    const { error } = await supabase
      .from('pawn_stock')
      .update({
        model: editing.model,
        color: editing.color,
        spec: editing.spec,
        device_password: editing.device_password || null,
        device_lock_type: editing.device_lock_type || 'password',
        pawn_price: parseFloat(editing.pawn_price),
        pawn_date: editing.pawn_date,
        interest_days: interestDays,
        interest_amount: parseFloat(editing.interest_amount) || 0,
        due_date: dueDate,
        customer_name: editing.customer_name,
        customer_phone: editing.customer_phone,
        customer_note: editing.customer_note,
        reminder_due_sent_at: null,
        reminder_overdue_sent_at: null,
        forfeit_alert_sent_at: null,
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

  async function handleSaveRenewalEdit() {
    if (!editingRenewal) return;
    const interestPaid = parseFloat(renewalEditForm.interestPaid) || 0;
    if (interestPaid < 0) {
      showToast('ดอกเบี้ยติดลบไม่ได้', '', 'danger');
      return;
    }

    const { error } = await supabase.from('pawn_renewals').update({
      renewal_date: renewalEditForm.renewalDate,
      interest_paid: interestPaid,
      note: renewalEditForm.note || null,
    }).eq('id', editingRenewal.id);

    if (error) {
      showToast('เกิดข้อผิดพลาด', error.message, 'danger');
      return;
    }

    const { data } = await supabase.from('pawn_renewals').select('*').eq('pawn_id', editingRenewal.pawn_id).order('renewal_date', { ascending: false });
    setRenewals(data || []);
    setEditingRenewal(null);
    showToast('แก้ไขประวัติต่อดอกสำเร็จ', '');
  }

  function addDays(dateStr: string, days: number) {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  }

  // เพิ่มประวัติต่อดอกย้อนหลัง (เช่น ลืมบันทึกไปงวดนึง) - ต่อท้าย chain จากวันครบกำหนดปัจจุบันของเครื่อง
  async function handleAddRenewalHistory() {
    if (!viewing) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const interestDays = viewing.interest_days || 30;
    const oldDue = viewing.due_date || viewing.pawn_date;
    const newDue = addDays(oldDue, interestDays);

    const { error: insErr } = await supabase.from('pawn_renewals').insert({
      pawn_id: viewing.id,
      renewal_date: newRenewalForm.date,
      interest_paid: parseFloat(newRenewalForm.interestPaid) || 0,
      old_due_date: oldDue,
      new_due_date: newDue,
      note: newRenewalForm.note || 'เพิ่มย้อนหลัง',
      renewed_by: user.id,
      renewed_by_name: profile.full_name,
      branch_id: viewing.branch_id,
      shop_id: viewing.shop_id,
    });
    if (insErr) {
      showToast('เกิดข้อผิดพลาด', insErr.message, 'danger');
      return;
    }

    const { error: updErr } = await supabase.from('pawn_stock').update({
      due_date: newDue,
      status: 'active',
      renew_count: (viewing.renew_count || 0) + 1,
      reminder_due_sent_at: null, reminder_overdue_sent_at: null, forfeit_alert_sent_at: null,
    }).eq('id', viewing.id);
    if (updErr) {
      showToast('เกิดข้อผิดพลาด', updErr.message, 'danger');
      return;
    }

    setAddingRenewal(false);
    setViewing(null);
    showToast('เพิ่มประวัติต่อดอกย้อนหลังสำเร็จ', '');
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

    // วันครบกำหนดใหม่ - ใช้ค่าที่ปรับได้จากฟอร์ม (ดีฟอลต์คำนวณจากวันครบกำหนดเดิม + จำนวนวัน ไม่ forgive วันที่เลยกำหนด)
    const newDueStr = renewForm.newDueDate;
    if (!newDueStr) {
      showToast('กรุณาเลือกวันครบกำหนดใหม่', '', 'danger');
      return;
    }

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
      reminder_due_sent_at: null,
      reminder_overdue_sent_at: null,
      forfeit_alert_sent_at: null,
    }).eq('id', renewing.id);

    if (updateError) {
      showToast('เกิดข้อผิดพลาด', updateError.message, 'danger');
      return;
    }

    showToast('ต่อดอกสำเร็จ', `ครบกำหนดใหม่: ${newDueStr}`);

    // 🔔 LINE Notify
    const lineMsg = `🔄 ต่อดอกจำนำ\n━━━━━━━━━━━━━\n📦 ${renewing.model}\n━━━━━━━━━━━━━\n👤 ลูกค้า: ${renewing.customer_name}\n💰 ดอกเบี้ยที่จ่าย: ฿${interestPaid.toLocaleString()}\n📅 ครบกำหนดใหม่: ${newDueStr}\n🔢 ต่อมาแล้ว: ${(renewing.renew_count || 0) + 1} ครั้ง`;
    sendLineNotify(lineMsg, 'pawn').catch(() => {});

    setRenewing(null);
    setRenewForm({ interestPaid: '', note: '', newDueDate: '' });
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
      device_password: forfeiting.device_password,
      device_lock_type: forfeiting.device_lock_type,
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
    
    // 🔔 LINE Notify
    const lineMsg = `⚠️ บันทึกหลุดจำนำ\n━━━━━━━━━━━━━\n📦 ${forfeiting.model}\n━━━━━━━━━━━━━\n👤 ลูกค้า: ${forfeiting.customer_name}\n💵 ราคาจำนำเดิม: ฿${Number(forfeiting.pawn_price).toLocaleString()}\n💰 ดอกเบี้ยที่ได้รับ: ฿${totalInterest.toLocaleString()}\n🔢 ต่อมาแล้ว: ${forfeiting.renew_count || 0} ครั้ง\n\n📌 เครื่องเข้าครอบครองร้านแล้ว`;
    sendLineNotify(lineMsg, 'pawn').catch(() => {});
    
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

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <Link href="/dashboard/pawn/add" className="btn" style={{ width: 'auto', flex: '1 1 200px' }}>
          ➕ รับจำนำใหม่
        </Link>
        <Link href="/dashboard/pawn/redeem" className="btn btn-sec" style={{ width: 'auto', flex: '1 1 200px' }}>
          🔓 ไถ่คืนเครื่อง
        </Link>
        {isAdmin && (
          <Link href="/dashboard/pawn/history" className="btn btn-sec" style={{ width: 'auto', flex: '1 1 200px' }}>
            ⏱️ ประวัติจำนำ
          </Link>
        )}
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
            placeholder="ค้นหา รุ่น, ลูกค้า, เบอร์..."
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
              {item.imei && <div className="imei">IMEI: {item.imei}</div>}
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
                      const interestDays = item.interest_days || 30;
                      const oldDue = item.due_date ? new Date(item.due_date) : new Date(item.pawn_date);
                      const newDue = new Date(oldDue);
                      newDue.setDate(newDue.getDate() + interestDays);
                      setRenewForm({
                        interestPaid: String(item.interest_amount || ''),
                        note: '',
                        newDueDate: newDue.toISOString().split('T')[0],
                      });
                    }}
                    title="ต่อดอก"
                    style={{ background: 'var(--accent-light)', color: 'var(--accent-text)' }}
                  >
                    🔄
                  </button>
                  <button
                    className="icon-btn"
                    onClick={async () => {
                      setViewing(item);
                      setShowViewPassword(false);
                      const { data } = await supabase.from('pawn_renewals').select('*').eq('pawn_id', item.id).order('renewal_date', { ascending: false });
                      setRenewals(data || []);
                    }}
                    title="ดู"
                  >ⓘ</button>
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
                      <button className="icon-btn" onClick={() => { setEditing({ ...item }); setShowViewPassword(false); }} title="แก้ไข">✎</button>
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
              {viewing.imei && (
                <div className="detail-item full">
                  <div className="label">IMEI</div>
                  <div className="value mono">{viewing.imei}</div>
                </div>
              )}
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
              <div className="detail-item full">
                <div className="label">รหัสปลดล็อกเครื่อง{viewing.device_lock_type === 'pattern' ? ' (แพทเทิร์น)' : ''}</div>
                {viewing.device_lock_type === 'pattern' && viewing.device_password ? (
                  showViewPassword ? (
                    <div>
                      <PatternLockPad readOnly value={parsePattern(viewing.device_password)} size={140} />
                      <button type="button" onClick={() => setShowViewPassword(false)}
                        style={{ display: 'block', margin: '6px auto 0', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', fontSize: 12 }}>
                        <EyeOff size={13} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 4 }} />ซ่อน
                      </button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setShowViewPassword(true)}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text)', fontSize: 13, padding: 0 }}>
                      🔒 ซ่อนไว้ (แพทเทิร์น) <Eye size={15} />
                    </button>
                  )
                ) : (
                  <div className="value" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {viewing.device_password
                      ? (showViewPassword ? viewing.device_password : '••••••••')
                      : '-'}
                    {viewing.device_password && (
                      <button
                        type="button"
                        onClick={() => setShowViewPassword(!showViewPassword)}
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', display: 'flex', alignItems: 'center' }}
                      >
                        {showViewPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    )}
                  </div>
                )}
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
                <div className="label">ต่อดอกไปแล้ว</div>
                <div className="value">{viewing.renew_count || 0} ครั้ง</div>
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
              <div className="detail-item full">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div className="label">ประวัติการต่อดอก</div>
                  <button
                    type="button"
                    onClick={() => {
                      setNewRenewalForm({ date: new Date().toISOString().split('T')[0], interestPaid: '', note: '' });
                      setAddingRenewal(true);
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4, background: 'transparent', border: '1px dashed var(--border)',
                      borderRadius: 8, padding: '4px 10px', color: 'var(--accent)', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    + เพิ่มย้อนหลัง
                  </button>
                </div>
                {renewals.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 6 }}>ยังไม่เคยต่อดอก</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                    {renewals.map((r) => (
                      <div key={r.id} style={{
                        padding: 8,
                        background: 'var(--surface-2)',
                        borderRadius: 6,
                        fontSize: 12,
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>{r.renewal_date}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ color: 'var(--success)', fontWeight: 600 }}>฿{Number(r.interest_paid || 0).toLocaleString()}</span>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingRenewal(r);
                                setRenewalEditForm({ renewalDate: r.renewal_date || '', interestPaid: String(r.interest_paid ?? ''), note: r.note || '' });
                              }}
                              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: 0, fontSize: 12 }}
                              title="แก้ไข"
                            >✎</button>
                          </div>
                        </div>
                        <div style={{ color: 'var(--text-dim)', marginTop: 2 }}>
                          {r.old_due_date || '-'} → {r.new_due_date}
                          {r.note ? ` • ${r.note}` : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-sec" onClick={() => setViewing(null)}>ปิด</button>
            </div>
          </div>
        </div>
      )}

      {editingRenewal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setEditingRenewal(null)}>
          <div className="modal">
            <h3>✎ แก้ไขประวัติต่อดอก</h3>
            <p className="modal-sub">แก้ไขวันที่/จำนวนเงินของรายการนี้</p>
            <div className="form-grid">
              <div className="field full">
                <label>วันที่ต่อดอก</label>
                <input type="date" value={renewalEditForm.renewalDate}
                  onChange={(e) => setRenewalEditForm({ ...renewalEditForm, renewalDate: e.target.value })} />
              </div>
              <div className="field full">
                <label>ดอกที่จ่าย (บาท)</label>
                <input type="number" inputMode="numeric" value={renewalEditForm.interestPaid}
                  onChange={(e) => setRenewalEditForm({ ...renewalEditForm, interestPaid: e.target.value })} />
              </div>
              <div className="field full">
                <label>หมายเหตุ</label>
                <input type="text" value={renewalEditForm.note}
                  onChange={(e) => setRenewalEditForm({ ...renewalEditForm, note: e.target.value })} />
              </div>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: -8, marginBottom: 16 }}>
              💡 แก้ได้เฉพาะวันที่/จำนวนเงิน/หมายเหตุ ไม่กระทบวันครบกำหนดของเครื่อง (ถ้าต้องแก้วันครบกำหนด ให้แก้ที่หน้าแก้ไขเครื่องแทน)
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={handleSaveRenewalEdit}>บันทึก ✓</button>
              <button className="btn btn-sec" onClick={() => setEditingRenewal(null)}>ยกเลิก</button>
            </div>
          </div>
        </div>
      )}

      {addingRenewal && viewing && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setAddingRenewal(false)}>
          <div className="modal">
            <h3>🔄 เพิ่มประวัติต่อดอกย้อนหลัง</h3>
            <p className="modal-sub">เช่น ลืมบันทึกไปงวดนึง</p>
            <div className="form-grid">
              <div className="field full">
                <label>วันที่ต่อดอก</label>
                <input type="date" value={newRenewalForm.date}
                  onChange={(e) => setNewRenewalForm({ ...newRenewalForm, date: e.target.value })} />
              </div>
              <div className="field full">
                <label>ดอกที่จ่าย (บาท)</label>
                <input type="number" inputMode="numeric" value={newRenewalForm.interestPaid}
                  onChange={(e) => setNewRenewalForm({ ...newRenewalForm, interestPaid: e.target.value })} />
              </div>
              <div className="field full">
                <label>หมายเหตุ</label>
                <input type="text" value={newRenewalForm.note} placeholder="เพิ่มย้อนหลัง"
                  onChange={(e) => setNewRenewalForm({ ...newRenewalForm, note: e.target.value })} />
              </div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--accent-text, var(--accent))', background: 'var(--surface-2)', padding: 10, borderRadius: 6, marginTop: -8, marginBottom: 16 }}>
              📅 นับต่อจากวันครบกำหนดปัจจุบัน ({viewing.due_date}) + {viewing.interest_days || 30} วัน = ครบกำหนดใหม่ <strong>{addDays(viewing.due_date || viewing.pawn_date, viewing.interest_days || 30)}</strong>
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={handleAddRenewalHistory}>เพิ่ม ✓</button>
              <button className="btn btn-sec" onClick={() => setAddingRenewal(false)}>ยกเลิก</button>
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
              {editing.imei && (
                <div className="field full">
                  <label>IMEI</label>
                  <input type="text" value={editing.imei} disabled />
                </div>
              )}
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
              <div className="field full">
                <label>รหัสปลดล็อกเครื่อง</label>
                <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                  <button type="button"
                    onClick={() => setEditing({ ...editing, device_lock_type: 'password' })}
                    className={(editing.device_lock_type || 'password') === 'password' ? 'btn' : 'btn btn-sec'}
                    style={{ width: 'auto', padding: '6px 14px', fontSize: 12 }}>
                    รหัสผ่าน/PIN
                  </button>
                  <button type="button"
                    onClick={() => setEditing({ ...editing, device_lock_type: 'pattern' })}
                    className={editing.device_lock_type === 'pattern' ? 'btn' : 'btn btn-sec'}
                    style={{ width: 'auto', padding: '6px 14px', fontSize: 12 }}>
                    แพทเทิร์น (ลากจุด)
                  </button>
                </div>
                {!showViewPassword ? (
                  <button type="button" className="btn btn-sec" onClick={() => setShowViewPassword(true)} style={{ width: 'auto' }}>
                    🔒 ซ่อนไว้ — กดเพื่อแก้ไข
                  </button>
                ) : editing.device_lock_type === 'pattern' ? (
                  <PatternLockPad
                    value={parsePattern(editing.device_password)}
                    onChange={(arr) => setEditing({ ...editing, device_password: arr.join(',') })}
                    size={180}
                  />
                ) : (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input type="text" value={editing.device_password || ''}
                      onChange={(e) => setEditing({ ...editing, device_password: e.target.value })}
                      style={{ flex: 1 }} />
                    <button type="button" className="btn btn-sec"
                      onClick={() => setShowViewPassword(false)}
                      style={{ width: 'auto', padding: '0 16px' }}>
                      <EyeOff size={16} />
                    </button>
                  </div>
                )}
              </div>
              <div className="field">
                <label>ราคาจำนำ</label>
                <input type="number" value={editing.pawn_price}
                  onChange={(e) => setEditing({ ...editing, pawn_price: e.target.value })} />
              </div>

              <div className="field">
                <label>วันที่จำนำ</label>
                <input type="date" value={editing.pawn_date || ''}
                  onChange={(e) => setEditing({ ...editing, pawn_date: e.target.value, recalculate_due: true })} />
              </div>

              <div className="field">
                <label>จำนวนวันต่อดอก</label>
                <input type="number" value={editing.interest_days || 30}
                  onChange={(e) => setEditing({ ...editing, interest_days: e.target.value, recalculate_due: true })} />
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
                  💡 เปลี่ยนค่า → วันครบกำหนดจะคำนวณใหม่
                </div>
              </div>

              <div className="field">
                <label>ดอกเบี้ยต่อรอบ (บาท)</label>
                <input type="number" value={editing.interest_amount || ''}
                  onChange={(e) => setEditing({ ...editing, interest_amount: e.target.value })} />
              </div>

              <div className="field full">
                <label>วันครบกำหนดต่อดอก (ปรับเองได้)</label>
                <input type="date" value={editing.due_date || ''}
                  onChange={(e) => setEditing({ ...editing, due_date: e.target.value, recalculate_due: false })} />
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
                  📅 ถ้าแก้วันจำนำหรือจำนวนวันด้านบน วันนี้จะคำนวณใหม่อัตโนมัติ
                </div>
              </div>

              <div className="field full">
                <label>ชื่อลูกค้า</label>
                <input type="text" value={editing.customer_name}
                  onChange={(e) => setEditing({ ...editing, customer_name: e.target.value })} />
              </div>
              <div className="field full">
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
              จะลบ {deleting.model} ของ {deleting.customer_name}?
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
              <div className="field full">
                <label>วันครบกำหนดใหม่ (ปรับเองได้)</label>
                <input type="date"
                  value={renewForm.newDueDate}
                  onChange={(e) => setRenewForm({ ...renewForm, newDueDate: e.target.value })} />
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
                  💡 ระบบคำนวณให้อัตโนมัติจากวันครบกำหนดเดิม + {renewing.interest_days || 30} วัน ปรับเองได้ถ้าต้องการ
                </div>
              </div>
            </div>

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
              <div><strong>{forfeiting.model}</strong></div>
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
