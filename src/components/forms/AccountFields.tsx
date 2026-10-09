import type { AccountData } from '../../db/repo';
import { centsToInput, parseAmount } from '../../lib/money';
import type { Account, AccountType } from '../../lib/types';
import { parsePercent, validateAccount, type AccountField, type AccountInput, type FieldErrors } from '../../lib/validation';
import { T } from '../../texts';
import { ColorPicker } from '../ui/ColorPicker';
import { Chip, ChipGroup } from '../sheets/Chips';
import { Field, TextInput, useFieldId } from '../ui/Field';
import { DateField } from './DateField';

export interface AccountDraft {
  name: string;
  type: AccountType;
  color: string;
  balance: string;
  date: string;
  tae: string;
  withholding: string;
}

export const ACCOUNT_TYPES: AccountType[] = ['corrent', 'remunerat', 'efectiu', 'altre'];

export function draftFromAccount(a: Account): AccountDraft {
  return {
    name: a.name,
    type: a.type,
    color: a.color,
    balance: centsToInput(a.initialBalanceCents),
    date: a.initialBalanceDate,
    tae: a.tae ? String(a.tae).replace('.', ',') : '',
    withholding: String(a.withholdingPct ?? 19).replace('.', ','),
  };
}

export function draftToInput(d: AccountDraft): AccountInput {
  return {
    name: d.name,
    type: d.type,
    color: d.color,
    // An empty balance means 0 €.
    initialBalanceCents: d.balance.trim() === '' ? 0 : parseAmount(d.balance),
    initialBalanceDate: d.date,
    tae: d.type === 'remunerat' ? parsePercent(d.tae) : undefined,
    withholdingPct: d.type === 'remunerat' ? parsePercent(d.withholding) : undefined,
  };
}

/** Validates a draft and returns the data to save (or the errors). */
export function checkDraft(d: AccountDraft, earliestMovement?: string | null): { errors: FieldErrors<AccountField>; data: AccountData | null } {
  const input = draftToInput(d);
  const errors = validateAccount(input, earliestMovement);
  if (Object.values(errors).some(Boolean)) return { errors, data: null };
  return {
    errors,
    data: {
      name: input.name,
      type: input.type,
      color: input.color,
      initialBalanceCents: input.initialBalanceCents!,
      initialBalanceDate: input.initialBalanceDate,
      tae: input.type === 'remunerat' ? (input.tae ?? 0) : undefined,
      withholdingPct: input.type === 'remunerat' ? (input.withholdingPct ?? 19) : undefined,
    },
  };
}

export function AccountFields({
  draft,
  onChange,
  errors,
  today,
  showColor = true,
}: {
  draft: AccountDraft;
  onChange: (patch: Partial<AccountDraft>) => void;
  errors: FieldErrors<AccountField>;
  today: string;
  showColor?: boolean;
}) {
  const nameId = useFieldId('account-name');
  const balanceId = useFieldId('account-balance');
  const taeId = useFieldId('account-tae');
  const whId = useFieldId('account-withholding');
  const t = T.accounts;
  return (
    <div className="space-y-4">
      <Field label={t.name} htmlFor={nameId} error={errors.name}>
        <TextInput
          id={nameId}
          value={draft.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder={t.namePlaceholder}
          autoComplete="off"
          invalid={!!errors.name}
        />
      </Field>
      <Field label={t.type}>
        <ChipGroup label={t.type}>
          {ACCOUNT_TYPES.map((type) => (
            <Chip key={type} selected={draft.type === type} onClick={() => onChange({ type })} testId={`account-type-${type}`}>
              {T.accountTypes[type]}
            </Chip>
          ))}
        </ChipGroup>
      </Field>
      <div className="grid grid-cols-2 items-end gap-3">
        <Field label={t.initialBalance} htmlFor={balanceId} error={errors.initialBalance}>
          <div className="relative">
            <TextInput
              id={balanceId}
              inputMode="decimal"
              value={draft.balance}
              onChange={(e) => onChange({ balance: e.target.value })}
              placeholder="0,00"
              className="pr-8 text-right tabular"
              invalid={!!errors.initialBalance}
              autoComplete="off"
            />
            <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-3">€</span>
          </div>
        </Field>
        <DateField label={t.initialBalanceDate} value={draft.date} onChange={(date) => onChange({ date })} error={errors.initialBalanceDate} today={today} shortcuts={false} />
      </div>
      {draft.type === 'remunerat' && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t.tae} htmlFor={taeId} error={errors.tae}>
              <TextInput
                id={taeId}
                inputMode="decimal"
                value={draft.tae}
                onChange={(e) => onChange({ tae: e.target.value })}
                placeholder="2,5"
                invalid={!!errors.tae}
                autoComplete="off"
                className="tabular"
              />
            </Field>
            <Field label={t.withholding} htmlFor={whId} error={errors.withholdingPct}>
              <TextInput
                id={whId}
                inputMode="decimal"
                value={draft.withholding}
                onChange={(e) => onChange({ withholding: e.target.value })}
                placeholder="19"
                invalid={!!errors.withholdingPct}
                autoComplete="off"
                className="tabular"
              />
            </Field>
          </div>
          <p className="-mt-1 text-[13px] leading-snug text-ink-3">{t.taeHint}</p>
        </>
      )}
      {showColor && (
        <Field label={t.color}>
          <ColorPicker value={draft.color} onChange={(color) => onChange({ color })} label={t.color} />
        </Field>
      )}
    </div>
  );
}
