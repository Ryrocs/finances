import type { CategoryGroup, CategoryKind } from './types';

export interface DefaultCategory {
  key: string;
  kind: CategoryKind;
  group: CategoryGroup;
  icon: string;
  color: string;
}

/**
 * Built-in categories created for every new user. Their labels are translated in the UI
 * (`categories.<key>`), so they follow the selected language until the user renames them.
 */
export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  // Needs
  { key: 'housing', kind: 'expense', group: 'needs', icon: 'house', color: '#2a78d6' },
  { key: 'food', kind: 'expense', group: 'needs', icon: 'shopping-cart', color: '#1baf7a' },
  { key: 'transport', kind: 'expense', group: 'needs', icon: 'car', color: '#eda100' },
  { key: 'subscriptions', kind: 'expense', group: 'needs', icon: 'repeat', color: '#4a3aa7' },
  { key: 'health', kind: 'expense', group: 'needs', icon: 'heart-pulse', color: '#e34948' },
  { key: 'education', kind: 'expense', group: 'needs', icon: 'graduation-cap', color: '#008300' },
  // Lifestyle
  { key: 'restaurants', kind: 'expense', group: 'lifestyle', icon: 'utensils', color: '#eb6834' },
  { key: 'leisure', kind: 'expense', group: 'lifestyle', icon: 'ticket', color: '#e87ba4' },
  { key: 'shopping', kind: 'expense', group: 'lifestyle', icon: 'shopping-bag', color: '#9085e9' },
  { key: 'travel', kind: 'expense', group: 'lifestyle', icon: 'plane', color: '#0891b2' },
  { key: 'entertainment', kind: 'expense', group: 'lifestyle', icon: 'clapperboard', color: '#c026d3' },
  // Other
  { key: 'other', kind: 'expense', group: 'other', icon: 'circle-ellipsis', color: '#898781' },
  // Income
  { key: 'salary', kind: 'income', group: 'income', icon: 'briefcase', color: '#15803d' },
  { key: 'freelance', kind: 'income', group: 'income', icon: 'laptop', color: '#1baf7a' },
  { key: 'interest', kind: 'income', group: 'income', icon: 'piggy-bank', color: '#2a78d6' },
  { key: 'gifts', kind: 'income', group: 'income', icon: 'gift', color: '#e87ba4' },
  { key: 'other_income', kind: 'income', group: 'income', icon: 'coins', color: '#898781' },
];

/** Icons the user can pick for custom categories (lucide names). */
export const CATEGORY_ICONS = [
  'house',
  'shopping-cart',
  'car',
  'bus',
  'fuel',
  'repeat',
  'heart-pulse',
  'pill',
  'graduation-cap',
  'book-open',
  'utensils',
  'coffee',
  'ticket',
  'shopping-bag',
  'shirt',
  'plane',
  'clapperboard',
  'gamepad-2',
  'dumbbell',
  'baby',
  'dog',
  'gift',
  'smartphone',
  'zap',
  'wifi',
  'wrench',
  'briefcase',
  'laptop',
  'piggy-bank',
  'coins',
  'landmark',
  'receipt',
  'circle-ellipsis',
] as const;

export const CATEGORY_COLORS = [
  '#2a78d6',
  '#1baf7a',
  '#eda100',
  '#4a3aa7',
  '#e34948',
  '#008300',
  '#eb6834',
  '#e87ba4',
  '#9085e9',
  '#0891b2',
  '#c026d3',
  '#898781',
] as const;

export const ACCOUNT_COLORS = ['#2a78d6', '#1baf7a', '#eda100', '#4a3aa7', '#eb6834', '#e87ba4', '#0891b2', '#52514e'] as const;

export const EXPENSE_GROUPS = ['needs', 'lifestyle', 'other'] as const;
