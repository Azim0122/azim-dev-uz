/**
 * create-admin.mjs — заводит пользователя админки или меняет ему пароль.
 *
 *   npm run db:admin -- azim
 *
 * Пароль спрашивается в терминале. В базу попадает только scrypt-хэш;
 * восстановить из него пароль нельзя — забытый пароль не
 * восстанавливают, а задают заново этой же командой.
 */

import pg from 'pg';
import { sslFor } from '../api/_lib/db.js';
import { hashPassword } from '../api/_lib/auth.js';
import { askPassword } from './ask-password.mjs';

const login = process.argv[2];

if (!login) {
  console.error('Укажите логин:  npm run db:admin -- azim');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error('Не задана переменная DATABASE_URL');
  process.exit(1);
}
// SESSION_SECRET здесь намеренно не проверяется: он подписывает куку
// сессии, а пароль хэшируется без него. На Vercel эта переменная —
// секрет, её значение обратно не выгружается, и требовать её локально
// значило бы заставить человека держать копию секрета у себя.

const password = await askPassword();

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: sslFor(process.env.DATABASE_URL),
});

await client.connect();
await client.query(
  `INSERT INTO admin_users (login, password_hash) VALUES ($1, $2)
   ON CONFLICT (login) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
  [login, hashPassword(password)]
);
await client.end();

console.log(`\n  ✓ Пользователь «${login}» готов. Вход — на /admin`);
console.log('  Очистите историю терминала, если пароль в неё попал.');
