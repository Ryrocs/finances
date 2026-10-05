'use client';

import { Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { useI18n } from '@/components/providers/I18nProvider';
import { LanguagePills } from '@/components/shell/LanguageSwitcher';
import { Logo } from '@/components/shell/Logo';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { api, ApiClientError } from '@/lib/api-client';
import type { MeDTO } from '@/lib/types';

export function AuthForm({ mode }: { mode: 'login' | 'signup' }) {
  const { t, tDynamic, locale } = useI18n();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const signup = mode === 'signup';
  const err = (k: string) => (errors[k] ? tDynamic(`errors.${errors[k]}`, t('errors.invalid')) : undefined);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const next: Record<string, string> = {};
    if (!email.trim()) next.email = 'required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = 'invalid_email';
    if (!password) next.password = 'required';
    else if (signup && password.length < 8) next.password = 'password_too_short';
    setErrors(next);
    if (Object.keys(next).length) return;

    setPending(true);
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      await api<{ user: MeDTO }>(signup ? '/api/auth/signup' : '/api/auth/login', {
        method: 'POST',
        body: signup ? { name: name.trim(), email: email.trim(), password, locale, timezone } : { email: email.trim(), password },
      });
      // Full navigation so the server renders the app with the new session cookie.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full reload on purpose: drops every cached financial query and re-runs the server auth check
      window.location.assign('/');
    } catch (error) {
      setPending(false);
      if (error instanceof ApiClientError) {
        if (Object.keys(error.fields).length) setErrors(error.fields);
        setFormError(tDynamic(`errors.${error.code}`, t('errors.server_error')));
      } else setFormError(t('errors.server_error'));
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-page px-4 pb-[max(1.5rem,var(--safe-bottom))] pt-[max(1rem,var(--safe-top))]">
      <div className="flex justify-end">
        <LanguagePills />
      </div>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-8">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo className="h-16 w-16 drop-shadow-md" />
          <p className="mt-3 text-2xl font-bold tracking-tight">{t('common.appName')}</p>
          <p className="mt-1 text-[15px] text-ink-3">{t('auth.tagline')}</p>
        </div>
        <div className="rounded-[1.75rem] border border-line/70 bg-surface p-5 shadow-card sm:p-7">
          <h1 className="text-xl font-bold">{signup ? t('auth.signupTitle') : t('auth.loginTitle')}</h1>
          <p className="mt-1 text-[15px] text-ink-3">{signup ? t('auth.signupSubtitle') : t('auth.loginSubtitle')}</p>
          <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4">
            {signup && (
              <Field label={t('auth.name')} optional={t('common.optional')} error={err('name')}>
                {(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder={t('auth.namePlaceholder')} maxLength={80} />}
              </Field>
            )}
            <Field label={t('auth.email')} error={err('email')}>
              {(p) => (
                <Input
                  {...p}
                  type="email"
                  inputMode="email"
                  autoComplete={signup ? 'email' : 'username'}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('auth.emailPlaceholder')}
                />
              )}
            </Field>
            <Field label={t('auth.password')} error={err('password')} hint={signup ? t('auth.passwordHint') : undefined}>
              {(p) => (
                <div className="relative">
                  <Input
                    {...p}
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={signup ? 'new-password' : 'current-password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-ink-3 hover:bg-surface-3"
                    aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" aria-hidden /> : <Eye className="h-5 w-5" aria-hidden />}
                  </button>
                </div>
              )}
            </Field>
            {formError && (
              <p role="alert" className="rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger">
                {formError}
              </p>
            )}
            <Button type="submit" block size="lg" loading={pending}>
              {signup ? t('auth.signupButton') : t('auth.loginButton')}
            </Button>
          </form>
        </div>
        <p className="mt-6 text-center text-[15px] text-ink-3">
          {signup ? t('auth.haveAccount') : t('auth.noAccount')}{' '}
          <Link href={signup ? '/login' : '/signup'} className="inline-block py-2 font-semibold text-brand">
            {signup ? t('auth.goToLogin') : t('auth.goToSignup')}
          </Link>
        </p>
      </main>
    </div>
  );
}
