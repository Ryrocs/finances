import { ArrowLeftRight, ChartPie, House, Settings, Target, Wallet, type LucideIcon } from 'lucide-react';
import type { MessageKey } from '@/lib/i18n/translate';

export interface NavItem {
  href: string;
  label: MessageKey;
  icon: LucideIcon;
  /** Shown in the phone tab bar (Settings lives in the header on phones). */
  mobile: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'nav.dashboard', icon: House, mobile: true },
  { href: '/movements', label: 'nav.movements', icon: ArrowLeftRight, mobile: true },
  { href: '/analytics', label: 'nav.analytics', icon: ChartPie, mobile: true },
  { href: '/net-worth', label: 'nav.netWorth', icon: Wallet, mobile: true },
  { href: '/budget', label: 'nav.budget', icon: Target, mobile: true },
  { href: '/settings', label: 'nav.settings', icon: Settings, mobile: false },
];

export function isActive(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}
