'use client';

import { useMemo } from 'react';
import { useI18n } from '@/components/providers/I18nProvider';
import { formatDate, formatMonth, formatPercent, relativeDay, type DateStyle, type MonthStyle } from '@/lib/format';
import { localToday } from '@/lib/dates';
import { formatMoney, type FormatMoneyOptions } from '@/lib/money';
import type { AccountDTO, CategoryDTO } from '@/lib/types';
import { useAccounts, useCategories, useMe } from './api';

/** Formatting bound to the current language and the user's currency. */
export function useFormat() {
  const { intlLocale, t } = useI18n();
  const { data: me } = useMe();
  const currency = me?.currency ?? 'EUR';
  const today = me?.today ?? localToday();
  return useMemo(
    () => ({
      today,
      currency,
      money: (cents: number, opts?: FormatMoneyOptions) => formatMoney(cents, intlLocale, currency, opts),
      date: (iso: string, style?: DateStyle) => formatDate(iso, intlLocale, style),
      month: (month: string, style?: MonthStyle) => formatMonth(month, intlLocale, style),
      percent: (value: number, opts?: { signed?: boolean; digits?: number }) => formatPercent(value, intlLocale, opts),
      day: (iso: string) => relativeDay(iso, today, intlLocale, { today: t('common.today'), yesterday: t('common.yesterday') }),
    }),
    [intlLocale, currency, today, t],
  );
}

/** Lookups for categories/accounts by id with translated labels. */
export function useLookups() {
  const { t, tDynamic } = useI18n();
  const { data: categories = [] } = useCategories();
  const { data: accounts = [] } = useAccounts();
  return useMemo(() => {
    const catById = new Map(categories.map((c) => [c.id, c]));
    const accById = new Map(accounts.map((a) => [a.id, a]));
    const categoryLabel = (c: CategoryDTO | undefined | null) =>
      !c ? t('categories.uncategorized') : c.name || (c.key ? tDynamic(`categories.${c.key}`, c.key) : t('categories.uncategorized'));
    return {
      categories,
      accounts,
      category: (id: string | null | undefined) => (id ? catById.get(id) : undefined),
      account: (id: string | null | undefined): AccountDTO | undefined => (id ? accById.get(id) : undefined),
      categoryLabel,
      categoryLabelById: (id: string | null | undefined) => categoryLabel(id ? catById.get(id) : undefined),
      accountName: (id: string | null | undefined) => (id ? (accById.get(id)?.name ?? '—') : '—'),
    };
  }, [categories, accounts, t, tDynamic]);
}
