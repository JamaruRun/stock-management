'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase-client';
import { Smartphone, X } from 'lucide-react';

interface Props {
  value: string;
  onChange: (modelName: string) => void;
  placeholder?: string;
}

/** เลือกรุ่นเครื่องแบบ dropdown ค้นหาได้ จาก device_models
 * ใช้ CSS var ล้วนเพื่อฝัง drop-in ได้ทั้งฟอร์ม dashboard และ v3 */
export default function DeviceModelPicker({ value, onChange, placeholder }: Props) {
  const supabase = createClient();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (!q) { setSuggestions([]); return; }
    setSearching(true);
    const t = setTimeout(async () => {
      const { data } = await supabase.from('device_models').select('model_name').ilike('model_name', `%${q}%`).order('model_name').limit(10);
      setSuggestions((data || []).map((d: any) => d.model_name));
      setSearching(false);
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  if (value) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, boxSizing: 'border-box' }}>
        <Smartphone size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
        <div style={{ flex: 1, fontSize: 13, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
        <button type="button" onClick={() => onChange('')} style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', display: 'flex', alignItems: 'center', flexShrink: 0 }}><X size={16} /></button>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder || 'ค้นหา/เลือกรุ่นเครื่อง...'}
        style={{ width: '100%', height: 42, padding: '0 12px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
      />
      {query.trim() && (
        <div style={{ position: 'absolute', top: 46, left: 0, right: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 8px 20px rgba(0,0,0,0.15)', zIndex: 20, maxHeight: 220, overflowY: 'auto' }}>
          {searching ? (
            <div style={{ padding: 12, fontSize: 12, color: 'var(--text-dim)' }}>กำลังค้นหา...</div>
          ) : suggestions.length === 0 ? (
            <div style={{ padding: 12, fontSize: 12, color: 'var(--text-dim)' }}>ไม่พบรุ่นที่ตรงกับคำค้นหา</div>
          ) : suggestions.map(s => (
            <button key={s} type="button" onClick={() => { onChange(s); setQuery(''); setSuggestions([]); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--text)', fontFamily: 'inherit' }}>
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
