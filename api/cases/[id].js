/**
 * GET    /api/cases/:id — одна карточка
 * PATCH  /api/cases/:id — правка (можно прислать только изменённые поля)
 * DELETE /api/cases/:id — удалить
 */

import { requireAuth } from '../_lib/auth.js';
import { int, methods, readJson } from '../_lib/http.js';
import { deleteCase, getCase, parseCaseInput, updateCase } from '../_lib/cases.js';

const caseId = (req) => int(req.query?.id, 'id карточки', { min: 1 });

export default requireAuth(
  methods({
    GET: async (req, res) => {
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json({ item: await getCase(caseId(req)) });
    },

    PATCH: async (req, res) => {
      const id = caseId(req);
      const body = await readJson(req);
      await updateCase(id, parseCaseInput(body, { partial: true }));
      res.status(200).json({ item: await getCase(id) });
    },

    DELETE: async (req, res) => {
      await deleteCase(caseId(req));
      res.status(200).json({ ok: true });
    },
  })
);
