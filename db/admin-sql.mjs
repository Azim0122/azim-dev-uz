/**
 * admin-sql.mjs — печатает SQL для создания пользователя админки.
 *
 *   node db/admin-sql.mjs azim
 *
 * В отличие от create-admin.mjs, к базе не подключается: спрашивает
 * пароль, считает scrypt-хэш и выводит готовый INSERT, который можно
 * вставить в веб-редактор SQL. Пароль никуда не уходит, в SQL попадает
 * только хэш — восстановить из него пароль нельзя.
 */

import { hashPassword } from '../api/_lib/auth.js';
import { askPassword } from './ask-password.mjs';

const login = process.argv[2];

if (!login) {
  console.error('Укажите логин:  node db/admin-sql.mjs azim');
  process.exit(1);
}

const hash = hashPassword(await askPassword());
const esc = (value) => `'${String(value).replace(/'/g, "''")}'`;

console.log('\n-- Вставьте это в SQL-редактор базы:\n');
console.log(
  `INSERT INTO admin_users (login, password_hash) VALUES (${esc(login)}, ${esc(hash)})\n` +
    `ON CONFLICT (login) DO UPDATE SET password_hash = EXCLUDED.password_hash;`
);
console.log('\n-- Очистите историю терминала, если пароль в неё попал.');
