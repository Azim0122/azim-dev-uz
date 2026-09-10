/**
 * GET  /api/cases — список карточек для админки (включая скрытые)
 * POST /api/cases — создать карточку
 */

import { requireAuth } from '../_lib/auth.js';
import { methods, readJson } from '../_lib/http.js';
import { createCase, getCase, listCases, parseCaseInput } from '../_lib/cases.js';

export default requireAuth(
  methods({
    GET: async (req, res) => {
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json({ items: await listCases() });
    },

    POST: async (req, res) => {
      const body = await readJson(req);
      const id = await createCase(parseCaseInput(body));
      res.status(201).json({ item: await getCase(id) });
    },
  })
);
