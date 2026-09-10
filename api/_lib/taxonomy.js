/**
 * taxonomy.js — вкладки и тэги.
 *
 * Таблицы устроены одинаково (код, три названия, порядок), поэтому
 * логика общая, а различается только имя таблицы и наличие флага
 * «показывать на сайте» у вкладок.
 */

import { query, queryOne } from './db.js';
import {
  bool,
  conflict,
  int,
  notFound,
  slug as parseSlug,
  slugify,
  translations,
} from './http.js';

const TABLES = {
  categories: { table: 'categories', hasActiveFlag: true, label: 'Вкладка' },
  tags: { table: 'tags', hasActiveFlag: false, label: 'Тэг' },
};

function config(kind) {
  const found = TABLES[kind];
  if (!found) throw new Error(`Неизвестный справочник: ${kind}`);
  return found;
}

function toApi(row, hasActiveFlag) {
  return {
    id: row.id,
    slug: row.slug,
    title: { ru: row.title_ru, uz: row.title_uz, en: row.title_en },
    sortOrder: row.sort_order,
    usedBy: Number(row.used_by ?? 0),
    ...(hasActiveFlag ? { isActive: row.is_active } : {}),
  };
}

/** Список со счётчиком «сколько карточек этим пользуется». */
export async function listTaxonomy(kind) {
  const { table, hasActiveFlag } = config(kind);
  const linkTable = kind === 'categories' ? 'case_categories' : 'case_tags';
  const linkColumn = kind === 'categories' ? 'category_id' : 'tag_id';

  const rows = await query(`
    SELECT t.*, (SELECT count(*) FROM ${linkTable} l WHERE l.${linkColumn} = t.id) AS used_by
    FROM ${table} t
    ORDER BY t.sort_order, t.id
  `);

  return rows.map((row) => toApi(row, hasActiveFlag));
}

function parseInput(kind, body, { partial = false } = {}) {
  const { hasActiveFlag } = config(kind);
  const data = {};
  const has = (field) => body[field] !== undefined;

  if (!partial || has('title')) {
    const title = translations(body.title, 'Название', { max: 100 });
    data.title_ru = title.ru;
    data.title_uz = title.uz;
    data.title_en = title.en;
  }

  if (!partial || has('slug')) {
    const source = body.slug || body.title?.en || body.title?.ru || '';
    data.slug = parseSlug(body.slug ? String(body.slug) : slugify(source), 'Код');
  }

  if (has('sortOrder')) data.sort_order = int(body.sortOrder, 'Порядок', { fallback: 0 });
  if (hasActiveFlag && has('isActive')) data.is_active = bool(body.isActive, true);

  return data;
}

export async function createTaxonomy(kind, body) {
  const { table, hasActiveFlag } = config(kind);
  const data = parseInput(kind, body);

  const columns = Object.keys(data);
  const placeholders = columns.map((_, i) => `$${i + 1}`);

  try {
    const row = await queryOne(
      `INSERT INTO ${table} (${columns.join(', ')}, sort_order)
       VALUES (${placeholders.join(', ')}, COALESCE((SELECT MAX(sort_order) + 1 FROM ${table}), 1))
       RETURNING *, 0 AS used_by`,
      columns.map((column) => data[column])
    );
    return toApi(row, hasActiveFlag);
  } catch (error) {
    if (error?.code === '23505') throw conflict(`${config(kind).label} с таким кодом уже есть`);
    throw error;
  }
}

export async function updateTaxonomy(kind, id, body) {
  const { table, hasActiveFlag, label } = config(kind);
  const data = parseInput(kind, body, { partial: true });

  if (!Object.keys(data).length) throw notFound('Нечего менять');

  const assignments = Object.keys(data).map((column, i) => `${column} = $${i + 2}`);

  try {
    const row = await queryOne(
      `UPDATE ${table} SET ${assignments.join(', ')} WHERE id = $1 RETURNING *, 0 AS used_by`,
      [id, ...Object.keys(data).map((column) => data[column])]
    );
    if (!row) throw notFound(`${label} не найдена`);
    return toApi(row, hasActiveFlag);
  } catch (error) {
    if (error?.code === '23505') throw conflict(`${label} с таким кодом уже есть`);
    throw error;
  }
}

/**
 * Удаление. Связи снимаются каскадом, но если справочником ещё
 * пользуются карточки — предупреждаем и требуем подтверждения,
 * чтобы вкладка не исчезла с сайта по случайному клику.
 */
export async function deleteTaxonomy(kind, id, { force = false } = {}) {
  const { table, label } = config(kind);
  const linkTable = kind === 'categories' ? 'case_categories' : 'case_tags';
  const linkColumn = kind === 'categories' ? 'category_id' : 'tag_id';

  const used = await queryOne(
    `SELECT count(*)::int AS total FROM ${linkTable} WHERE ${linkColumn} = $1`,
    [id]
  );

  if (used.total > 0 && !force) {
    throw conflict(`${label} используется в ${used.total} карточках. Удалить вместе со связями?`);
  }

  const row = await queryOne(`DELETE FROM ${table} WHERE id = $1 RETURNING id`, [id]);
  if (!row) throw notFound(`${label} не найдена`);
}
