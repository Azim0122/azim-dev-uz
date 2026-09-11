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

import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { hashPassword } from '../api/_lib/auth.js';

const login = process.argv[2];

if (!login) {
  console.error('Укажите логин:  node db/admin-sql.mjs azim');
  process.exit(1);
}

/**
 * Пароль спрашиваем в терминале, но если команду запустили с
 * перенаправленным вводом (`... < file`, пайп), читаем оттуда —
 * иначе скрипт молча повиснет на первом же вопросе.
 */
async function askPassword() {
  if (stdin.isTTY) {
    const rl = readline.createInterface({ input: stdin, output: stdout });
    const first = await rl.question('Пароль (не меньше 10 символов): ');
    const again = await rl.question('Повторите пароль: ');
    rl.close();
    return [first, again];
  }

  const chunks = [];
  for await (const chunk of stdin) chunks.push(chunk);
  const lines = Buffer.concat(chunks).toString('utf8').split('\n');
  return [lines[0] ?? '', lines[1] ?? lines[0] ?? ''];
}

const [password, again] = await askPassword();

if (password.length < 10) {
  console.error('Пароль короче 10 символов — так не пойдёт');
  process.exit(1);
}
if (password !== again) {
  console.error('Пароли не совпали');
  process.exit(1);
}

const hash = hashPassword(password);
const esc = (value) => `'${String(value).replace(/'/g, "''")}'`;

console.log('\n-- Вставьте это в SQL-редактор базы:\n');
console.log(
  `INSERT INTO admin_users (login, password_hash) VALUES (${esc(login)}, ${esc(hash)})\n` +
    `ON CONFLICT (login) DO UPDATE SET password_hash = EXCLUDED.password_hash;`
);
console.log('\n-- Очистите историю терминала, если пароль в неё попал.');
