'use client';

import { ChevronRight, Download, KeyRound, LogOut, Repeat, Sparkles, Tags, Trash2, Wallet, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { useI18n } from '@/components/providers/I18nProvider';
import { LanguageList } from '@/components/shell/LanguageSwitcher';
import { PageHeader } from '@/components/shell/PageHeader';
import { Button, buttonClasses } from '@/components/ui/Button';
import { Card, SectionTitle } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Field, Input, Select } from '@/components/ui/Field';
import { Sheet } from '@/components/ui/Sheet';
import { useErrorMessage } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { useAccounts, useDemoData, useMe, useRecurring, useUpdateProfile } from '@/hooks/api';
import { api, ApiClientError } from '@/lib/api-client';
import { CURRENCIES, type Locale } from '@/lib/types';

export function SettingsView() {
  const { t, setLocale } = useI18n();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const { data: me } = useMe();
  const { data: accounts = [] } = useAccounts();
  const { data: recurring } = useRecurring();
  const update = useUpdateProfile();
  const { load, remove } = useDemoData();
  const [name, setName] = useState(me?.name ?? '');
  const [confirmDemo, setConfirmDemo] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function changeLanguage(locale: Locale) {
    await setLocale(locale);
    try {
      await update.mutateAsync({ locale });
      toast.show(t('settings.languageChanged'));
    } catch (error) {
      toast.show(errorMessage(error), 'error');
    }
  }

  async function saveName(e: FormEvent) {
    e.preventDefault();
    try {
      await update.mutateAsync({ name: name.trim() });
      toast.show(t('settings.profileSaved'));
    } catch (error) {
      toast.show(errorMessage(error), 'error');
    }
  }

  async function logout() {
    setLoggingOut(true);
    try {
      await api('/api/auth/logout', { method: 'POST' });
    } finally {
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full reload on purpose: drops every cached financial query and re-runs the server auth check
      window.location.assign('/login');
    }
  }

  return (
    <>
      <PageHeader title={t('settings.title')} showSettings={false} />
      <div className="mx-auto max-w-2xl pb-4">
        <SectionTitle>{t('settings.profile')}</SectionTitle>
        <Card>
          <form onSubmit={saveName} className="space-y-4">
            <Field label={t('auth.name')}>
              {(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoComplete="name" placeholder={t('auth.namePlaceholder')} />}
            </Field>
            <div className="flex items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="px-1 text-sm font-medium text-ink-2">{t('auth.email')}</p>
                <p className="truncate px-1 text-[15px] text-ink">{me?.email}</p>
              </div>
              <Button type="submit" variant="soft" size="sm" loading={update.isPending && update.variables?.name !== undefined} disabled={name.trim() === (me?.name ?? '')}>
                {t('common.save')}
              </Button>
            </div>
          </form>
        </Card>

        <SectionTitle>{t('settings.preferences')}</SectionTitle>
        <Card className="space-y-5">
          <div>
            <p className="mb-2 px-1 text-sm font-medium text-ink-2">{t('settings.language')}</p>
            <LanguageList onChange={(l) => void changeLanguage(l)} />
          </div>
          <Field label={t('settings.currency')} hint={t('settings.currencyNote')}>
            {(p) => (
              <Select
                {...p}
                value={me?.currency ?? 'EUR'}
                onChange={async (e) => {
                  try {
                    await update.mutateAsync({ currency: e.target.value as (typeof CURRENCIES)[number] });
                    toast.show(t('settings.profileSaved'));
                  } catch (error) {
                    toast.show(errorMessage(error), 'error');
                  }
                }}
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </Card>

        <SectionTitle>{t('settings.data')}</SectionTitle>
        <Card className="p-2 sm:p-2">
          <ul>
            <LinkRow href="/settings/accounts" icon={Wallet} title={t('settings.accounts')} hint={`${accounts.length} · ${t('settings.accountsHint')}`} />
            <LinkRow href="/settings/categories" icon={Tags} title={t('settings.categories')} hint={t('settings.categoriesHint')} />
            <LinkRow
              href="/settings/recurring"
              icon={Repeat}
              title={t('settings.recurring')}
              hint={recurring ? `${recurring.length} · ${t('settings.recurringHint')}` : t('settings.recurringHint')}
            />
          </ul>
        </Card>

        <div id="demo" className="scroll-mt-24">
          <SectionTitle>{t('settings.demo')}</SectionTitle>
          <Card>
            <p className="text-[14px] leading-relaxed text-ink-2">{t('settings.demoText')}</p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              {me?.hasDemoData ? (
                <Button variant="danger" icon={<Trash2 className="h-4 w-4" aria-hidden />} onClick={() => setConfirmDemo(true)}>
                  {t('settings.demoRemove')}
                </Button>
              ) : (
                <Button
                  variant="soft"
                  icon={<Sparkles className="h-4 w-4" aria-hidden />}
                  loading={load.isPending}
                  onClick={() =>
                    load.mutate(undefined, {
                      onSuccess: () => toast.show(t('settings.demoLoaded')),
                      onError: (error) => toast.show(errorMessage(error), 'error'),
                    })
                  }
                >
                  {t('settings.demoLoad')}
                </Button>
              )}
            </div>
          </Card>
        </div>

        <SectionTitle>{t('settings.export')}</SectionTitle>
        <Card>
          <p className="text-[14px] text-ink-2">{t('settings.exportText')}</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <a href="/api/export?format=csv" download className={buttonClasses({ variant: 'soft' })}>
              <Download className="h-4 w-4" aria-hidden />
              {t('settings.exportCsv')}
            </a>
            <a href="/api/export?format=json" download className={buttonClasses({ variant: 'soft' })}>
              <Download className="h-4 w-4" aria-hidden />
              {t('settings.exportJson')}
            </a>
          </div>
        </Card>

        <SectionTitle>{t('settings.account')}</SectionTitle>
        <Card className="p-2 sm:p-2">
          <ul>
            <ActionRow icon={KeyRound} title={t('settings.changePassword')} onClick={() => setPasswordOpen(true)} />
            <ActionRow icon={LogOut} title={loggingOut ? t('auth.loggingOut') : t('auth.logout')} onClick={() => void logout()} />
            <ActionRow icon={Trash2} title={t('settings.deleteAccount')} onClick={() => setDeleteOpen(true)} danger />
          </ul>
        </Card>

        <p className="mt-6 px-1 text-center text-[13px] leading-relaxed text-ink-3">{t('settings.installHint')}</p>
        <p className="mt-1 text-center text-[12px] text-ink-4">{t('settings.version', { version: '1.0.0' })}</p>
      </div>

      <ConfirmDialog
        open={confirmDemo}
        title={t('settings.demoRemove')}
        description={t('settings.demoRemoveConfirm')}
        onCancel={() => setConfirmDemo(false)}
        loading={remove.isPending}
        onConfirm={() =>
          remove.mutate(undefined, {
            onSuccess: () => {
              setConfirmDemo(false);
              toast.show(t('settings.demoRemoved'));
            },
            onError: (error) => {
              setConfirmDemo(false);
              toast.show(errorMessage(error), 'error');
            },
          })
        }
      />
      <PasswordSheet open={passwordOpen} onClose={() => setPasswordOpen(false)} />
      <DeleteAccountSheet open={deleteOpen} onClose={() => setDeleteOpen(false)} />
    </>
  );
}

function LinkRow({ href, icon: Icon, title, hint }: { href: string; icon: LucideIcon; title: string; hint?: string }) {
  return (
    <li>
      <Link href={href} className="flex min-h-14 items-center gap-3 rounded-2xl px-3 py-2.5 hover:bg-surface-2">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-surface-2 text-ink-2">
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold text-ink">{title}</span>
          {hint && <span className="block truncate text-[13px] text-ink-3">{hint}</span>}
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-ink-4" aria-hidden />
      </Link>
    </li>
  );
}

function ActionRow({ icon: Icon, title, onClick, danger }: { icon: LucideIcon; title: string; onClick: () => void; danger?: boolean }) {
  return (
    <li>
      <button type="button" onClick={onClick} className="flex min-h-14 w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left hover:bg-surface-2">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${danger ? 'bg-danger-soft text-danger' : 'bg-surface-2 text-ink-2'}`}>
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <span className={`min-w-0 flex-1 truncate text-[15px] font-semibold ${danger ? 'text-danger' : 'text-ink'}`}>{title}</span>
      </button>
    </li>
  );
}

function PasswordSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, tDynamic } = useI18n();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!current) errs.currentPassword = 'required';
    if (next.length < 8) errs.newPassword = 'password_too_short';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setPending(true);
    try {
      await api('/api/me/password', { method: 'POST', body: { currentPassword: current, newPassword: next } });
      toast.show(t('settings.passwordChanged'));
      setCurrent('');
      setNext('');
      onClose();
    } catch (error) {
      if (error instanceof ApiClientError && Object.keys(error.fields).length) setErrors(error.fields);
      else toast.show(errorMessage(error), 'error');
    } finally {
      setPending(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('settings.changePassword')}
      footer={
        <Button type="submit" form="password-form" block loading={pending}>
          {t('common.save')}
        </Button>
      }
    >
      <form id="password-form" onSubmit={submit} noValidate className="space-y-4 pt-1">
        <Field label={t('settings.currentPassword')} error={errors.currentPassword && tDynamic(`errors.${errors.currentPassword}`)}>
          {(p) => <Input {...p} type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />}
        </Field>
        <Field label={t('settings.newPassword')} hint={t('auth.passwordHint')} error={errors.newPassword && tDynamic(`errors.${errors.newPassword}`)}>
          {(p) => <Input {...p} type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />}
        </Field>
      </form>
    </Sheet>
  );
}

function DeleteAccountSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, tDynamic } = useI18n();
  const errorMessage = useErrorMessage();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!password) return setError(t('errors.required'));
    setPending(true);
    try {
      await api('/api/me', { method: 'DELETE', body: { password } });
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full reload on purpose: drops every cached financial query and re-runs the server auth check
      window.location.assign('/signup');
    } catch (err) {
      setError(err instanceof ApiClientError && err.fields.password ? tDynamic(`errors.${err.fields.password}`) : errorMessage(err));
      setPending(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('settings.deleteAccount')}
      footer={
        <Button type="submit" form="delete-account-form" variant="danger" block loading={pending}>
          {t('settings.deleteAccountButton')}
        </Button>
      }
    >
      <form id="delete-account-form" onSubmit={submit} noValidate className="space-y-4 pt-1">
        <p className="text-[15px] leading-relaxed text-ink-2">{t('settings.deleteAccountText')}</p>
        <Field label={t('auth.password')} error={error ?? undefined}>
          {(p) => <Input {...p} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />}
        </Field>
      </form>
    </Sheet>
  );
}
