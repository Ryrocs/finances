import 'server-only';
import { and, eq, gte, lte, ne, sql } from 'drizzle-orm';
import { addMonthsToKey, monthEnd, monthOf, monthsBetween, monthStart, minISO } from '@/lib/dates';
import { groupTotals, summarizeCashFlow, totalsByCategory, type CashFlowRow } from '@/lib/finance/cashflow';
import { liquidWealth } from '@/lib/finance/balances';
import { buildNetWorthSeries, earliestDate, periodStart, type DailyDelta, type InitialBalance } from '@/lib/finance/networth';
import { projectSpending } from '@/lib/finance/projection';
import { compareAmounts } from '@/lib/finance/cashflow';
import type { AnalyticsDTO, CategoryGroup, MonthSummaryDTO, NetWorthDTO, NetWorthPeriod, TransactionType } from '@/lib/types';
import { getDb } from '../db';
import { categories, transactions } from '../db/schema';
import { listAccounts } from './accounts';
import { buildBudgetOverview, listBudgets } from './budgets';
import { pendingRecurringExpenses } from './recurring';
import { recentTransactions } from './transactions';

async function cashFlowRows(userId: string, from: string, to: string): Promise<(CashFlowRow & { fixed: boolean })[]> {
  const rows = await getDb()
    .select({
      type: transactions.type,
      categoryId: transactions.categoryId,
      fixed: sql<boolean>`(${transactions.recurringId} is not null)`,
      amount: sql<string>`sum(${transactions.amountCents})`,
      count: sql<string>`count(*)`,
    })
    .from(transactions)
    .where(and(eq(transactions.userId, userId), ne(transactions.type, 'transfer'), gte(transactions.date, from), lte(transactions.date, to)))
    .groupBy(transactions.type, transactions.categoryId, sql`(${transactions.recurringId} is not null)`);
  return rows.map((r) => ({
    type: r.type as TransactionType,
    categoryId: r.categoryId,
    fixed: Boolean(r.fixed),
    amountCents: Number(r.amount),
    count: Number(r.count),
  }));
}

/** Average monthly expenses over the previous `n` months that have any expense. */
async function averageExpenses(userId: string, month: string, n = 3): Promise<number | null> {
  const from = monthStart(addMonthsToKey(month, -n));
  const to = monthEnd(addMonthsToKey(month, -1));
  const rows = await getDb()
    .select({ m: sql<string>`to_char(${transactions.date}, 'YYYY-MM')`, total: sql<string>`sum(${transactions.amountCents})` })
    .from(transactions)
    .where(and(eq(transactions.userId, userId), eq(transactions.type, 'expense'), gte(transactions.date, from), lte(transactions.date, to)))
    .groupBy(sql`to_char(${transactions.date}, 'YYYY-MM')`);
  if (!rows.length) return null;
  return Math.round(rows.reduce((s, r) => s + Number(r.total), 0) / rows.length);
}

export async function monthSummary(userId: string, month: string, today: string): Promise<MonthSummaryDTO> {
  const db = getDb();
  const from = monthStart(month);
  const to = monthEnd(month);
  const prevMonth = addMonthsToKey(month, -1);
  // Net worth at the end of the selected month, or today for the current/future month.
  const netWorthAsOf = minISO(to, today);
  const isCurrent = month === monthOf(today);

  const [rows, prevRows, average, accountList, budgetRows, cats, pendingFixed, recent] = await Promise.all([
    cashFlowRows(userId, from, to),
    cashFlowRows(userId, monthStart(prevMonth), monthEnd(prevMonth)),
    averageExpenses(userId, month),
    listAccounts(userId, netWorthAsOf),
    listBudgets(userId),
    db.select({ id: categories.id, group: categories.group }).from(categories).where(eq(categories.userId, userId)),
    isCurrent ? pendingRecurringExpenses(userId, today) : Promise.resolve(0),
    recentTransactions(userId, from, to, 5),
  ]);

  const flow = summarizeCashFlow(rows);
  const prev = summarizeCashFlow(prevRows);
  const expensesByCategory = totalsByCategory(rows, 'expense');
  const incomeByCategory = totalsByCategory(rows, 'income');
  const groupOf = new Map(cats.map((c) => [c.id, c.group as CategoryGroup]));
  const budgetsOverview = buildBudgetOverview(month, today, budgetRows, expensesByCategory);

  const fixed = rows.filter((r) => r.type === 'expense' && r.fixed).reduce((s, r) => s + r.amountCents, 0);
  const projection = projectSpending({
    month,
    today,
    fixedCents: fixed,
    variableCents: flow.expenseCents - fixed,
    pendingFixedCents: pendingFixed,
    budgetCents: budgetsOverview.overall?.budgetCents ?? null,
    averageCents: average,
    incomeCents: flow.incomeCents,
  });

  return {
    month,
    today,
    incomeCents: flow.incomeCents,
    expenseCents: flow.expenseCents,
    balanceCents: flow.balanceCents,
    transactionCount: flow.count,
    expensesByCategory,
    incomeByCategory,
    groupTotals: groupTotals(expensesByCategory, (id) => groupOf.get(id)),
    previous: { month: prevMonth, incomeCents: prev.incomeCents, expenseCents: prev.expenseCents },
    netWorth: { asOf: netWorthAsOf, liquidCents: liquidWealth(accountList) },
    projection,
    budgets: budgetsOverview,
    recent,
  };
}

export async function analytics(userId: string, fromMonth: string, toMonth: string): Promise<AnalyticsDTO> {
  const rows = await getDb()
    .select({
      m: sql<string>`to_char(${transactions.date}, 'YYYY-MM')`,
      type: transactions.type,
      categoryId: transactions.categoryId,
      total: sql<string>`sum(${transactions.amountCents})`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        ne(transactions.type, 'transfer'),
        gte(transactions.date, monthStart(fromMonth)),
        lte(transactions.date, monthEnd(toMonth)),
      ),
    )
    .groupBy(sql`to_char(${transactions.date}, 'YYYY-MM')`, transactions.type, transactions.categoryId);

  const months = monthsBetween(fromMonth, toMonth);
  const expensesByMonth: AnalyticsDTO['expensesByMonth'] = Object.fromEntries(months.map((m) => [m, {}]));
  const incomeByMonth: AnalyticsDTO['incomeByMonth'] = Object.fromEntries(months.map((m) => [m, {}]));
  const totals = new Map(months.map((m) => [m, { income: 0, expense: 0 }]));
  for (const r of rows) {
    const amount = Number(r.total);
    const t = totals.get(r.m);
    if (!t || !r.categoryId) continue;
    if (r.type === 'income') {
      t.income += amount;
      incomeByMonth[r.m][r.categoryId] = (incomeByMonth[r.m][r.categoryId] ?? 0) + amount;
    } else if (r.type === 'expense') {
      t.expense += amount;
      expensesByMonth[r.m][r.categoryId] = (expensesByMonth[r.m][r.categoryId] ?? 0) + amount;
    }
  }
  return {
    months,
    series: months.map((m) => {
      const t = totals.get(m)!;
      return { month: m, incomeCents: t.income, expenseCents: t.expense, balanceCents: t.income - t.expense };
    }),
    expensesByMonth,
    incomeByMonth,
  };
}

/**
 * Liquid wealth history, reconstructed from initial balances and every movement that touches a
 * liquid account. Transfers between two liquid accounts net to zero on that day.
 */
export async function netWorth(userId: string, period: NetWorthPeriod, today: string): Promise<NetWorthDTO> {
  const [accountList, deltaRows] = await Promise.all([
    listAccounts(userId, today),
    getDb().execute<{ date: string; cents: string }>(sql`
      select d.date::text as date, sum(d.cents) as cents from (
        select t.date,
          case t.type when 'income' then t.amount_cents else -t.amount_cents end as cents
        from transactions t join accounts a on a.id = t.account_id and a.user_id = t.user_id
        where t.user_id = ${userId} and a.is_liquid and t.date <= ${today}::date
        union all
        select t.date, t.amount_cents as cents
        from transactions t join accounts a on a.id = t.to_account_id and a.user_id = t.user_id
        where t.user_id = ${userId} and t.type = 'transfer' and a.is_liquid and t.date <= ${today}::date
      ) d
      group by d.date
      order by d.date
    `),
  ]);

  const initials: InitialBalance[] = accountList
    .filter((a) => a.isLiquid && a.initialBalanceDate <= today && a.initialBalanceCents !== 0)
    .map((a) => ({ date: a.initialBalanceDate, cents: a.initialBalanceCents }));
  // Accounts with a 0 initial balance still mark when data starts.
  const starts: InitialBalance[] = accountList.filter((a) => a.isLiquid).map((a) => ({ date: a.initialBalanceDate, cents: 0 }));
  const deltas: DailyDelta[] = deltaRows.rows.map((r) => ({ date: r.date, cents: Number(r.cents) }));

  // Never start the chart before any data exists (otherwise it shows a fake jump from 0).
  const earliest = earliestDate([...initials, ...starts], deltas);
  const start = periodStart(period, today, earliest);
  const from = earliest && earliest > start ? minISO(earliest, today) : start;
  const series = buildNetWorthSeries(initials, deltas, from, today);
  const liquid = liquidWealth(accountList);
  const nonLiquid = accountList.filter((a) => !a.isLiquid).reduce((s, a) => s + a.balanceCents, 0);
  const first = series[0]?.cents ?? 0;
  const change = compareAmounts(first, liquid);

  return {
    today,
    period,
    liquidCents: liquid,
    nonLiquidCents: nonLiquid,
    accounts: accountList,
    series,
    change,
  };
}
