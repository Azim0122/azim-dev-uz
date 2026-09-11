/**
 * POST /api/auth/login    — вход в админку
 * POST /api/auth/logout   — выход
 * GET  /api/auth/session  — кто сейчас вошёл
 * POST /api/auth/setup    — первый вход: заводит единственного админа
 *
 * Действия живут в одном файле намеренно: на бесплатном тарифе
 * Vercel у проекта не больше 12 serverless-функций, и разносить по
 * файлу на каждый маленький обработчик — непозволительная роскошь.
 * Снаружи адреса остались прежними.
 */

import { queryOne } from '../_lib/db.js';
import {
  clearSessionCookie,
  getUser,
  hashPassword,
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

  // Пока в базе нет ни одного админа, админка показывает не форму
  // входа, а форму «придумайте логин и пароль». Лишний запрос делаем
  // только когда никто не вошёл — вошедшему он не нужен.
  const needsSetup = user ? false : !(await adminExists());

  res.status(200).json({ user, needsSetup });
}

/** Есть ли в базе хоть один пользователь админки. */
async function adminExists() {
  const row = await queryOne('SELECT 1 AS ok FROM admin_users LIMIT 1');
  return Boolean(row);
}

/**
 * Первый вход. Работает только пока таблица пуста — как только админ
 * появился, действие закрывается навсегда и пароль меняют уже изнутри
 * (или командой npm run db:admin). Поэтому отдельный секрет для этой
 * формы не нужен: воспользоваться ей можно ровно один раз.
 */
async function setup(req, res) {
  if (await adminExists()) {
    throw new ApiError(409, 'Админ уже заведён — войдите по своему логину и паролю');
  }

  const body = await readJson(req);
  const userLogin = str(body.login, 'Логин', { max: 60 });
  const password = str(body.password, 'Пароль', { max: 200 });

  if (!/^[a-zA-Z0-9._\-]{3,60}$/.test(userLogin)) {
    throw new ApiError(400, 'Логин: латиница, цифры, точка, дефис, подчёркивание — от 3 символов');
  }
  if (password.length < 10) {
    throw new ApiError(400, 'Пароль короче 10 символов — так не пойдёт');
  }

  // Вставка с проверкой в самом SQL: два одновременных запроса не
  // смогут создать двух админов, даже если оба прошли проверку выше.
  const user = await queryOne(
    `INSERT INTO admin_users (login, password_hash)
     SELECT $1, $2
     WHERE NOT EXISTS (SELECT 1 FROM admin_users)
     RETURNING id, login`,
    [userLogin, hashPassword(password)]
  );

  if (!user) {
    throw new ApiError(409, 'Админ уже заведён — войдите по своему логину и паролю');
  }

  setSessionCookie(res, user.id);
  res.setHeader('Cache-Control', 'no-store');
  res.status(201).json({ user });
}

const ROUTES = {
  login: methods({ POST: login }),
  logout: methods({ POST: logout }),
  session: methods({ GET: session }),
  setup: methods({ POST: setup }),
};

export default async function handler(req, res) {
  const route = ROUTES[String(req.query?.action || '')];

  if (!route) {
    res.status(404).json({ error: 'Неизвестное действие' });
    return;
  }

  return route(req, res);
}
