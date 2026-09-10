/**
 * create-admin.mjs — заводит пользователя админки или меняет ему пароль.
 *
 *   npm run db:admin -- azim
 *
 * Пароль спрашивается в терминале. В базу попадает только scrypt-хэш;
 * восстановить из него пароль нельзя — забытый пароль не
 * восстанавливают, а задают заново этой же командой.
 */

import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import pg from 'pg';
import { sslFor } from '../api/_lib/db.js';
import { hashPassword } from '../api/_lib/auth.js';

const login = process.argv[2];

if (!login) {
  console.error('Укажите логин:  npm run db:admin -- azim');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error('Не задана переменная DATABASE_URL');
  process.exit(1);
}
if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
  console.error('Не задан SESSION_SECRET (нужно не меньше 32 символов)');
  process.exit(1);
}

const rl = readline.createInterface({ input: stdin, output: stdout });

const password = await rl.question('Пароль (не меньше 10 символов): ');
const again = await rl.question('Повторите пароль: ');
rl.close();

if (password.length < 10) {
  console.error('Пароль короче 10 символов — так не пойдёт');
  process.exit(1);
}
if (password !== again) {
  console.error('Пароли не совпали');
  process.exit(1);
}

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
