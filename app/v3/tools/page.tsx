'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-client';
import { fetchAllRows } from '@/lib/db-utils';
import { getGradeInfo } from '@/lib/parts-constants';
import ImportExcel, { ImportType } from '@/components/ImportExcel';
import LabelPrint30x20 from '@/components/LabelPrint30x20';

export default function ToolsPage() {
  const [profile, setProfile] = useState<any>(null);
  const [branches, setBranches] = useState<any[]>([]);
  const [branch, setBranch] = useState('');
  const [importType, setImportType] = useState<ImportType | null>(null);
  const [labelType, setLabelType] = useState('stock');
  const [rows, setRows] = useState<any[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [printing, setPrinting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const supabase = createClient();
  useEffect(() => { (async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const result = await supabase.from('profiles').select('id,full_name,role,is_super_admin,shop_id,branch_id,shops(name)').eq('id', user.id).single();
    if (result.error) { setError(result.error.message); return; }
    setProfile(result.data);
    setBranch(result.data.branch_id || '');
    const bs = await supabase.from('branches').select('id,name').eq('shop_id', result.data.shop_id).order('name');
    if (bs.error) setError(bs.error.message); else setBranches(bs.data || []);
  })(); }, []);
  async function loadLabels() {
    if (!profile?.shop_id) return;
    setBusy(true); setError(''); setSelected([]);
    try {
      const data = await fetchAllRows<any>(() => {
        let q = supabase.from(labelType).select(labelType === 'parts' ? '*,part_compatibility(device_models(model_name))' : '*').eq('shop_id', profile.shop_id).order('id');
        if (branch) q = q.eq('branch_id', branch);
        return q;
      });
      setRows(data.map(r => ({ id: r.id, shopName: profile.shops?.name, productName: r.name || r.model,
        variant: labelType === 'parts' ? [(r.part_compatibility || []).map((c: any) => c.device_models?.model_name).filter(Boolean).join(' / ') || r.phone_model, getGradeInfo(r.grade)?.label].filter(Boolean).join(' · ') : [r.color, r.spec].filter(Boolean).join(' / '),
        price: r.sell_price ?? r.price, code: r.sku || r.imei || r.id, showBarcode: true, showQR: true })));
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }
  const admin = profile?.role === 'admin' || profile?.is_super_admin;
  const filtered = rows.filter(r => `${r.productName} ${r.variant || ''} ${r.code}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="v3-tools-page">
    <h1 className="v3-page-title">นำเข้าและพิมพ์ป้าย</h1>
    <p className="v3-page-subtitle">ใช้ข้อมูลและสาขาของร้านปัจจุบัน</p>
    {error && <p role="alert" style={{ color: 'var(--danger)' }}>{error}</p>}
    <div className="v3-card" style={{ marginTop: 16 }}>
      <label>สาขา <select aria-label="สาขาที่ใช้ทำรายการ" value={branch} onChange={e => { setBranch(e.target.value); setRows([]); setSelected([]); }} disabled={!admin}>
        <option value="">เลือกสาขา</option>{branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
      </select></label>
    </div>
    {admin && <section className="v3-card" style={{ marginTop: 12 }}>
      <h2>นำเข้า Excel</h2><p>เลือกประเภท แล้วดาวน์โหลดแม่แบบในหน้าต่างนำเข้า</p>
      <div className="v3-tools-actions">{([['stock', 'สต๊อกเครื่อง'], ['pawn', 'จำนำ'], ['installment', 'ผ่อนชำระ']] as [ImportType, string][]).map(([type, label]) =>
        <button key={type} className="v3-btn v3-btn-secondary" disabled={!branch} onClick={() => setImportType(type)}>{label}</button>)}</div>
    </section>}
    <section className="v3-card" style={{ marginTop: 12 }}>
      <h2>พิมพ์ป้ายบาร์โค้ด / QR</h2>
      <div className="v3-tools-actions">
        <select aria-label="ประเภทป้าย" value={labelType} onChange={e => { setLabelType(e.target.value); setRows([]); setSelected([]); }}><option value="stock">เครื่อง</option><option value="goods">อุปกรณ์เสริม</option><option value="parts">อะไหล่</option></select>
        <button className="v3-btn v3-btn-secondary" disabled={busy || !profile || !branch} onClick={loadLabels}>{busy ? 'กำลังโหลด…' : 'โหลดรายการ'}</button>
        <Link className="v3-btn v3-btn-secondary" href="/v3/goods/print">ป้ายอุปกรณ์เสริม A4</Link>
      </div>
      <input aria-label="ค้นหารายการพิมพ์" placeholder="ค้นหาชื่อ / รุ่น / โค้ด" value={search} onChange={e => setSearch(e.target.value)} />
      {rows.length > 0 && <div className="v3-tools-actions"><button className="v3-btn v3-btn-secondary" onClick={() => setSelected(filtered.map(r => r.id))}>เลือกผลค้นหาทั้งหมด</button><button className="v3-btn v3-btn-secondary" onClick={() => setSelected([])}>ยกเลิกทั้งหมด</button></div>}
      <div className="v3-label-list">{filtered.map(r => <label key={r.id}><input type="checkbox" checked={selected.includes(r.id)} onChange={e => setSelected(prev => e.target.checked ? [...prev, r.id] : prev.filter(id => id !== r.id))} /><span>{r.productName}<small>{r.variant} · {r.code}</small></span></label>)}</div>
      <button className="v3-btn v3-btn-primary" disabled={!selected.length} onClick={() => setPrinting(true)}>พิมพ์ {selected.length} รายการ</button>
    </section>
    {printing && <LabelPrint30x20 items={rows.filter(r => selected.includes(r.id))} onClose={() => setPrinting(false)} />}
    {importType && profile && branch && <ImportExcel type={importType} branchId={branch} shopId={profile.shop_id} userId={profile.id} userName={profile.full_name || ''} onClose={() => setImportType(null)} onSuccess={() => { setImportType(null); setRows([]); }} />}
  </div>;
}
