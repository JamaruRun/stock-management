'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  onScan: (code: string) => void;
  onClose: () => void;
}

export default function BarcodeScanner({ onScan, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState('');
  const [scanning, setScanning] = useState(true);
  const [manualInput, setManualInput] = useState('');
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    let cancelled = false;
    let detector: any = null;
    let intervalId: any = null;

    async function startCamera() {
      try {
        // ตรวจว่า browser รองรับ BarcodeDetector ไหม
        const hasBarcodeDetector = 'BarcodeDetector' in window;

        if (!hasBarcodeDetector) {
          setError('เบราว์เซอร์นี้ไม่รองรับการสแกน กรุณาพิมพ์ IMEI ด้วยตัวเอง');
          return;
        }

        // @ts-ignore
        detector = new window.BarcodeDetector({
          formats: ['code_128', 'code_39', 'ean_13', 'ean_8', 'qr_code', 'data_matrix']
        });

        // ขอเปิดกล้อง
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment', // กล้องหลัง
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        });

        if (cancelled) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        // เริ่มสแกน
        intervalId = setInterval(async () => {
          if (!videoRef.current || cancelled) return;
          try {
            const barcodes = await detector.detect(videoRef.current);
            if (barcodes.length > 0 && scanning) {
              const code = barcodes[0].rawValue;
              // เช็คว่าเป็น IMEI (15 หลัก) หรือไม่
              const cleaned = code.replace(/\D/g, '');
              if (cleaned.length === 15) {
                setScanning(false);
                onScan(cleaned);
                stopCamera();
              } else if (cleaned.length >= 14 && cleaned.length <= 16) {
                // ใกล้เคียง อาจมี check digit เกิน
                setScanning(false);
                onScan(cleaned.substring(0, 15));
                stopCamera();
              }
            }
          } catch (e) {
            console.error(e);
          }
        }, 500);
      } catch (e: any) {
        setError(
          e.name === 'NotAllowedError'
            ? 'กรุณาอนุญาตการเข้าถึงกล้อง'
            : 'ไม่สามารถเปิดกล้องได้: ' + e.message
        );
      }
    }

    function stopCamera() {
      if (intervalId) clearInterval(intervalId);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    }

    startCamera();

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, []);

  function handleManualSubmit() {
    const cleaned = manualInput.replace(/\D/g, '');
    if (cleaned.length !== 15) {
      setError('IMEI ต้องมี 15 หลัก');
      return;
    }
    onScan(cleaned);
  }

  return (
    <div className="modal-overlay" style={{ alignItems: 'center' }}>
      <div className="modal" style={{ maxWidth: 480, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '20px 20px 12px' }}>
          <h3>สแกน IMEI</h3>
          <p className="modal-sub" style={{ marginBottom: 0 }}>
            ใช้กล้องหลังเล็งไปที่ barcode บนกล่อง
          </p>
        </div>

        {error ? (
          <div style={{ padding: '0 20px 20px' }}>
            <div className="error-box">{error}</div>
            <div className="field">
              <label>หรือพิมพ์ IMEI ด้วยตัวเอง</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={15}
                value={manualInput}
                onChange={e => setManualInput(e.target.value)}
                placeholder="356789012345678"
              />
            </div>
            <div className="modal-actions" style={{ marginTop: 12 }}>
              <button className="btn" onClick={handleManualSubmit}>
                ใช้ IMEI นี้
              </button>
              <button className="btn btn-sec" onClick={onClose}>
                ยกเลิก
              </button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ position: 'relative', background: '#000', aspectRatio: '4/3' }}>
              <video
                ref={videoRef}
                playsInline
                muted
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              {/* กรอบสแกน */}
              <div
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '80%',
                  height: '30%',
                  border: '2px solid var(--accent)',
                  borderRadius: 4,
                  pointerEvents: 'none',
                  boxShadow: '0 0 0 9999px rgba(0,0,0,0.4)'
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 2,
                    background: 'var(--accent)',
                    boxShadow: '0 0 8px var(--accent)',
                    animation: 'scanLine 2s linear infinite'
                  }}
                />
              </div>
              <style>{`
                @keyframes scanLine {
                  0% { top: 0; }
                  50% { top: calc(100% - 2px); }
                  100% { top: 0; }
                }
              `}</style>
            </div>

            <div style={{ padding: 16 }}>
              <p
                style={{
                  fontSize: 12,
                  color: 'var(--text-dim)',
                  textAlign: 'center',
                  marginBottom: 12
                }}
              >
                เล็ง barcode ให้อยู่ในกรอบ ระบบจะสแกนอัตโนมัติ
              </p>
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
