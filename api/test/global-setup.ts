// Runs once before the suite: fresh schema, then migrations.
export default async function setup() {
  const url = process.env.TEST_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/gwc_test';
  const dbName = new URL(url).pathname.replace('/', '');
  if (!dbName.endsWith('_test')) {
    throw new Error(`Refusing to wipe "${dbName}". Test database names must end in _test.`);
  }

  Object.assign(process.env, {
    NODE_ENV: 'test',
    DATABASE_URL: url,
    JWT_SECRET: 'test-secret-not-for-real-use',
    FLAG_PEPPER: 'test-pepper',
  });

  const { pool } = await import('../src/db.js');
  const { migrate } = await import('../src/migrate.js');

  await pool.query('drop schema public cascade; create schema public;');
  await migrate(() => {});
  await pool.end();
}
