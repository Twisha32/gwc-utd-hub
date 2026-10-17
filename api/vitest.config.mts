import { defineConfig } from 'vitest/config';

// Tests run against a real Postgres. Point TEST_DATABASE_URL at a throwaway
// database whose name ends in _test, it gets wiped on every run.
const dbUrl =
  process.env.TEST_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/gwc_test';

export default defineConfig({
  test: {
    environment: 'node',
    fileParallelism: false,
    globalSetup: ['./test/global-setup.ts'],
    testTimeout: 15_000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: dbUrl,
      JWT_SECRET: 'test-secret-not-for-real-use',
      FLAG_PEPPER: 'test-pepper',
      ALLOWED_EMAIL_DOMAINS: 'utdallas.edu',
      OFFICER_EMAILS: '',
      CLUB_JOIN_CODE: '',
      BCRYPT_ROUNDS: '4',
      RUN_MIGRATIONS: 'false',
    },
  },
});
