import './globals.css';
import type { Metadata, Viewport } from 'next';
import { ThemeProvider } from '@/components/ThemeProvider';

export const metadata: Metadata = {
  title: 'Stock Manager · ระบบจัดการสต๊อกร้านมือถือ',
  description: 'ระบบจัดการสต๊อกมือถือ จำนำ ผ่อน และอุปกรณ์เสริม',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#3b82f6',
};

const themeScript = `
(function() {
  try {
    var t = localStorage.getItem('stock_app_theme');
    if (t && ['dark','light','matrix','ocean','sakura'].includes(t)) {
      document.documentElement.setAttribute('data-theme', t);
    }
  } catch(e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" data-theme="light">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <link rel="preconnect" href="https://husbgswmqmlfsijllfxp.supabase.co" />
        <link rel="dns-prefetch" href="https://husbgswmqmlfsijllfxp.supabase.co" />
      </head>
      <body>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
