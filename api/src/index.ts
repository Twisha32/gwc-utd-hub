import { createApp } from './app';
import { config } from './config';
import { pool } from './db';
import { migrate } from './migrate';

async function main() {
  if (config.runMigrations) await migrate();

  const app = createApp();
  const server = app.listen(config.port, () => {
    console.log(`api listening on :${config.port} (${config.env})`);
  });

  const shutdown = () => {
    server.close(() => {
      pool.end().finally(() => process.exit(0));
    });
    // don't hang forever on open connections
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
