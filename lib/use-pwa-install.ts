'use client';

import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function usePwaInstall() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    const iOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    const standalone = (window.navigator as any).standalone === true;
    setIsIOS(iOS);
    setInstalled(window.matchMedia('(display-mode: standalone)').matches || standalone);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const canInstall = !installed && (isIOS || !!deferred);

  async function promptInstall(): Promise<'ios-guide' | 'accepted' | 'dismissed' | 'unavailable'> {
    if (isIOS) return 'ios-guide';
    if (!deferred) return 'unavailable';
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === 'accepted') setDeferred(null);
    return choice.outcome;
  }

  return { canInstall, isIOS, installed, promptInstall };
}
