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
  const readerRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadZXing(): Promise<any> {
      if ((window as any).ZXing) return (window as any).ZXing;
      
      return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js';
        script.onload = () => resolve((window as any).ZXing);
        script.onerror = () => reject(new Error('โหลด ZXing ไม่สำเร็จ'));
        document.head.appendChild(script);
      });
    }

    async function start() {
      try {
        setStatusMessage('กำลังโหลดตัวสแกน...');

        // โหลด ZXing ก่อน
        const ZXing = await loadZXing();
        if (cancelled) return;

        setStatusMessage('กำลังเปิดกล้อง...');

        // ตั้งค่า hints สำหรับ ZXing - อ่านได้หลาย format
        const hints = new Map();
        const formats = [
          ZXing.BarcodeFormat.CODE_128,
          ZXing.BarcodeFormat.CODE_39,
          ZXing.BarcodeFormat.EAN_13,
          ZXing.BarcodeFormat.EAN_8,
          ZXing.BarcodeFormat.UPC_A,
          ZXing.BarcodeFormat.UPC_E,
          ZXing.BarcodeFormat.ITF,
          ZXing.BarcodeFormat.QR_CODE,
          ZXing.BarcodeFormat.DATA_MATRIX,
        ];
        hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, formats);
        hints.set(ZXing.DecodeHintType.TRY_HARDER, true);

        const reader = new ZXing.BrowserMultiFormatReader(hints);
        readerRef.current = reader;

        // หา device กล้อง (เลือกกล้องหลัง)
        let deviceId: string | undefined;
        try {
          const devices = await ZXing.BrowserCodeReader.listVideoInputDevices();
          // หากล้องหลัง
          const backCamera = devices.find((d: any) => 
            /back|rear|environment/i.test(d.label)
          );
          deviceId = backCamera?.deviceId || devices[devices.length - 1]?.deviceId;
        } catch (e) {
          // ใช้ default
        }

        if (cancelled) return;

        setStatusMessage('ส่อง barcode ในกรอบ...');

        // เริ่มสแกน
        await reader.decodeFromVideoDevice(
          deviceId || null,
          videoRef.current!,
          (result: any, err: any) => {
            if (cancelled || !scanningRef.current) return;
            if (result) {
              handleDetected(result.getText());
            }
            // err ที่ปกติคือ NotFoundException (ยังไม่เจอ) - ไม่ใช่ error จริง
          }
        );

        // เก็บ stream เผื่อ cleanup
        if (videoRef.current?.srcObject) {
          streamRef.current = videoRef.current.srcObject as MediaStream;
        }

      } catch (e: any) {
        if (cancelled) return;
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

      if (mode === 'imei') {
        if (numericOnly.length === 15) {
          scanningRef.current = false;
          if (navigator.vibrate) navigator.vibrate(150);
          onScan(numericOnly);
          stop();
        } else if (numericOnly.length >= 14 && numericOnly.length <= 16) {
          scanningRef.current = false;
          if (navigator.vibrate) navigator.vibrate(150);
          onScan(numericOnly.substring(0, 15));
          stop();
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
      if (readerRef.current) {
        try { readerRef.current.reset(); } catch (e) {}
        readerRef.current = null;
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
  }, [mode, onScan]);

  function handleManualSubmit() {
    const cleaned = manualInput.trim();
    
    if (mode === 'imei') {
      const numericOnly = cleaned.replace(/\D/g, '');
      if (numericOnly.length !== 15) {
        setError('IMEI ต้องมี 15 หลัก');
        return;
      }
      onScan(numericOnly);
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
          <h3>📷 สแกน Barcode</h3>
          <p className="modal-sub" style={{ marginBottom: 0 }}>
            {mode === 'imei' ? 'ใช้กล้องเล็งไปที่ barcode IMEI บนกล่อง' :
             mode === 'sku' ? 'ส่อง barcode บนสินค้า' :
             'ส่อง barcode'}
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
                width: '85%',
                height: '35%',
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
                left: 0,
                right: 0,
                textAlign: 'center',
                color: '#fff',
                fontSize: 12,
                textShadow: '0 1px 2px rgba(0,0,0,0.8)',
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
