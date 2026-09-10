/**
 * db.js — подключение к Postgres.
 *
 * Serverless-функция живёт недолго и запускается во многих копиях,
 * поэтому пул держим маленьким и переиспользуем между вызовами: Node
 * кэширует модуль, пока «тёплый» экземпляр функции жив.
 *
 * DATABASE_URL должен указывать на пулер (у Neon это хост с суффиксом
 * -pooler) — прямое подключение быстро упрётся в лимит соединений.
 */

import pg from 'pg';

const { Pool } = pg;

/**
 * Облачные базы (Neon, Supabase) требуют TLS, локальная — нет.
 * Определяем по строке подключения, чтобы одна и та же настройка
 * работала и на сервере, и на машине разработчика.
 */
export function sslFor(connectionString = '') {
  if (/sslmode=disable/.test(connectionString)) return false;
  if (/@(localhost|127\.0\.0\.1)[:/]/.test(connectionString)) return false;
  return { rejectUnauthorized: false };
}

/**
 * Пул создаётся при первом запросе, а не при импорте модуля: так
 * вспомогательные скрипты могут импортировать отсюда sslFor, не имея
 * DATABASE_URL, и сами показать понятное сообщение.
 */
function getPool() {
  if (globalThis.__azimPool) return globalThis.__azimPool;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('Не задана переменная окружения DATABASE_URL');

  globalThis.__azimPool = new Pool({
    connectionString,
    max: 3,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    ssl: sslFor(connectionString),
  });

  return globalThis.__azimPool;
}

/** Обычный запрос. Возвращает массив строк. */
export async function query(text, params = []) {
  const result = await getPool().query(text, params);
  return result.rows;
}

/** Запрос, от которого ожидается ровно одна строка (или ничего). */
export async function queryOne(text, params = []) {
  const rows = await query(text, params);
  return rows[0] ?? null;
}

/**
 * Транзакция. Всё внутри колбэка выполняется на одном соединении:
 * либо применяется целиком, либо откатывается целиком.
 */
export async function transaction(callback) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
