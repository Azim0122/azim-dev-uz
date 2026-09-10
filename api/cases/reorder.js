/**
 * POST /api/cases/reorder — новый порядок карточек.
 * Тело: { "ids": [12, 4, 7, ...] } — в том порядке, в каком они
 * должны идти на сайте.
 */

import { requireAuth } from '../_lib/auth.js';
import { idList, methods, readJson } from '../_lib/http.js';
import { listCases, reorderCases } from '../_lib/cases.js';

export default requireAuth(
  methods({
    POST: async (req, res) => {
      const body = await readJson(req);
      await reorderCases(idList(body.ids, 'Порядок карточек'));
      res.status(200).json({ items: await listCases() });
    },
  })
);
