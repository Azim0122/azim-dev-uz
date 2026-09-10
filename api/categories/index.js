/**
 * GET  /api/categories — список (вкладки блока «Мои работы»)
 * POST /api/categories — создать
 */

import { requireAuth } from '../_lib/auth.js';
import { methods, readJson } from '../_lib/http.js';
import { createTaxonomy, listTaxonomy } from '../_lib/taxonomy.js';

const KIND = 'categories';

export default requireAuth(
  methods({
    GET: async (req, res) => {
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json({ items: await listTaxonomy(KIND) });
    },

    POST: async (req, res) => {
      const item = await createTaxonomy(KIND, await readJson(req));
      res.status(201).json({ item });
    },
  })
);
