'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-client';
import Toast from '@/components/Toast';
import { PART_CATEGORIES, PART_GRADES, getCategoryLabel, getCategoryShort, getGradeInfo } from '@/lib/parts-constants';
import { fetchAllRows } from '@/lib/db-utils';
import { sendLinePush } from '@/lib/line-notify';
import { syncLedgerEntry } from '@/lib/ledger-sync';
import LabelPrint30x20 from '@/components/LabelPrint30x20';

interface Part {
  id: string;
  name: string;
  category: string;
  phone_model: string;
  grade?: string;
  cost_price: number;
  wholesale_price?: number;
  sell_price: number;
  stock_qty: number;
  low_stock_alert: number;
  supplier_id?: string;
  sku?: string;
  note?: string;
  added_by_name?: string;
  branch_id?: string;
  suppliers?: { name: string } | null;
}

type StockFilter = 'all' | 'in_stock' | 'low_stock' | 'out_of_stock';

export default function PartsPage() {
  const supabase = createClient();
  const [parts, setParts] = useState<Part[]>([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  
  // Filters
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [grade, setGrade] = useState('');
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  
  // Quick adjust modal
  const [adjusting, setAdjusting] = useState<Part | null>(null);
  const [adjustQty, setAdjustQty] = useState('');
  
  // Print label
  const [printingLabel, setPrintingLabel] = useState<Part | null>(null);
  const [viewing, setViewing] = useState<Part | null>(null);
  const [adjustNote, setAdjustNote] = useState('');
  const [adjustType, setAdjustType] = useState<'in' | 'out' | 'set'>('in');
  const [savingAdjust, setSavingAdjust] = useState(false);

  const [toast, setToast] = useState<{ title: string; msg: string; type: string } | null>(null);
  const [modelsByPart, setModelsByPart] = useState<Record<string, string[]>>({});

  function showToast(title: string, msg: string, type: 'success' | 'danger' = 'success') {
    setToast({ title, msg, type });
    setTimeout(() => setToast(null), 2500);
  }

  async function load() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data: p } = await supabase
      .from('profiles').select('*, shops(name)').eq('id', user.id).single();
    setProfile(p);

    const data = await fetchAllRows<Part>(() =>
      supabase.from('parts').select('*, suppliers(name)').order('updated_at', { ascending: false }).order('id', { ascending: true })
    );

    setParts(data);

    const { data: compatRows } = await supabase
      .from('part_compatibility')
      .select('part_id, device_models(model_name)');
    const map: Record<string, string[]> = {};
    (compatRows || []).forEach((r: any) => {
      const name = r.device_models?.model_name;
      if (!name) return;
      if (!map[r.part_id]) map[r.part_id] = [];
      map[r.part_id].push(name);
    });
    setModelsByPart(map);

    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  // Filter logic
  const filtered = useMemo(() => {
    let result = parts;

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.phone_model.toLowerCase().includes(q) ||
        (p.sku && p.sku.toLowerCase().includes(q))
      );
    }

    if (category) {
      result = result.filter(p => p.category === category);
    }

    if (grade) {
      result = result.filter(p => p.grade === grade);
    }

    if (stockFilter !== 'all') {
      result = result.filter(p => {
        if (stockFilter === 'out_of_stock') return p.stock_qty === 0;
        if (stockFilter === 'low_stock') return p.stock_qty > 0 && p.stock_qty <= p.low_stock_alert;
        if (stockFilter === 'in_stock') return p.stock_qty > p.low_stock_alert;
        return true;
      });
    }

    return result;
  }, [parts, search, category, grade, stockFilter]);

  // Stats
  const stats = useMemo(() => {
    return {
      total: parts.length,
      lowStock: parts.filter(p => p.stock_qty > 0 && p.stock_qty <= p.low_stock_alert).length,
      outOfStock: parts.filter(p => p.stock_qty === 0).length,
      totalValue: parts.reduce((sum, p) => sum + (p.cost_price * p.stock_qty), 0),
    };
  }, [parts]);

  async function handleAdjustSubmit() {
    if (!adjusting) return;
    const qty = parseInt(adjustQty);
    if (!qty || qty < 0) {
      showToast('จำนวนไม่ถูกต้อง', '', 'danger');
      return;
    }

    setSavingAdjust(true);

    let newQty = adjusting.stock_qty;
    let change = 0;
    
    if (adjustType === 'in') {
      newQty = adjusting.stock_qty + qty;
      change = qty;
    } else if (adjustType === 'out') {
      if (qty > adjusting.stock_qty) {
        showToast('สต๊อกไม่พอ', `เหลือ ${adjusting.stock_qty} ชิ้น`, 'danger');
        setSavingAdjust(false);
        return;
      }
      newQty = adjusting.stock_qty - qty;
      change = -qty;
    } else {
      // set
      newQty = qty;
      change = qty - adjusting.stock_qty;
    }

    // Update stock
    const { error: updateError } = await supabase
      .from('parts')
      .update({ stock_qty: newQty })
      .eq('id', adjusting.id);

    if (updateError) {
      showToast('บันทึกไม่สำเร็จ', updateError.message, 'danger');
      setSavingAdjust(false);
      return;
    }

    // บันทึก transaction
    await supabase.from('part_transactions').insert({
      shop_id: profile.shop_id,
      part_id: adjusting.id,
      type: adjustType === 'in' ? 'in' : adjustType === 'out' ? 'out' : 'adjust',
      qty_change: change,
      cost_at_transaction: adjusting.cost_price,
      reference_type: 'adjust',
      note: adjustNote || null,
      done_by: profile.id,
      done_by_name: profile.full_name,
    });

    showToast('อัพเดทสต๊อกแล้ว', `${adjusting.name}: ${adjusting.stock_qty} → ${newQty}`);

    if (adjustType === 'in' && qty > 0) {
      const codeTxt = adjusting.sku || adjusting.id.slice(0, 8);
      const modelsTxt = (modelsByPart[adjusting.id]?.join(' / ')) || adjusting.phone_model || 'ทั่วไป';
      const msg = `📦 รับอะไหล่เข้าสต็อค\n━━━━━━━━━━━━━\n🔧 ${adjusting.name}\n🔖 ${codeTxt}\n📱 ${modelsTxt}\n➕ รับเข้า: ${qty} ชิ้น\n💰 ต้นทุน/ชิ้น: ฿${Number(adjusting.cost_price).toLocaleString()}\n📊 คงเหลือ: ${newQty} ชิ้น\n👤 บันทึกโดย: ${profile.full_name}`;
      sendLinePush(msg, 'restock').catch(() => {});
      syncLedgerEntry(supabase, {
        shopId: profile.shop_id, branchId: adjusting.branch_id, sourceEvent: 'parts_stock_in',
        amount: Number(adjusting.cost_price) * qty, description: `รับอะไหล่ ${adjusting.name} เข้าสต็อค ${qty} ชิ้น`,
        userId: profile.id, userName: profile.full_name,
      });
    }

    // 🔔 LINE: ถ้าสต๊อกตกถึง alert level → แจ้งเตือน
    // (เฉพาะเปลี่ยนผ่านขอบเขต - เพื่อไม่ส่งซ้ำ)
    const wasAboveAlert = adjusting.stock_qty > adjusting.low_stock_alert;
    const nowBelowAlert = newQty <= adjusting.low_stock_alert;
    if (wasAboveAlert && nowBelowAlert && newQty > 0) {
      sendLinePush(
        `⚠️ อะไหล่ใกล้หมด\n\n🔧 ${adjusting.name}\n📱 ${(adjusting as any).phone_model || '-'}\n📦 เหลือ ${newQty} ชิ้น (ขั้นต่ำ ${adjusting.low_stock_alert})\n\n💡 ควรสั่งเพิ่ม`,
        'parts_low'
      ).catch(() => {});
    } else if (newQty === 0 && adjusting.stock_qty > 0) {
      // หมดสต๊อก!
      sendLinePush(
        `❌ อะไหล่หมดสต๊อก\n\n🔧 ${adjusting.name}\n📱 ${(adjusting as any).phone_model || '-'}\n\n🚨 ต้องสั่งด่วน`,
        'parts_low'
      ).catch(() => {});
    }

    setAdjusting(null);
    setAdjustQty('');
    setAdjustNote('');
    setAdjustType('in');
    setSavingAdjust(false);
    load();
  }

  function openAdjust(p: Part) {
    setAdjusting(p);
    setAdjustQty('');
    setAdjustNote('');
    setAdjustType('in');
  }

  if (loading) {
    return (
      <>
        <div className="page-header"><h1>🔧 อะไหล่งานซ่อม</h1></div>
        <div className="skeleton" style={{ height: 100 }}></div>
      </>
    );
  }

  return (
    <>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div>
          <h1>🔧 อะไหล่งานซ่อม</h1>
          <div className="desc">จัดการสต๊อกอะไหล่ • แบต • จอ • แพรชาร์จ ฯลฯ</div>
        </div>
        <Link href="/dashboard/parts/add" style={{
          padding: '10px 16px',
          background: 'var(--accent)',
          color: '#fff',
          borderRadius: 6,
          fontSize: 13,
          textDecoration: 'none',
          fontWeight: 600,
          whiteSpace: 'nowrap',
        }}>+ เพิ่ม</Link>
      </div>

      {/* Stats Hero */}
      <div style={{
        background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
        borderRadius: 'var(--radius)',
        padding: 20,
        marginBottom: 20,
        color: '#fff',
      }}>
        <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 6 }}>มูลค่าสต๊อกรวม</div>
        <div style={{ fontSize: 32, fontWeight: 700, lineHeight: 1 }}>
          ฿{stats.totalValue.toLocaleString()}
        </div>
        <div style={{ 
          marginTop: 12, 
          paddingTop: 12, 
          borderTop: '1px solid rgba(255,255,255,0.2)',
          display: 'flex', 
          gap: 16, 
          flexWrap: 'wrap',
          fontSize: 12,
        }}>
          <div>📦 {stats.total} รายการ</div>
          <div onClick={() => setStockFilter('low_stock')} style={{ cursor: 'pointer' }}>
            ⚠️ {stats.lowStock} ใกล้หมด
          </div>
          <div onClick={() => setStockFilter('out_of_stock')} style={{ cursor: 'pointer' }}>
            ❌ {stats.outOfStock} หมด
          </div>
        </div>
      </div>

      {/* Alert: stock ใกล้หมด */}
      {(stats.lowStock > 0 || stats.outOfStock > 0) && stockFilter === 'all' && (
        <div style={{
          padding: 12,
          background: 'rgba(245, 158, 11, 0.1)',
          borderLeft: '3px solid #f59e0b',
          borderRadius: 6,
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          cursor: 'pointer',
        }} onClick={() => setStockFilter('low_stock')}>
          <div style={{ fontSize: 20 }}>⚠️</div>
          <div style={{ flex: 1, fontSize: 13 }}>
            <strong>{stats.lowStock + stats.outOfStock} รายการ</strong> ต้องสั่งซื้อ
          </div>
          <div style={{ fontSize: 11, color: 'var(--accent)' }}>ดู →</div>
        </div>
      )}

      {/* Search */}
      <div style={{ marginBottom: 12 }}>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍 ค้นหา: ชื่ออะไหล่ / รุ่นมือถือ / SKU"
          style={{
            width: '100%',
            padding: 12,
            fontSize: 14,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            color: 'var(--text)',
            fontFamily: 'inherit',
          }}
        />
      </div>

      {/* Filter chips */}
      <div style={{ 
        display: 'flex', 
        gap: 6, 
        marginBottom: 8, 
        overflowX: 'auto',
        paddingBottom: 4,
        WebkitOverflowScrolling: 'touch',
      }}>
        <FilterChip active={!category} onClick={() => setCategory('')} label="ทั้งหมด" />
        {PART_CATEGORIES.map(c => (
          <FilterChip 
            key={c.id} 
            active={category === c.id} 
            onClick={() => setCategory(category === c.id ? '' : c.id)}
            label={c.label}
          />
        ))}
      </div>

      <div style={{ 
        display: 'flex', 
        gap: 6, 
        marginBottom: 12,
        overflowX: 'auto',
        paddingBottom: 4,
      }}>
        <FilterChip active={!grade} onClick={() => setGrade('')} label="ทุกเกรด" small />
        {PART_GRADES.map(g => (
          <FilterChip 
            key={g.id} 
            active={grade === g.id} 
            onClick={() => setGrade(grade === g.id ? '' : g.id)}
            label={g.label}
            color={g.color}
            small
          />
        ))}
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {[
          { id: 'all', label: 'ทั้งหมด' },
          { id: 'in_stock', label: '✓ พอใช้' },
          { id: 'low_stock', label: '⚠️ ใกล้หมด' },
          { id: 'out_of_stock', label: '❌ หมด' },
        ].map(s => (
          <FilterChip
            key={s.id}
            active={stockFilter === s.id}
            onClick={() => setStockFilter(s.id as StockFilter)}
            label={s.label}
            small
          />
        ))}
      </div>

      {/* Results count */}
      <div style={{ 
        fontSize: 11, 
        color: 'var(--text-dim)', 
        marginBottom: 10,
        padding: '0 4px',
      }}>
        แสดง {filtered.length} จาก {parts.length} รายการ
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="form-card">
          <div className="empty">
            <div className="empty-icon" style={{ opacity: 0.3 }}>📦</div>
            <div className="empty-title">
              {parts.length === 0 ? 'ยังไม่มีอะไหล่' : 'ไม่พบอะไหล่ที่ค้นหา'}
            </div>
            {parts.length === 0 && (
              <Link href="/dashboard/parts/add" style={{ 
                display: 'inline-block',
                marginTop: 10,
                padding: '8px 16px',
                background: 'var(--accent)',
                color: '#fff',
                borderRadius: 6,
                textDecoration: 'none',
                fontSize: 13,
              }}>+ เพิ่มอะไหล่แรก</Link>
            )}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(p => {
            const isOut = p.stock_qty === 0;
            const isLow = !isOut && p.stock_qty <= p.low_stock_alert;
            const gradeInfo = p.grade ? getGradeInfo(p.grade) : null;

            return (
              <div
                key={p.id}
                onClick={() => setViewing(p)}
                style={{
                  background: 'var(--surface)',
                  border: `1px solid ${isOut ? '#ef4444' : isLow ? '#f59e0b' : 'var(--border)'}`,
                  borderRadius: 'var(--radius-sm)',
                  padding: 12,
                  transition: 'all 0.15s',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>
                      {p.name}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 6 }}>
                      📱 {p.phone_model}
                    </div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      <Badge label={getCategoryShort(p.category)} />
                      {gradeInfo && <Badge label={gradeInfo.label} color={gradeInfo.color} />}
                      {p.suppliers?.name && <Badge label={`🏭 ${p.suppliers.name}`} subtle />}
                    </div>
                  </div>
                  
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ 
                      fontSize: 20, 
                      fontWeight: 700,
                      color: isOut ? '#ef4444' : isLow ? '#f59e0b' : 'var(--text)',
                    }}>
                      {p.stock_qty}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>ชิ้น</div>
                  </div>
                </div>

                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  marginTop: 10,
                  paddingTop: 10,
                  borderTop: '1px solid var(--border)',
                  fontSize: 12,
                }}>
                  <div style={{ display: 'flex', gap: 12, color: 'var(--text-dim)' }}>
                    <span>ต้นทุน <strong style={{ color: 'var(--text)' }}>฿{Number(p.cost_price).toLocaleString()}</strong></span>
                    <span>ขาย <strong style={{ color: 'var(--accent)' }}>฿{Number(p.sell_price).toLocaleString()}</strong></span>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }} onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setPrintingLabel(p)}
                      style={{
                        padding: '4px 10px',
                        background: 'var(--surface-2)',
                        color: 'var(--text)',
                        border: '1px solid var(--border)',
                        borderRadius: 4,
                        cursor: 'pointer',
                        fontSize: 11,
                        fontFamily: 'inherit',
                      }}
                    >🏷️</button>
                    <button
                      onClick={() => openAdjust(p)}
                      style={{
                        padding: '4px 10px',
                        background: 'var(--surface-2)',
                        color: 'var(--text)',
                        border: '1px solid var(--border)',
                        borderRadius: 4,
                        cursor: 'pointer',
                        fontSize: 11,
                        fontFamily: 'inherit',
                      }}
                    >📊 ปรับ</button>
                    <Link
                      href={`/dashboard/parts/edit?id=${p.id}`}
                      style={{
                        padding: '4px 10px',
                        background: 'var(--surface-2)',
                        color: 'var(--text)',
                        border: '1px solid var(--border)',
                        borderRadius: 4,
                        fontSize: 11,
                        textDecoration: 'none',
                      }}
                    >✏️</Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Quick Adjust Modal */}
      {adjusting && (
        <div className="modal-overlay" onClick={() => !savingAdjust && setAdjusting(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 380 }}>
            <h3 style={{ margin: '0 0 4px' }}>📊 ปรับสต๊อก</h3>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 14 }}>
              {adjusting.name} • คงเหลือปัจจุบัน <strong>{adjusting.stock_qty}</strong> ชิ้น
            </div>

            {/* Type selector */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 14 }}>
              {([
                { id: 'in', label: '➕ รับเข้า', color: '#10b981' },
                { id: 'out', label: '➖ จ่ายออก', color: '#ef4444' },
                { id: 'set', label: '🔄 ตั้งจำนวน', color: '#3b82f6' },
              ] as const).map(t => (
                <button
                  key={t.id}
                  onClick={() => setAdjustType(t.id)}
                  style={{
                    flex: 1,
                    padding: '8px 4px',
                    background: adjustType === t.id ? t.color : 'var(--surface-2)',
                    color: adjustType === t.id ? '#fff' : 'var(--text)',
                    border: 'none',
                    borderRadius: 4,
                    fontSize: 11,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontWeight: 600,
                  }}
                >{t.label}</button>
              ))}
            </div>

            <div className="field full" style={{ marginBottom: 12 }}>
              <label>{adjustType === 'set' ? 'จำนวนใหม่' : 'จำนวน'}</label>
              <input
                type="number"
                value={adjustQty}
                onChange={(e) => setAdjustQty(e.target.value)}
                inputMode="numeric"
                placeholder="0"
                autoFocus
                style={{ fontSize: 18, textAlign: 'center' }}
              />
            </div>

            <div className="field full" style={{ marginBottom: 16 }}>
              <label>หมายเหตุ (optional)</label>
              <input
                type="text"
                value={adjustNote}
                onChange={(e) => setAdjustNote(e.target.value)}
                placeholder="เหตุผล"
              />
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button 
                onClick={() => setAdjusting(null)}
                disabled={savingAdjust}
                className="btn btn-sec"
              >ยกเลิก</button>
              <button 
                onClick={handleAdjustSubmit}
                disabled={savingAdjust}
                className="btn"
              >{savingAdjust ? 'กำลังบันทึก...' : 'บันทึก'}</button>
            </div>
          </div>
        </div>
      )}

      {printingLabel && profile && (
        <LabelPrint30x20
          items={[{
            shopName: profile.shops?.name,
            productName: printingLabel.name,
            variant: `${(modelsByPart[printingLabel.id]?.join(' / ')) || printingLabel.phone_model}${printingLabel.grade ? ' • ' + (getGradeInfo(printingLabel.grade)?.label || printingLabel.grade) : ''}`,
            price: Number(printingLabel.sell_price),
            code: printingLabel.sku || printingLabel.id,
            showBarcode: true,
            showQR: true,
          }]}
          copies={1}
          onClose={() => setPrintingLabel(null)}
        />
      )}

      {viewing && (
        <PartViewModal
          item={viewing}
          compatModels={modelsByPart[viewing.id]}
          onClose={() => setViewing(null)}
          onEdit={() => setViewing(null)}
        />
      )}

      {toast && <Toast {...toast} />}
    </>
  );
}

function PartViewModal({ item, compatModels, onClose, onEdit }: { item: Part; compatModels?: string[]; onClose: () => void; onEdit: () => void }) {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [compatRows, setCompatRows] = useState<any[]>([]);
  const gradeInfo = item.grade ? getGradeInfo(item.grade) : null;
  const profit = item.cost_price ? Number(item.sell_price) - Number(item.cost_price) : 0;

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('part_compatibility')
        .select('cost_price, labor_cost, sell_price, device_models(model_name)')
        .eq('part_id', item.id);
      setCompatRows((data || []).map((r: any) => ({ ...r, model_name: r.device_models?.model_name || '-' })));
      setLoading(false);
    }
    load();
  }, [item.id]);

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h3>{item.name}</h3>
        <p className="modal-sub">{getCategoryLabel(item.category)}{gradeInfo ? ` · ${gradeInfo.label}` : ''}</p>
        <div className="detail-grid">
          <div className="detail-item">
            <div className="label">ราคาทุน</div>
            <div className="value">฿{Number(item.cost_price || 0).toLocaleString()}</div>
          </div>
          <div className="detail-item">
            <div className="label">ราคาส่ง</div>
            <div className="value">฿{Number(item.wholesale_price || 0).toLocaleString()}</div>
          </div>
          <div className="detail-item">
            <div className="label">ราคาหน้าร้าน</div>
            <div className="value" style={{ color: 'var(--accent)' }}>฿{Number(item.sell_price || 0).toLocaleString()}</div>
          </div>
          <div className="detail-item">
            <div className="label">กำไร (ทุน→หน้าร้าน)</div>
            <div className="value" style={{ color: profit > 0 ? '#10b981' : undefined }}>฿{profit.toLocaleString()}</div>
          </div>
          <div className="detail-item">
            <div className="label">คงเหลือ</div>
            <div className="value">{item.stock_qty} ชิ้น</div>
          </div>
          <div className="detail-item">
            <div className="label">เตือนเมื่อเหลือ</div>
            <div className="value">{item.low_stock_alert ?? 2} ชิ้น</div>
          </div>
          {item.sku && (
            <div className="detail-item">
              <div className="label">SKU</div>
              <div className="value mono">{item.sku}</div>
            </div>
          )}
          {item.suppliers?.name && (
            <div className="detail-item">
              <div className="label">ซัพพลายเออร์</div>
              <div className="value">{item.suppliers.name}</div>
            </div>
          )}
          {item.added_by_name && (
            <div className="detail-item">
              <div className="label">เพิ่มโดย</div>
              <div className="value">{item.added_by_name}</div>
            </div>
          )}
          {item.note && (
            <div className="detail-item full">
              <div className="label">หมายเหตุ</div>
              <div className="value">{item.note}</div>
            </div>
          )}
          <div className="detail-item full">
            <div className="label">รุ่นมือถือที่ใช้ได้</div>
            {loading ? (
              <div className="value">กำลังโหลด...</div>
            ) : compatRows.length === 0 ? (
              <div className="value">{item.phone_model || 'ทั่วไป (ยังไม่ได้ผูกกับรุ่นเฉพาะ)'}</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                {compatRows.map((r, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12, background: 'var(--surface-2)', borderRadius: 6, padding: '6px 8px' }}>
                    <strong>{r.model_name}</strong>
                    <span style={{ color: 'var(--text-dim)' }}>ทุน ฿{Number(r.cost_price || 0).toLocaleString()} · ขาย ฿{Number(r.sell_price || 0).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn btn-sec" onClick={onClose}>ปิด</button>
          <Link href={`/dashboard/parts/edit?id=${item.id}`} className="btn" onClick={onEdit}>✏️ แก้ไข</Link>
        </div>
      </div>
    </div>
  );
}

function FilterChip({ active, onClick, label, color, small }: { 
  active: boolean; 
  onClick: () => void; 
  label: string; 
  color?: string;
  small?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: small ? '5px 10px' : '7px 12px',
        background: active ? (color || 'var(--accent)') : 'var(--surface-2)',
        color: active ? '#fff' : 'var(--text)',
        border: 'none',
        borderRadius: 100,
        fontSize: small ? 11 : 12,
        cursor: 'pointer',
        fontFamily: 'inherit',
        fontWeight: active ? 600 : 500,
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >{label}</button>
  );
}

function Badge({ label, color, subtle }: { label: string; color?: string; subtle?: boolean }) {
  return (
    <span style={{
      fontSize: 10,
      padding: '2px 6px',
      background: subtle 
        ? 'var(--surface-2)' 
        : color ? `${color}25` : 'rgba(59, 130, 246, 0.15)',
      color: subtle 
        ? 'var(--text-dim)' 
        : color || 'var(--accent)',
      borderRadius: 4,
      fontWeight: 600,
      whiteSpace: 'nowrap',
    }}>{label}</span>
  );
}
