import { beforeEach, describe, expect, it } from 'vitest';
import { FinancesDB } from '../../src/db/db';
import * as repo from '../../src/db/repo';
import { BACKUP_SCHEMA_VERSION, validateBackup } from '../../src/lib/backup';
import { BOM, buildCsv, csvAmount } from '../../src/lib/csv';
import { account, tx } from './helpers';

describe('CSV export', () => {
  const accounts = [account({ id: 'a', name: 'Compte corrent' }), account({ id: 's', name: 'Compte remunerat' })];
  const categories = [{ id: 'food', name: 'Restauració', emoji: '🍔', color: '#000', kind: 'expense' as const, order: 0, createdAt: 0 }];

  it('uses ;, a decimal comma, UTF-8 with BOM and the expected columns', () => {
    const csv = buildCsv(
      [
        tx({ type: 'expense', amountCents: 183157, date: '2026-10-05', categoryId: 'food', description: 'Sopar; "amics"', notes: 'línia 1\nlínia 2' }),
        tx({ type: 'transfer', amountCents: 50000, date: '2026-10-01', accountId: 'a', toAccountId: 's' }),
      ],
      accounts,
      categories,
    );
    expect(csv.startsWith(BOM)).toBe(true);
    const lines = csv.slice(1).split('\r\n');
    expect(lines[0]).toBe('Data;Tipus;Import;Categoria;Compte;Compte destinació;Descripció;Notes');
    // Oldest first.
    expect(lines[1]).toBe('2026-10-01;Transferència;500,00;;Compte corrent;Compte remunerat;;');
    expect(lines[2]).toBe('2026-10-05;Despesa;1831,57;Restauració;Compte corrent;;"Sopar; ""amics""";"línia 1\nlínia 2"');
    expect(csvAmount(5)).toBe('0,05');
  });
});

describe('backups', () => {
  let db: FinancesDB;

  beforeEach(async () => {
    db = new FinancesDB(`bk-${Math.random()}`);
    repo.setDatabase(db);
    await repo.ensureSeed();
  });

  it('export → wipe → restore gives back exactly the same data', async () => {
    const a = await repo.createAccount({ name: 'Compte corrent', type: 'corrent', color: '#000', initialBalanceCents: 100000, initialBalanceDate: '2026-08-01' });
    const s = await repo.createAccount({ name: 'Remunerat', type: 'remunerat', color: '#111', initialBalanceCents: 500000, initialBalanceDate: '2026-08-01', tae: 2.5 });
    await repo.saveMovement({ type: 'expense', date: '2026-10-05', amountCents: 2450, categoryId: 'cat_restauracio', accountId: a, notes: 'amb la Marta' });
    await repo.saveMovement({ type: 'transfer', date: '2026-10-06', amountCents: 10000, accountId: a, toAccountId: s });
    await repo.createRule({ type: 'expense', date: '2026-09-01', startDate: '2026-09-01', amountCents: 999, categoryId: 'cat_subscripcions', accountId: a, frequency: 'monthly', dayOfMonth: 1 }, '2026-10-09');
    await repo.saveBudget('default', 100000, { cat_restauracio: 8000 });
    await repo.setSetting('onboardingDone', true);
    await repo.setSetting('interestProcessed', { [s]: '2026-09' });

    const before = await repo.readAllData();
    const file = JSON.parse(JSON.stringify(await repo.exportBackup()));
    expect(file).toMatchObject({ app: 'finances', schemaVersion: BACKUP_SCHEMA_VERSION });

    await repo.wipeAll();
    expect(await db.transactions.count()).toBe(0);

    const result = validateBackup(file);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    await repo.restoreBackup(result.backup);
    const after = await repo.readAllData();
    const sortById = <T extends { id: string }>(rows: T[]) => [...rows].sort((x, y) => x.id.localeCompare(y.id));
    expect(sortById(after.accounts)).toEqual(sortById(before.accounts));
    expect(sortById(after.categories)).toEqual(sortById(before.categories));
    expect(sortById(after.transactions)).toEqual(sortById(JSON.parse(JSON.stringify(before.transactions))));
    expect(sortById(after.recurringRules)).toEqual(sortById(JSON.parse(JSON.stringify(before.recurringRules))));
    expect(after.budgets).toEqual(before.budgets);
    expect(Object.fromEntries(after.settings.map((r) => [r.key, r.value]))).toEqual(Object.fromEntries(before.settings.map((r) => [r.key, r.value])));
  });

  it('rejects files that are not valid backups', () => {
    expect(validateBackup(null).ok).toBe(false);
    expect(validateBackup({ app: 'other', schemaVersion: 1, data: {} }).ok).toBe(false);
    expect(validateBackup({ app: 'finances', schemaVersion: 99, data: {} }).ok).toBe(false);
    const base = {
      app: 'finances',
      schemaVersion: 1,
      exportedAt: '2026-10-09T10:00:00.000Z',
      data: {
        accounts: [{ id: 'a', name: 'A', type: 'corrent', color: '#000', initialBalanceCents: 0, initialBalanceDate: '2026-01-01', order: 0, createdAt: 0 }],
        categories: [{ id: 'c', name: 'C', emoji: '🍔', color: '#000', kind: 'expense', order: 0, createdAt: 0 }],
        transactions: [{ id: 't', type: 'expense', date: '2026-02-01', amountCents: 100, categoryId: 'c', accountId: 'a', source: 'manual', createdAt: 0, updatedAt: 0 }],
        recurringRules: [],
        budgets: [],
        settings: [],
      },
    };
    expect(validateBackup(base).ok).toBe(true);
    const orphan = structuredClone(base);
    orphan.data.transactions[0].accountId = 'missing';
    expect(validateBackup(orphan).ok).toBe(false);
    const floatAmount = structuredClone(base);
    floatAmount.data.transactions[0].amountCents = 1.5;
    expect(validateBackup(floatAmount).ok).toBe(false);
    const badDate = structuredClone(base);
    badDate.data.transactions[0].date = '2026-02-30';
    expect(validateBackup(badDate).ok).toBe(false);
  });
});
