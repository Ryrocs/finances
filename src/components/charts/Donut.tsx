import { Cell, Pie, PieChart } from 'recharts';
import { formatEUR } from '../../lib/money';
import { FitAmount } from '../ui/Amount';
import { CHART } from './common';

export interface DonutSlice {
  id: string;
  label: string;
  color: string;
  value: number;
}

/** Folds everything after the first `max` slices into one neutral slice, so the donut stays readable. */
export function foldSlices(slices: DonutSlice[], max: number, otherLabel: string): DonutSlice[] {
  if (slices.length <= max + 1) return slices;
  const rest = slices.slice(max).reduce((sum, s) => sum + s.value, 0);
  return [...slices.slice(0, max), { id: '__rest', label: otherLabel, color: '#cfd0d6', value: rest }];
}

export function Donut({ slices, centerLabel, centerValue, size = 200 }: { slices: DonutSlice[]; centerLabel: string; centerValue: number; size?: number }) {
  return (
    <div className="relative mx-auto" style={{ width: size, height: size }} role="img" aria-label={`${centerLabel}: ${formatEUR(centerValue)}`}>
      <PieChart width={size} height={size}>
        <Pie
          data={slices}
          dataKey="value"
          nameKey="label"
          cx="50%"
          cy="50%"
          innerRadius={size * 0.34}
          outerRadius={size * 0.48}
          startAngle={90}
          endAngle={-270}
          stroke={CHART.surface}
          strokeWidth={2}
          isAnimationActive={false}
        >
          {slices.map((s) => (
            <Cell key={s.id} fill={s.color} />
          ))}
        </Pie>
      </PieChart>
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="flex flex-col items-center text-center" style={{ width: size * 0.58 }}>
          <span className="text-[13px] text-ink-3">{centerLabel}</span>
          <FitAmount cents={centerValue} className="w-full text-[19px] font-bold" />
        </div>
      </div>
    </div>
  );
}
