import {
  Baby,
  BookOpen,
  Briefcase,
  Bus,
  Car,
  CircleEllipsis,
  Clapperboard,
  Coffee,
  Coins,
  Dog,
  Dumbbell,
  Fuel,
  Gamepad2,
  Gift,
  GraduationCap,
  HeartPulse,
  House,
  Landmark,
  Laptop,
  Pill,
  PiggyBank,
  Plane,
  Receipt,
  Repeat,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Ticket,
  Utensils,
  Wallet,
  Banknote,
  Vault,
  Wifi,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import type { AccountType, CategoryDTO } from '@/lib/types';
import { cn } from './cn';

const CATEGORY_ICON_MAP: Record<string, LucideIcon> = {
  house: House,
  'shopping-cart': ShoppingCart,
  car: Car,
  bus: Bus,
  fuel: Fuel,
  repeat: Repeat,
  'heart-pulse': HeartPulse,
  pill: Pill,
  'graduation-cap': GraduationCap,
  'book-open': BookOpen,
  utensils: Utensils,
  coffee: Coffee,
  ticket: Ticket,
  'shopping-bag': ShoppingBag,
  shirt: Shirt,
  plane: Plane,
  clapperboard: Clapperboard,
  'gamepad-2': Gamepad2,
  dumbbell: Dumbbell,
  baby: Baby,
  dog: Dog,
  gift: Gift,
  smartphone: Smartphone,
  zap: Zap,
  wifi: Wifi,
  wrench: Wrench,
  briefcase: Briefcase,
  laptop: Laptop,
  'piggy-bank': PiggyBank,
  coins: Coins,
  landmark: Landmark,
  receipt: Receipt,
  'circle-ellipsis': CircleEllipsis,
};

export function categoryIcon(name: string | undefined): LucideIcon {
  return (name && CATEGORY_ICON_MAP[name]) || CircleEllipsis;
}

const ACCOUNT_ICON_MAP: Record<AccountType, LucideIcon> = {
  checking: Landmark,
  savings: Vault,
  cash: Banknote,
  other: Wallet,
};

export function accountIcon(type: AccountType | undefined): LucideIcon {
  return (type && ACCOUNT_ICON_MAP[type]) || Wallet;
}

/** Hex colour → translucent background for icon badges. */
export function tint(hex: string, alpha = 0.14): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgb(${r} ${g} ${b} / ${alpha})`;
}

const SIZES = { sm: 'h-9 w-9 [&>svg]:h-[18px] [&>svg]:w-[18px]', md: 'h-11 w-11 [&>svg]:h-5 [&>svg]:w-5', lg: 'h-12 w-12 [&>svg]:h-6 [&>svg]:w-6' };

export function IconBadge({ icon: Icon, color, size = 'md', className }: { icon: LucideIcon; color: string; size?: keyof typeof SIZES; className?: string }) {
  return (
    <span className={cn('inline-flex shrink-0 items-center justify-center rounded-2xl', SIZES[size], className)} style={{ background: tint(color), color }} aria-hidden>
      <Icon strokeWidth={2.1} />
    </span>
  );
}

export function CategoryBadge({ category, size = 'md' }: { category: CategoryDTO | undefined; size?: keyof typeof SIZES }) {
  return <IconBadge icon={categoryIcon(category?.icon)} color={category?.color ?? '#898781'} size={size} />;
}
