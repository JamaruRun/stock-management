'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-client';
import {
  X, Edit2, Trash2, ShoppingCart, Printer, Copy, Calendar,
  Smartphone, Tag, MapPin, Truck, CheckCircle2,
} from 'lucide-react';

interface Props {
  item: any;
  isAdmin: boolean;
  onClose: () => void;
  onDeleted: () => void;
}

export default function StockDetailModal({ item, isAdmin, onClose, onDeleted }: Props) {
  const supabase = createClient();
  const [deleting, setDeleting] = useState(false);
  const [copied, setCopied] = useState(false);
  const profit = (Number(item.price) || 0) - (Number(item.cost_price) || 0);
  const profitPct = item.cost_price ? ((profit / Number(item.cost_price)) * 100).toFixed(1) : '0';

  async function handleDelete() {
    if (!confirm(`ลบเครื่อง ${item.model} (IMEI: ${item.imei})?\n\nการลบนี้ย้อนกลับไม่ได้`)) return;
    setDeleting(true);
    const { error } = await supabase.from('stock').delete().eq('id', item.id);
    if (error) {
      alert('ลบไม่สำเร็จ: ' + error.message);
      setDeleting(false);
      return;
    }
    onDeleted();
  }

  function copyImei() {
    navigator.clipboard.writeText(item.imei);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div onClick={onClose} style={overlayStyle}>
      <div onClick={(e) => e.stopPropagation()} style={modalStyle}>
        {/* Close button */}
        <button onClick={onClose} style={closeBtnStyle}>
          <X size={18} />
        </button>

        {/* Hero - phone image */}
        <div style={{
          background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
          padding: '32px 20px 20px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          position: 'relative',
        }}>
          <PhoneSVGLarge model={item.model} color={item.color} />
          <h2 style={{
            fontSize: 22,
            fontWeight: 800,
            marginTop: 14,
            fontFamily: 'Prompt, Sarabun, sans-serif',
            letterSpacing: '-0.5px',
          }}>
            {item.model}
          </h2>
          <div style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 4 }}>
            {item.spec}{item.spec && item.color ? ' • ' : ''}{item.color}
          </div>
          <span style={{
            display: 'inline-block',
            marginTop: 10,
            padding: '4px 14px',
            background: '#dcfce7',
            color: '#166534',
            fontSize: 11,
            fontWeight: 600,
            borderRadius: 100,
          }}>
            <CheckCircle2 size={11} style={{ display: 'inline', marginRight: 4, verticalAlign: '-1px' }} />
            พร้อมขาย
          </span>
        </div>

        {/* Body */}
        <div style={{ padding: 16, overflowY: 'auto' }}>
          {/* IMEI */}
          <div style={{
            background: 'var(--surface-2)',
            borderRadius: 12,
            padding: '12px 14px',
            marginBottom: 14,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 10,
          }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 2 }}>IMEI</div>
              <div style={{
                fontFamily: 'monospace',
                fontSize: 14,
                fontWeight: 600,
                wordBreak: 'break-all',
              }}>
                {item.imei}
              </div>
            </div>
            <button onClick={copyImei} style={iconBtnStyle}>
              {copied ? <CheckCircle2 size={16} color="#22c55e" /> : <Copy size={16} />}
            </button>
          </div>

          {/* Price section */}
          <div style={{
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: 12,
            marginBottom: 14,
          }}>
            {isAdmin && item.cost_price && (
              <PriceRow label="ต้นทุน" value={`฿${Number(item.cost_price).toLocaleString()}`} />
            )}
            <PriceRow
              label="ราคาขาย"
              value={`฿${Number(item.price).toLocaleString()}`}
              big
              color="var(--accent)"
            />
            {isAdmin && item.cost_price && profit !== 0 && (
              <PriceRow
                label="กำไร"
                value={`฿${profit.toLocaleString()} (${profitPct}%)`}
                color={profit > 0 ? '#22c55e' : '#ef4444'}
              />
            )}
          </div>

          {/* Details */}
          <div style={{ marginBottom: 14 }}>
            <h4 style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              รายละเอียดเพิ่มเติม
            </h4>
            <div style={{ display: 'grid', gap: 8 }}>
              <DetailRow
                Icon={Tag}
                label="สภาพ"
                value={item.device_condition === 'used' ? 'เครื่องมือสอง' : 'เครื่องใหม่ / มือ 1'}
              />
              {item.branches?.name && (
                <DetailRow Icon={MapPin} label="สาขา" value={item.branches.name} />
              )}
              {item.suppliers?.name && (
                <DetailRow Icon={Truck} label="ซัพพลายเออร์" value={item.suppliers.name} />
              )}
              {item.added_date && (
                <DetailRow
                  Icon={Calendar}
                  label="วันที่รับเข้า"
                  value={new Date(item.added_date).toLocaleDateString('th-TH', {
                    year: 'numeric', month: 'short', day: 'numeric',
                  })}
                />
              )}
              {item.added_by_name && (
                <DetailRow Icon={Smartphone} label="ผู้บันทึก" value={item.added_by_name} />
              )}
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Link
              href={`/dashboard/sell?imei=${encodeURIComponent(item.imei)}`}
              style={primaryBtnStyle}
            >
              <ShoppingCart size={16} /> ขายเครื่องนี้
            </Link>
            <div style={{ display: 'flex', gap: 8 }}>
              <Link
                href={`/dashboard/stock`}
                style={secondaryBtnStyle}
              >
                <Edit2 size={14} /> แก้ไข
              </Link>
              <button
                onClick={handleDelete}
                disabled={deleting}
                style={dangerBtnStyle}
              >
                <Trash2 size={14} /> {deleting ? 'กำลังลบ...' : 'ลบ'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PriceRow({ label, value, big, color }: any) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
      padding: big ? '8px 0' : '4px 0',
      borderTop: big ? '1px dashed var(--border)' : 'none',
      marginTop: big ? 6 : 0,
    }}>
      <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{label}</span>
      <span style={{
        fontSize: big ? 22 : 14,
        fontWeight: big ? 800 : 600,
        color: color || 'var(--text)',
        fontFamily: 'Prompt, Sarabun, sans-serif',
      }}>
        {value}
      </span>
    </div>
  );
}

function DetailRow({ Icon, label, value }: any) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 12px',
      background: 'var(--surface-2)',
      borderRadius: 10,
    }}>
      <Icon size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 600, textAlign: 'right' }}>{value}</span>
      </div>
    </div>
  );
}

function PhoneSVGLarge({ model, color }: { model: string; color?: string | null }) {
  const m = (model || '').toLowerCase();
  const c = (color || '').toLowerCase();
  let bodyColor = '#1c1c1e';
  let hasNotch = false;
  let hasDynamicIsland = false;
  if (c.includes('white') || c.includes('starlight') || c.includes('silver')) bodyColor = '#f5f5f7';
  else if (c.includes('blue') || c.includes('sierra')) bodyColor = '#1e40af';
  else if (c.includes('red')) bodyColor = '#dc2626';
  else if (c.includes('green')) bodyColor = '#16a34a';
  else if (c.includes('purple') || c.includes('violet')) bodyColor = '#7c3aed';
  else if (c.includes('pink') || c.includes('rose')) bodyColor = '#ec4899';
  else if (c.includes('gold')) bodyColor = '#f59e0b';
  else if (c.includes('midnight') || c.includes('black') || c.includes('graphite')) bodyColor = '#0f172a';
  if (m.match(/iphone\s*1[4-9]|iphone\s*2[0-9]/) && m.includes('pro')) hasDynamicIsland = true;
  else if (m.match(/iphone\s*(x|11|12|13|14|15)/)) hasNotch = true;

  return (
    <svg width="100" height="150" viewBox="0 0 100 150" style={{ filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.15))' }}>
      <rect x="5" y="5" width="90" height="140" rx="14" fill={bodyColor} stroke="rgba(0,0,0,0.1)" strokeWidth="0.5" />
      <rect x="9" y="11" width="82" height="128" rx="10" fill="#000" />
      {hasNotch && <rect x="36" y="11" width="28" height="5" rx="2.5" fill={bodyColor} />}
      {hasDynamicIsland && <rect x="40" y="16" width="20" height="5" rx="2.5" fill="#000" />}
      {!hasNotch && !hasDynamicIsland && (
        <rect x="44" y="16" width="12" height="1.5" rx="0.75" fill="rgba(255,255,255,0.2)" />
      )}
    </svg>
  );
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.5)',
  backdropFilter: 'blur(4px)',
  zIndex: 100,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 12,
};

const modalStyle: React.CSSProperties = {
  background: 'var(--surface)',
  borderRadius: 20,
  width: '100%',
  maxWidth: 440,
  maxHeight: '92vh',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
  position: 'relative',
};

const closeBtnStyle: React.CSSProperties = {
  position: 'absolute',
  top: 12, right: 12,
  width: 32, height: 32,
  borderRadius: 8,
  background: 'rgba(255,255,255,0.9)',
  backdropFilter: 'blur(10px)',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--text)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 10,
};

const iconBtnStyle: React.CSSProperties = {
  width: 32, height: 32,
  borderRadius: 8,
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  cursor: 'pointer',
  color: 'var(--text)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  flexShrink: 0,
};

const primaryBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  padding: '14px',
  background: 'var(--accent)',
  color: '#fff',
  border: 'none',
  borderRadius: 12,
  fontSize: 14,
  fontWeight: 700,
  cursor: 'pointer',
  textDecoration: 'none',
  fontFamily: 'inherit',
};

const secondaryBtnStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  padding: '11px',
  background: 'var(--surface-2)',
  color: 'var(--text)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  textDecoration: 'none',
  fontFamily: 'inherit',
};

const dangerBtnStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  padding: '11px',
  background: '#fee2e2',
  color: '#991b1b',
  border: '1px solid #fecaca',
  borderRadius: 10,
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
};
