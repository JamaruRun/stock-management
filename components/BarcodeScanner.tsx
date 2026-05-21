'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  onScan: (code: string) => void;
  onClose: () => void;
  mode?: 'imei' | 'sku' | 'any';
}

const SCANNER_ID = 'barcode-scanner-region';
const DEBOUNCE_MS = 1500; // กันสแกนซ้ำใน 1.5 วินาที

type CameraState = 'idle' | 'requesting' | 'ready' | 'denied' | 'no-camera' | 'unsupported' | 'error';

export default function BarcodeScanner({ onScan, onClose, mode = 'any' }: Props) {
  const [cameraState, setCameraState] = useState<CameraState>('idle');
  const [errorDetail, setErrorDetail] = useState('');
  const [manualInput, setManualInput] = useState('');
  const [statusMessage, setStatusMessage] = useState('กำลังเตรียมกล้อง...');
  const [showManualInput, setShowManualInput] = useState(false);
  
  // Refs สำหรับ scanner control
  const scannerRef = useRef<any>(null);
  const lastScanRef = useRef<{ code: string; time: number }>({ code: '', time: 0 });
  const isProcessingRef = useRef(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    let cancelled = false;

    async function checkBrowserSupport(): Promise<boolean> {
      // เช็คว่า browser รองรับ MediaDevices API ไหม
      if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraState('unsupported');
        setErrorDetail('Browser ไม่รองรับการเข้าถึงกล้อง กรุณาใช้ Chrome/Safari เวอร์ชั่นใหม่');
        return false;
      }

      // เช็คว่ามีกล้องในเครื่องไหม
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const hasCamera = devices.some(d => d.kind === 'videoinput');
        if (!hasCamera) {
          setCameraState('no-camera');
          setErrorDetail('ไม่พบกล้องในอุปกรณ์นี้');
          return false;
        }
      } catch (e) {
        // ผ่านไปก่อน - ลอง getUserMedia ดู
      }

      return true;
    }

    async function start() {
      try {
        setCameraState('requesting');
        setStatusMessage('กำลังขออนุญาตใช้กล้อง...');

        // 1. Check browser support
        const supported = await checkBrowserSupport();
        if (!supported || cancelled) return;

        // 2. Dynamic import html5-qrcode
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode');
        if (cancelled) return;

        // 3. สร้าง scanner instance
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

        // 4. Start - ใช้กล้องหลังเป็นค่าเริ่มต้น + 1280x720
        setStatusMessage('กำลังเปิดกล้อง...');
        
        await scanner.start(
          { facingMode: { exact: 'environment' } as any }, // บังคับกล้องหลังก่อน
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
              facingMode: { ideal: 'environment' },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          } as any,
          handleDecoded,
          () => {} // silent error per frame
        ).catch(async (err: any) => {
          // ถ้า exact: 'environment' ไม่ได้ ลอง fallback เป็น ideal
          console.warn('Exact environment failed, fallback:', err);
          if (cancelled) return;
          
          try {
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
                  facingMode: { ideal: 'environment' },
                  width: { ideal: 1280 },
                  height: { ideal: 720 },
                },
              } as any,
              handleDecoded,
              () => {}
            );
          } catch (innerErr) {
            throw innerErr;
          }
        });

        if (cancelled) {
          try { await scanner.stop(); } catch (e) {}
          return;
        }

        setCameraState('ready');
        setStatusMessage('เล็งไปที่ Barcode หรือ QR Code');
      } catch (e: any) {
        if (cancelled) return;
        console.error('Scanner error:', e);
        
        // จำแนกประเภท error
        const name = e?.name || '';
        const msg = (e?.message || '').toLowerCase();

        if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || msg.includes('permission') || msg.includes('denied')) {
          setCameraState('denied');
          setErrorDetail('กรุณาอนุญาตการเข้าถึงกล้องในเบราว์เซอร์');
        } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || msg.includes('not found') || msg.includes('no camera')) {
          setCameraState('no-camera');
          setErrorDetail('ไม่พบกล้องในอุปกรณ์นี้');
        } else if (name === 'NotReadableError' || msg.includes('in use') || msg.includes('busy')) {
          setCameraState('error');
          setErrorDetail('กล้องกำลังถูกใช้งานโดยแอปอื่น กรุณาปิดแอปอื่นก่อน');
        } else if (name === 'OverconstrainedError' || msg.includes('constraint')) {
          setCameraState('error');
          setErrorDetail('กล้องไม่รองรับการตั้งค่าที่ขอ');
        } else if (msg.includes('https') || msg.includes('secure')) {
          setCameraState('unsupported');
          setErrorDetail('ต้องใช้ผ่าน HTTPS เท่านั้น');
        } else {
          setCameraState('error');
          setErrorDetail(e?.message || 'ไม่สามารถเปิดกล้องได้');
        }
      }
    }

    function handleDecoded(decodedText: string) {
      if (cancelled || !isMountedRef.current) return;
      if (isProcessingRef.current) return; // กันยิงซ้อน

      const cleaned = decodedText.trim();
      const now = Date.now();

      // Debounce - ถ้าเป็นรหัสเดียวกันใน 1.5 วินาที → ข้าม
      if (cleaned === lastScanRef.current.code && (now - lastScanRef.current.time) < DEBOUNCE_MS) {
        return;
      }
      lastScanRef.current = { code: cleaned, time: now };

      const numericOnly = cleaned.replace(/\D/g, '');

      console.log('[Scanner]', { raw: decodedText, cleaned, numericOnly, mode });

      // Validate ตาม mode
      let final = '';
      
      if (mode === 'imei') {
        if (numericOnly.length >= 14 && numericOnly.length <= 16) {
          final = numericOnly.length === 16 ? numericOnly.substring(0, 15) : numericOnly;
        } else if (numericOnly.length >= 10 && numericOnly.length < 14) {
          // อ่านบางส่วน - แจ้งเตือนแต่ไม่ commit
          setStatusMessage(`อ่านได้ ${numericOnly.length} หลัก (ต้องการ 15) - เลื่อนกล้องให้ใกล้ขึ้น`);
          return;
        } else {
          return; // ไม่ใช่ IMEI - ข้าม
        }
      } else if (mode === 'sku') {
        if (cleaned.length >= 3) {
          final = cleaned;
        } else {
          return;
        }
      } else {
        // mode = 'any'
        if (cleaned.length >= 3) {
          // ถ้าเป็นเลข 15 หลัก คิดว่าเป็น IMEI
          if (numericOnly.length === 15) {
            final = numericOnly;
          } else {
            final = cleaned;
          }
        } else {
          return;
        }
      }

      if (!final) return;

      // ✅ ยอมรับการสแกน
      isProcessingRef.current = true;
      setStatusMessage(`✓ พบ: ${final.substring(0, 20)}${final.length > 20 ? '...' : ''}`);
      
      // Haptic feedback
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate(150); } catch (e) {}
      }

      // หยุดกล้องทันทีเพื่อไม่ให้ scan ซ้ำ
      stopScanner().finally(() => {
        // ส่ง code กลับ
        if (isMountedRef.current && !cancelled) {
          onScan(final);
        }
      });
    }

    async function stopScanner() {
      const scanner = scannerRef.current;
      if (!scanner) return;
      
      try {
        if (scanner.isScanning) {
          await scanner.stop();
        }
        try {
          scanner.clear();
        } catch (e) {}
      } catch (e) {
        console.warn('Stop scanner error:', e);
      } finally {
        scannerRef.current = null;
      }
    }

    start();

    return () => {
      cancelled = true;
      isMountedRef.current = false;
      stopScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  function handleManualSubmit() {
    const cleaned = manualInput.trim();
    if (!cleaned) {
      return;
    }
    
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
        alert('รหัสสั้นเกินไป (ต้องมีอย่างน้อย 3 ตัวอักษร)');
        return;
      }
      onScan(cleaned);
    }
  }

  const hasError = ['denied', 'no-camera', 'unsupported', 'error'].includes(cameraState);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Render
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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
            <h3 style={{ margin: 0, fontSize: 16 }}>📷 สแกน</h3>
            <p style={{ 
              margin: '2px 0 0', 
              fontSize: 11, 
              color: 'var(--text-dim)',
            }}>
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

        {/* Body - Error State */}
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

            {/* แนะนำการแก้ไข */}
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

            {/* Manual input - fallback */}
            <div style={{ 
              padding: 12, 
              background: 'var(--surface-2)', 
              borderRadius: 8,
            }}>
              <div style={{ 
                fontSize: 12, 
                color: 'var(--text-dim)', 
                marginBottom: 8,
                fontWeight: 600,
              }}>
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
                  fontSize: 16, // ใหญ่กว่า 16 = iOS ไม่ zoom
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  color: 'var(--text)',
                  fontFamily: 'JetBrains Mono, monospace',
                  marginBottom: 10,
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleManualSubmit();
                  }
                }}
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
                style={{ 
                  width: '100%', 
                  height: '100%',
                  overflow: 'hidden',
                }}
              />

              {/* Loading overlay - ก่อนกล้องเปิด */}
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
                    width: 40,
                    height: 40,
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

              {/* กรอบสแกน + Laser */}
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
                      width: '80%',
                      maxWidth: 320,
                      aspectRatio: '1.6 / 1',
                      borderRadius: 16,
                      boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)',
                    }}>
                      {/* 4 มุม */}
                      <div style={{ position: 'absolute', top: -3, left: -3, width: 32, height: 32, borderTop: '4px solid var(--accent)', borderLeft: '4px solid var(--accent)', borderTopLeftRadius: 16 }}/>
                      <div style={{ position: 'absolute', top: -3, right: -3, width: 32, height: 32, borderTop: '4px solid var(--accent)', borderRight: '4px solid var(--accent)', borderTopRightRadius: 16 }}/>
                      <div style={{ position: 'absolute', bottom: -3, left: -3, width: 32, height: 32, borderBottom: '4px solid var(--accent)', borderLeft: '4px solid var(--accent)', borderBottomLeftRadius: 16 }}/>
                      <div style={{ position: 'absolute', bottom: -3, right: -3, width: 32, height: 32, borderBottom: '4px solid var(--accent)', borderRight: '4px solid var(--accent)', borderBottomRightRadius: 16 }}/>

                      {/* Laser line */}
                      <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 8,
                        right: 8,
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

                  {/* Status message */}
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
                </>
              )}

              <style>{`
                @keyframes scanLaser {
                  0%, 100% { top: 6%; opacity: 1; }
                  50% { top: calc(94% - 2px); opacity: 1; }
                  45%, 55% { opacity: 0.6; }
                }
                @keyframes spin {
                  to { transform: rotate(360deg); }
                }
              `}</style>
            </div>

            {/* Footer - manual input + close */}
            <div style={{ 
              padding: 14,
              flex: '0 0 auto',
              borderTop: '1px solid var(--border)',
            }}>
              {/* Toggle manual input */}
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
                    fontSize: 11, 
                    color: 'var(--text-dim)', 
                    marginBottom: 6,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}>
                    <span>⌨️ พิมพ์รหัสเอง</span>
                    <button
                      onClick={() => { setShowManualInput(false); setManualInput(''); }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--accent)',
                        cursor: 'pointer',
                        fontSize: 11,
                        padding: 2,
                        fontFamily: 'inherit',
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
                        flex: 1,
                        padding: 12,
                        fontSize: 16, // กันzoomบน iOS
                        background: 'var(--surface-2)',
                        border: '1px solid var(--border)',
                        borderRadius: 6,
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
