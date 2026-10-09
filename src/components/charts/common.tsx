import { formatEUR, formatEURCompact } from '../../lib/money';

/** Shared chart styling: recessive axes and hairline solid grid. */
export const CHART = {
  axis: '#a1a1aa',
  grid: '#ececef',
  surface: '#ffffff',
  income: '#10B981',
  expense: '#F43F5E',
  accent: '#6366F1',
  warning: '#F59E0B',
  tick: { fill: '#8a8a94', fontSize: 11 },
} as const;

export const axisMoney = (cents: number) => formatEURCompact(cents);

interface TooltipRow {
  name?: string | number;
  value?: number | string | Array<number | string>;
  color?: string;
  dataKey?: string | number | ((obj: unknown) => unknown);
  payload?: Record<string, unknown>;
}

/** Tooltip in "1.234,56 €" format (or a percentage). */
export function ChartTooltip({
  active,
  payload,
  label,
  labelFormatter,
  percent = false,
}: {
  active?: boolean;
  payload?: readonly TooltipRow[];
  label?: string | number;
  labelFormatter?: (label: string) => string;
  percent?: boolean;
}) {
  if (!active || !payload?.length) return null;
  const title = labelFormatter ? labelFormatter(String(label ?? '')) : label;
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2 text-[13px] shadow-[0_4px_16px_rgb(0_0_0/0.08)]">
      {title !== undefined && title !== '' && <p className="mb-1 font-semibold text-ink">{title}</p>}
      {payload.map((row, i) => {
        const value = typeof row.value === 'number' ? row.value : Number(row.value);
        return (
          <p key={i} className="flex items-center gap-2 text-ink-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: row.color }} aria-hidden />
            <span>{row.name}</span>
            <span className="money ml-auto pl-3 font-semibold text-ink">
              {Number.isFinite(value) ? (percent ? `${value.toFixed(1).replace('.', ',')} %` : formatEUR(value)) : '—'}
            </span>
          </p>
        );
      })}
    </div>
  );
}

export function Legend({ items }: { items: Array<{ label: string; color: string }> }) {
  return (
    <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-2">
      {items.map((it) => (
        <li key={it.label} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: it.color }} aria-hidden />
          {it.label}
        </li>
      ))}
    </ul>
  );
}
