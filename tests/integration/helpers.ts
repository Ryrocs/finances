import { and, eq, sql } from 'drizzle-orm';
import { getDb } from '@/server/db';
import { categories } from '@/server/db/schema';
import { createAccount } from '@/server/services/accounts';
import { createUser } from '@/server/services/users';

export async function resetDb() {
  await getDb().execute(sql`truncate table users, rate_limits restart identity cascade`);
}

let counter = 0;
export async function makeUser(name = 'user') {
  counter += 1;
  return createUser({ email: `${name}-${counter}-${Date.now()}@test.local`, password: 'correct horse battery', name, locale: 'ca' });
}

export async function categoryId(userId: string, key: string): Promise<string> {
  const [row] = await getDb()
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.userId, userId), eq(categories.key, key)));
  if (!row) throw new Error(`no category ${key}`);
  return row.id;
}

export async function makeAccount(userId: string, name: string, initialBalanceCents = 0, opts: { isLiquid?: boolean; date?: string } = {}) {
  return createAccount(userId, 'EUR', {
    name,
    type: 'checking',
    initialBalanceCents,
    initialBalanceDate: opts.date ?? '2026-10-01',
    isLiquid: opts.isLiquid ?? true,
  });
}
