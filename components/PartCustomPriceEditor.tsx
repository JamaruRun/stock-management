'use client';

import { Plus, X, Tag, DollarSign } from 'lucide-react';

export interface CustomPriceRow { id?: string; label: string; price: string }

interface Props {
  rows: CustomPriceRow[];
  onChange: (rows: CustomPriceRow[]) => void;
}

export default function PartCustomPriceEditor({ rows, onChange }: Props) {
  function updateRow(idx: number, patch: Partial<CustomPriceRow>) {
    onChange(rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }
  function removeRow(idx: number) {
    onChange(rows.filter((_, i) => i !== idx));
  }
  function addRow() {
    onChange([...rows, { label: '', price: '' }]);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {rows.map((row, idx) => (
        <div key={row.id || idx} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1.4 }}>
            <Tag size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            <input
              value={row.label}
              onChange={(e) => updateRow(idx, { label: e.target.value })}
              placeholder="เช่น ราคาร้านสอง"
              style={{ ...rowInputSt, paddingLeft: 34 }}
            />
          </div>
          <div style={{ position: 'relative', flex: 1 }}>
            <DollarSign size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            <input
              type="number" inputMode="decimal"
              value={row.price}
              onChange={(e) => updateRow(idx, { price: e.target.value })}
              placeholder="0"
              style={{ ...rowInputSt, paddingLeft: 34 }}
            />
          </div>
          <button type="button" onClick={() => removeRow(idx)} style={removeBtnSt}><X size={14} /></button>
        </div>
      ))}
      <button type="button" onClick={addRow} style={addBtnSt}>
        <Plus size={14} /> เพิ่มราคา
      </button>
    </div>
  );
}

const rowInputSt: React.CSSProperties = {
  width: '100%', height: 40, padding: '0 12px', background: 'var(--surface-2)',
  border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)',
  fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
};
const removeBtnSt: React.CSSProperties = {
  width: 32, height: 32, flexShrink: 0, background: 'var(--surface-2)', border: '1px solid var(--border)',
  borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444',
};
const addBtnSt: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  padding: '9px 12px', background: 'var(--surface-2)', border: '1px dashed var(--border)',
  borderRadius: 10, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--text-dim)', fontFamily: 'inherit',
};
