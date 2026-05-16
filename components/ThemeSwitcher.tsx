'use client';

import { useTheme, THEMES, Theme } from './ThemeProvider';

interface Props {
  onClose?: () => void;
}

export default function ThemeSwitcher({ onClose }: Props) {
  const { theme, setTheme } = useTheme();

  return (
    <div className="theme-grid">
      {THEMES.map((t) => (
        <button
          key={t.id}
          className={`theme-option ${t.id === theme ? 'active' : ''}`}
          onClick={() => {
            setTheme(t.id as Theme);
            if (onClose) setTimeout(onClose, 300);
          }}
        >
          <div className="theme-option-emoji">{t.icon}</div>
          <div className="theme-option-name">{t.name}</div>
        </button>
      ))}
    </div>
  );
}
