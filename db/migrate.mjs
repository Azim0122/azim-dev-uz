/**
 * migrate.mjs — применяет db/schema.sql к базе из DATABASE_URL.
 *
 *   npm run db:migrate
 *
 * Файл схемы написан так, что повторный запуск ничего не ломает.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { sslFor } from '../api/_lib/db.js';

const here = path.dirname(fileURLToPath(import.meta.url));

if (!process.env.DATABASE_URL) {
  console.error('Не задана переменная DATABASE_URL');
  process.exit(1);
}

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: sslFor(process.env.DATABASE_URL),
});

await client.connect();
await client.query(fs.readFileSync(path.join(here, 'schema.sql'), 'utf8'));

const { rows } = await client.query(`
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public' ORDER BY table_name
`);

await client.end();

console.log('  ✓ Схема применена. Таблицы:', rows.map((row) => row.table_name).join(', '));
