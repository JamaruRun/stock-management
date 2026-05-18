'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  onScan: (code: string) => void;
  onClose: () => void;
  mode?: 'imei' | 'sku' | 'any';
}

const SCANNER_ID = 'barcode-scanner-region';

export default function BarcodeScanner({ onScan, onClose, mode = 'any' }: Props) {
  const [error, setError] = useState('');
  const [manualInput, setManualInput] = useState('');
  const [statusMessage, setStatusMessage] = useState('กำลังเปิดกล้อง...');
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const scannerRef = useRef<any>(null);
  const scanningRef = useRef(true);

  function addDebug(msg: string) {
    setDebugLog(prev => [...prev.slice(-2), msg]);
  }

  useEffect(() => {
    let cancelled = false;

    async function start() {
      try {
        setStatusMessage('กำลังโหลด scanner...');

        // dynamic import เพื่อไม่ให้ build error
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode');

        if (cancelled) return;

        const scanner = new Html5Qrcode(SCANNER_ID, {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.CODE_93,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.ITF,
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.DATA_MATRIX,
            Html5QrcodeSupportedFormats.PDF_417,
            Html5QrcodeSupportedFormats.AZTEC,
          ] as any,
          verbose: false,
        } as any);

        scannerRef.current = scanner;

        setStatusMessage('กำลังเปิดกล้อง...');

        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: (vw: number, vh: number) => {
              const minDim = Math.min(vw, vh);
              return {
                width: Math.floor(minDim * 0.85),
                height: Math.floor(minDim * 0.5),
              };
            },
            aspectRatio: 1.333,
            disableFlip: false,
            videoConstraints: {
              facingMode: 'environment',
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            },
          } as any,
          (decodedText: string) => {
            if (cancelled || !scanningRef.current) return;
            handleDetected(decodedText);
          },
          (errorMessage: string) => {
            // Error ทุก frame (ปกติ) - ไม่แสดง
          }
        );

        if (cancelled) {
          try { await scanner.stop(); } catch (e) {}
          return;
        }

        setStatusMessage('ส่อง barcode หรือ QR Code ในกรอบ...');
      } catch (e: any) {
        if (cancelled) return;
        console.error('Scanner error:', e);
        setError(
          e?.name === 'NotAllowedError'
            ? 'กรุณาอนุญาตการเข้าถึงกล้อง'
            : 'ไม่สามารถเปิดกล้อง: ' + (e?.message || 'unknown')
        );
      }
    }

    function handleDetected(code: string) {
      if (!scanningRef.current) return;

      const cleaned = code.trim();
      const numericOnly = cleaned.replace(/\D/g, '');

      addDebug(`📷 อ่าน: "${cleaned.substring(0, 30)}" (${numericOnly.length} หลัก)`);
      console.log('[Scanner]', { raw: code, cleaned, numericOnly, mode });

      if (mode === 'imei') {
        if (numericOnly.length >= 14 && numericOnly.length <= 16) {
          scanningRef.current = false;
          if (navigator.vibrate) navigator.vibrate(150);
          const final = numericOnly.length === 16 ? numericOnly.substring(0, 15) : numericOnly;
          onScan(final);
          stop();
        } else if (numericOnly.length >= 10) {
          setStatusMessage(`พบ ${numericOnly.length} หลัก (ต้องการ 15) - ขยับกล้องใหม่`);
        }
      } else if (mode === 'sku') {
        if (cleaned.length >= 3) {
          scanningRef.current = false;
          if (navigator.vibrate) navigator.vibrate(150);
          onScan(cleaned);
          stop();
        }
      } else {
        if (cleaned.length >= 3) {
          scanningRef.current = false;
          if (navigator.vibrate) navigator.vibrate(150);
          if (numericOnly.length === 15) onScan(numericOnly);
          else onScan(cleaned);
          stop();
        }
      }
    }

    async function stop() {
      if (scannerRef.current) {
        try { 
          if (scannerRef.current.isScanning) {
            await scannerRef.current.stop();
          }
        } catch (e) {}
        scannerRef.current = null;
      }
    }

    start();

    return () => {
      cancelled = true;
      scanningRef.current = false;
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  function handleManualSubmit() {
    const cleaned = manualInput.trim();
    
    if (mode === 'imei') {
      const numericOnly = cleaned.replace(/\D/g, '');
      if (numericOnly.length < 14 || numericOnly.length > 16) {
        setError('IMEI ควรมี 14-16 หลัก');
        return;
      }
      const final = numericOnly.length === 16 ? numericOnly.substring(0, 15) : numericOnly;
      onScan(final);
    } else {
      if (cleaned.length < 3) {
        setError('รหัสสั้นเกินไป');
        return;
      }
      onScan(cleaned);
    }
  }

  return (
    <div className="modal-overlay" style={{ alignItems: 'center' }}>
      <div className="modal" style={{ maxWidth: 480, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '20px 20px 12px' }}>
          <h3>📷 สแกน</h3>
          <p className="modal-sub" style={{ marginBottom: 0 }}>
            {mode === 'imei' ? 'เล็งไปที่ barcode IMEI บนกล่องเครื่อง' :
             mode === 'sku' ? 'เล็งไปที่ QR Code หรือ Barcode บนป้ายสินค้า' :
             'เล็งไปที่ QR Code หรือ Barcode'}
          </p>
        </div>

        {error ? (
          <div style={{ padding: '0 20px 20px' }}>
            <div style={{
              padding: 12,
              background: 'rgba(255, 71, 87, 0.1)',
              borderLeft: '3px solid #ff4757',
              color: '#ff4757',
              marginBottom: 16,
            }}>{error}</div>
            <div className="field">
              <label>หรือพิมพ์เอง</label>
              <input
                type="text"
                value={manualInput}
                onChange={e => setManualInput(e.target.value)}
                placeholder={mode === 'imei' ? '356789012345678' : 'ITM-A1B2C3'}
                autoFocus
              />
            </div>
            <div className="modal-actions" style={{ marginTop: 12 }}>
              <button className="btn" onClick={handleManualSubmit}>ใช้รหัสนี้</button>
              <button className="btn btn-sec" onClick={onClose}>ยกเลิก</button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ position: 'relative', background: '#000', aspectRatio: '4/3' }}>
              <div 
                id={SCANNER_ID} 
                style={{ 
                  width: '100%', 
                  height: '100%',
                  overflow: 'hidden',
                }}
              />
              <div style={{
                position: 'absolute',
                bottom: 12,
                left: 12,
                right: 12,
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

              {/* Debug log */}
              {debugLog.length > 0 && (
                <div style={{
                  position: 'absolute',
                  top: 12,
                  left: 12,
                  right: 12,
                  background: 'rgba(0,0,0,0.8)',
                  color: '#00ff41',
                  fontSize: 10,
                  padding: '6px 8px',
                  borderRadius: 4,
                  fontFamily: 'JetBrains Mono, monospace',
                  maxHeight: 60,
                  overflow: 'hidden',
                  zIndex: 10,
                  pointerEvents: 'none',
                }}>
                  {debugLog.map((log, i) => (
                    <div key={i} style={{ opacity: 0.7 + i * 0.15 }}>{log}</div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ padding: 16 }}>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 6 }}>
                  💡 พิมพ์เองได้ ถ้าสแกนไม่ติด:
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    inputMode={mode === 'imei' ? 'numeric' : 'text'}
                    value={manualInput}
                    onChange={e => setManualInput(e.target.value)}
                    placeholder={mode === 'imei' ? '356789012345678' : 'ITM-A1B2C3'}
                    style={{
                      flex: 1,
                      padding: 10,
                      background: 'var(--surface-2)',
                      border: '1px solid var(--border)',
                      color: 'var(--text)',
                      fontFamily: 'JetBrains Mono, monospace',
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleManualSubmit();
                      }
                    }}
                  />
                  <button
                    onClick={handleManualSubmit}
                    style={{
                      padding: '0 16px',
                      background: 'var(--accent)',
                      color: 'var(--bg)',
                      border: 'none',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      fontWeight: 600,
                    }}
                  >ใช้</button>
                </div>
              </div>
              <button className="btn btn-sec" onClick={onClose} style={{ width: '100%' }}>
                ยกเลิก
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
