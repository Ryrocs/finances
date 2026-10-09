import { Plus, ShieldCheck, Wallet, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { ACCOUNT_TYPES, AccountFields, checkDraft, type AccountDraft } from '../components/forms/AccountFields';
import { chipClass } from '../components/sheets/Chips';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { useToast } from '../components/ui/Toast';
import { runAutomation } from '../db/automation';
import { createAccounts, restoreBackup, setSetting } from '../db/repo';
import { PALETTE } from '../db/seed';
import { validateBackup } from '../lib/backup';
import { formatEUR, parseAmount } from '../lib/money';
import type { AccountType } from '../lib/types';
import type { AccountField, FieldErrors } from '../lib/validation';
import { useAppState } from '../state/app';
import { T } from '../texts';

const t = T.onboarding;

type Draft = AccountDraft & { key: number };

let nextKey = 0;

function newDraft(name: string, type: AccountType, color: string, today: string): Draft {
  return { key: nextKey++, name, type, color, balance: '', date: today, tae: '', withholding: '19' };
}

function suggestedDrafts(today: string): Draft[] {
  return [
    newDraft(t.suggested[0], 'corrent', PALETTE[0], today),
    newDraft(t.suggested[1], 'remunerat', PALETTE[1], today),
    newDraft(t.suggested[2], 'efectiu', PALETTE[2], today),
  ];
}

/** "Compte remunerat", then "Compte remunerat 2", "Compte remunerat 3"… */
function uniqueName(base: string, taken: readonly string[]): string {
  const names = new Set(taken.map((n) => n.trim().toLowerCase()));
  if (!names.has(base.toLowerCase())) return base;
  for (let i = 2; ; i++) if (!names.has(`${base} ${i}`.toLowerCase())) return `${base} ${i}`;
}

/** Sum of the balances typed so far (ignoring the ones that aren't valid amounts yet). */
function draftsTotal(drafts: readonly AccountDraft[]): number {
  let total = 0;
  for (const d of drafts) total += d.balance.trim() === '' ? 0 : (parseAmount(d.balance) ?? 0);
  return total;
}

export function OnboardingPage() {
  const [step, setStep] = useState<'welcome' | 'accounts'>('welcome');
  return step === 'welcome' ? <Welcome onNext={() => setStep('accounts')} /> : <AccountsStep />;
}

function Layout({ children, footer }: { children: React.ReactNode; footer: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col bg-page">
      <div className="flex-1 px-5 pb-6" style={{ paddingTop: 'calc(var(--safe-top) + 24px)' }}>
        {children}
      </div>
      <div className="sticky bottom-0 border-t border-line bg-page/95 px-5 pt-3 backdrop-blur-md" style={{ paddingBottom: 'max(16px, var(--safe-bottom))' }}>
        {footer}
      </div>
    </div>
  );
}

function Welcome({ onNext }: { onNext: () => void }) {
  const { today } = useAppState();
  const toast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);

  // A new phone, or after wiping everything: start from a backup instead of from scratch.
  const restore = async (file: File | undefined) => {
    if (!file) return;
    try {
      const result = validateBackup(JSON.parse(await file.text()));
      if (!result.ok) throw new Error(result.reason);
      await restoreBackup(result.backup);
      await runAutomation(today);
      toast(T.data.restored);
    } catch (e) {
      console.warn(e);
      toast(T.data.invalidBackup, 'error');
    } finally {
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  return (
    <Layout
      footer={
        <div className="space-y-2">
          <Button block size="lg" onClick={onNext}>
            {t.start}
          </Button>
          <Button block variant="ghost" onClick={() => fileInput.current?.click()} data-testid="onboarding-restore">
            {t.restore}
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept=".json,application/json"
            className="hidden"
            data-testid="onboarding-restore-file"
            onChange={(e) => void restore(e.target.files?.[0])}
          />
        </div>
      }
    >
      <div className="flex flex-col pt-[8vh]">
        <img src="/icons/icon.svg" alt="" className="h-16 w-16 rounded-[18px]" />
        <h1 className="mt-6 text-[32px] font-bold leading-tight tracking-tight">{t.welcomeTitle}</h1>
        <p className="mt-3 text-[17px] leading-relaxed text-ink-2">{t.welcomeBody}</p>
        <ul className="mt-6 space-y-3">
          {t.points.map((p) => (
            <li key={p} className="flex gap-3 text-[15px] leading-snug text-ink-2">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-ink" aria-hidden />
              {p}
            </li>
          ))}
        </ul>
        <div className="mt-8 flex gap-3 rounded-card border border-line bg-surface p-4 text-[14px] leading-snug text-ink-2">
          <ShieldCheck className="h-5 w-5 shrink-0 text-income-ink" aria-hidden />
          {t.privacy}
        </div>
      </div>
    </Layout>
  );
}

function AccountsStep() {
  const { today } = useAppState();
  const navigate = useNavigate();
  const [drafts, setDrafts] = useState<Draft[]>(() => suggestedDrafts(today));
  const [scrollTo, setScrollTo] = useState<number | null>(null);
  const cardRefs = useRef(new Map<number, HTMLDivElement>());

  // Bring a just-added account into view so its name and balance can be typed straight away.
  useEffect(() => {
    if (scrollTo === null) return;
    cardRefs.current.get(scrollTo)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setScrollTo(null);
  }, [scrollTo]);

  const addDraft = (type: AccountType) => {
    setFormError(null);
    const draft = newDraft(
      uniqueName(t.defaultNames[type], drafts.map((d) => d.name)),
      type,
      PALETTE[drafts.length % PALETTE.length],
      today,
    );
    setDrafts((list) => [...list, draft]);
    setErrors((list) => [...list, {}]);
    setScrollTo(draft.key);
  };
  const [errors, setErrors] = useState<FieldErrors<AccountField>[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const update = (index: number, patch: Partial<AccountDraft>) => {
    setDrafts((list) => list.map((d, i) => (i === index ? { ...d, ...patch } : d)));
    setErrors((list) => list.map((e, i) => (i === index ? {} : e)));
  };

  const submit = async () => {
    if (drafts.length === 0) {
      setFormError(t.needOne);
      return;
    }
    const checks = drafts.map((d) => checkDraft(d));
    setErrors(checks.map((c) => c.errors));
    if (checks.some((c) => !c.data)) return;
    setBusy(true);
    try {
      const ids = await createAccounts(checks.map((c) => c.data!));
      await setSetting('lastAccountId', ids[0]);
      await runAutomation(today);
      await setSetting('onboardingDone', true);
      navigate('/', { replace: true });
    } catch (e) {
      console.error(e);
      setFormError(T.common.error);
      setBusy(false);
    }
  };

  return (
    <Layout
      footer={
        <>
          {formError && (
            <p role="alert" className="mb-2 text-center text-[14px] font-medium text-expense-ink">
              {formError}
            </p>
          )}
          {drafts.length > 0 && (
            <div className="mb-3 flex items-baseline justify-between gap-3" data-testid="onboarding-total">
              <span className="min-w-0 text-[14px] text-ink-2">
                {t.total} · {t.accountsCount(drafts.length)}
              </span>
              <span className="money shrink-0 text-[18px] font-bold">{formatEUR(draftsTotal(drafts))}</span>
            </div>
          )}
          <Button block size="lg" onClick={submit} disabled={busy || drafts.length === 0} data-testid="onboarding-finish">
            {t.finish}
          </Button>
        </>
      }
    >
      <h1 className="text-[30px] font-bold leading-tight tracking-tight">{t.accountsTitle}</h1>
      <p className="mt-2 text-[16px] leading-relaxed text-ink-2">{t.accountsBody}</p>

      <div className="mt-5 space-y-3">
        {drafts.map((draft, i) => (
          <Card
            key={draft.key}
            data-testid="onboarding-account"
            className="scroll-mt-4"
            ref={(el: HTMLDivElement | null) => {
              if (el) cardRefs.current.set(draft.key, el);
              else cardRefs.current.delete(draft.key);
            }}
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: draft.color }} aria-hidden />
                <span className="truncate text-[16px] font-semibold">{draft.name || T.accounts.newTitle}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDrafts((list) => list.filter((_, j) => j !== i));
                  setErrors((list) => list.filter((_, j) => j !== i));
                }}
                aria-label={`${t.removeAccount}: ${draft.name}`}
                className="-mr-2 flex h-11 w-11 items-center justify-center rounded-full text-ink-3 active:bg-soft"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <AccountFields draft={draft} onChange={(patch) => update(i, patch)} errors={errors[i] ?? {}} today={today} showColor={false} />
          </Card>
        ))}
      </div>

      {drafts.length === 0 && (
        <div className="mt-5 flex items-center gap-3 rounded-card border border-dashed border-line-strong p-4 text-[14px] text-ink-3">
          <Wallet className="h-5 w-5 shrink-0" aria-hidden />
          {t.needOne}
        </div>
      )}

      <div className="mt-5">
        <p className="text-[15px] font-semibold">{t.addAccount}</p>
        <p className="mb-3 mt-0.5 text-[13px] leading-snug text-ink-3">{t.addAccountHint}</p>
        <div className="flex flex-wrap gap-2">
          {ACCOUNT_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              className={chipClass(false)}
              onClick={() => addDraft(type)}
              aria-label={t.addOfType(T.accountTypes[type])}
              data-testid={`onboarding-add-${type}`}
            >
              <Plus className="h-4 w-4 shrink-0" aria-hidden />
              {T.accountTypes[type]}
            </button>
          ))}
        </div>
      </div>
    </Layout>
  );
}
