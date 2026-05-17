'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  onScan: (code: string) => void;
  onClose: () => void;
  mode?: 'imei' | 'sku' | 'any';
}

export default function BarcodeScanner({ onScan, onClose, mode = 'any' }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState('');
  const [manualInput, setManualInput] = useState('');
  const [statusMessage, setStatusMessage] = useState('กำลังเปิดกล้อง...');
  const streamRef = useRef<MediaStream | null>(null);
  const scanningRef = useRef(true);
  const controlsRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      try {
        setStatusMessage('กำลังโหลด scanner...');

        // import แบบ dynamic เพื่อไม่ให้ build ติดปัญหา
        const { BrowserMultiFormatReader } = await import('@zxing/browser');
        const { DecodeHintType, BarcodeFormat } = await import('@zxing/library');

        if (cancelled) return;

        // ตั้งค่า hints
        const hints = new Map();
        const formats = [
          BarcodeFormat.QR_CODE,        // QR Code (สำคัญที่สุด)
          BarcodeFormat.CODE_128,       // Barcode สินค้าทั่วไป
          BarcodeFormat.CODE_39,
          BarcodeFormat.EAN_13,         // สินค้าจริง
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
          BarcodeFormat.ITF,
          BarcodeFormat.DATA_MATRIX,
        ];
        hints.set(DecodeHintType.POSSIBLE_FORMATS, formats);
        hints.set(DecodeHintType.TRY_HARDER, true);

        const reader = new BrowserMultiFormatReader(hints);

        setStatusMessage('กำลังเปิดกล้อง...');

        // หากล้องหลัง
        let deviceId: string | undefined;
        try {
          const devices = await BrowserMultiFormatReader.listVideoInputDevices();
          const backCamera = devices.find((d: any) => 
            /back|rear|environment/i.test(d.label)
          );
          deviceId = backCamera?.deviceId || devices[devices.length - 1]?.deviceId;
        } catch (e) {
          // ใช้ default
        }

        if (cancelled) return;

        setStatusMessage('ส่อง QR Code หรือ Barcode ในกรอบ...');

        // เริ่มสแกน
        const controls = await reader.decodeFromVideoDevice(
          deviceId,
          videoRef.current!,
          (result: any, err: any) => {
            if (cancelled || !scanningRef.current) return;
            if (result) {
              handleDetected(result.getText());
            }
          }
        );

        controlsRef.current = controls;

        // เก็บ stream
        if (videoRef.current?.srcObject) {
          streamRef.current = videoRef.current.srcObject as MediaStream;
        }

      } catch (e: any) {
        if (cancelled) return;
        console.error('Scanner error:', e);
        setError(
          e.name === 'NotAllowedError'
            ? 'กรุณาอนุญาตการเข้าถึงกล้อง'
            : 'ไม่สามารถเปิดกล้อง: ' + (e.message || 'unknown')
        );
      }
    }

    function handleDetected(code: string) {
      if (!scanningRef.current) return;

      const cleaned = code.trim();
      const numericOnly = cleaned.replace(/\D/g, '');

      // Debug: แสดงสิ่งที่อ่านได้
      setStatusMessage(`อ่าน: "${cleaned}" (${numericOnly.length} หลัก)`);
      console.log('[Scanner]', { raw: code, cleaned, numericOnly, mode });

      if (mode === 'imei') {
        // ผ่อนเงื่อนไข: ยอมรับ 14-16 หลักตัวเลข
        if (numericOnly.length >= 14 && numericOnly.length <= 16) {
          scanningRef.current = false;
          if (navigator.vibrate) navigator.vibrate(150);
          // ถ้ายาว 14-16 หลัก ใช้ตัวเลขล้วน (ถ้า > 15 ตัด, ถ้า < 15 ใช้ทั้งหมด)
          const final = numericOnly.length === 15 ? numericOnly : 
                       numericOnly.length === 16 ? numericOnly.substring(0, 15) :
                       numericOnly; // 14 หลักก็ส่งให้ user เผื่อแก้
          onScan(final);
          stop();
        } else if (numericOnly.length >= 10) {
          // ตัวเลขเยอะแต่ไม่ครบ - แจ้งให้ user
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
          if (numericOnly.length === 15) {
            onScan(numericOnly);
          } else {
            onScan(cleaned);
          }
          stop();
        }
      }
    }

    function stop() {
      if (controlsRef.current) {
        try { 
          controlsRef.current.stop(); 
        } catch (e) {}
        controlsRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
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
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '80%',
                height: '60%',
                border: '2px solid var(--accent)',
                borderRadius: 4,
                pointerEvents: 'none',
                boxShadow: '0 0 0 9999px rgba(0,0,0,0.4)'
              }}>
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 2,
                  background: 'var(--accent)',
                  boxShadow: '0 0 8px var(--accent)',
                  animation: 'scanLine 2s linear infinite'
                }}/>
              </div>
              <div style={{
                position: 'absolute',
                bottom: 12,
                left: 12,
                right: 12,
                textAlign: 'center',
                color: '#fff',
                fontSize: 12,
                textShadow: '0 1px 2px rgba(0,0,0,0.8)',
                background: 'rgba(0,0,0,0.6)',
                padding: '6px 10px',
                borderRadius: 6,
                fontWeight: 500,
              }}>{statusMessage}</div>
              <style>{`
                @keyframes scanLine {
                  0% { top: 0; }
                  50% { top: calc(100% - 2px); }
                  100% { top: 0; }
                }
              `}</style>
            </div>

            <div style={{ padding: 16 }}>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 6 }}>
                  หรือพิมพ์เอง:
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
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
