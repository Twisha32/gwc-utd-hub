import { migrate } from './migrate';
import { pool } from './db';

migrate()
  .then(() => pool.end())
  .catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
