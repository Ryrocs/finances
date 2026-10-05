'use client';

import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { api, qs } from '@/lib/api-client';
import type {
  AccountDTO,
  BudgetAlert,
  AnalyticsDTO,
  BudgetDTO,
  BudgetOverviewDTO,
  CategoryDTO,
  MeDTO,
  MonthSummaryDTO,
  NetWorthDTO,
  NetWorthPeriod,
  RecurringDTO,
  TransactionDTO,
  TransactionListDTO,
} from '@/lib/types';

export const qk = {
  me: ['me'] as const,
  accounts: ['accounts'] as const,
  categories: ['categories'] as const,
  summary: (month: string) => ['summary', month] as const,
  transactions: (filters: object) => ['transactions', filters] as const,
  budgets: (month: string) => ['budgets', month] as const,
  netWorth: (period: NetWorthPeriod) => ['net-worth', period] as const,
  analytics: (from: string, to: string) => ['analytics', from, to] as const,
  recurring: ['recurring'] as const,
};

/** Any change to money data can affect every report, so refresh everything except profile & categories. */
export function invalidateFinancial(client: QueryClient) {
  return client.invalidateQueries({ predicate: (q) => !['me', 'categories'].includes(q.queryKey[0] as string) });
}

// ---------- Queries ----------

export function useMe() {
  return useQuery({ queryKey: qk.me, queryFn: () => api<{ user: MeDTO }>('/api/me').then((r) => r.user) });
}

export function useAccounts() {
  return useQuery({ queryKey: qk.accounts, queryFn: () => api<{ accounts: AccountDTO[] }>('/api/accounts').then((r) => r.accounts) });
}

export function useCategories() {
  return useQuery({
    queryKey: qk.categories,
    queryFn: () => api<{ categories: CategoryDTO[] }>('/api/categories').then((r) => r.categories),
    staleTime: 5 * 60_000,
  });
}

export function useSummary(month: string) {
  return useQuery({
    queryKey: qk.summary(month),
    queryFn: () => api<{ summary: MonthSummaryDTO }>(`/api/summary${qs({ month })}`).then((r) => r.summary),
    placeholderData: keepPreviousData,
  });
}

export interface MovementFilters {
  month?: string;
  type?: string;
  accountId?: string;
  categoryId?: string;
  q?: string;
  cats?: string[];
}

export function useTransactions(filters: MovementFilters) {
  return useInfiniteQuery({
    queryKey: qk.transactions(filters),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) =>
      api<TransactionListDTO>(`/api/transactions${qs({ ...filters, cursor: pageParam, limit: 50 })}`, { signal }),
    getNextPageParam: (last) => last.nextCursor,
    placeholderData: keepPreviousData,
  });
}

export function useBudgets(month: string) {
  return useQuery({
    queryKey: qk.budgets(month),
    queryFn: () => api<{ budgets: BudgetDTO[]; overview: BudgetOverviewDTO }>(`/api/budgets${qs({ month })}`),
    placeholderData: keepPreviousData,
  });
}

export function useNetWorth(period: NetWorthPeriod) {
  return useQuery({
    queryKey: qk.netWorth(period),
    queryFn: () => api<{ netWorth: NetWorthDTO }>(`/api/net-worth${qs({ period })}`).then((r) => r.netWorth),
    placeholderData: keepPreviousData,
  });
}

export function useAnalytics(from: string, to: string) {
  return useQuery({
    queryKey: qk.analytics(from, to),
    queryFn: () => api<{ analytics: AnalyticsDTO }>(`/api/analytics${qs({ from, to })}`).then((r) => r.analytics),
    placeholderData: keepPreviousData,
  });
}

export function useRecurring() {
  return useQuery({ queryKey: qk.recurring, queryFn: () => api<{ recurring: RecurringDTO[] }>('/api/recurring').then((r) => r.recurring) });
}

// ---------- Mutations ----------

export type TransactionPayload =
  | { type: 'expense' | 'income'; amountCents: number; date: string; accountId: string; categoryId: string; description: string; notes: string | null }
  | { type: 'transfer'; amountCents: number; date: string; accountId: string; toAccountId: string; description: string; notes: string | null };

export interface SaveTransactionResult {
  transaction: TransactionDTO;
  budgetAlerts: BudgetAlert[];
}

export function useSaveTransaction() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id?: string; payload: TransactionPayload }) =>
      id
        ? api<SaveTransactionResult>(`/api/transactions/${id}`, { method: 'PUT', body: payload })
        : api<SaveTransactionResult>('/api/transactions', { method: 'POST', body: payload }),
    onSuccess: () => invalidateFinancial(client),
  });
}

export function useDeleteTransaction() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/api/transactions/${id}`, { method: 'DELETE' }),
    onSuccess: () => invalidateFinancial(client),
  });
}

export interface AccountPayload {
  name: string;
  type: string;
  initialBalanceCents: number;
  initialBalanceDate: string;
  isLiquid: boolean;
  color?: string;
  archived?: boolean;
}

export function useSaveAccount() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id?: string; payload: Partial<AccountPayload> }) =>
      id
        ? api<{ account: AccountDTO }>(`/api/accounts/${id}`, { method: 'PATCH', body: payload })
        : api<{ account: AccountDTO }>('/api/accounts', { method: 'POST', body: payload }),
    onSuccess: () => invalidateFinancial(client),
  });
}

export function useDeleteAccount() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/api/accounts/${id}`, { method: 'DELETE' }),
    onSuccess: () => invalidateFinancial(client),
  });
}

export interface CategoryPayload {
  name: string;
  kind?: string;
  group: string;
  icon: string;
  color: string;
}

export function useSaveCategory() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id?: string; payload: Partial<CategoryPayload> & { archived?: false } }) =>
      id
        ? api<{ category: CategoryDTO }>(`/api/categories/${id}`, { method: 'PATCH', body: payload })
        : api<{ category: CategoryDTO }>('/api/categories', { method: 'POST', body: payload }),
    onSuccess: () => client.invalidateQueries(),
  });
}

export function useDeleteCategory() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<{ archived: boolean }>(`/api/categories/${id}`, { method: 'DELETE' }),
    onSuccess: () => client.invalidateQueries(),
  });
}

export function useSaveBudget() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (payload: { categoryId: string | null; amountCents: number }) =>
      api<{ budget: BudgetDTO }>('/api/budgets', { method: 'PUT', body: payload }),
    onSuccess: () => invalidateFinancial(client),
  });
}

export function useDeleteBudget() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/api/budgets/${id}`, { method: 'DELETE' }),
    onSuccess: () => invalidateFinancial(client),
  });
}

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

export type RecurringPayload = DistributiveOmit<TransactionPayload, 'date'> & {
  frequency: string;
  interval: number;
  startDate: string;
  endDate: string | null;
  isActive: boolean;
};

export function useSaveRecurring() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id?: string; payload: RecurringPayload }) =>
      id
        ? api<{ recurring: RecurringDTO }>(`/api/recurring/${id}`, { method: 'PUT', body: payload })
        : api<{ recurring: RecurringDTO }>('/api/recurring', { method: 'POST', body: payload }),
    onSuccess: () => invalidateFinancial(client),
  });
}

export function useDeleteRecurring() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/api/recurring/${id}`, { method: 'DELETE' }),
    onSuccess: () => invalidateFinancial(client),
  });
}

export function useDemoData() {
  const client = useQueryClient();
  const load = useMutation({
    mutationFn: () => api<{ created: number }>('/api/demo', { method: 'POST' }),
    onSuccess: () => client.invalidateQueries(),
  });
  const remove = useMutation({
    mutationFn: () => api<{ removedAccounts: number; keptAccounts: number }>('/api/demo', { method: 'DELETE' }),
    onSuccess: () => client.invalidateQueries(),
  });
  return { load, remove };
}

export function useUpdateProfile() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<Pick<MeDTO, 'name' | 'locale' | 'currency' | 'timezone'>>) =>
      api<{ user: MeDTO }>('/api/me', { method: 'PATCH', body: patch }),
    onSuccess: (data, patch) => {
      client.setQueryData(qk.me, data.user);
      if (patch.currency) client.invalidateQueries();
    },
  });
}
