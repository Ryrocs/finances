import type { ISODate, MonthKey } from './dates';

export type AccountType = 'corrent' | 'remunerat' | 'efectiu' | 'altre';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  color: string;
  initialBalanceCents: number;
  initialBalanceDate: ISODate;
  /** Annual equivalent rate in % (e.g. 2.5). Only for 'remunerat'. */
  tae?: number;
  /** Tax withheld on interest, in % (default 19). */
  withholdingPct?: number;
  order: number;
  createdAt: number;
}

export type CategoryKind = 'expense' | 'income';
export type CategoryGroup = 'necessitats' | 'oci' | 'altres';

export interface Category {
  id: string;
  name: string;
  emoji: string;
  color: string;
  kind: CategoryKind;
  /** Only for expenses. */
  group?: CategoryGroup;
  order: number;
  createdAt: number;
}

export type TransactionType = 'expense' | 'income' | 'transfer';
export type TransactionSource = 'manual' | 'recurring' | 'interest';

export interface Transaction {
  id: string;
  type: TransactionType;
  date: ISODate;
  /** Always positive. */
  amountCents: number;
  /** Required for expense/income, absent for transfers. */
  categoryId?: string;
  /** The account (the source account for a transfer). */
  accountId: string;
  /** Destination account (transfers only). */
  toAccountId?: string;
  description?: string;
  notes?: string;
  source: TransactionSource;
  recurringId?: string;
  createdAt: number;
  updatedAt: number;
}

export type Frequency = 'weekly' | 'monthly' | 'yearly';

export interface RecurringRule {
  id: string;
  type: TransactionType;
  amountCents: number;
  categoryId?: string;
  accountId: string;
  toAccountId?: string;
  description?: string;
  notes?: string;
  frequency: Frequency;
  /** Monthly/yearly. Clamped to the last day of shorter months. */
  dayOfMonth?: number;
  /** Weekly. ISO weekday, 1 = Monday … 7 = Sunday. */
  weekday?: number;
  startDate: ISODate;
  endDate?: ISODate;
  /** Last occurrence already turned into a movement. */
  lastGeneratedDate?: ISODate;
  active: boolean;
  createdAt: number;
}

export interface Budget {
  id: string;
  /** 'default' applies to every month that has no budget of its own. */
  month: 'default' | MonthKey;
  totalCents?: number;
  /** categoryId → cents. Missing = no budget for that category. */
  perCategory: Record<string, number>;
}

export interface SettingsMap {
  onboardingDone: boolean;
  lastAccountId: string;
  /** Epoch ms of the last JSON backup. */
  lastBackupAt: number;
  /** accountId → last month ('YYYY-MM') whose interest was already generated. */
  interestProcessed: Record<string, MonthKey>;
}

export type SettingKey = keyof SettingsMap;

export interface SettingRow<K extends SettingKey = SettingKey> {
  key: K;
  value: SettingsMap[K];
}
