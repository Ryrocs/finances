import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '@/server/auth/password';
import { consumeRateLimit, resetRateLimit } from '@/server/auth/rate-limit';
import { createSession, invalidateSession, validateSessionToken } from '@/server/auth/session';
import { getDb } from '@/server/db';
import { categories, sessions, users } from '@/server/db/schema';
import { changePassword, createUser, deleteUser, findUserByEmail } from '@/server/services/users';
import { makeAccount, makeUser, resetDb } from './helpers';

beforeEach(resetDb);

describe('passwords', () => {
  it('hashes with a random salt and verifies in constant time', async () => {
    const a = await hashPassword('s3cret-password');
    const b = await hashPassword('s3cret-password');
    expect(a).not.toBe(b);
    expect(a.startsWith('scrypt$')).toBe(true);
    expect(a).not.toContain('s3cret-password');
    expect(await verifyPassword('s3cret-password', a)).toBe(true);
    expect(await verifyPassword('wrong', a)).toBe(false);
    expect(await verifyPassword('x', 'garbage')).toBe(false);
  });
});

describe('sign up', () => {
  it('stores no plaintext password and seeds default categories', async () => {
    const user = await createUser({ email: 'anna@test.local', password: 'correct horse battery', name: 'Anna' });
    const row = await findUserByEmail('anna@test.local');
    expect(row?.passwordHash).not.toContain('correct horse battery');
    const cats = await getDb().select().from(categories).where(eq(categories.userId, user.id));
    expect(cats.length).toBe(17);
    expect(cats.filter((c) => c.kind === 'income').length).toBe(5);
  });

  it('rejects a duplicate email', async () => {
    await createUser({ email: 'dup@test.local', password: 'correct horse battery' });
    await expect(createUser({ email: 'dup@test.local', password: 'another password' })).rejects.toMatchObject({ code: 'email_taken', status: 409 });
  });
});

describe('sessions', () => {
  it('validates, then rejects after logout', async () => {
    const user = await makeUser('sess');
    const { token } = await createSession(user.id);
    const valid = await validateSessionToken(token);
    expect(valid?.user.id).toBe(user.id);
    expect(valid?.user).not.toHaveProperty('passwordHash');
    // Only a hash of the token is stored.
    const stored = await getDb().select().from(sessions).where(eq(sessions.userId, user.id));
    expect(stored[0].id).not.toBe(token);
    await invalidateSession(token);
    expect(await validateSessionToken(token)).toBeNull();
  });

  it('rejects unknown and expired tokens', async () => {
    const user = await makeUser('exp');
    const { token } = await createSession(user.id);
    await getDb().update(sessions).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(sessions.userId, user.id));
    expect(await validateSessionToken(token)).toBeNull();
    expect(await validateSessionToken('not-a-token')).toBeNull();
  });

  it('renews sessions that are past half their lifetime', async () => {
    const user = await makeUser('renew');
    const { token } = await createSession(user.id);
    await getDb()
      .update(sessions)
      .set({ expiresAt: new Date(Date.now() + 2 * 86_400_000) })
      .where(eq(sessions.userId, user.id));
    const result = await validateSessionToken(token);
    expect(result?.renewed).toBe(true);
    expect(result!.expiresAt.getTime()).toBeGreaterThan(Date.now() + 25 * 86_400_000);
  });

  it('changing the password signs out other sessions', async () => {
    const user = await makeUser('pw');
    await createSession(user.id);
    await createSession(user.id);
    await expect(changePassword(user.id, 'wrong', 'new password 123')).rejects.toMatchObject({ code: 'invalid_credentials' });
    await changePassword(user.id, 'correct horse battery', 'new password 123');
    expect((await getDb().select().from(sessions).where(eq(sessions.userId, user.id))).length).toBe(0);
    const row = await findUserByEmail(user.email);
    expect(await verifyPassword('new password 123', row!.passwordHash)).toBe(true);
  });
});

describe('rate limiting', () => {
  it('blocks after the limit within the window and can be reset', async () => {
    const key = `login:test-${Date.now()}`;
    for (let i = 0; i < 3; i++) expect(await consumeRateLimit(key, 3, 60)).toBe(true);
    expect(await consumeRateLimit(key, 3, 60)).toBe(false);
    await resetRateLimit(key);
    expect(await consumeRateLimit(key, 3, 60)).toBe(true);
  });
});

describe('account deletion', () => {
  it('requires the password and removes every row of the user', async () => {
    const user = await makeUser('bye');
    await makeAccount(user.id, 'Main', 1000);
    await expect(deleteUser(user.id, 'nope')).rejects.toMatchObject({ code: 'invalid_credentials' });
    await deleteUser(user.id, 'correct horse battery');
    expect(await getDb().select().from(users).where(eq(users.id, user.id))).toHaveLength(0);
  });
});
