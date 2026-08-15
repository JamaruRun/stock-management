'use client';

import { useState } from 'react';
import { usePwaInstall } from '@/lib/use-pwa-install';
import { IOSInstallGuide } from './PWAInstallPrompt';

interface Props {
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

/** Small persistent install button - a supplement to the auto-popup banner,
 * for when the browser never fires beforeinstallprompt (or the user already dismissed it). */
export default function InstallAppButton({ className, style, children }: Props) {
  const { canInstall, promptInstall } = usePwaInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (!canInstall) return null;

  async function handleClick() {
    const result = await promptInstall();
    if (result === 'ios-guide') setShowIOSGuide(true);
  }

  return (
    <>
      <button className={className} onClick={handleClick} title="ติดตั้งแอป" style={style}>
        {children ?? '📲'}
      </button>
      {showIOSGuide && <IOSInstallGuide onClose={() => setShowIOSGuide(false)} />}
    </>
  );
}
