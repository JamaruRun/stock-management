'use client';

import Link from 'next/link';
import { ArrowLeft, Search, Loader2 } from 'lucide-react';

export function Header({ Icon, title, subtitle, color }: any) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
      <Link href="/v3/super-admin" style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--surface-2)', color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', flexShrink: 0 }}><ArrowLeft size={20} /></Link>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: `${color}22`, color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon size={20} /></div>
        <div><h1 style={{ fontSize: 18, fontWeight: 700, fontFamily: 'Prompt, sans-serif' }}>{title}</h1><p style={{ fontSize: 11, color: 'var(--text-dim)' }}>{subtitle}</p></div>
      </div>
    </div>
  );
}
export function FilterTabs({ tabs, active, onChange }: any) {
  return (
    <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
      {tabs.map(([id, label]: any) => (
        <button key={id} onClick={() => onChange(id)} style={{ padding: '7px 13px', borderRadius: 100, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', border: '1px solid var(--border)', background: active === id ? 'var(--accent)' : 'var(--surface)', color: active === id ? '#fff' : 'var(--text)' }}>{label}</button>
      ))}
    </div>
  );
}
export function SearchBar({ value, onChange, placeholder }: any) {
  return (
    <div className="v3-card" style={{ padding: 10, marginBottom: 12 }}>
      <div style={{ position: 'relative' }}>
        <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={{ width: '100%', height: 38, padding: '0 12px 0 36px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
      </div>
    </div>
  );
}
export function LoadingCard() { return <div className="v3-card" style={{ padding: 60, textAlign: 'center', color: 'var(--text-dim)' }}><Loader2 size={24} className="v3-spin" /></div>; }
export function EmptyCard({ Icon, text }: any) { return <div className="v3-card" style={{ padding: 40, textAlign: 'center' }}><Icon size={48} strokeWidth={1.2} style={{ margin: '0 auto 12px', color: 'var(--text-muted)' }} /><div style={{ fontSize: 14, fontWeight: 600 }}>{text}</div></div>; }
