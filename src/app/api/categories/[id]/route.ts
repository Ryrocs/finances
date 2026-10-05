import { z } from 'zod';
import { categoryUpdateSchema } from '@/lib/validation';
import { authed, notFound, readJson } from '@/server/http';
import { deleteCategory, restoreCategory, updateCategory } from '@/server/services/categories';

const idSchema = z.uuid();
const patchSchema = categoryUpdateSchema.extend({ archived: z.literal(false).optional() });

export const PATCH = authed<{ id: string }>(async ({ req, user, params }) => {
  if (!idSchema.safeParse(params.id).success) throw notFound();
  const { archived, ...input } = await readJson(req, patchSchema);
  if (archived === false) await restoreCategory(user.id, params.id);
  return { category: await updateCategory(user.id, params.id, input) };
});

/** Archives the category when it is in use (history keeps its label), deletes it otherwise. */
export const DELETE = authed<{ id: string }>(async ({ user, params }) => {
  if (!idSchema.safeParse(params.id).success) throw notFound();
  return deleteCategory(user.id, params.id);
});
