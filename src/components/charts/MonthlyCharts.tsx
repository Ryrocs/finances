import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { fittedDomain, zeroBasedDomain } from '../../lib/chart-scale';
import { formatMonthShort, formatMonthYear } from '../../lib/dates';
import type { MonthFlow } from '../../lib/finance/cashflow';
import { formatPercent } from '../../lib/money';
import { T } from '../../texts';
import { axisMoney, CHART, ChartTooltip, Legend } from './common';

const HEIGHT = 210;
const monthTick = (m: string) => formatMonthShort(m, false);
const monthLabel = (m: string) => (m ? formatMonthYear(m) : '');
const margin = { top: 8, right: 8, bottom: 0, left: 0 };

function Frame({ children, testId }: { children: React.ReactElement; testId: string }) {
  return (
    <div style={{ height: HEIGHT }} className="w-full" data-testid={testId}>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}

const xAxis = <XAxis dataKey="month" tickFormatter={monthTick} tick={CHART.tick} tickLine={false} axisLine={{ stroke: CHART.grid }} interval={0} />;
// Line charts: keep the first and last dots (and their labels) away from the edges.
const lineXAxis = (
  <XAxis dataKey="month" tickFormatter={monthTick} tick={CHART.tick} tickLine={false} axisLine={{ stroke: CHART.grid }} interval={0} padding={{ left: 14, right: 14 }} />
);

export function IncomeExpenseBars({ data }: { data: MonthFlow[] }) {
  const max = Math.max(0, ...data.map((d) => Math.max(d.incomeCents, d.expenseCents)));
  const { domain, ticks } = zeroBasedDomain(0, max);
  return (
    <>
      <Legend
        items={[
          { label: T.common.income, color: CHART.income },
          { label: T.common.expenses, color: CHART.expense },
        ]}
      />
      <Frame testId="chart-income-expenses">
        <BarChart data={data} margin={margin} barGap={2} barCategoryGap="22%">
          <CartesianGrid vertical={false} stroke={CHART.grid} />
          {xAxis}
          <YAxis domain={domain} ticks={ticks} tickFormatter={axisMoney} tick={CHART.tick} tickLine={false} axisLine={false} width={50} />
          <Tooltip content={<ChartTooltip labelFormatter={monthLabel} />} cursor={{ fill: '#f3f4f6' }} />
          <Bar dataKey="incomeCents" name={T.common.income} fill={CHART.income} radius={[4, 4, 0, 0]} maxBarSize={18} isAnimationActive={false} />
          <Bar dataKey="expenseCents" name={T.common.expenses} fill={CHART.expense} radius={[4, 4, 0, 0]} maxBarSize={18} isAnimationActive={false} />
        </BarChart>
      </Frame>
    </>
  );
}

export function ExpenseLine({ data }: { data: MonthFlow[] }) {
  const values = data.map((d) => d.expenseCents);
  const { domain, ticks } = fittedDomain(Math.min(...values), Math.max(...values));
  return (
    <Frame testId="chart-expense-trend">
      <LineChart data={data} margin={margin}>
        <CartesianGrid vertical={false} stroke={CHART.grid} />
        {lineXAxis}
        <YAxis domain={domain} ticks={ticks} tickFormatter={axisMoney} tick={CHART.tick} tickLine={false} axisLine={false} width={50} allowDataOverflow />
        <Tooltip content={<ChartTooltip labelFormatter={monthLabel} />} cursor={{ stroke: CHART.axis, strokeWidth: 1 }} />
        <Line
          type="linear"
          dataKey="expenseCents"
          name={T.common.expenses}
          stroke={CHART.expense}
          strokeWidth={2}
          dot={{ r: 4, fill: CHART.expense, stroke: CHART.surface, strokeWidth: 2 }}
          activeDot={{ r: 5, fill: CHART.expense, stroke: CHART.surface, strokeWidth: 2 }}
          isAnimationActive={false}
        />
      </LineChart>
    </Frame>
  );
}

export function BalanceBars({ data }: { data: MonthFlow[] }) {
  const values = data.map((d) => d.balanceCents);
  const { domain, ticks } = zeroBasedDomain(Math.min(...values), Math.max(...values));
  return (
    <Frame testId="chart-balance">
      <BarChart data={data} margin={margin} barCategoryGap="30%">
        <CartesianGrid vertical={false} stroke={CHART.grid} />
        {xAxis}
        <YAxis domain={domain} ticks={ticks} tickFormatter={axisMoney} tick={CHART.tick} tickLine={false} axisLine={false} width={50} />
        <ReferenceLine y={0} stroke={CHART.axis} />
        <Tooltip content={<ChartTooltip labelFormatter={monthLabel} />} cursor={{ fill: '#f3f4f6' }} />
        <Bar dataKey="balanceCents" name={T.dashboard.balance} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false}>
          {data.map((d) => (
            <Cell key={d.month} fill={d.balanceCents >= 0 ? CHART.income : CHART.expense} />
          ))}
        </Bar>
      </BarChart>
    </Frame>
  );
}

export function SavingsLine({ data }: { data: MonthFlow[] }) {
  const values = data.map((d) => d.savingsRate).filter((v): v is number => v !== null);
  const lo = Math.min(0, ...values);
  // At least a 0–10 % window so a flat 0 % line still has a sensible axis.
  const hi = Math.max(10, ...values);
  const { domain, ticks } = zeroBasedDomain(lo, hi);
  const rows = data.map((d) => ({ month: d.month, rate: d.savingsRate === null ? null : Math.round(d.savingsRate * 10) / 10 }));
  return (
    <Frame testId="chart-savings">
      <LineChart data={rows} margin={margin}>
        <CartesianGrid vertical={false} stroke={CHART.grid} />
        {lineXAxis}
        <YAxis domain={domain} ticks={ticks} tickFormatter={(v: number) => formatPercent(v, 0)} tick={CHART.tick} tickLine={false} axisLine={false} width={50} />
        <ReferenceLine y={0} stroke={CHART.axis} />
        <Tooltip content={<ChartTooltip labelFormatter={monthLabel} percent />} cursor={{ stroke: CHART.axis, strokeWidth: 1 }} />
        <Line
          type="linear"
          dataKey="rate"
          name={T.analysis.savingsRate}
          stroke={CHART.accent}
          strokeWidth={2}
          connectNulls={false}
          dot={{ r: 4, fill: CHART.accent, stroke: CHART.surface, strokeWidth: 2 }}
          activeDot={{ r: 5, fill: CHART.accent, stroke: CHART.surface, strokeWidth: 2 }}
          isAnimationActive={false}
        />
      </LineChart>
    </Frame>
  );
}
