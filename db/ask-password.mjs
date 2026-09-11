/**
 * ask-password.mjs — спрашивает пароль дважды и проверяет его.
 *
 * Общий кусок для create-admin.mjs и admin-sql.mjs. Вынесен отдельно,
 * чтобы правило «не меньше 10 символов» жило в одном месте.
 *
 * Если ввод перенаправлен (пайп, `< file`), читаем оттуда: иначе
 * скрипт молча повиснет на первом же вопросе.
 */

import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

const MIN_LENGTH = 10;

export async function askPassword() {
  let first;
  let again;

  if (stdin.isTTY) {
    const rl = readline.createInterface({ input: stdin, output: stdout });
    first = await rl.question(`Пароль (не меньше ${MIN_LENGTH} символов): `);
    again = await rl.question('Повторите пароль: ');
    rl.close();
  } else {
    const chunks = [];
    for await (const chunk of stdin) chunks.push(chunk);
    const lines = Buffer.concat(chunks).toString('utf8').split('\n');
    first = lines[0] ?? '';
    again = lines[1] ?? first;
  }

  if (first.length < MIN_LENGTH) {
    console.error(`Пароль короче ${MIN_LENGTH} символов — так не пойдёт`);
    process.exit(1);
  }
  if (first !== again) {
    console.error('Пароли не совпали');
    process.exit(1);
  }

  return first;
}
