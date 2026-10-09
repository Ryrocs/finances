/**
 * Validation shared by the forms (messages under each field) and the data layer (last line of
 * defence). Messages are in src/texts.ts.
 */
import { T } from '../texts';
import { formatShortDate, isValidISODate, type ISODate } from './dates';
import { MAX_AMOUNT_CENTS } from './money';
import type { Account, AccountType, Category, Frequency, TransactionType } from './types';

export type FieldErrors<K extends string> = Partial<Record<K, string>>;

export interface MovementInput {
  type: TransactionType;
  date: ISODate;
  amountCents: number | null;
  categoryId?: string;
  accountId?: string;
  toAccountId?: string;
  description?: string;
  notes?: string;
}

export type MovementField = 'amount' | 'category' | 'account' | 'toAccount' | 'date';

type AccountRef = Pick<Account, 'id' | 'name' | 'initialBalanceDate'>;
type CategoryRef = Pick<Category, 'id' | 'kind'>;

export function validateMovement(input: MovementInput, accounts: readonly AccountRef[], categories: readonly CategoryRef[]): FieldErrors<MovementField> {
  const errors: FieldErrors<MovementField> = {};
  const v = T.validation;

  if (input.amountCents === null || !Number.isInteger(input.amountCents) || input.amountCents <= 0) errors.amount = v.amountRequired;
  else if (input.amountCents > MAX_AMOUNT_CENTS) errors.amount = v.amountTooLarge;

  if (input.type !== 'transfer') {
    const category = categories.find((c) => c.id === input.categoryId);
    if (!category || category.kind !== input.type) errors.category = v.categoryRequired;
  }

  const account = accounts.find((a) => a.id === input.accountId);
  if (!account) errors.account = input.type === 'transfer' ? v.fromAccountRequired : v.accountRequired;

  let toAccount: AccountRef | undefined;
  if (input.type === 'transfer') {
    toAccount = accounts.find((a) => a.id === input.toAccountId);
    if (!toAccount) errors.toAccount = v.toAccountRequired;
    else if (toAccount.id === input.accountId) errors.toAccount = v.sameAccount;
  }

  if (!isValidISODate(input.date)) errors.date = v.dateRequired;
  else {
    // A movement can't be earlier than the initial balance of the account(s) it touches.
    const limit = [account, toAccount].filter((a): a is AccountRef => !!a).find((a) => input.date < a.initialBalanceDate);
    if (limit) errors.date = v.dateBeforeInitial(limit.name, formatShortDate(limit.initialBalanceDate, 0));
  }
  return errors;
}

export interface ScheduleInput {
  frequency: Frequency;
  startDate: ISODate;
  endDate?: ISODate;
}

export type ScheduleField = 'endDate';

export function validateSchedule(input: ScheduleInput): FieldErrors<ScheduleField> {
  if (input.endDate && input.endDate < input.startDate) return { endDate: T.validation.endBeforeStart };
  return {};
}

export interface AccountInput {
  name: string;
  type: AccountType;
  color: string;
  initialBalanceCents: number | null;
  initialBalanceDate: ISODate;
  tae?: number | null;
  withholdingPct?: number | null;
}

export type AccountField = 'name' | 'initialBalance' | 'initialBalanceDate' | 'tae' | 'withholdingPct';

/** `earliestMovement`: the oldest movement of the account, which the initial date can't pass. */
export function validateAccount(input: AccountInput, earliestMovement?: ISODate | null): FieldErrors<AccountField> {
  const errors: FieldErrors<AccountField> = {};
  const v = T.validation;
  if (!input.name.trim()) errors.name = v.nameRequired;
  if (input.initialBalanceCents === null || !Number.isInteger(input.initialBalanceCents)) errors.initialBalance = v.initialBalanceRequired;
  else if (Math.abs(input.initialBalanceCents) > MAX_AMOUNT_CENTS) errors.initialBalance = v.amountTooLarge;
  if (!isValidISODate(input.initialBalanceDate)) errors.initialBalanceDate = v.dateRequired;
  else if (earliestMovement && earliestMovement < input.initialBalanceDate) {
    errors.initialBalanceDate = v.initialAfterMovements(formatShortDate(earliestMovement, 0));
  }
  if (input.type === 'remunerat') {
    if (input.tae !== null && input.tae !== undefined && (!Number.isFinite(input.tae) || input.tae < 0 || input.tae > 50)) errors.tae = v.taeRange;
    if (
      input.withholdingPct !== null &&
      input.withholdingPct !== undefined &&
      (!Number.isFinite(input.withholdingPct) || input.withholdingPct < 0 || input.withholdingPct > 100)
    ) {
      errors.withholdingPct = v.withholdingRange;
    }
  }
  return errors;
}

/** Parses a percentage typed with a comma or a point ("2,5" → 2.5). Empty → null, invalid → NaN. */
export function parsePercent(text: string): number | null {
  const s = text.trim().replace(/\s|%/g, '').replace(',', '.');
  if (s === '') return null;
  if (!/^\d+(\.\d+)?$/.test(s)) return Number.NaN;
  return Number(s);
}

export function hasErrors(errors: object): boolean {
  return Object.values(errors).some(Boolean);
}
