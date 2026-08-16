'use client';

import { useRef, useState } from 'react';

interface Props {
  value: number[];
  onChange?: (v: number[]) => void;
  readOnly?: boolean;
  size?: number;
}

const DOTS = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => ({
  n,
  row: Math.floor((n - 1) / 3),
  col: (n - 1) % 3,
}));

export default function PatternLockPad({ value, onChange, readOnly, size = 200 }: Props) {
  const [drawing, setDrawing] = useState<number[]>(value || []);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDrawingRef = useRef(false);
  const drawingRef = useRef<number[]>(value || []);

  const path = readOnly ? (value || []) : drawing;
  const pad = size * 0.18;
  const step = (size - 2 * pad) / 2;

  function dotAt(n: number) {
    const d = DOTS[n - 1];
    return { x: pad + d.col * step, y: pad + d.row * step };
  }

  function nearestDot(clientX: number, clientY: number): number | null {
    const rect = containerRef.current!.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    let best: number | null = null;
    let bestDist = Infinity;
    for (const { n } of DOTS) {
      const p = dotAt(n);
      const dist = Math.hypot(p.x - x, p.y - y);
      if (dist < size * 0.16 && dist < bestDist) {
        best = n;
        bestDist = dist;
      }
    }
    return best;
  }

  function pointerPos(clientX: number, clientY: number) {
    const rect = containerRef.current!.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  function start(clientX: number, clientY: number) {
    if (readOnly) return;
    const n = nearestDot(clientX, clientY);
    if (n) {
      isDrawingRef.current = true;
      drawingRef.current = [n];
      setDrawing([n]);
      setDragPos(pointerPos(clientX, clientY));
    }
  }
  function move(clientX: number, clientY: number) {
    if (readOnly || !isDrawingRef.current) return;
    setDragPos(pointerPos(clientX, clientY));
    const n = nearestDot(clientX, clientY);
    if (n && !drawingRef.current.includes(n)) {
      drawingRef.current = [...drawingRef.current, n];
      setDrawing(drawingRef.current);
    }
  }
  function end() {
    if (readOnly || !isDrawingRef.current) return;
    isDrawingRef.current = false;
    setDragPos(null);
    onChange?.(drawingRef.current);
  }

  function handleClear() {
    if (readOnly) return;
    drawingRef.current = [];
    setDrawing([]);
    onChange?.([]);
  }

  return (
    <div>
      <div
        ref={containerRef}
        onMouseDown={(e) => start(e.clientX, e.clientY)}
        onMouseMove={(e) => move(e.clientX, e.clientY)}
        onMouseUp={end}
        onMouseLeave={end}
        onTouchStart={(e) => { const t = e.touches[0]; start(t.clientX, t.clientY); }}
        onTouchMove={(e) => { const t = e.touches[0]; move(t.clientX, t.clientY); e.preventDefault(); }}
        onTouchEnd={end}
        style={{
          width: size, height: size, touchAction: 'none', userSelect: 'none',
          background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 16,
          position: 'relative', margin: '0 auto', cursor: readOnly ? 'default' : 'pointer',
        }}
      >
        <svg width={size} height={size} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          {path.slice(1).map((n, i) => {
            const a = dotAt(path[i]);
            const b = dotAt(n);
            return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--accent)" strokeWidth={4} strokeLinecap="round" />;
          })}
          {!readOnly && dragPos && path.length > 0 && (
            <line x1={dotAt(path[path.length - 1]).x} y1={dotAt(path[path.length - 1]).y} x2={dragPos.x} y2={dragPos.y} stroke="var(--accent)" strokeWidth={4} strokeLinecap="round" opacity={0.5} />
          )}
          {DOTS.map(({ n }) => {
            const p = dotAt(n);
            const active = path.includes(n);
            return (
              <circle key={n} cx={p.x} cy={p.y} r={active ? size * 0.045 : size * 0.035}
                fill={active ? 'var(--accent)' : 'var(--surface)'}
                stroke={active ? 'var(--accent)' : 'var(--border-strong, var(--border))'}
                strokeWidth={2} />
            );
          })}
        </svg>
      </div>
      {!readOnly && (
        <button type="button" onClick={handleClear} style={{
          display: 'block', margin: '10px auto 0', padding: '6px 14px',
          background: 'transparent', border: '1px solid var(--border)', borderRadius: 8,
          color: 'var(--text-dim)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
        }}>
          ล้างแพทเทิร์น
        </button>
      )}
    </div>
  );
}
