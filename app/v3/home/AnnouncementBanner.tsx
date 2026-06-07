'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase-client';
import { X, Info, CheckCircle2, AlertTriangle, Gift, Pin } from 'lucide-react';

const TYPE_MAP: Record<string, { color: string; bg: string; Icon: any }> = {
  info: { color: '#3b82f6', bg: '#eff6ff', Icon: Info },
  success: { color: '#16a34a', bg: '#f0fdf4', Icon: CheckCircle2 },
  warning: { color: '#d97706', bg: '#fffbeb', Icon: AlertTriangle },
  promo: { color: '#8b5cf6', bg: '#f5f3ff', Icon: Gift },
};
const DISMISS_KEY = 'v3-dismissed-announcements';

export default function AnnouncementBanner() {
  const supabase = createClient();
  const [items, setItems] = useState<any[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);

  useEffect(() => {
    try { setDismissed(JSON.parse(localStorage.getItem(DISMISS_KEY) || '[]')); } catch {}
    async function load() {
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .eq('is_active', true)
        .order('pinned', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(5);
      if (error) return; // ตารางยังไม่ถูกสร้าง → เงียบไว้
      const active = (data || []).filter((a: any) => !a.expires_at || a.expires_at > nowIso);
      setItems(active);
    }
    load();
  }, []);

  function dismiss(id: string) {
    const next = [...dismissed, id];
    setDismissed(next);
    try { localStorage.setItem(DISMISS_KEY, JSON.stringify(next)); } catch {}
  }

  const visible = items.filter(a => !dismissed.includes(a.id));
  if (visible.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
      {visible.map(a => {
        const t = TYPE_MAP[a.type] || TYPE_MAP.info;
        return (
          <div key={a.id} style={{ background: t.bg, border: `1px solid ${t.color}33`, borderLeft: `4px solid ${t.color}`, borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <t.Icon size={18} style={{ color: t.color, flexShrink: 0, marginTop: 1 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {a.pinned && <Pin size={11} style={{ color: t.color }} />}
                <span style={{ fontSize: 14, fontWeight: 700, fontFamily: 'Prompt, sans-serif', color: '#1f2937' }}>{a.title}</span>
              </div>
              <p style={{ fontSize: 13, color: '#374151', marginTop: 2, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{a.body}</p>
            </div>
            <button onClick={() => dismiss(a.id)} style={{ width: 26, height: 26, borderRadius: 7, background: 'rgba(0,0,0,0.05)', border: 'none', color: '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }} title="ปิด">
              <X size={15} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
