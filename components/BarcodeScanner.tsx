'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  onScan: (code: string) => void;
  onClose: () => void;
  mode?: 'imei' | 'sku' | 'any';
}

const SCANNER_ID = 'barcode-scanner-region';
const DEBOUNCE_MS = 1500;

type CameraState = 'idle' | 'requesting' | 'ready' | 'denied' | 'no-camera' | 'unsupported' | 'error';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Format mapping ตาม mode (ลด format = เร็วขึ้น 30%+)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const FORMATS_BY_MODE = {
  imei: {
    // IMEI ส่วนใหญ่ใช้ CODE_128 หรือ ITF (Interleaved 2 of 5)
    detector: ['code_128', 'itf'] as string[],
    html5: ['CODE_128', 'ITF', 'CODE_39'] as string[],
  },
  sku: {
    // SKU/Barcode สินค้า ส่วนใหญ่ QR หรือ CODE_128
    detector: ['qr_code', 'code_128', 'ean_13', 'ean_8'] as string[],
    html5: ['QR_CODE', 'CODE_128', 'EAN_13', 'EAN_8'] as string[],
  },
  any: {
    detector: ['qr_code', 'code_128', 'ean_13', 'itf'] as string[],
    html5: ['QR_CODE', 'CODE_128', 'EAN_13', 'ITF'] as string[],
  },
};

export default function BarcodeScanner({ onScan, onClose, mode = 'any' }: Props) {
  const [cameraState, setCameraState] = useState<CameraState>('idle');
  const [errorDetail, setErrorDetail] = useState('');
  const [manualInput, setManualInput] = useState('');
  const [statusMessage, setStatusMessage] = useState('กำลังเปิดกล้อง...');
  const [showManualInput, setShowManualInput] = useState(false);
  const [usingNative, setUsingNative] = useState(false);
  
  // Refs
  const html5ScannerRef = useRef<any>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<any>(null);
  const rafRef = useRef<number | null>(null);
  const lastScanRef = useRef<{ code: string; time: number }>({ code: '', time: 0 });
  const isProcessingRef = useRef(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    let cancelled = false;

    function handleDecoded(decodedText: string) {
      if (cancelled || !isMountedRef.current) return;
      if (isProcessingRef.current) return;

      const cleaned = decodedText.trim();
      const now = Date.now();

      if (cleaned === lastScanRef.current.code && (now - lastScanRef.current.time) < DEBOUNCE_MS) {
        return;
      }
      lastScanRef.current = { code: cleaned, time: now };

      const numericOnly = cleaned.replace(/\D/g, '');
      let final = '';

      if (mode === 'imei') {
        if (numericOnly.length >= 14 && numericOnly.length <= 16) {
          final = numericOnly.length === 16 ? numericOnly.substring(0, 15) : numericOnly;
        } else {
          return;
        }
      } else if (mode === 'sku') {
        if (cleaned.length >= 3) final = cleaned;
        else return;
      } else {
        if (cleaned.length >= 3) {
          final = numericOnly.length === 15 ? numericOnly : cleaned;
        } else return;
      }

      if (!final) return;

      // ✅ ยอมรับการสแกน
      isProcessingRef.current = true;
      setStatusMessage(`✓ พบ: ${final.substring(0, 20)}`);
      
      // Haptic feedback
      if (navigator.vibrate) {
        try { navigator.vibrate(150); } catch (e) {}
      }

      // หยุดกล้องทันที
      stopAll().finally(() => {
        if (isMountedRef.current && !cancelled) {
          onScan(final);
        }
      });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // วิธีที่ 1: ใช้ Native BarcodeDetector API (เร็วที่สุด)
    // รองรับ: Android Chrome 88+, Edge, Opera (ไม่รองรับใน iOS Safari)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    async function tryNativeDetector(): Promise<boolean> {
      if (typeof window === 'undefined') return false;
      if (!('BarcodeDetector' in window)) return false;

      try {
        const BarcodeDetector = (window as any).BarcodeDetector;
        
        // เช็ค formats ที่ browser รองรับ
        const supportedFormats: string[] = await BarcodeDetector.getSupportedFormats();
        const wantedFormats = FORMATS_BY_MODE[mode].detector
          .filter(f => supportedFormats.includes(f));

        if (wantedFormats.length === 0) {
          return false; // ไม่มี format ที่ต้องการ
        }

        // สร้าง detector
        detectorRef.current = new BarcodeDetector({ formats: wantedFormats });

        // ขอกล้อง
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach(t => t.stop());
          return false;
        }

        streamRef.current = stream;

        // ต่อ stream กับ video
        if (!videoRef.current) {
          // สร้าง video element manually
          const v = document.createElement('video');
          v.autoplay = true;
          v.playsInline = true;
          v.muted = true;
          v.style.width = '100%';
          v.style.height = '100%';
          v.style.objectFit = 'cover';
          
          const container = document.getElementById(SCANNER_ID);
          if (container) {
            container.innerHTML = '';
            container.appendChild(v);
          }
          videoRef.current = v;
        }

        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        if (cancelled) {
          stream.getTracks().forEach(t => t.stop());
          return false;
        }

        setUsingNative(true);
        setCameraState('ready');
        setStatusMessage('เล็งไปที่ Barcode หรือ QR Code');

        // เริ่ม detection loop
        startDetectionLoop();
        return true;
      } catch (e: any) {
        console.warn('Native BarcodeDetector failed:', e);
        return false;
      }
    }

    async function startDetectionLoop() {
      if (!detectorRef.current || !videoRef.current) return;

      const detect = async () => {
        if (cancelled || !isMountedRef.current || isProcessingRef.current) return;
        if (!videoRef.current || videoRef.current.readyState < 2) {
          rafRef.current = requestAnimationFrame(detect);
          return;
        }

        try {
          const barcodes = await detectorRef.current.detect(videoRef.current);
          if (barcodes.length > 0) {
            handleDecoded(barcodes[0].rawValue);
            return; // หยุด loop
          }
        } catch (e) {
          // ignore per-frame errors
        }

        rafRef.current = requestAnimationFrame(detect);
      };

      detect();
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // วิธีที่ 2: Fallback ใช้ html5-qrcode (ทุก browser)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    async function tryHtml5Qrcode() {
      setStatusMessage('กำลังโหลด scanner...');
      
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode');
      if (cancelled) return;

      // ใช้เฉพาะ format ที่ mode ต้องการ
      const formats = FORMATS_BY_MODE[mode].html5
        .map(name => (Html5QrcodeSupportedFormats as any)[name])
        .filter(Boolean);

      const scanner = new Html5Qrcode(SCANNER_ID, {
        formatsToSupport: formats,
        verbose: false,
      } as any);

      html5ScannerRef.current = scanner;
      setStatusMessage('กำลังเปิดกล้อง...');

      // เริ่มด้วย ideal:environment ทันที (ไม่ลอง exact ก่อน - ประหยัด 200-400ms)
      await scanner.start(
        { facingMode: { ideal: 'environment' } as any },
        {
          fps: 15, // เพิ่มจาก 10 → 15 = scan บ่อยขึ้น
          qrbox: (vw: number, vh: number) => {
            const minDim = Math.min(vw, vh);
            // กล่องเล็กลง 70% = engine ประมวลผลพื้นที่น้อยลง = เร็วขึ้น
            return {
              width: Math.floor(minDim * 0.7),
              height: Math.floor(minDim * 0.45),
            };
          },
          aspectRatio: 1.333,
          disableFlip: false,
          videoConstraints: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        } as any,
        handleDecoded,
        () => {}
      );

      if (cancelled) {
        try { await scanner.stop(); } catch (e) {}
        return;
      }

      setCameraState('ready');
      setStatusMessage('เล็งไปที่ Barcode หรือ QR Code');
    }

    async function checkBrowserSupport(): Promise<boolean> {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraState('unsupported');
        setErrorDetail('Browser ไม่รองรับการเข้าถึงกล้อง กรุณาใช้ Chrome/Safari เวอร์ชั่นใหม่');
        return false;
      }
      return true;
    }

    async function start() {
      try {
        setCameraState('requesting');
        setStatusMessage('กำลังเปิดกล้อง...');

        const supported = await checkBrowserSupport();
        if (!supported || cancelled) return;

        // 🚀 ลองใช้ Native BarcodeDetector ก่อน (เร็วกว่ามาก)
        const nativeOk = await tryNativeDetector();
        if (nativeOk || cancelled) return;

        // Fallback: html5-qrcode
        await tryHtml5Qrcode();
      } catch (e: any) {
        if (cancelled) return;
        console.error('Scanner error:', e);
        
        const name = e?.name || '';
        const msg = (e?.message || '').toLowerCase();

        if (name === 'NotAllowedError' || msg.includes('permission')) {
          setCameraState('denied');
          setErrorDetail('กรุณาอนุญาตการเข้าถึงกล้องในเบราว์เซอร์');
        } else if (name === 'NotFoundError' || msg.includes('not found')) {
          setCameraState('no-camera');
          setErrorDetail('ไม่พบกล้องในอุปกรณ์นี้');
        } else if (name === 'NotReadableError') {
          setCameraState('error');
          setErrorDetail('กล้องกำลังถูกใช้งานโดยแอปอื่น');
        } else if (msg.includes('https') || msg.includes('secure')) {
          setCameraState('unsupported');
          setErrorDetail('ต้องใช้ผ่าน HTTPS เท่านั้น');
        } else {
          setCameraState('error');
          setErrorDetail(e?.message || 'ไม่สามารถเปิดกล้องได้');
        }
      }
    }

    async function stopAll() {
      // Stop native
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      detectorRef.current = null;

      // Stop html5-qrcode
      const scanner = html5ScannerRef.current;
      if (scanner) {
        try {
          if (scanner.isScanning) await scanner.stop();
          try { scanner.clear(); } catch (e) {}
        } catch (e) {
          console.warn('Stop scanner error:', e);
        }
        html5ScannerRef.current = null;
      }
    }

    start();

    return () => {
      cancelled = true;
      isMountedRef.current = false;
      stopAll();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  function handleManualSubmit() {
    const cleaned = manualInput.trim();
    if (!cleaned) return;
    
    if (mode === 'imei') {
      const numericOnly = cleaned.replace(/\D/g, '');
      if (numericOnly.length < 14 || numericOnly.length > 16) {
        alert('IMEI ต้องมี 14-16 หลัก');
        return;
      }
      const final = numericOnly.length === 16 ? numericOnly.substring(0, 15) : numericOnly;
      onScan(final);
    } else {
      if (cleaned.length < 3) {
        alert('รหัสสั้นเกินไป');
        return;
      }
      onScan(cleaned);
    }
  }

  const hasError = ['denied', 'no-camera', 'unsupported', 'error'].includes(cameraState);

  return (
    <div className="modal-overlay" style={{ alignItems: 'center', padding: 12 }}>
      <div className="modal" style={{ 
        maxWidth: 480, 
        width: '100%',
        padding: 0, 
        overflow: 'hidden',
        maxHeight: '95vh',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{ 
          padding: '16px 20px 12px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16 }}>
              📷 สแกน
              {usingNative && cameraState === 'ready' && (
                <span style={{ 
                  fontSize: 9, 
                  background: 'rgba(16, 185, 129, 0.15)', 
                  color: '#10b981',
                  padding: '2px 6px',
                  borderRadius: 4,
                  marginLeft: 8,
                  fontWeight: 700,
                }}>FAST</span>
              )}
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-dim)' }}>
              {mode === 'imei' ? 'IMEI บนกล่องเครื่อง' :
               mode === 'sku' ? 'QR Code / Barcode บนป้าย' :
               'QR Code / Barcode'}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="ปิด"
            style={{
              background: 'var(--surface-2)',
              border: 'none',
              borderRadius: '50%',
              width: 32,
              height: 32,
              cursor: 'pointer',
              fontSize: 16,
              color: 'var(--text)',
              fontFamily: 'inherit',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >✕</button>
        </div>

        {/* Body */}
        {hasError ? (
          <div style={{ padding: 20, overflow: 'auto' }}>
            <div style={{
              padding: 14,
              background: 'rgba(255, 71, 87, 0.08)',
              borderLeft: '3px solid #ff4757',
              borderRadius: 6,
              marginBottom: 16,
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#ff4757', marginBottom: 4 }}>
                {cameraState === 'denied' && '🚫 ไม่ได้รับอนุญาตให้ใช้กล้อง'}
                {cameraState === 'no-camera' && '📷 ไม่พบกล้อง'}
                {cameraState === 'unsupported' && '⚠️ Browser ไม่รองรับ'}
                {cameraState === 'error' && '⚠️ ไม่สามารถเปิดกล้อง'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.5 }}>
                {errorDetail}
              </div>
            </div>

            {cameraState === 'denied' && (
              <div style={{
                padding: 12,
                background: 'var(--surface-2)',
                borderRadius: 6,
                fontSize: 12,
                marginBottom: 16,
                lineHeight: 1.7,
              }}>
                <strong>💡 วิธีแก้:</strong>
                <ol style={{ marginLeft: 18, marginTop: 4 }}>
                  <li>กดไอคอน 🔒 / ⓘ ในแถบ URL</li>
                  <li>เลือก "การตั้งค่าเว็บไซต์"</li>
                  <li>เปลี่ยน "กล้อง" เป็น "อนุญาต"</li>
                  <li>Refresh หน้าใหม่</li>
                </ol>
              </div>
            )}

            <div style={{ padding: 12, background: 'var(--surface-2)', borderRadius: 8 }}>
              <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8, fontWeight: 600 }}>
                ⌨️ กรอกรหัสเอง
              </div>
              <input
                type="text"
                inputMode={mode === 'imei' ? 'numeric' : 'text'}
                value={manualInput}
                onChange={e => setManualInput(e.target.value)}
                placeholder={mode === 'imei' ? '356789012345678' : 'ITM-A1B2C3'}
                autoFocus
                style={{
                  width: '100%',
                  padding: 12,
                  fontSize: 16,
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  color: 'var(--text)',
                  fontFamily: 'JetBrains Mono, monospace',
                  marginBottom: 10,
                }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleManualSubmit(); } }}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button 
                  onClick={handleManualSubmit}
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    background: 'var(--accent)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                >✓ ใช้รหัสนี้</button>
                <button 
                  onClick={onClose}
                  style={{
                    padding: '12px 16px',
                    background: 'var(--surface)',
                    color: 'var(--text)',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontSize: 14,
                  }}
                >ยกเลิก</button>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Camera View */}
            <div style={{ 
              position: 'relative', 
              background: '#000', 
              aspectRatio: '4/3',
              flex: '0 0 auto',
            }}>
              <div 
                id={SCANNER_ID} 
                style={{ width: '100%', height: '100%', overflow: 'hidden' }}
              />

              {/* Loading */}
              {cameraState !== 'ready' && (
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'rgba(0,0,0,0.6)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'column',
                  gap: 12,
                  zIndex: 20,
                }}>
                  <div style={{
                    width: 40, height: 40,
                    border: '3px solid rgba(255,255,255,0.2)',
                    borderTopColor: '#fff',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite',
                  }}/>
                  <div style={{ color: '#fff', fontSize: 13, fontWeight: 500 }}>
                    {statusMessage}
                  </div>
                </div>
              )}

              {/* Frame */}
              {cameraState === 'ready' && (
                <>
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    pointerEvents: 'none',
                    zIndex: 5,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <div style={{
                      position: 'relative',
                      width: '70%',
                      maxWidth: 280,
                      aspectRatio: '1.6 / 1',
                      borderRadius: 16,
                      boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)',
                    }}>
                      <div style={{ position: 'absolute', top: -3, left: -3, width: 32, height: 32, borderTop: '4px solid var(--accent)', borderLeft: '4px solid var(--accent)', borderTopLeftRadius: 16 }}/>
                      <div style={{ position: 'absolute', top: -3, right: -3, width: 32, height: 32, borderTop: '4px solid var(--accent)', borderRight: '4px solid var(--accent)', borderTopRightRadius: 16 }}/>
                      <div style={{ position: 'absolute', bottom: -3, left: -3, width: 32, height: 32, borderBottom: '4px solid var(--accent)', borderLeft: '4px solid var(--accent)', borderBottomLeftRadius: 16 }}/>
                      <div style={{ position: 'absolute', bottom: -3, right: -3, width: 32, height: 32, borderBottom: '4px solid var(--accent)', borderRight: '4px solid var(--accent)', borderBottomRightRadius: 16 }}/>

                      <div style={{
                        position: 'absolute',
                        top: 0, left: 8, right: 8,
                        height: 2,
                        background: 'linear-gradient(90deg, transparent 0%, #ff3344 20%, #ff3344 80%, transparent 100%)',
                        boxShadow: '0 0 12px #ff3344, 0 0 24px #ff3344',
                        animation: 'scanLaser 2.4s ease-in-out infinite',
                        borderRadius: 2,
                      }}/>

                      <div style={{
                        position: 'absolute',
                        inset: 0,
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                        borderRadius: 16,
                        boxShadow: 'inset 0 0 20px rgba(59, 130, 246, 0.15)',
                      }}/>
                    </div>
                  </div>

                  <div style={{
                    position: 'absolute',
                    bottom: 12, left: 12, right: 12,
                    textAlign: 'center',
                    color: '#fff',
                    fontSize: 12,
                    background: 'rgba(0,0,0,0.7)',
                    padding: '8px 12px',
                    borderRadius: 6,
                    fontWeight: 500,
                    pointerEvents: 'none',
                    zIndex: 10,
                  }}>{statusMessage}</div>
                </>
              )}

              <style>{`
                @keyframes scanLaser {
                  0%, 100% { top: 6%; opacity: 1; }
                  50% { top: calc(94% - 2px); opacity: 1; }
                  45%, 55% { opacity: 0.6; }
                }
                @keyframes spin { to { transform: rotate(360deg); } }
              `}</style>
            </div>

            {/* Footer */}
            <div style={{ padding: 14, flex: '0 0 auto', borderTop: '1px solid var(--border)' }}>
              {!showManualInput ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => setShowManualInput(true)}
                    style={{
                      flex: 1,
                      padding: '10px 14px',
                      background: 'var(--surface-2)',
                      color: 'var(--text)',
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      fontSize: 13,
                      fontWeight: 500,
                    }}
                  >⌨️ กรอกเอง</button>
                  <button 
                    onClick={onClose}
                    style={{
                      padding: '10px 16px',
                      background: 'transparent',
                      color: 'var(--text-dim)',
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      fontSize: 13,
                    }}
                  >ปิด</button>
                </div>
              ) : (
                <div>
                  <div style={{ 
                    fontSize: 11, color: 'var(--text-dim)', marginBottom: 6,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <span>⌨️ พิมพ์รหัสเอง</span>
                    <button
                      onClick={() => { setShowManualInput(false); setManualInput(''); }}
                      style={{
                        background: 'transparent', border: 'none', color: 'var(--accent)',
                        cursor: 'pointer', fontSize: 11, padding: 2, fontFamily: 'inherit',
                      }}
                    >กลับไปสแกน</button>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="text"
                      inputMode={mode === 'imei' ? 'numeric' : 'text'}
                      value={manualInput}
                      onChange={e => setManualInput(e.target.value)}
                      placeholder={mode === 'imei' ? '356789012345678' : 'ITM-A1B2C3'}
                      autoFocus
                      style={{
                        flex: 1, padding: 12, fontSize: 16,
                        background: 'var(--surface-2)',
                        border: '1px solid var(--border)',
                        borderRadius: 6,
                        color: 'var(--text)',
                        fontFamily: 'JetBrains Mono, monospace',
                      }}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleManualSubmit(); } }}
                    />
                    <button
                      onClick={handleManualSubmit}
                      style={{
                        padding: '0 18px',
                        background: 'var(--accent)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 6,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        fontWeight: 600,
                        fontSize: 14,
                      }}
                    >ใช้</button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
