/** GET /api/auth/session — кто вошёл. Админка спрашивает при загрузке. */

import { getUser } from '../_lib/auth.js';
import { methods } from '../_lib/http.js';

export default methods({
  GET: async (req, res) => {
    const user = await getUser(req);
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ user });
  },
});
