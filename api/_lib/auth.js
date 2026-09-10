/**
 * auth.js — вход в админку.
 *
 * Пароль хранится как scrypt-хэш, сессия — подписанная HMAC кука.
 * Ни того, ни другого нельзя подделать, не зная SESSION_SECRET,
 * и на сервере не нужно хранить список активных сессий.
 *
 * Всё считается стандартным модулем node:crypto — внешних библиотек
 * для авторизации в проекте нет.
 */

import crypto from 'node:crypto';
import { queryOne } from './db.js';

const COOKIE_NAME = 'azim_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // неделя
const SCRYPT_KEYLEN = 64;

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) {
    throw new Error('SESSION_SECRET не задан или короче 32 символов');
  }
  return value;
}

/* ------------------------------------------------------------------ */
/* Пароли                                                              */
/* ------------------------------------------------------------------ */

/** Считает хэш пароля: scrypt$<соль>$<хэш>. Соль у каждого своя. */
export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, SCRYPT_KEYLEN).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

/**
 * Проверяет пароль. Сравнение — timingSafeEqual, чтобы по времени
 * ответа нельзя было подбирать хэш посимвольно.
 */
export function verifyPassword(password, stored) {
  const [scheme, salt, hash] = String(stored).split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;

  const expected = Buffer.from(hash, 'hex');
  const actual = crypto.scryptSync(password, salt, expected.length);
  return crypto.timingSafeEqual(expected, actual);
}

/* ------------------------------------------------------------------ */
/* Сессия                                                              */
/* ------------------------------------------------------------------ */

const b64 = (buffer) => Buffer.from(buffer).toString('base64url');

function sign(payload) {
  return crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
}

function createToken(userId) {
  const payload = b64(JSON.stringify({ uid: userId, exp: Date.now() + SESSION_TTL_MS }));
  return `${payload}.${sign(payload)}`;
}

function readToken(token) {
  if (typeof token !== 'string' || !token.includes('.')) return null;

  const [payload, signature] = token.split('.');
  const expected = sign(payload);

  // Обе строки одной длины — иначе timingSafeEqual бросает исключение
  if (signature.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data.uid || !data.exp || data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

function parseCookies(header = '') {
  const jar = {};
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    jar[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim());
  }
  return jar;
}

function cookieOptions(maxAgeSeconds) {
  // Secure опускаем только на локальной разработке, иначе браузер
  // не примет куку по http://localhost
  const secure = process.env.NODE_ENV === 'production' ? ' Secure;' : '';
  return `Path=/; HttpOnly;${secure} SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}

export function setSessionCookie(res, userId) {
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${createToken(userId)}; ${cookieOptions(SESSION_TTL_MS / 1000)}`
  );
}

export function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; ${cookieOptions(0)}`);
}

/**
 * Возвращает текущего администратора или null.
 * Пользователь читается из базы каждый раз — так удалённый аккаунт
 * перестаёт работать сразу, а не через неделю жизни куки.
 */
export async function getUser(req) {
  const token = parseCookies(req.headers.cookie || '')[COOKIE_NAME];
  const session = readToken(token);
  if (!session) return null;

  return queryOne('SELECT id, login FROM admin_users WHERE id = $1', [session.uid]);
}

/**
 * Обёртка для защищённых обработчиков: без валидной сессии
 * до самого обработчика запрос не доходит.
 */
export function requireAuth(handler) {
  return async (req, res) => {
    const user = await getUser(req);
    if (!user) {
      res.status(401).json({ error: 'Нужно войти в админку' });
      return;
    }
    req.user = user;
    return handler(req, res);
  };
}
