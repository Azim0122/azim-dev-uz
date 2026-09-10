/** POST /api/auth/logout — выход. */

import { clearSessionCookie } from '../_lib/auth.js';
import { methods } from '../_lib/http.js';

export default methods({
  POST: async (req, res) => {
    clearSessionCookie(res);
    res.status(200).json({ ok: true });
  },
});
