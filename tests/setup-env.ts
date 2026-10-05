// Integration tests run against a real Postgres (the same engine as Neon in production).
// Default: local database; override with TEST_DATABASE_URL (CI sets it).
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgresql://finances:finances@127.0.0.1:5432/finances_test';
