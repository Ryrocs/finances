import { timingSafeEqual } from 'node:crypto';
import { deleteExpiredSessions } from '@/server/auth/session';
import { errorResponse } from '@/server/http';
import { generateDueForAllUsers } from '@/server/services/recurring';

export const maxDuration = 60;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = Buffer.from(req.headers.get('authorization') ?? '');
  const expected = Buffer.from(`Bearer ${secret}`);
  return header.length === expected.length && timingSafeEqual(header, expected);
}

/** Called daily by Vercel Cron (see vercel.json). Idempotent. */
export async function GET(req: Request) {
  if (!authorized(req)) return Response.json({ error: { code: 'unauthorized' } }, { status: 401 });
  try {
    const result = await generateDueForAllUsers();
    await deleteExpiredSessions();
    return Response.json({ ok: true, ...result });
  } catch (error) {
    return errorResponse(error);
  }
}
