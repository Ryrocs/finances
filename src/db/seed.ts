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
  { id: 'cat_habitatge', name: 'Habitatge', emoji: '🏠', color: '#6366F1', kind: 'expense', group: 'necessitats' },
  { id: 'cat_alimentacio', name: 'Alimentació', emoji: '🛒', color: '#22C55E', kind: 'expense', group: 'necessitats' },
  { id: 'cat_transport', name: 'Transport', emoji: '🚇', color: '#0EA5E9', kind: 'expense', group: 'necessitats' },
  { id: 'cat_subscripcions', name: 'Subscripcions', emoji: '📱', color: '#8B5CF6', kind: 'expense', group: 'necessitats' },
  { id: 'cat_salut', name: 'Salut', emoji: '💊', color: '#EC4899', kind: 'expense', group: 'necessitats' },
  { id: 'cat_estudis', name: 'Estudis', emoji: '📚', color: '#14B8A6', kind: 'expense', group: 'necessitats' },
  { id: 'cat_restauracio', name: 'Restauració', emoji: '🍔', color: '#F97316', kind: 'expense', group: 'oci' },
  { id: 'cat_oci', name: 'Oci', emoji: '🎉', color: '#F59E0B', kind: 'expense', group: 'oci' },
  { id: 'cat_compres', name: 'Compres', emoji: '🛍️', color: '#F43F5E', kind: 'expense', group: 'oci' },
  { id: 'cat_viatges', name: 'Viatges', emoji: '✈️', color: '#06B6D4', kind: 'expense', group: 'oci' },
  { id: 'cat_entreteniment', name: 'Entreteniment', emoji: '🎮', color: '#A855F7', kind: 'expense', group: 'oci' },
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

/** Palette offered for accounts and categories. */
export const PALETTE = [
  '#6366F1',
  '#10B981',
  '#F59E0B',
  '#0EA5E9',
  '#F43F5E',
  '#8B5CF6',
  '#14B8A6',
  '#F97316',
  '#EC4899',
  '#22C55E',
  '#06B6D4',
  '#64748B',
];
