'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';

type FeedbackType = 'bug' | 'feature' | 'praise' | 'complaint' | 'general';

const FEEDBACK_TYPES: { id: FeedbackType; label: string; icon: string; color: string }[] = [
  { id: 'bug', label: 'แจ้งบั๊ก', icon: '🐛', color: '#ef4444' },
  { id: 'feature', label: 'ขอฟีเจอร์', icon: '💡', color: '#3b82f6' },
  { id: 'praise', label: 'ชื่นชม', icon: '⭐', color: '#f59e0b' },
  { id: 'complaint', label: 'ร้องเรียน', icon: '😞', color: '#8b5cf6' },
  { id: 'general', label: 'ทั่วไป', icon: '💬', color: '#6b7280' },
];

const COOLDOWN_KEY = 'stock_feedback_last_sent';
const COOLDOWN_MINUTES = 1;

export default function FeedbackButton() {
  const pathname = usePathname();
  const [showModal, setShowModal] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [type, setType] = useState<FeedbackType>('general');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [rating, setRating] = useState<number>(0);

  // ไม่แสดงบนหน้า public
  const isPublicPage = 
    pathname === '/' || 
    pathname === '/login' || 
    pathname === '/signup-beta' ||
    pathname.startsWith('/auth/');

  if (isPublicPage) return null;

  function resetForm() {
    setType('general');
    setSubject('');
    setMessage('');
    setRating(0);
    setError('');
  }

  function close() {
    setShowModal(false);
    setTimeout(() => {
      resetForm();
      setSubmitted(false);
    }, 300);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (message.trim().length < 5) {
      setError('กรุณาเขียนอย่างน้อย 5 ตัวอักษร');
      return;
    }

    // Cooldown check
    const lastSent = localStorage.getItem(COOLDOWN_KEY);
    if (lastSent) {
      const diff = (Date.now() - parseInt(lastSent)) / 1000 / 60;
      if (diff < COOLDOWN_MINUTES) {
        setError(`กรุณารอ ${Math.ceil(COOLDOWN_MINUTES - diff)} นาทีก่อนส่งใหม่`);
        return;
      }
    }

    setSubmitting(true);

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          subject: subject.trim() || undefined,
          message: message.trim(),
          rating: rating > 0 ? rating : undefined,
          page_url: pathname,
        }),
      });

      const data = await res.json();
      
      if (!res.ok) {
        setError(data.error || 'ส่งไม่สำเร็จ');
        setSubmitting(false);
        return;
      }

      localStorage.setItem(COOLDOWN_KEY, Date.now().toString());
      setSubmitted(true);
      setSubmitting(false);
    } catch (e: any) {
      setError('เกิดข้อผิดพลาด: ' + e.message);
      setSubmitting(false);
    }
  }

  const typeInfo = FEEDBACK_TYPES.find(t => t.id === type) || FEEDBACK_TYPES[4];

  return (
    <>
      {/* FAB ลอย - มุมขวาล่าง */}
      <button
        onClick={() => setShowModal(true)}
        title="ส่ง Feedback"
        style={{
          position: 'fixed',
          bottom: 80,
          right: 16,
          width: 52,
          height: 52,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
          color: '#fff',
          border: 'none',
          cursor: 'pointer',
          fontSize: 24,
          boxShadow: '0 8px 20px rgba(139, 92, 246, 0.4)',
          zIndex: 999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'inherit',
          transition: 'transform 0.2s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.1)')}
        onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
      >
        💬
      </button>

      {showModal && (
        <div className="modal-overlay" onClick={close} style={{ padding: 12 }}>
          <div 
            className="modal" 
            onClick={(e) => e.stopPropagation()}
            style={{ 
              maxWidth: 480, 
              width: '100%',
              maxHeight: '90vh',
              overflow: 'auto',
            }}
          >
            {submitted ? (
              // Success state
              <div style={{ textAlign: 'center', padding: 20 }}>
                <div style={{
                  width: 80,
                  height: 80,
                  margin: '0 auto 16px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 38,
                  color: '#fff',
                  boxShadow: '0 8px 20px rgba(16,185,129,0.3)',
                }}>✓</div>
                <h3 style={{ margin: '0 0 8px' }}>ขอบคุณมากครับ! 🙏</h3>
                <p style={{ color: 'var(--text-dim)', fontSize: 14, marginBottom: 20 }}>
                  ข้อความของคุณส่งถึงทีมพัฒนาแล้ว<br />
                  เราจะนำไปปรับปรุงระบบให้ดียิ่งขึ้น
                </p>
                <button onClick={close} className="btn" style={{ width: '100%' }}>
                  ปิดหน้าต่าง
                </button>
              </div>
            ) : (
              // Form state
              <form onSubmit={handleSubmit}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                  <div>
                    <h3 style={{ margin: 0 }}>💬 ส่ง Feedback</h3>
                    <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-dim)' }}>
                      บอกเรา - เพื่อปรับปรุงระบบให้ดียิ่งขึ้น
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={close}
                    style={{
                      background: 'var(--surface-2)',
                      border: 'none',
                      borderRadius: '50%',
                      width: 30,
                      height: 30,
                      cursor: 'pointer',
                      fontSize: 13,
                      color: 'var(--text)',
                      fontFamily: 'inherit',
                    }}
                  >✕</button>
                </div>

                {/* Type buttons */}
                <div style={{ marginTop: 14, marginBottom: 14 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', display: 'block', marginBottom: 8 }}>
                    ประเภท
                  </label>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {FEEDBACK_TYPES.map(t => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setType(t.id)}
                        style={{
                          padding: '8px 12px',
                          background: type === t.id ? t.color : 'var(--surface-2)',
                          color: type === t.id ? '#fff' : 'var(--text)',
                          border: 'none',
                          borderRadius: 6,
                          cursor: 'pointer',
                          fontSize: 12,
                          fontFamily: 'inherit',
                          fontWeight: type === t.id ? 600 : 500,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <span>{t.icon}</span>
                        <span>{t.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Rating (ถ้าเป็น praise) */}
                {type === 'praise' && (
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', display: 'block', marginBottom: 8 }}>
                      ให้คะแนน
                    </label>
                    <div style={{ display: 'flex', gap: 4, fontSize: 28 }}>
                      {[1, 2, 3, 4, 5].map(n => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setRating(n)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            opacity: n <= rating ? 1 : 0.3,
                            fontSize: 28,
                            padding: 2,
                            fontFamily: 'inherit',
                            transition: 'all 0.15s',
                          }}
                        >⭐</button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Subject */}
                <div className="field full" style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>หัวข้อ (ไม่บังคับ)</label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="เช่น ปุ่มปริ้นป้ายไม่ทำงาน"
                    maxLength={100}
                  />
                </div>

                {/* Message */}
                <div className="field full" style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>
                    ข้อความ <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={
                      type === 'bug' ? 'อธิบายอาการ + ขั้นตอนที่ทำก่อนเกิดบั๊ก' :
                      type === 'feature' ? 'ฟีเจอร์อะไรที่อยากให้มี? อยากให้ทำงานยังไง?' :
                      type === 'praise' ? 'สิ่งที่ชอบที่สุดในระบบ' :
                      type === 'complaint' ? 'เกิดอะไรขึ้น? อยากให้แก้ไขอย่างไร?' :
                      'เล่าให้ฟังหน่อย'
                    }
                    rows={5}
                    required
                    minLength={5}
                    maxLength={2000}
                    style={{ resize: 'vertical', fontFamily: 'inherit' }}
                  />
                  <small style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                    {message.length} / 2000 ตัวอักษร
                  </small>
                </div>

                {error && (
                  <div style={{
                    padding: 10,
                    background: 'rgba(239, 68, 68, 0.08)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: 6,
                    color: '#dc2626',
                    fontSize: 12,
                    marginBottom: 12,
                  }}>
                    ⚠️ {error}
                  </div>
                )}

                <div style={{
                  padding: 10,
                  background: 'rgba(59, 130, 246, 0.05)',
                  borderRadius: 6,
                  fontSize: 11,
                  color: 'var(--text-dim)',
                  marginBottom: 14,
                  lineHeight: 1.5,
                }}>
                  💡 ข้อความจะถูกส่งถึงทีมพัฒนาโดยตรง <br />
                  📍 เราจะรู้ว่าคุณส่งจากหน้าไหน + เป็นใคร เพื่อตรวจสอบได้แม่นยำ
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" onClick={close} className="btn btn-sec" disabled={submitting}>
                    ยกเลิก
                  </button>
                  <button 
                    type="submit" 
                    className="btn" 
                    disabled={submitting || message.trim().length < 5}
                  >
                    {submitting ? '⏳ กำลังส่ง...' : `${typeInfo.icon} ส่ง Feedback`}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
