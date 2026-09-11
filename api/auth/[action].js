/**
 * POST /api/auth/login    — вход в админку
 * POST /api/auth/logout   — выход
 * GET  /api/auth/session  — кто сейчас вошёл
 *
 * Три действия живут в одном файле намеренно: на бесплатном тарифе
 * Vercel у проекта не больше 12 serverless-функций, и разносить по
 * файлу на каждый маленький обработчик — непозволительная роскошь.
 * Снаружи адреса остались прежними.
 */

import { queryOne } from '../_lib/db.js';
import {
  clearSessionCookie,
  getUser,
  setSessionCookie,
  verifyPassword,
} from '../_lib/auth.js';
import { ApiError, methods, notFound, readJson, str } from '../_lib/http.js';

// Задержка на неудачной попытке: перебор паролей становится
// непрактично медленным, живому человеку она незаметна.
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function login(req, res) {
  const body = await readJson(req);
  const login = str(body.login, 'Логин', { max: 60 });
  const password = str(body.password, 'Пароль', { max: 200 });

  const user = await queryOne(
    'SELECT id, login, password_hash FROM admin_users WHERE login = $1',
    [login]
  );

  // Один и тот же ответ и при неверном логине, и при неверном пароле —
  // иначе форма подсказывает, какие логины существуют.
  if (!user || !verifyPassword(password, user.password_hash)) {
    await pause(700);
    throw new ApiError(401, 'Неверный логин или пароль');
  }

  await queryOne('UPDATE admin_users SET last_login_at = now() WHERE id = $1 RETURNING id', [
    user.id,
  ]);

  setSessionCookie(res, user.id);
  res.status(200).json({ user: { id: user.id, login: user.login } });
}

function logout(req, res) {
  clearSessionCookie(res);
  res.status(200).json({ ok: true });
}

async function session(req, res) {
  const user = await getUser(req);
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({ user });
}

const ROUTES = {
  login: methods({ POST: login }),
  logout: methods({ POST: logout }),
  session: methods({ GET: session }),
};

export default async function handler(req, res) {
  const route = ROUTES[String(req.query?.action || '')];

  if (!route) {
    res.status(404).json({ error: 'Неизвестное действие' });
    return;
  }

  return route(req, res);
}
