/**
 * bootstrap.mjs — подготовка базы во время сборки на Vercel.
 *
 * Запускается как Build Command (см. vercel.json) и делает две вещи:
 *
 *   1. применяет схему — CREATE TABLE IF NOT EXISTS, повтор безопасен;
 *   2. если таблица работ пуста, переносит в неё стартовые данные.
 *
 * Второй шаг именно «если пусто»: как только работы начнут править
 * через админку, перезаливать их на каждой сборке нельзя — правки
 * затрутся.
 *
 * Сборку скрипт не роняет никогда. База может быть недоступна или
 * переменная не задана — сайт всё равно должен собраться и открыться,
 * просто без блока «Мои работы». Отсутствие базы — не причина
 * оставить человека без сайта.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const here = path.dirname(fileURLToPath(import.meta.url));

const skip = (why) => {
  console.log(`  · База не трогалась: ${why}`);
  process.exit(0);
};

if (!process.env.DATABASE_URL) skip('не задана переменная DATABASE_URL');

let pg;
try {
  pg = (await import('pg')).default;
} catch {
  skip('модуль pg недоступен');
}

const { sslFor } = await import('../api/_lib/db.js');

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: sslFor(process.env.DATABASE_URL),
  connectionTimeoutMillis: 15_000,
});

try {
  await client.connect();
  await client.query(fs.readFileSync(path.join(here, 'schema.sql'), 'utf8'));
  console.log('  ✓ Схема применена');

  const { rows } = await client.query('SELECT count(*)::int AS n FROM cases');
  const empty = rows[0].n === 0;
  await client.end();

  if (!empty) {
    console.log(`  · Работ в базе: ${rows[0].n} — перенос не нужен`);
    process.exit(0);
  }

  // seed.mjs открывает собственное соединение, поэтому запускаем его
  // отдельным процессом, а не импортом.
  const seed = spawnSync(process.execPath, [path.join(here, 'seed.mjs')], {
    stdio: 'inherit',
    env: process.env,
  });

  if (seed.status !== 0) console.log('  · Перенос стартовых данных не удался — сборку не останавливаем');
} catch (error) {
  console.log(`  · База недоступна (${error.message}) — сборку не останавливаем`);
  try {
    await client.end();
  } catch {
    /* соединения могло и не быть */
  }
}

process.exit(0);
