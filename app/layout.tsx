import './globals.css';
import type { Metadata, Viewport } from 'next';
import { ThemeProvider } from '@/components/ThemeProvider';

export const metadata: Metadata = {
  title: 'Stock Manager · ระบบจัดการสต๊อกร้านมือถือ',
  description: 'ระบบจัดการร้านมือถือ + ร้านซ่อม - สต๊อก จำนำ ผ่อน ขาย ซ่อม รายงาน',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Stock',
  },
  icons: {
    icon: [
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
    shortcut: '/favicon.ico',
  },
  applicationName: 'Stock Manager',
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

// Service Worker - update เก่าทันที + reload
const swScript = `
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('/sw.js').then(function(reg) {
      // เช็ค update ทุก 30 วินาที
      setInterval(function() { reg.update(); }, 30000);
      
      // ถ้ามี SW ใหม่ → ใช้ทันที
      reg.addEventListener('updatefound', function() {
        var newWorker = reg.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', function() {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // SW ใหม่พร้อม → reload
              newWorker.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        }
      });
    }).catch(function(err) {
      console.warn('SW registration failed:', err);
    });
    
    // เมื่อ SW ใหม่ activate → reload
    var refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', function() {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  });
}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" data-theme="light">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <link rel="preconnect" href="https://husbgswmqmlfsijllfxp.supabase.co" />
        <link rel="dns-prefetch" href="https://husbgswmqmlfsijllfxp.supabase.co" />
        {/* Google Fonts - Sarabun + Prompt */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600;700;800&family=Prompt:wght@500;600;700&display=swap"
          rel="stylesheet"
        />
        {/* PWA */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Stock" />
        <meta name="format-detection" content="telephone=no" />
      </head>
      <body>
        <ThemeProvider>
          {children}
        </ThemeProvider>
        <script dangerouslySetInnerHTML={{ __html: swScript }} />
      </body>
    </html>
  );
}
