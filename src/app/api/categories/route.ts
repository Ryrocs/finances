import { categorySchema } from '@/lib/validation';
import { authed, readJson } from '@/server/http';
import { createCategory, listCategories } from '@/server/services/categories';

export const GET = authed(async ({ user }) => ({ categories: await listCategories(user.id) }));

export const POST = authed(async ({ req, user }) => {
  const input = await readJson(req, categorySchema);
  return Response.json({ category: await createCategory(user.id, input) }, { status: 201 });
});
