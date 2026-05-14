'use client';

import { useState, useRef, useEffect } from 'react';
import { useTheme, THEMES, Theme } from './ThemeProvider';

export default function ThemeSwitcher({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const current = THEMES.find(t => t.id === theme) || THEMES[0];

  return (
    <div className="theme-switcher" ref={ref}>
      <button
        className="theme-trigger"
        onClick={() => setOpen(!open)}
        title="เปลี่ยน Theme"
      >
        <span>{current.icon}</span>
        {!compact && <span>{current.name}</span>}
        <span style={{ fontSize: 9, opacity: 0.6 }}>▾</span>
      </button>

      {open && (
        <div className="theme-dropdown">
          {THEMES.map((t) => (
            <button
              key={t.id}
              className={`theme-option ${t.id === theme ? 'active' : ''}`}
              onClick={() => {
                setTheme(t.id as Theme);
                setOpen(false);
              }}
            >
              <span className="theme-swatch" style={{ background: t.color }}></span>
              <span style={{ fontSize: 14 }}>{t.icon}</span>
              <span>{t.name}</span>
              {t.id === theme && <span className="check">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
