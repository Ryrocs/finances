/**
 * Input validation shared by the API (authoritative) and the forms (instant feedback).
 * Error messages are *codes* (e.g. "required", "same_account"), translated in the UI.
 */
import { z } from 'zod';
import { isValidISODate } from './dates';
import { CATEGORY_COLORS, CATEGORY_ICONS } from './categories';
import { MAX_AMOUNT_CENTS } from './money';
import { ACCOUNT_TYPES, CATEGORY_GROUPS, CATEGORY_KINDS, CURRENCIES, FREQUENCIES, LOCALES } from './types';

const required = (iss: { input: unknown }) => (iss.input === undefined || iss.input === null || iss.input === '' ? 'required' : 'invalid');

const trimmed = (max: number) =>
  z
    .string({ error: required })
    .trim()
    .max(max, { error: 'too_long' });

const nonEmpty = (max: number) => trimmed(max).min(1, { error: 'required' });

const isoDate = z.string({ error: required }).refine(isValidISODate, { error: 'invalid_date' });

const id = z.uuid({ error: required });

const positiveAmount = z
  .number({ error: required })
  .int({ error: 'invalid' })
  .min(1, { error: 'amount_positive' })
  .max(MAX_AMOUNT_CENTS, { error: 'amount_too_large' });

const signedAmount = z
  .number({ error: required })
  .int({ error: 'invalid' })
  .min(-MAX_AMOUNT_CENTS, { error: 'amount_too_large' })
  .max(MAX_AMOUNT_CENTS, { error: 'amount_too_large' });

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, { error: 'invalid' });

const optionalNotes = z
  .string()
  .trim()
  .max(500, { error: 'too_long' })
  .nullish()
  .transform((v) => (v ? v : null));

// ---------- Auth & profile ----------

export const emailSchema = z
  .string({ error: required })
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: (iss) => (iss.input === '' ? 'required' : 'invalid_email') }).max(254, { error: 'too_long' }));

export const passwordSchema = z
  .string({ error: required })
  .min(8, { error: 'password_too_short' })
  .max(200, { error: 'too_long' });

export const signupSchema = z.object({
  name: trimmed(80).optional().default(''),
  email: emailSchema,
  password: passwordSchema,
  locale: z.enum(LOCALES).optional(),
  timezone: z.string().max(64).optional(),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string({ error: required }).min(1, { error: 'required' }).max(200, { error: 'too_long' }),
});

export const profileSchema = z
  .object({
    name: trimmed(80),
    locale: z.enum(LOCALES, { error: 'invalid' }),
    currency: z.enum(CURRENCIES, { error: 'invalid' }),
    timezone: z.string().max(64),
  })
  .partial();

export const changePasswordSchema = z.object({
  currentPassword: z.string({ error: required }).min(1, { error: 'required' }),
  newPassword: passwordSchema,
});

export const deleteAccountSchema = z.object({
  password: z.string({ error: required }).min(1, { error: 'required' }),
});

// ---------- Accounts ----------

export const accountSchema = z.object({
  name: nonEmpty(60),
  type: z.enum(ACCOUNT_TYPES, { error: required }),
  initialBalanceCents: signedAmount,
  initialBalanceDate: isoDate,
  isLiquid: z.boolean({ error: required }),
  color: hexColor.optional(),
  archived: z.boolean().optional(),
});

export const accountUpdateSchema = accountSchema.partial();

// ---------- Categories ----------

export const categorySchema = z.object({
  name: nonEmpty(40),
  kind: z.enum(CATEGORY_KINDS, { error: required }),
  group: z.enum(CATEGORY_GROUPS, { error: required }),
  icon: z.enum(CATEGORY_ICONS, { error: 'invalid' }),
  color: z.enum(CATEGORY_COLORS, { error: 'invalid' }).or(hexColor),
});

export const categoryUpdateSchema = categorySchema.omit({ kind: true }).partial();

// ---------- Movements ----------

const movementCommon = {
  amountCents: positiveAmount,
  accountId: id,
  description: trimmed(120).optional().default(''),
  notes: optionalNotes,
};

const movementBase = { ...movementCommon, date: isoDate };

export const transactionSchema = z
  .discriminatedUnion(
    'type',
    [
      z.object({ type: z.literal('expense'), ...movementBase, categoryId: id }),
      z.object({ type: z.literal('income'), ...movementBase, categoryId: id }),
      z.object({ type: z.literal('transfer'), ...movementBase, toAccountId: id }),
    ],
    { error: 'invalid_type' },
  )
  .superRefine((value, ctx) => {
    if (value.type === 'transfer' && value.toAccountId === value.accountId) {
      ctx.addIssue({ code: 'custom', path: ['toAccountId'], message: 'same_account' });
    }
  });

export type TransactionInput = z.infer<typeof transactionSchema>;

// ---------- Budgets ----------

export const budgetSchema = z.object({
  categoryId: id.nullable(),
  amountCents: positiveAmount,
});

// ---------- Recurring ----------

const recurringFields = {
  ...movementCommon,
  frequency: z.enum(FREQUENCIES, { error: required }),
  interval: z.number().int().min(1, { error: 'invalid' }).max(12, { error: 'invalid' }).optional().default(1),
  startDate: isoDate,
  endDate: isoDate.nullish().transform((v) => v ?? null),
  isActive: z.boolean().optional().default(true),
};

export const recurringSchema = z
  .discriminatedUnion(
    'type',
    [
      z.object({ type: z.literal('expense'), ...recurringFields, categoryId: id }),
      z.object({ type: z.literal('income'), ...recurringFields, categoryId: id }),
      z.object({ type: z.literal('transfer'), ...recurringFields, toAccountId: id }),
    ],
    { error: 'invalid_type' },
  )
  .superRefine((value, ctx) => {
    if (value.type === 'transfer' && value.toAccountId === value.accountId) {
      ctx.addIssue({ code: 'custom', path: ['toAccountId'], message: 'same_account' });
    }
    if (value.endDate && value.endDate < value.startDate) {
      ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'end_before_start' });
    }
  });

export type RecurringInput = z.infer<typeof recurringSchema>;

// ---------- Helpers ----------

const KNOWN_CODES = new Set([
  'required',
  'invalid',
  'invalid_date',
  'invalid_email',
  'invalid_type',
  'too_long',
  'password_too_short',
  'amount_positive',
  'amount_too_large',
  'same_account',
  'end_before_start',
]);

/** Converts a ZodError into { field: code } using only known, translatable codes. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = issue.path.length ? issue.path.join('.') : '_form';
    if (out[field]) continue;
    out[field] = KNOWN_CODES.has(issue.message) ? issue.message : 'invalid';
  }
  return out;
}
