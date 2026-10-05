import 'server-only';
import { and, asc, eq, sql } from 'drizzle-orm';
import { DEFAULT_CATEGORIES } from '@/lib/categories';
import type { CategoryDTO, CategoryGroup, CategoryKind } from '@/lib/types';
import type { categorySchema, categoryUpdateSchema } from '@/lib/validation';
import type { z } from 'zod';
import { getDb, type Database } from '../db';
import { budgets, categories, recurringTransactions, transactions, type CategoryRow } from '../db/schema';
import { notFound, validationError } from '../http';

type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

export function toCategoryDTO(row: CategoryRow): CategoryDTO {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    kind: row.kind as CategoryKind,
    group: row.group as CategoryGroup,
    icon: row.icon,
    color: row.color,
    sortOrder: row.sortOrder,
    archived: row.archivedAt !== null,
  };
}

export async function seedDefaultCategories(tx: Tx | Database, userId: string): Promise<void> {
  await tx
    .insert(categories)
    .values(DEFAULT_CATEGORIES.map((c, i) => ({ userId, key: c.key, kind: c.kind, group: c.group, icon: c.icon, color: c.color, sortOrder: i })))
    .onConflictDoNothing();
}

export async function listCategories(userId: string): Promise<CategoryDTO[]> {
  const rows = await getDb()
    .select()
    .from(categories)
    .where(eq(categories.userId, userId))
    .orderBy(asc(categories.sortOrder), asc(categories.createdAt));
  return rows.map(toCategoryDTO);
}

export async function getCategory(userId: string, id: string): Promise<CategoryRow> {
  const [row] = await getDb()
    .select()
    .from(categories)
    .where(and(eq(categories.id, id), eq(categories.userId, userId)))
    .limit(1);
  if (!row) throw notFound();
  return row;
}

function assertGroupMatchesKind(kind: CategoryKind, group: CategoryGroup) {
  const ok = kind === 'income' ? group === 'income' : group !== 'income';
  if (!ok) throw validationError({ group: 'invalid' });
}

export async function createCategory(userId: string, input: z.output<typeof categorySchema>): Promise<CategoryDTO> {
  assertGroupMatchesKind(input.kind, input.group);
  const db = getDb();
  const [{ max }] = await db
    .select({ max: sql<number>`coalesce(max(${categories.sortOrder}), 0)` })
    .from(categories)
    .where(eq(categories.userId, userId));
  const [row] = await db
    .insert(categories)
    .values({ userId, name: input.name, kind: input.kind, group: input.group, icon: input.icon, color: input.color, sortOrder: Number(max) + 1 })
    .returning();
  return toCategoryDTO(row);
}

export async function updateCategory(userId: string, id: string, input: z.output<typeof categoryUpdateSchema>): Promise<CategoryDTO> {
  const current = await getCategory(userId, id);
  if (input.group) assertGroupMatchesKind(current.kind as CategoryKind, input.group);
  const [row] = await getDb()
    .update(categories)
    .set({ ...input, updatedAt: new Date() })
    .where(and(eq(categories.id, id), eq(categories.userId, userId)))
    .returning();
  return toCategoryDTO(row);
}

/**
 * Deleting a category that is used by movements or recurring rules archives it instead, so
 * history keeps its label and icon. Its budget is removed. Unused categories are deleted.
 */
export async function deleteCategory(userId: string, id: string): Promise<{ archived: boolean }> {
  await getCategory(userId, id);
  return getDb().transaction(async (tx) => {
    const result = await tx.execute<{ used: boolean }>(sql`
      select exists (select 1 from ${transactions} where ${transactions.userId} = ${userId} and ${transactions.categoryId} = ${id})
          or exists (select 1 from ${recurringTransactions} where ${recurringTransactions.userId} = ${userId} and ${recurringTransactions.categoryId} = ${id})
        as used`);
    const used = Boolean(result.rows[0]?.used);
    await tx.delete(budgets).where(and(eq(budgets.userId, userId), eq(budgets.categoryId, id)));
    if (used) {
      await tx
        .update(categories)
        .set({ archivedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(categories.id, id), eq(categories.userId, userId)));
      return { archived: true };
    }
    await tx.delete(categories).where(and(eq(categories.id, id), eq(categories.userId, userId)));
    return { archived: false };
  });
}

export async function restoreCategory(userId: string, id: string): Promise<CategoryDTO> {
  await getCategory(userId, id);
  const [row] = await getDb()
    .update(categories)
    .set({ archivedAt: null, updatedAt: new Date() })
    .where(and(eq(categories.id, id), eq(categories.userId, userId)))
    .returning();
  return toCategoryDTO(row);
}

/** Built-in category ids by key (used by demo data). */
export async function findCategoryIdsByKey(userId: string): Promise<Map<string, string>> {
  const rows = await getDb()
    .select({ id: categories.id, key: categories.key })
    .from(categories)
    .where(eq(categories.userId, userId));
  const map = new Map<string, string>();
  for (const r of rows) if (r.key) map.set(r.key, r.id);
  return map;
}
