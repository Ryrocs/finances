import { expect, request, test, type APIRequestContext } from '@playwright/test';

/** HTTP-level checks of the deployed API: authentication, CSRF/origin, isolation, cron secret. */

async function newUser(baseURL: string, name: string): Promise<APIRequestContext> {
  const ctx = await request.newContext({ baseURL, extraHTTPHeaders: { Origin: baseURL } });
  const res = await ctx.post('/api/auth/signup', { data: { name, email: `${name}-${Date.now()}@test.local`, password: 'correct horse battery' } });
  expect(res.status()).toBe(201);
  return ctx;
}

test('API requires a session', async ({ baseURL }) => {
  const anon = await request.newContext({ baseURL });
  for (const path of ['/api/accounts', '/api/transactions', '/api/summary', '/api/net-worth', '/api/budgets', '/api/me', '/api/export']) {
    const res = await anon.get(path);
    expect(res.status(), path).toBe(401);
    expect(res.headers()['cache-control']).toContain('no-store');
  }
  expect((await anon.get('/api/health')).status()).toBe(200);
});

test('cross-origin writes are rejected', async ({ baseURL }) => {
  const user = await newUser(baseURL!, 'csrf');
  const res = await user.post('/api/accounts', {
    headers: { Origin: 'https://evil.example' },
    data: { name: 'x', type: 'checking', initialBalanceCents: 0, initialBalanceDate: '2026-10-01', isLiquid: true },
  });
  expect(res.status()).toBe(403);
});

test('users cannot read or change each other’s data over HTTP', async ({ baseURL }) => {
  const alice = await newUser(baseURL!, 'alice');
  const bob = await newUser(baseURL!, 'bob');
  const acc = await (await alice.post('/api/accounts', { data: { name: 'Alice', type: 'checking', initialBalanceCents: 100_000, initialBalanceDate: '2026-01-01', isLiquid: true } })).json();
  const cats = await (await alice.get('/api/categories')).json();
  const food = cats.categories.find((c: { key: string }) => c.key === 'food').id;
  const tx = await (
    await alice.post('/api/transactions', { data: { type: 'expense', amountCents: 1234, date: '2026-01-02', accountId: acc.account.id, categoryId: food } })
  ).json();

  expect((await bob.get(`/api/transactions/${tx.transaction.id}`)).status()).toBe(404);
  expect((await bob.delete(`/api/transactions/${tx.transaction.id}`)).status()).toBe(404);
  expect((await bob.patch(`/api/accounts/${acc.account.id}`, { data: { name: 'pwned' } })).status()).toBe(404);
  expect((await bob.delete(`/api/accounts/${acc.account.id}`)).status()).toBe(404);
  const bobCats = await (await bob.get('/api/categories')).json();
  const bobFood = bobCats.categories.find((c: { key: string }) => c.key === 'food').id;
  const sneaky = await bob.post('/api/transactions', { data: { type: 'expense', amountCents: 1, date: '2026-01-02', accountId: acc.account.id, categoryId: bobFood } });
  expect(sneaky.status()).toBe(400);
  expect((await (await bob.get('/api/accounts')).json()).accounts).toEqual([]);
  // A user id in the request is ignored — the session decides.
  const list = await (await bob.get(`/api/transactions?userId=${encodeURIComponent('x')}`)).json();
  expect(list.items).toEqual([]);

  const still = await (await alice.get(`/api/transactions/${tx.transaction.id}`)).json();
  expect(still.transaction.amountCents).toBe(1234);
});

test('validation errors come back as translatable codes', async ({ baseURL }) => {
  const user = await newUser(baseURL!, 'val');
  const res = await user.post('/api/transactions', { data: { type: 'expense', amountCents: 0, date: '2026-02-30' } });
  expect(res.status()).toBe(400);
  const body = await res.json();
  expect(body.error.code).toBe('validation');
  expect(body.error.fields).toMatchObject({ amountCents: 'amount_positive', date: 'invalid_date', accountId: 'required', categoryId: 'required' });
});

test('cron endpoint requires the secret', async ({ baseURL }) => {
  const anon = await request.newContext({ baseURL });
  expect((await anon.get('/api/cron/recurring')).status()).toBe(401);
  expect((await anon.get('/api/cron/recurring', { headers: { Authorization: 'Bearer wrong' } })).status()).toBe(401);
  if (!process.env.E2E_BASE_URL) {
    const ok = await anon.get('/api/cron/recurring', { headers: { Authorization: 'Bearer e2e-cron-secret' } });
    expect(ok.status()).toBe(200);
    expect(await ok.json()).toMatchObject({ ok: true });
  }
});

test('PWA manifest, icons and service worker are served', async ({ baseURL }) => {
  const anon = await request.newContext({ baseURL });
  const manifest = await (await anon.get('/manifest.webmanifest')).json();
  expect(manifest).toMatchObject({ name: 'Finances', display: 'standalone', start_url: '/' });
  for (const icon of manifest.icons) expect((await anon.get(icon.src)).status()).toBe(200);
  expect((await anon.get('/sw.js')).status()).toBe(200);
  expect((await anon.get('/offline.html')).status()).toBe(200);
  expect((await anon.get('/icons/apple-touch-icon.png')).status()).toBe(200);
});
