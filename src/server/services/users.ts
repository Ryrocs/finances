import 'server-only';
import { and, eq, ne, sql } from 'drizzle-orm';
import { isValidTimeZone, todayInTimeZone } from '@/lib/dates';
import type { Currency, Locale, MeDTO } from '@/lib/types';
import type { profileSchema } from '@/lib/validation';
import type { z } from 'zod';
import { hashPassword, verifyPassword } from '../auth/password';
import type { SessionUser } from '../auth/session';
import { getDb } from '../db';
import { accounts, sessions, users } from '../db/schema';
import { ApiError, validationError } from '../http';
import { seedDefaultCategories } from './categories';
import { hasDemoData } from './demo';

export function userToday(user: Pick<SessionUser, 'timezone'>): string {
  return todayInTimeZone(user.timezone);
}

export async function createUser(input: {
  email: string;
  password: string;
  name?: string;
  locale?: Locale;
  timezone?: string;
}): Promise<SessionUser> {
  const db = getDb();
  const passwordHash = await hashPassword(input.password);
  const timezone = input.timezone && isValidTimeZone(input.timezone) ? input.timezone : 'Europe/Madrid';
  try {
    return await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(users)
        .values({ email: input.email, passwordHash, name: input.name ?? '', locale: input.locale ?? 'ca', timezone })
        .returning();
      await seedDefaultCategories(tx, row.id);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { passwordHash: _hash, ...user } = row;
      return user;
    });
  } catch (error) {
    const code = (error as { code?: string; cause?: { code?: string } }).code ?? (error as { cause?: { code?: string } }).cause?.code;
    if (code === '23505') throw new ApiError(409, 'email_taken', { email: 'email_taken' });
    throw error;
  }
}

export async function findUserByEmail(email: string) {
  const [row] = await getDb().select().from(users).where(eq(users.email, email)).limit(1);
  return row ?? null;
}

export async function getMe(user: SessionUser): Promise<MeDTO> {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    locale: user.locale as Locale,
    currency: user.currency as Currency,
    timezone: user.timezone,
    today: userToday(user),
    hasDemoData: await hasDemoData(user.id),
  };
}

export async function updateProfile(user: SessionUser, patch: z.output<typeof profileSchema>): Promise<SessionUser> {
  if (patch.timezone !== undefined && !isValidTimeZone(patch.timezone)) throw validationError({ timezone: 'invalid' });
  const db = getDb();
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(users)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(users.id, user.id))
      .returning();
    // Single-currency ledger: accounts always use the user's currency (no FX conversion).
    if (patch.currency && patch.currency !== user.currency) {
      await tx.update(accounts).set({ currency: patch.currency }).where(eq(accounts.userId, user.id));
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...rest } = row;
    return rest;
  });
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string, keepSessionHash?: string) {
  const db = getDb();
  const [row] = await db.select({ hash: users.passwordHash }).from(users).where(eq(users.id, userId)).limit(1);
  if (!row || !(await verifyPassword(currentPassword, row.hash))) {
    throw new ApiError(400, 'invalid_credentials', { currentPassword: 'wrong_password' });
  }
  const passwordHash = await hashPassword(newPassword);
  await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, userId));
  // Sign out every other device.
  await db
    .delete(sessions)
    .where(keepSessionHash ? and(eq(sessions.userId, userId), ne(sessions.id, keepSessionHash)) : eq(sessions.userId, userId));
}

export async function deleteUser(userId: string, password: string): Promise<void> {
  const db = getDb();
  const [row] = await db.select({ hash: users.passwordHash }).from(users).where(eq(users.id, userId)).limit(1);
  if (!row || !(await verifyPassword(password, row.hash))) {
    throw new ApiError(400, 'invalid_credentials', { password: 'wrong_password' });
  }
  // Every financial table cascades from users.
  await db.delete(users).where(eq(users.id, userId));
}

export async function countUsers(): Promise<number> {
  const [{ n }] = await getDb().select({ n: sql<number>`count(*)` }).from(users);
  return Number(n);
}
