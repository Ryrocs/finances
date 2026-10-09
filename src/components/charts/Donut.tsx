import { Cell, Pie, PieChart } from 'recharts';
import { formatEUR } from '../../lib/money';
import { FitAmount } from '../ui/Amount';
import { CHART } from './common';
import type { DonutSlice } from './slices';

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
