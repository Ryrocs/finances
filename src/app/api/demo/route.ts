import type { Locale } from '@/lib/types';
import { authed } from '@/server/http';
import { loadDemoData, removeDemoData } from '@/server/services/demo';
import { userToday } from '@/server/services/users';

export const POST = authed(async ({ user }) => loadDemoData(user.id, user.locale as Locale, user.currency, userToday(user)));

/** Removes only rows flagged as demo; real data is never touched. */
export const DELETE = authed(async ({ user }) => removeDemoData(user.id));
