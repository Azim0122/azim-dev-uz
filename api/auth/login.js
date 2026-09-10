/** POST /api/auth/login — вход в админку. */

import { queryOne } from '../_lib/db.js';
import { verifyPassword, setSessionCookie } from '../_lib/auth.js';
import { methods, readJson, str, ApiError } from '../_lib/http.js';

// Задержка на неудачной попытке: перебор паролей становится
// непрактично медленным, живому человеку она незаметна.
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default methods({
  POST: async (req, res) => {
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
  },
});
