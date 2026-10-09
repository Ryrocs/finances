import type { Category, CategoryGroup, CategoryKind } from '../lib/types';

interface SeedCategory {
  id: string;
  name: string;
  emoji: string;
  color: string;
  kind: CategoryKind;
  group?: CategoryGroup;
}

/** Stable ids of the categories the app relies on. */
export const CATEGORY_IDS = {
  otherExpense: 'cat_altres',
  otherIncome: 'cat_altres_ingressos',
  interest: 'cat_interessos',
} as const;

export const DEFAULT_CATEGORIES: SeedCategory[] = [
  { id: 'cat_habitatge', name: 'Habitatge', emoji: '🏠', color: '#2A78D6', kind: 'expense', group: 'necessitats' },
  { id: 'cat_alimentacio', name: 'Alimentació', emoji: '🛒', color: '#EB6834', kind: 'expense', group: 'necessitats' },
  { id: 'cat_transport', name: 'Transport', emoji: '🚇', color: '#EDA100', kind: 'expense', group: 'necessitats' },
  { id: 'cat_subscripcions', name: 'Subscripcions', emoji: '📱', color: '#4A3AA7', kind: 'expense', group: 'necessitats' },
  { id: 'cat_salut', name: 'Salut', emoji: '💊', color: '#0EA5E9', kind: 'expense', group: 'necessitats' },
  { id: 'cat_estudis', name: 'Estudis', emoji: '📚', color: '#8B5CF6', kind: 'expense', group: 'necessitats' },
  { id: 'cat_restauracio', name: 'Restauració', emoji: '🍔', color: '#1BAF7A', kind: 'expense', group: 'oci' },
  { id: 'cat_oci', name: 'Oci', emoji: '🎉', color: '#008300', kind: 'expense', group: 'oci' },
  { id: 'cat_compres', name: 'Compres', emoji: '🛍️', color: '#E87BA4', kind: 'expense', group: 'oci' },
  { id: 'cat_viatges', name: 'Viatges', emoji: '✈️', color: '#E34948', kind: 'expense', group: 'oci' },
  { id: 'cat_entreteniment', name: 'Entreteniment', emoji: '🎮', color: '#A16207', kind: 'expense', group: 'oci' },
  { id: CATEGORY_IDS.otherExpense, name: 'Altres', emoji: '🏷️', color: '#94A3B8', kind: 'expense', group: 'altres' },
  { id: 'cat_feina', name: 'Feina', emoji: '💼', color: '#10B981', kind: 'income' },
  { id: 'cat_pensio', name: 'Pensió', emoji: '👴', color: '#0EA5E9', kind: 'income' },
  { id: 'cat_ajuda_familiar', name: 'Ajuda familiar', emoji: '👪', color: '#F59E0B', kind: 'income' },
  { id: CATEGORY_IDS.interest, name: 'Interessos', emoji: '📈', color: '#6366F1', kind: 'income' },
  { id: CATEGORY_IDS.otherIncome, name: 'Altres ingressos', emoji: '💰', color: '#94A3B8', kind: 'income' },
];

export function defaultCategories(now = Date.now()): Category[] {
  return DEFAULT_CATEGORIES.map((c, index) => ({ ...c, order: index, createdAt: now }));
}

/**
 * Palette offered for accounts and categories. The first eight follow a colour-blind-checked
 * categorical order (adjacent hues stay distinguishable in charts).
 */
export const PALETTE = [
  '#2A78D6',
  '#EB6834',
  '#1BAF7A',
  '#EDA100',
  '#E87BA4',
  '#008300',
  '#4A3AA7',
  '#E34948',
  '#0EA5E9',
  '#8B5CF6',
  '#A16207',
  '#64748B',
];
