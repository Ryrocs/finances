'use client';

import { useState, type ReactNode } from 'react';

export interface DonutSegment {
  id: string;
  label: string;
  value: number;
  color: string;
}

function arcPath(cx: number, cy: number, r: number, start: number, end: number): string {
  const large = end - start > Math.PI ? 1 : 0;
  const x0 = cx + r * Math.cos(start);
  const y0 = cy + r * Math.sin(start);
  const x1 = cx + r * Math.cos(end);
  const y1 = cy + r * Math.sin(end);
  return `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`;
}

/**
 * Donut with a 2px surface gap between segments. Tapping a segment highlights it; the
 * centre shows the total or the active segment. A visually hidden table carries the data.
 */
export function DonutChart({
  segments,
  size = 168,
  thickness = 22,
  centerTitle,
  centerValue,
  formatValue,
  activeId,
  onActiveChange,
  tableCaption,
}: {
  segments: DonutSegment[];
  size?: number;
  thickness?: number;
  centerTitle: ReactNode;
  centerValue: ReactNode;
  formatValue: (v: number) => string;
  activeId?: string | null;
  onActiveChange?: (id: string | null) => void;
  tableCaption: string;
}) {
  const [internalActive, setInternalActive] = useState<string | null>(null);
  const active = activeId !== undefined ? activeId : internalActive;
  const setActive = onActiveChange ?? setInternalActive;
  const total = segments.reduce((s, x) => s + x.value, 0);
  const r = (size - thickness) / 2;
  const c = size / 2;
  const gap = segments.length > 1 ? 2 / r : 0; // 2px gap in radians
  const activeSeg = segments.find((s) => s.id === active);

  const sweeps = segments.map((s) => (total > 0 ? (s.value / total) * Math.PI * 2 : 0));
  const arcs = segments.map((s, i) => {
    const offset = -Math.PI / 2 + sweeps.slice(0, i).reduce((a, b) => a + b, 0);
    const start = offset + gap / 2;
    const end = offset + sweeps[i] - gap / 2;
    return { ...s, start, end: Math.max(start + 0.0001, end), full: sweeps[i] >= Math.PI * 2 - 0.0001 };
  });

  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle cx={c} cy={c} r={r} fill="none" stroke="var(--color-surface-2)" strokeWidth={thickness} />
        {arcs.map((a) =>
          a.full ? (
            <circle key={a.id} cx={c} cy={c} r={r} fill="none" stroke={a.color} strokeWidth={thickness} />
          ) : (
            <path
              key={a.id}
              d={arcPath(c, c, r, a.start, a.end)}
              fill="none"
              stroke={a.color}
              strokeWidth={active === a.id ? thickness + 6 : thickness}
              opacity={active && active !== a.id ? 0.35 : 1}
              className="cursor-pointer transition-all duration-200"
              onClick={() => setActive(active === a.id ? null : a.id)}
            />
          ),
        )}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
        <span className="line-clamp-2 text-[12px] font-medium leading-tight text-ink-3">{activeSeg ? activeSeg.label : centerTitle}</span>
        <span className="mt-0.5 text-lg font-bold leading-tight text-ink">{activeSeg ? formatValue(activeSeg.value) : centerValue}</span>
      </div>
      <div className="sr-only">
        <table>
        <caption>{tableCaption}</caption>
        <tbody>
          {segments.map((s) => (
            <tr key={s.id}>
              <th scope="row">{s.label}</th>
              <td>{formatValue(s.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}
