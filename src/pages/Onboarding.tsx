import { Plus, ShieldCheck, Wallet, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { AccountFields, checkDraft, type AccountDraft } from '../components/forms/AccountFields';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { useToast } from '../components/ui/Toast';
import { runAutomation } from '../db/automation';
import { createAccounts, restoreBackup, setSetting } from '../db/repo';
import { PALETTE } from '../db/seed';
import { validateBackup } from '../lib/backup';
import type { AccountField, FieldErrors } from '../lib/validation';
import { useAppState } from '../state/app';
import { T } from '../texts';

const t = T.onboarding;

function suggestedDrafts(today: string): AccountDraft[] {
  return [
    { name: t.suggested[0], type: 'corrent', color: PALETTE[0], balance: '', date: today, tae: '', withholding: '19' },
    { name: t.suggested[1], type: 'remunerat', color: PALETTE[1], balance: '', date: today, tae: '', withholding: '19' },
    { name: t.suggested[2], type: 'efectiu', color: PALETTE[2], balance: '', date: today, tae: '', withholding: '19' },
  ];
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
  const [drafts, setDrafts] = useState<AccountDraft[]>(() => suggestedDrafts(today));
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
          <Card key={i} data-testid="onboarding-account">
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

      <Button
        variant="outline"
        block
        className="mt-3"
        onClick={() => {
          setFormError(null);
          setDrafts((list) => [
            ...list,
            { name: '', type: 'corrent', color: PALETTE[list.length % PALETTE.length], balance: '', date: today, tae: '', withholding: '19' },
          ]);
        }}
      >
        <Plus className="h-5 w-5" aria-hidden />
        {t.addAccount}
      </Button>
    </Layout>
  );
}
