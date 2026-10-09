import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { fittedDomain } from '../../lib/chart-scale';
import { diffDays, formatLongDate, MONTHS_SHORT, parseISODate } from '../../lib/dates';
import type { DailyPoint } from '../../lib/finance/balances';
import { T } from '../../texts';
import { CHART, ChartTooltip, moneyTickFormatter } from './common';

export function WealthArea({ points }: { points: DailyPoint[] }) {
  let min = Infinity;
  let max = -Infinity;
  for (const p of points) {
    min = Math.min(min, p.cents);
    max = Math.max(max, p.cents);
  }
  const { domain, ticks } = fittedDomain(min, max);
  // Long spans: one tick at the start of a month (at most ~5); short ones show days.
  const longRange = points.length > 1 && diffDays(points[0].date, points[points.length - 1].date) > 100;
  let xTicks: string[] | undefined;
  if (longRange) {
    const starts = points.filter((p, i) => i > 0 && p.date.slice(0, 7) !== points[i - 1].date.slice(0, 7)).map((p) => p.date);
    const step = Math.max(1, Math.ceil(starts.length / 5));
    xTicks = starts.filter((_, i) => i % step === 0);
  }
  const tickLabel = (date: string) => {
    const { y, m, d } = parseISODate(date);
    const month = MONTHS_SHORT[m - 1].replace('.', '');
    return longRange ? `${month} ${String(y).slice(2)}` : `${d} ${month}`;
  };

  return (
    <div className="h-[220px] w-full" data-testid="wealth-chart">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="wealthFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART.accent} stopOpacity={0.16} />
              <stop offset="100%" stopColor={CHART.accent} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={CHART.grid} />
          <XAxis
            dataKey="date"
            tickFormatter={tickLabel}
            tick={CHART.tick}
            tickLine={false}
            axisLine={{ stroke: CHART.grid }}
            ticks={xTicks}
            minTickGap={24}
            interval={xTicks ? 0 : 'preserveStartEnd'}
          />
          <YAxis
            domain={domain}
            ticks={ticks}
            allowDataOverflow
            tickFormatter={moneyTickFormatter(ticks)}
            tick={CHART.tick}
            tickLine={false}
            axisLine={false}
            width={58}
          />
          <Tooltip
            content={<ChartTooltip labelFormatter={(d) => (d ? formatLongDate(d) : '')} />}
            cursor={{ stroke: CHART.axis, strokeWidth: 1 }}
          />
          <Area
            type="linear"
            dataKey="cents"
            name={T.wealth.total}
            baseValue={domain[0]}
            stroke={CHART.accent}
            strokeWidth={2}
            fill="url(#wealthFill)"
            isAnimationActive={false}
            activeDot={{ r: 4, stroke: CHART.surface, strokeWidth: 2, fill: CHART.accent }}
            dot={points.length === 1 ? { r: 4, fill: CHART.accent, stroke: CHART.surface, strokeWidth: 2 } : false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
