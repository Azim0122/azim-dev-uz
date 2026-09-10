/**
 * PATCH  /api/tags/:id — переименовать, переставить, включить или скрыть
 * DELETE /api/tags/:id — удалить (?force=1 — вместе со связями)
 */

import { requireAuth } from '../_lib/auth.js';
import { bool, int, methods, readJson } from '../_lib/http.js';
import { deleteTaxonomy, updateTaxonomy } from '../_lib/taxonomy.js';

const KIND = 'tags';
const entityId = (req) => int(req.query?.id, 'id', { min: 1 });

export default requireAuth(
  methods({
    PATCH: async (req, res) => {
      const item = await updateTaxonomy(KIND, entityId(req), await readJson(req));
      res.status(200).json({ item });
    },

    DELETE: async (req, res) => {
      await deleteTaxonomy(KIND, entityId(req), { force: bool(req.query?.force) });
      res.status(200).json({ ok: true });
    },
  })
);
