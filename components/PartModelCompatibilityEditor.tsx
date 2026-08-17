'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase-client';
import { COMMON_PHONE_MODELS } from '@/lib/parts-constants';
import type { CompatRow } from '@/lib/part-compatibility';

interface Props {
  rows: CompatRow[];
  onChange: (rows: CompatRow[]) => void;
  defaultCostPrice?: string;
  defaultLaborCost?: string;
  defaultSellPrice?: string;
}

/** เลือกรุ่นมือถือที่อะไหล่ชิ้นนี้ใช้ได้แบบหลายรุ่น พร้อมราคาต่อรุ่น (ทุน/labor/ขาย)
 * ใช้ CSS var ล้วนเพื่อให้ฝัง drop-in ได้ทั้งฟอร์ม dashboard (global CSS) และ v3 (inline style) */
export default function PartModelCompatibilityEditor({ rows, onChange, defaultCostPrice, defaultLaborCost, defaultSellPrice }: Props) {
  const supabase = createClient();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (!q) { setSuggestions([]); return; }
    setSearching(true);
    const t = setTimeout(async () => {
      const { data } = await supabase.from('device_models').select('model_name').ilike('model_name', `%${q}%`).order('model_name').limit(8);
      const dbNames = (data || []).map((d: any) => d.model_name as string);
      const presetNames = COMMON_PHONE_MODELS.filter((m) => m.toLowerCase().includes(q.toLowerCase()));
      const merged = Array.from(new Set([...dbNames, ...presetNames]))
        .filter((m) => !rows.some((r) => r.model_name.toLowerCase() === m.toLowerCase()))
        .slice(0, 8);
      setSuggestions(merged);
      setSearching(false);
    }, 200);
    return () => clearTimeout(t);
  }, [query, rows]);

  function addModel(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (rows.some((r) => r.model_name.toLowerCase() === trimmed.toLowerCase())) { setQuery(''); setSuggestions([]); return; }
    onChange([...rows, {
      model_name: trimmed,
      cost_price: defaultCostPrice || '',
      labor_cost: defaultLaborCost || '',
      sell_price: defaultSellPrice || '',
    }]);
    setQuery('');
    setSuggestions([]);
  }

  function updateRow(idx: number, field: 'cost_price' | 'labor_cost' | 'sell_price', value: string) {
    onChange(rows.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  }

  function removeRow(idx: number) {
    onChange(rows.filter((_, i) => i !== idx));
  }

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 12, background: 'var(--surface-2)' }}>
      <div style={{ position: 'relative', marginBottom: rows.length > 0 ? 10 : 0 }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addModel(query); } }}
          placeholder="พิมพ์ค้นหา/เพิ่มรุ่นมือถือ..."
          style={{
            width: '100%', height: 40, padding: '0 12px', background: 'var(--surface)',
            border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)',
            fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
          }}
        />
        {query.trim() && (
          <div style={{
            position: 'absolute', top: 42, left: 0, right: 0, background: 'var(--surface)',
            border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: 10, maxHeight: 180, overflowY: 'auto',
          }}>
            {searching ? (
              <div style={{ padding: 10, fontSize: 12, color: 'var(--text-dim)' }}>กำลังค้นหา...</div>
            ) : (
              <>
                {suggestions.map((s) => (
                  <button key={s} type="button" onClick={() => addModel(s)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 12.5, color: 'var(--text)', fontFamily: 'inherit' }}>
                    {s}
                  </button>
                ))}
                <button type="button" onClick={() => addModel(query)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: 'transparent', border: 'none', borderTop: suggestions.length ? '1px solid var(--border)' : 'none', cursor: 'pointer', fontSize: 12.5, color: 'var(--accent)', fontWeight: 600, fontFamily: 'inherit' }}>
                  + เพิ่มรุ่นใหม่ &quot;{query.trim()}&quot;
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {rows.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>ยังไม่ได้เลือกรุ่น — พิมพ์ค้นหาด้านบนเพื่อเพิ่ม</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rows.map((r, idx) => {
            const cost = parseFloat(r.cost_price) || 0;
            const labor = parseFloat(r.labor_cost) || 0;
            const sell = parseFloat(r.sell_price) || 0;
            const isLoss = sell > 0 && sell < cost + labor;
            return (
              <div key={idx} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{r.model_name}</div>
                  <button type="button" onClick={() => removeRow(idx)} style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 0 }}>×</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                  <PriceInput label="ทุน (฿)" value={r.cost_price} onChange={(v: string) => updateRow(idx, 'cost_price', v)} />
                  <PriceInput label="Labor (฿)" value={r.labor_cost} onChange={(v: string) => updateRow(idx, 'labor_cost', v)} />
                  <PriceInput label="ขาย (฿)" value={r.sell_price} onChange={(v: string) => updateRow(idx, 'sell_price', v)} />
                </div>
                {isLoss && (
                  <div style={{ marginTop: 6, fontSize: 11, color: '#dc2626', background: '#fef2f2', padding: '4px 8px', borderRadius: 6 }}>
                    ⚠️ ราคาขายต่ำกว่าทุน+labor (ขาดทุน ฿{(cost + labor - sell).toLocaleString()})
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PriceInput({ label, value, onChange }: any) {
  return (
    <div>
      <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 2 }}>{label}</div>
      <input type="number" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} placeholder="0"
        style={{ width: '100%', height: 32, padding: '0 8px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 12, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
    </div>
  );
}
