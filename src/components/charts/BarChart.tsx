'use client';

import { useState } from 'react';
import { linearScale, niceTicks } from '@/lib/chart-scale';
import { useWidth } from './useSize';

export interface BarSeries {
  id: string;
  label: string;
  color: string;
  /** Optional colour for negative values (e.g. monthly balance). */
  negativeColor?: string;
}

export interface BarGroup {
  key: string;
  label: string;
  /** Long label for the tooltip/table (e.g. "October 2026"). */
  fullLabel: string;
  values: Record<string, number>;
}

/**
 * Vertical (grouped) bar chart. Bars ≤ 24px, 4px rounded data-end, square at the baseline,
 * 2px surface gap between neighbours; tap a group to see its values.
 */
export function BarChart({
  groups,
  series,
  height = 200,
  formatValue,
  formatTick,
  tableCaption,
  highlightKey,
}: {
  groups: BarGroup[];
  series: BarSeries[];
  height?: number;
  formatValue: (v: number) => string;
  formatTick: (v: number) => string;
  tableCaption: string;
  highlightKey?: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<string | null>(null);

  const values = groups.flatMap((g) => series.map((s) => g.values[s.id] ?? 0));
  const ticks = niceTicks(Math.min(0, ...values), Math.max(0, ...values), 4);
  const axisWidth = Math.max(36, ...ticks.map((t) => formatTick(t).length * 6.4 + 8));
  const top = 8;
  const bottom = 24;
  const plotW = Math.max(40, width - axisWidth);
  const y = linearScale([ticks[0], ticks[ticks.length - 1]], [height - bottom, top]);
  const band = plotW / Math.max(1, groups.length);
  const gapPx = 2;
  const barW = Math.max(3, Math.min(24, (band * 0.7 - gapPx * (series.length - 1)) / series.length));
  const groupW = barW * series.length + gapPx * (series.length - 1);
  const zeroY = y(0);
  // Show every n-th label so they never collide on narrow phones.
  const labelEvery = Math.max(1, Math.ceil((groups.length * 34) / plotW));
  const activeGroup = groups.find((g) => g.key === active);

  return (
    <div ref={ref} className="relative w-full select-none">
      <svg width={width} height={height} role="img" aria-label={tableCaption}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={axisWidth} x2={width} y1={y(t)} y2={y(t)} stroke={t === 0 ? 'var(--color-line-strong)' : 'var(--color-line)'} strokeWidth={1} />
            <text x={axisWidth - 6} y={y(t)} dy="0.32em" textAnchor="end" className="fill-ink-4 text-[11px] tabular">
              {formatTick(t)}
            </text>
          </g>
        ))}
        {groups.map((g, gi) => {
          const x0 = axisWidth + gi * band + (band - groupW) / 2;
          const dim = active !== null && active !== g.key;
          return (
            <g key={g.key} opacity={dim ? 0.4 : 1} className="transition-opacity">
              {series.map((s, si) => {
                const v = g.values[s.id] ?? 0;
                if (v === 0) return null;
                const x = x0 + si * (barW + gapPx);
                const yv = y(v);
                const h = Math.max(1, Math.abs(zeroY - yv));
                const r = Math.min(4, barW / 2, h);
                const fill = v < 0 && s.negativeColor ? s.negativeColor : s.color;
                // Rounded at the data end, square at the baseline.
                const d =
                  v >= 0
                    ? `M${x},${zeroY} V${yv + r} Q${x},${yv} ${x + r},${yv} H${x + barW - r} Q${x + barW},${yv} ${x + barW},${yv + r} V${zeroY} Z`
                    : `M${x},${zeroY} V${zeroY + h - r} Q${x},${zeroY + h} ${x + r},${zeroY + h} H${x + barW - r} Q${x + barW},${zeroY + h} ${x + barW},${zeroY + h - r} V${zeroY} Z`;
                return <path key={s.id} d={d} style={{ fill }} />;
              })}
              {(gi % labelEvery === 0 || g.key === highlightKey) && (
                <text
                  x={axisWidth + gi * band + band / 2}
                  y={height - 6}
                  textAnchor="middle"
                  className={g.key === highlightKey ? 'fill-ink text-[11px] font-semibold' : 'fill-ink-3 text-[11px]'}
                >
                  {g.label}
                </text>
              )}
              {/* Hit target bigger than the mark */}
              <rect
                x={axisWidth + gi * band}
                y={0}
                width={band}
                height={height}
                fill="transparent"
                className="cursor-pointer"
                onClick={() => setActive(active === g.key ? null : g.key)}
                onPointerEnter={(e) => e.pointerType === 'mouse' && setActive(g.key)}
                onPointerLeave={(e) => e.pointerType === 'mouse' && setActive(null)}
              />
            </g>
          );
        })}
      </svg>
      {activeGroup && (
        <div
          className="pointer-events-none absolute top-0 z-10 min-w-36 -translate-x-1/2 rounded-xl border border-line bg-surface px-3 py-2 text-[13px] shadow-lg"
          style={{
            left: Math.min(Math.max(axisWidth + groups.indexOf(activeGroup) * band + band / 2, 80), width - 80),
          }}
          role="status"
        >
          <p className="mb-1 font-semibold text-ink">{activeGroup.fullLabel}</p>
          {series.map((s) => (
            <p key={s.id} className="flex items-center justify-between gap-3 text-ink-2">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} aria-hidden />
                {s.label}
              </span>
              <span className="font-semibold text-ink tabular">{formatValue(activeGroup.values[s.id] ?? 0)}</span>
            </p>
          ))}
        </div>
      )}
      <div className="sr-only">
        <table>
        <caption>{tableCaption}</caption>
        <thead>
          <tr>
            <th scope="col" />
            {series.map((s) => (
              <th key={s.id} scope="col">
                {s.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <tr key={g.key}>
              <th scope="row">{g.fullLabel}</th>
              {series.map((s) => (
                <td key={s.id}>{formatValue(g.values[s.id] ?? 0)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}

export function ChartLegend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-2">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: i.color }} aria-hidden />
          {i.label}
        </li>
      ))}
    </ul>
  );
}
