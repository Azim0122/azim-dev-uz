/**
 * cases.js — работа с карточками для админки: чтение, разбор формы,
 * запись вместе со связями (категории и тэги).
 */

import { query, queryOne, transaction } from './db.js';
import {
  badRequest,
  bool,
  conflict,
  idList,
  int,
  mediaUrl,
  notFound,
  slug as parseSlug,
  slugify,
  str,
  translations,
  url as parseUrl,
} from './http.js';

const SELECT_CASE = `
  SELECT c.*,
         COALESCE(cats.ids, '{}') AS category_ids,
         COALESCE(tgs.ids, '{}')  AS tag_ids
  FROM cases c
  LEFT JOIN LATERAL (
    SELECT array_agg(category_id ORDER BY category_id) AS ids
    FROM case_categories WHERE case_id = c.id
  ) cats ON TRUE
  LEFT JOIN LATERAL (
    SELECT array_agg(tag_id ORDER BY tag_id) AS ids
    FROM case_tags WHERE case_id = c.id
  ) tgs ON TRUE
`;

/** Строка базы → объект, который ждёт админка. */
function toApi(row) {
  return {
    id: row.id,
    slug: row.slug,
    url: row.url,
    image: row.image_url,
    width: row.image_width,
    height: row.image_height,
    video: row.video_url,
    title: { ru: row.title_ru, uz: row.title_uz, en: row.title_en },
    description: { ru: row.description_ru, uz: row.description_uz, en: row.description_en },
    isPublished: row.is_published,
    sortOrder: row.sort_order,
    categoryIds: row.category_ids,
    tagIds: row.tag_ids,
    updatedAt: row.updated_at,
  };
}

export async function listCases() {
  const rows = await query(`${SELECT_CASE} ORDER BY c.sort_order, c.id`);
  return rows.map(toApi);
}

export async function getCase(id) {
  const row = await queryOne(`${SELECT_CASE} WHERE c.id = $1`, [id]);
  if (!row) throw notFound('Карточка не найдена');
  return toApi(row);
}

/**
 * Разбор и проверка данных формы.
 *
 * partial = true для PATCH: тогда проверяются только присланные поля,
 * а остальные остаются как есть.
 */
export function parseCaseInput(body, { partial = false } = {}) {
  const data = {};
  const has = (field) => body[field] !== undefined;

  if (!partial || has('title')) {
    const title = translations(body.title, 'Название', { max: 150 });
    data.title_ru = title.ru;
    data.title_uz = title.uz;
    data.title_en = title.en;
  }

  if (!partial || has('description')) {
    const description = translations(body.description, 'Описание', {
      required: false,
      max: 400,
    });
    data.description_ru = description.ru;
    data.description_uz = description.uz;
    data.description_en = description.en;
  }

  if (!partial || has('url')) data.url = parseUrl(body.url, 'Ссылка на сайт');
  if (!partial || has('image')) data.image_url = mediaUrl(body.image, 'Картинка');
  if (has('video')) data.video_url = mediaUrl(body.video, 'Видео', { required: false }) || null;

  if (!partial || has('width')) {
    data.image_width = int(body.width, 'Ширина картинки', { min: 1, max: 10000, fallback: 1680 });
  }
  if (!partial || has('height')) {
    data.image_height = int(body.height, 'Высота картинки', { min: 1, max: 10000, fallback: 909 });
  }

  if (has('isPublished')) data.is_published = bool(body.isPublished, true);
  if (has('sortOrder')) data.sort_order = int(body.sortOrder, 'Порядок', { fallback: 0 });

  if (!partial || has('slug')) {
    const source = body.slug || body.title?.ru || body.title?.en || '';
    const generated = body.slug ? String(body.slug) : slugify(source);
    if (!generated) throw badRequest('Не удалось составить код карточки — заполните название');
    data.slug = parseSlug(generated, 'Код карточки');
  }

  const categoryIds = !partial || has('categoryIds') ? idList(body.categoryIds, 'Категории') : null;
  const tagIds = !partial || has('tagIds') ? idList(body.tagIds, 'Тэги') : null;

  if (categoryIds && categoryIds.length === 0) {
    throw badRequest('Выберите хотя бы одну вкладку, иначе карточку негде показать');
  }

  return { data, categoryIds, tagIds };
}

/** Переписывает связи карточки: сначала чистим, потом вставляем заново. */
async function writeLinks(client, table, column, caseId, ids) {
  await client.query(`DELETE FROM ${table} WHERE case_id = $1`, [caseId]);
  if (!ids?.length) return;

  await client.query(
    `INSERT INTO ${table} (case_id, ${column}) SELECT $1, unnest($2::int[])`,
    [caseId, ids]
  );
}

const uniqueViolation = (error) => error?.code === '23505';
const foreignKeyViolation = (error) => error?.code === '23503';

export async function createCase(input) {
  const { data, categoryIds, tagIds } = input;

  const columns = Object.keys(data);
  const placeholders = columns.map((_, i) => `$${i + 1}`);

  try {
    return await transaction(async (client) => {
      // Новая карточка встаёт первой в списке — так её сразу видно
      // и на сайте, и в админке, без ручной перестановки.
      const { rows } = await client.query(
        `INSERT INTO cases (${columns.join(', ')}, sort_order)
         VALUES (${placeholders.join(', ')},
                 COALESCE((SELECT MIN(sort_order) - 1 FROM cases), 0))
         RETURNING id`,
        columns.map((column) => data[column])
      );

      const id = rows[0].id;
      await writeLinks(client, 'case_categories', 'category_id', id, categoryIds);
      await writeLinks(client, 'case_tags', 'tag_id', id, tagIds);
      return id;
    });
  } catch (error) {
    if (uniqueViolation(error)) throw conflict('Карточка с таким кодом уже есть');
    if (foreignKeyViolation(error)) throw badRequest('Выбрана несуществующая вкладка или тэг');
    throw error;
  }
}

export async function updateCase(id, input) {
  const { data, categoryIds, tagIds } = input;

  try {
    return await transaction(async (client) => {
      if (Object.keys(data).length) {
        const assignments = Object.keys(data).map((column, i) => `${column} = $${i + 2}`);
        const { rowCount } = await client.query(
          `UPDATE cases SET ${assignments.join(', ')} WHERE id = $1`,
          [id, ...Object.keys(data).map((column) => data[column])]
        );
        if (!rowCount) throw notFound('Карточка не найдена');
      }

      if (categoryIds) await writeLinks(client, 'case_categories', 'category_id', id, categoryIds);
      if (tagIds) await writeLinks(client, 'case_tags', 'tag_id', id, tagIds);
    });
  } catch (error) {
    if (uniqueViolation(error)) throw conflict('Карточка с таким кодом уже есть');
    if (foreignKeyViolation(error)) throw badRequest('Выбрана несуществующая вкладка или тэг');
    throw error;
  }
}

export async function deleteCase(id) {
  const row = await queryOne('DELETE FROM cases WHERE id = $1 RETURNING id', [id]);
  if (!row) throw notFound('Карточка не найдена');
}

/** Порядок карточек: приходит массив id в нужной последовательности. */
export async function reorderCases(ids) {
  if (!ids.length) return;

  await transaction(async (client) => {
    await client.query(
      `UPDATE cases SET sort_order = position.index
       FROM (SELECT id, ordinality AS index FROM unnest($1::int[]) WITH ORDINALITY AS t(id, ordinality)) AS position
       WHERE cases.id = position.id`,
      [ids]
    );
  });
}
