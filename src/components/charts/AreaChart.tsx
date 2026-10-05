'use client';

import { useState, type PointerEvent } from 'react';
import { linearScale, niceTicksInRange } from '@/lib/chart-scale';
import { useWidth } from './useSize';

export interface AreaPoint {
  x: string;
  y: number;
}

/**
 * Single-series area/line chart: 2px line, ~10 % area wash, crosshair + tooltip that follows the
 * finger or mouse. Y axis is not forced to 0 so changes in wealth stay visible.
 */
export function AreaChart({
  points,
  color,
  height = 200,
  formatValue,
  formatTick,
  formatX,
  formatXFull,
  tableCaption,
}: {
  points: AreaPoint[];
  color: string;
  height?: number;
  formatValue: (v: number) => string;
  formatTick: (v: number) => string;
  formatX: (x: string) => string;
  formatXFull: (x: string) => string;
  tableCaption: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  if (!points.length) return null;

  const ys = points.map((p) => p.y);
  let min = Math.min(...ys);
  let max = Math.max(...ys);
  if (min === max) {
    min -= Math.max(100, Math.abs(min) * 0.1);
    max += Math.max(100, Math.abs(max) * 0.1);
  } else {
    const pad = (max - min) * 0.15;
    min -= pad;
    max += pad;
  }
  const ticks = niceTicksInRange(min, max, 3);
  const axisWidth = Math.max(40, ...ticks.map((t) => formatTick(t).length * 6.4 + 8));
  const top = 10;
  const bottom = 24;
  const plotW = Math.max(40, width - axisWidth - 8);
  const x = linearScale([0, Math.max(1, points.length - 1)], [axisWidth, axisWidth + plotW]);
  const y = linearScale([min, max], [height - bottom, top]);

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.y).toFixed(1)}`).join(' ');
  const area = `${line} L${x(points.length - 1).toFixed(1)},${height - bottom} L${x(0).toFixed(1)},${height - bottom} Z`;
  const labelIdx = points.length <= 1 ? [0] : [0, Math.floor((points.length - 1) / 2), points.length - 1];
  const last = points.length - 1;

  const onMove = (e: PointerEvent<SVGRectElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const rel = (e.clientX - rect.left) / rect.width;
    setHover(Math.min(last, Math.max(0, Math.round(rel * last))));
  };

  const active = hover ?? null;
  const tooltipLeft = active !== null ? Math.min(Math.max(x(active), 70), width - 70) : 0;

  return (
    <div ref={ref} className="relative w-full touch-pan-y select-none">
      <svg width={width} height={height} role="img" aria-label={tableCaption}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={axisWidth} x2={width - 8} y1={y(t)} y2={y(t)} stroke="var(--color-line)" strokeWidth={1} />
            <text x={axisWidth - 6} y={y(t)} dy="0.32em" textAnchor="end" className="fill-ink-4 text-[11px] tabular">
              {formatTick(t)}
            </text>
          </g>
        ))}
        <path d={area} fill={color} opacity={0.1} />
        <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {labelIdx.map((i, k) => (
          <text
            key={i}
            x={x(i)}
            y={height - 6}
            textAnchor={k === 0 ? 'start' : k === labelIdx.length - 1 ? 'end' : 'middle'}
            className="fill-ink-3 text-[11px]"
          >
            {formatX(points[i].x)}
          </text>
        ))}
        {/* End dot with surface ring */}
        <circle cx={x(last)} cy={y(points[last].y)} r={5} fill={color} stroke="var(--color-surface)" strokeWidth={2} />
        {active !== null && (
          <g>
            <line x1={x(active)} x2={x(active)} y1={top} y2={height - bottom} stroke="var(--color-ink-4)" strokeWidth={1} />
            <circle cx={x(active)} cy={y(points[active].y)} r={5} fill={color} stroke="var(--color-surface)" strokeWidth={2} />
          </g>
        )}
        <rect
          x={axisWidth}
          y={0}
          width={plotW}
          height={height}
          fill="transparent"
          onPointerDown={onMove}
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
        />
      </svg>
      {active !== null && (
        <div
          className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full rounded-xl border border-line bg-surface px-3 py-1.5 text-center text-[13px] shadow-lg"
          style={{ left: tooltipLeft }}
          role="status"
        >
          <p className="text-ink-3">{formatXFull(points[active].x)}</p>
          <p className="font-semibold text-ink tabular">{formatValue(points[active].y)}</p>
        </div>
      )}
      <div className="sr-only">
        <table>
        <caption>{tableCaption}</caption>
        <tbody>
          {points.map((p) => (
            <tr key={p.x}>
              <th scope="row">{formatXFull(p.x)}</th>
              <td>{formatValue(p.y)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}
