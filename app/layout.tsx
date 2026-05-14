import './globals.css';
import type { Metadata, Viewport } from 'next';
import { ThemeProvider } from '@/components/ThemeProvider';

export const metadata: Metadata = {
  title: 'STOCK • ระบบจัดการสต๊อกมือถือ',
  description: 'ระบบจัดการสต๊อกมือถือด้วยเลข IMEI',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0a0a0a',
};

// Inline script - รัน theme ก่อน React mount เพื่อกัน flash
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
    <html lang="th" data-theme="dark">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
