import 'server-only';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { addMonthsToKey, daysInMonthKey, monthOf, monthStart, toISODate } from '@/lib/dates';
import type { Locale } from '@/lib/types';
import { getDb } from '../db';
import { accounts, budgets, recurringTransactions, transactions } from '../db/schema';
import { findCategoryIdsByKey } from './categories';
import { generateDueForUser } from './recurring';

/*
 * Demo data: every row is flagged is_demo = true. Removing it deletes only flagged rows.
 * A demo account that the user has since used for real movements is kept (converted to a
 * real account with a zero opening balance) so real data is never deleted.
 */

const TEXT: Record<Locale, Record<string, string>> = {
  ca: {
    checking: 'Compte corrent', savings: "Compte d'estalvi", cash: 'Efectiu',
    salary: 'Nòmina', rent: 'Lloguer', netflix: 'Netflix', spotify: 'Spotify', gym: 'Gimnàs', toSavings: 'Estalvi mensual',
    interest: 'Interessos', supermarket: 'Supermercat', market: 'Mercat', restaurant: 'Sopar fora', coffee: 'Cafè',
    transport: 'Targeta de transport', fuel: 'Benzina', cinema: 'Cinema', concert: 'Concert', clothes: 'Roba',
    pharmacy: 'Farmàcia', books: 'Llibres', cashWithdrawal: 'Retirada d’efectiu', electricity: 'Llum', phone: 'Mòbil',
  },
  es: {
    checking: 'Cuenta corriente', savings: 'Cuenta de ahorro', cash: 'Efectivo',
    salary: 'Nómina', rent: 'Alquiler', netflix: 'Netflix', spotify: 'Spotify', gym: 'Gimnasio', toSavings: 'Ahorro mensual',
    interest: 'Intereses', supermarket: 'Supermercado', market: 'Mercado', restaurant: 'Cena fuera', coffee: 'Café',
    transport: 'Abono transporte', fuel: 'Gasolina', cinema: 'Cine', concert: 'Concierto', clothes: 'Ropa',
    pharmacy: 'Farmacia', books: 'Libros', cashWithdrawal: 'Retirada de efectivo', electricity: 'Luz', phone: 'Móvil',
  },
  en: {
    checking: 'Checking account', savings: 'Savings account', cash: 'Cash',
    salary: 'Salary', rent: 'Rent', netflix: 'Netflix', spotify: 'Spotify', gym: 'Gym', toSavings: 'Monthly savings',
    interest: 'Interest', supermarket: 'Supermarket', market: 'Market', restaurant: 'Dinner out', coffee: 'Coffee',
    transport: 'Transport pass', fuel: 'Fuel', cinema: 'Cinema', concert: 'Concert', clothes: 'Clothes',
    pharmacy: 'Pharmacy', books: 'Books', cashWithdrawal: 'Cash withdrawal', electricity: 'Electricity', phone: 'Phone',
  },
};

/** Deterministic PRNG so the same user always gets the same demo data. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFrom(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

export async function hasDemoData(userId: string): Promise<boolean> {
  const result = await getDb().execute<{ has: boolean }>(sql`
    select exists (select 1 from accounts where user_id = ${userId} and is_demo)
        or exists (select 1 from transactions where user_id = ${userId} and is_demo)
        or exists (select 1 from budgets where user_id = ${userId} and is_demo)
        or exists (select 1 from recurring_transactions where user_id = ${userId} and is_demo) as has`);
  return Boolean(result.rows[0]?.has);
}

export async function loadDemoData(userId: string, locale: Locale, currency: string, today: string): Promise<{ created: number }> {
  if (await hasDemoData(userId)) return { created: 0 };
  const t = TEXT[locale] ?? TEXT.ca;
  const cat = await findCategoryIdsByKey(userId);
  const INCOME_KEYS = new Set(['salary', 'freelance', 'interest', 'gifts', 'other_income']);
  // Fall back to the generic category of the same kind if the user removed a built-in one.
  const c = (key: string) => cat.get(key) ?? cat.get(INCOME_KEYS.has(key) ? 'other_income' : 'other') ?? null;
  const rand = mulberry32(seedFrom(userId));
  const between = (min: number, max: number) => Math.round(min + rand() * (max - min));

  const startMonth = addMonthsToKey(monthOf(today), -5);
  const start = monthStart(startMonth);
  const db = getDb();

  const createdRows = await db.transaction(async (tx) => {
    const [checking, savings, cash] = await tx
      .insert(accounts)
      .values([
        { userId, name: t.checking, type: 'checking', initialBalanceCents: 2_450_00, initialBalanceDate: start, currency, isLiquid: true, color: '#2a78d6', sortOrder: 100, isDemo: true },
        { userId, name: t.savings, type: 'savings', initialBalanceCents: 8_600_00, initialBalanceDate: start, currency, isLiquid: true, color: '#1baf7a', sortOrder: 101, isDemo: true },
        { userId, name: t.cash, type: 'cash', initialBalanceCents: 80_00, initialBalanceDate: start, currency, isLiquid: true, color: '#eda100', sortOrder: 102, isDemo: true },
      ])
      .returning({ id: accounts.id });

    // Fixed monthly movements as recurring rules (generated below, also flagged as demo).
    const rules: (typeof recurringTransactions.$inferInsert)[] = [
      { userId, type: 'income', amountCents: 2_150_00, accountId: checking.id, categoryId: c('salary'), description: t.salary, frequency: 'monthly', startDate: start, isDemo: true },
      { userId, type: 'expense', amountCents: 780_00, accountId: checking.id, categoryId: c('housing'), description: t.rent, frequency: 'monthly', startDate: `${startMonth}-02`, isDemo: true },
      { userId, type: 'expense', amountCents: 12_99, accountId: checking.id, categoryId: c('subscriptions'), description: t.netflix, frequency: 'monthly', startDate: `${startMonth}-08`, isDemo: true },
      { userId, type: 'expense', amountCents: 10_99, accountId: checking.id, categoryId: c('subscriptions'), description: t.spotify, frequency: 'monthly', startDate: `${startMonth}-15`, isDemo: true },
      { userId, type: 'expense', amountCents: 39_90, accountId: checking.id, categoryId: c('health'), description: t.gym, frequency: 'monthly', startDate: `${startMonth}-05`, isDemo: true },
      { userId, type: 'transfer', amountCents: 300_00, accountId: checking.id, toAccountId: savings.id, description: t.toSavings, frequency: 'monthly', startDate: `${startMonth}-03`, isDemo: true },
    ];
    const validRules = rules.filter((r) => r.type === 'transfer' || r.categoryId);
    if (validRules.length) await tx.insert(recurringTransactions).values(validRules);

    const rows: (typeof transactions.$inferInsert)[] = [];
    const add = (date: string, type: 'expense' | 'income' | 'transfer', amountCents: number, accountId: string, opts: { categoryKey?: string; toAccountId?: string; description: string }) => {
      if (date > today) return;
      if (type !== 'transfer' && !(opts.categoryKey && c(opts.categoryKey))) return;
      rows.push({
        userId,
        type,
        amountCents,
        date,
        accountId,
        toAccountId: opts.toAccountId ?? null,
        categoryId: opts.categoryKey ? c(opts.categoryKey) : null,
        description: opts.description,
        isDemo: true,
      });
    };

    for (let i = 0; i < 6; i++) {
      const month = addMonthsToKey(startMonth, i);
      const [y, m] = month.split('-').map(Number);
      const days = daysInMonthKey(month);
      const day = (d: number) => toISODate(y, m, Math.min(d, days));

      for (let k = 0; k < 6; k++) add(day(2 + k * 5 + between(0, 2)), 'expense', between(28_00, 86_00), checking.id, { categoryKey: 'food', description: t.supermarket });
      add(day(between(10, 20)), 'expense', between(12_00, 24_00), cash.id, { categoryKey: 'food', description: t.market });
      for (let k = 0; k < between(2, 4); k++) add(day(between(4, 27)), 'expense', between(18_00, 48_00), checking.id, { categoryKey: 'restaurants', description: t.restaurant });
      for (let k = 0; k < 3; k++) add(day(between(1, 28)), 'expense', between(2_20, 4_80), cash.id, { categoryKey: 'restaurants', description: t.coffee });
      add(day(1), 'expense', 40_00, checking.id, { categoryKey: 'transport', description: t.transport });
      if (rand() > 0.4) add(day(between(8, 25)), 'expense', between(35_00, 60_00), checking.id, { categoryKey: 'transport', description: t.fuel });
      add(day(between(9, 14)), 'expense', between(42_00, 75_00), checking.id, { categoryKey: 'housing', description: t.electricity });
      add(day(20), 'expense', 19_90, checking.id, { categoryKey: 'subscriptions', description: t.phone });
      add(day(between(6, 26)), 'expense', between(9_00, 28_00), checking.id, { categoryKey: 'leisure', description: t.cinema });
      if (rand() > 0.5) add(day(between(10, 28)), 'expense', between(30_00, 65_00), checking.id, { categoryKey: 'entertainment', description: t.concert });
      add(day(between(3, 27)), 'expense', between(25_00, 95_00), checking.id, { categoryKey: 'shopping', description: t.clothes });
      if (rand() > 0.6) add(day(between(3, 27)), 'expense', between(6_00, 22_00), checking.id, { categoryKey: 'health', description: t.pharmacy });
      if (rand() > 0.7) add(day(between(3, 27)), 'expense', between(12_00, 35_00), checking.id, { categoryKey: 'education', description: t.books });
      add(day(between(5, 12)), 'transfer', 100_00, checking.id, { toAccountId: cash.id, description: t.cashWithdrawal });
      add(day(days), 'income', between(18_00, 26_00), savings.id, { categoryKey: 'interest', description: t.interest });
    }
    const inserted = rows.length ? await tx.insert(transactions).values(rows).returning({ id: transactions.id }) : [];

    // Budgets only where the user hasn't set their own.
    const existing = await tx.select({ categoryId: budgets.categoryId }).from(budgets).where(eq(budgets.userId, userId));
    const taken = new Set(existing.map((b) => b.categoryId ?? 'overall'));
    const demoBudgets = [
      { key: 'overall', categoryId: null, amountCents: 1_700_00 },
      { key: 'restaurants', categoryId: c('restaurants'), amountCents: 120_00 },
      { key: 'leisure', categoryId: c('leisure'), amountCents: 60_00 },
      { key: 'shopping', categoryId: c('shopping'), amountCents: 80_00 },
      { key: 'transport', categoryId: c('transport'), amountCents: 90_00 },
    ].filter((b) => (b.key === 'overall' || b.categoryId) && !taken.has(b.categoryId ?? 'overall'));
    if (demoBudgets.length) {
      await tx.insert(budgets).values(demoBudgets.map((b) => ({ userId, categoryId: b.categoryId, amountCents: b.amountCents, isDemo: true })));
    }
    return inserted.length;
  });

  const generated = await generateDueForUser(userId, today);
  return { created: createdRows + generated };
}

export async function removeDemoData(userId: string): Promise<{ removedAccounts: number; keptAccounts: number }> {
  return getDb().transaction(async (tx) => {
    await tx.delete(transactions).where(and(eq(transactions.userId, userId), eq(transactions.isDemo, true)));
    await tx.delete(recurringTransactions).where(and(eq(recurringTransactions.userId, userId), eq(recurringTransactions.isDemo, true)));
    await tx.delete(budgets).where(and(eq(budgets.userId, userId), eq(budgets.isDemo, true)));

    const demoAccounts = await tx
      .select({ id: accounts.id })
      .from(accounts)
      .where(and(eq(accounts.userId, userId), eq(accounts.isDemo, true)));
    if (!demoAccounts.length) return { removedAccounts: 0, keptAccounts: 0 };
    const ids = demoAccounts.map((a) => a.id);

    // Demo accounts still referenced by real movements or rules are kept as real accounts.
    const used = await tx
      .select({ id: accounts.id })
      .from(accounts)
      .where(
        and(
          eq(accounts.userId, userId),
          inArray(accounts.id, ids),
          sql`(exists (select 1 from transactions t where t.user_id = ${userId} and (t.account_id = ${accounts.id} or t.to_account_id = ${accounts.id}))
            or exists (select 1 from recurring_transactions r where r.user_id = ${userId} and (r.account_id = ${accounts.id} or r.to_account_id = ${accounts.id})))`,
        ),
      );
    const keep = new Set(used.map((r) => r.id));
    const toDelete = ids.filter((id) => !keep.has(id));
    if (keep.size) {
      await tx
        .update(accounts)
        .set({ isDemo: false, initialBalanceCents: 0, updatedAt: new Date() })
        .where(and(eq(accounts.userId, userId), inArray(accounts.id, [...keep])));
    }
    if (toDelete.length) await tx.delete(accounts).where(and(eq(accounts.userId, userId), inArray(accounts.id, toDelete)));
    return { removedAccounts: toDelete.length, keptAccounts: keep.size };
  });
}
