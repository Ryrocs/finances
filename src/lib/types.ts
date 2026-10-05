/** DTOs shared by the API (server) and the UI (client). Money is always integer cents. */

export const LOCALES = ['ca', 'es', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

export const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF'] as const;
export type Currency = (typeof CURRENCIES)[number];

export const TRANSACTION_TYPES = ['expense', 'income', 'transfer'] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const ACCOUNT_TYPES = ['checking', 'savings', 'cash', 'other'] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const CATEGORY_KINDS = ['expense', 'income'] as const;
export type CategoryKind = (typeof CATEGORY_KINDS)[number];

export const CATEGORY_GROUPS = ['needs', 'lifestyle', 'other', 'income'] as const;
export type CategoryGroup = (typeof CATEGORY_GROUPS)[number];

export const FREQUENCIES = ['weekly', 'monthly', 'yearly'] as const;
export type Frequency = (typeof FREQUENCIES)[number];

export const NET_WORTH_PERIODS = ['30d', '3m', '6m', '12m', 'all'] as const;
export type NetWorthPeriod = (typeof NET_WORTH_PERIODS)[number];

export interface MeDTO {
  id: string;
  email: string;
  name: string;
  locale: Locale;
  currency: Currency;
  timezone: string;
  today: string;
  hasDemoData: boolean;
}

export interface AccountDTO {
  id: string;
  name: string;
  type: AccountType;
  initialBalanceCents: number;
  initialBalanceDate: string;
  currency: string;
  isLiquid: boolean;
  color: string;
  sortOrder: number;
  archived: boolean;
  isDemo: boolean;
  /** Balance as of today (user's time zone). */
  balanceCents: number;
  transactionCount: number;
}

export interface CategoryDTO {
  id: string;
  key: string | null;
  name: string | null;
  kind: CategoryKind;
  group: CategoryGroup;
  icon: string;
  color: string;
  sortOrder: number;
  archived: boolean;
}

export interface TransactionDTO {
  id: string;
  type: TransactionType;
  amountCents: number;
  date: string;
  accountId: string;
  toAccountId: string | null;
  categoryId: string | null;
  description: string;
  notes: string | null;
  recurringId: string | null;
  isDemo: boolean;
  createdAt: string;
}

export interface TransactionListDTO {
  items: TransactionDTO[];
  nextCursor: string | null;
  totals: { count: number; incomeCents: number; expenseCents: number };
}

export interface BudgetDTO {
  id: string;
  categoryId: string | null;
  amountCents: number;
  isDemo: boolean;
}

export type BudgetLevel = 'ok' | 'warning' | 'exceeded';

export interface BudgetStatus {
  budgetCents: number;
  spentCents: number;
  remainingCents: number;
  /** Rounded percentage spent (can exceed 100). */
  percent: number;
  level: BudgetLevel;
}

export interface BudgetStatusDTO extends BudgetStatus {
  id: string;
  categoryId: string | null;
}

export interface BudgetAlert {
  categoryId: string | null;
  level: BudgetLevel;
  percent: number;
  remainingCents: number;
}

export interface BudgetOverviewDTO {
  month: string;
  overall: BudgetStatusDTO | null;
  categories: BudgetStatusDTO[];
  /** Spending in categories without their own budget (for context). */
  unbudgetedSpentCents: number;
  totalSpentCents: number;
  /** Days remaining in the month including today (0 for past months). */
  daysLeft: number;
}

export interface RecurringDTO {
  id: string;
  type: TransactionType;
  amountCents: number;
  accountId: string;
  toAccountId: string | null;
  categoryId: string | null;
  description: string;
  notes: string | null;
  frequency: Frequency;
  interval: number;
  startDate: string;
  endDate: string | null;
  isActive: boolean;
  isDemo: boolean;
  nextDate: string | null;
  lastGeneratedDate: string | null;
}

export interface CategoryAmount {
  categoryId: string;
  amountCents: number;
  count: number;
}

export type ProjectionStatus = 'available' | 'too_early' | 'past' | 'future';
export type ProjectionReference = 'budget' | 'average' | 'income';

export interface ProjectionDTO {
  status: ProjectionStatus;
  projectedCents: number;
  dailyRateCents: number;
  daysElapsed: number;
  daysInMonth: number;
  fixedCents: number;
  variableCents: number;
  reference: ProjectionReference | null;
  referenceCents: number;
  /** true when the projection exceeds the reference (budget / usual spending / income). */
  high: boolean;
}

export interface MonthSummaryDTO {
  month: string;
  today: string;
  incomeCents: number;
  expenseCents: number;
  balanceCents: number;
  transactionCount: number;
  expensesByCategory: CategoryAmount[];
  incomeByCategory: CategoryAmount[];
  groupTotals: Record<'needs' | 'lifestyle' | 'other', number>;
  previous: { month: string; incomeCents: number; expenseCents: number };
  netWorth: { asOf: string; liquidCents: number };
  projection: ProjectionDTO;
  budgets: BudgetOverviewDTO;
  recent: TransactionDTO[];
}

export interface MonthlyPoint {
  month: string;
  incomeCents: number;
  expenseCents: number;
  balanceCents: number;
}

export interface AnalyticsDTO {
  months: string[];
  series: MonthlyPoint[];
  /** month → categoryId → expense cents */
  expensesByMonth: Record<string, Record<string, number>>;
  incomeByMonth: Record<string, Record<string, number>>;
}

export interface NetWorthPoint {
  date: string;
  cents: number;
}

export interface NetWorthDTO {
  today: string;
  period: NetWorthPeriod;
  liquidCents: number;
  nonLiquidCents: number;
  accounts: AccountDTO[];
  series: NetWorthPoint[];
  change: { fromCents: number; toCents: number; diffCents: number; percent: number | null };
}

export type ApiErrorCode =
  | 'validation'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'email_taken'
  | 'invalid_credentials'
  | 'rate_limited'
  | 'bad_origin'
  | 'server_error';

export interface ApiErrorBody {
  error: { code: ApiErrorCode; fields?: Record<string, string> };
}
