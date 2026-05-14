'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export type Theme = 'dark' | 'light' | 'matrix' | 'ocean' | 'sakura';

export const THEMES: { id: Theme; name: string; icon: string; color: string }[] = [
  { id: 'dark', name: 'Dark', icon: '🖤', color: '#0a0a0a' },
  { id: 'light', name: 'Light', icon: '🤍', color: '#f5f5f5' },
  { id: 'matrix', name: 'Matrix', icon: '💚', color: '#00ff41' },
  { id: 'ocean', name: 'Ocean', icon: '🌊', color: '#38bdf8' },
  { id: 'sakura', name: 'Sakura', icon: '🌸', color: '#db2777' },
];

const ThemeContext = createContext<{
  theme: Theme;
  setTheme: (t: Theme) => void;
}>({
  theme: 'dark',
  setTheme: () => {},
});

const STORAGE_KEY = 'stock_app_theme';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Theme | null;
      if (saved && THEMES.some(t => t.id === saved)) {
        applyTheme(saved);
        setThemeState(saved);
      }
    } catch (e) {}
  }, []);

  function applyTheme(t: Theme) {
    document.documentElement.setAttribute('data-theme', t);
  }

  function setTheme(t: Theme) {
    applyTheme(t);
    setThemeState(t);
    try {
      localStorage.setItem(STORAGE_KEY, t);
    } catch (e) {}
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
