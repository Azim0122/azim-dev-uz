/**
 * seed.mjs — переносит в базу то, что было на сайте до переезда:
 * 11 работ, 7 вкладок и 6 тэгов, каждый с тремя переводами.
 *
 *   npm run db:seed
 *
 * Запускается один раз после миграции. Повторный запуск обновит
 * существующие записи по коду (slug) и не создаст дублей.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { sslFor } from '../api/_lib/db.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(here);

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

const legacy = readJson(path.join(here, 'legacy-cases.json'));
const dicts = Object.fromEntries(
  ['ru', 'uz', 'en'].map((lang) => [lang, readJson(path.join(root, 'content', `${lang}.json`))])
);

if (!process.env.DATABASE_URL) {
  console.error('Не задана переменная DATABASE_URL');
  process.exit(1);
}

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: sslFor(process.env.DATABASE_URL),
});

await client.connect();
await client.query('BEGIN');

try {
  /* --- вкладки --------------------------------------------------- */
  const categoryIds = new Map();

  for (const [index, slug] of legacy.categories.entries()) {
    const { rows } = await client.query(
      `INSERT INTO categories (slug, title_ru, title_uz, title_en, sort_order)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (slug) DO UPDATE
         SET title_ru = EXCLUDED.title_ru,
             title_uz = EXCLUDED.title_uz,
             title_en = EXCLUDED.title_en
       RETURNING id`,
      [
        slug,
        dicts.ru.cases.categories[slug],
        dicts.uz.cases.categories[slug],
        dicts.en.cases.categories[slug],
        index + 1,
      ]
    );
    categoryIds.set(slug, rows[0].id);
  }

  /* --- тэги ------------------------------------------------------- */
  const tagIds = new Map();
  const tagSlugs = Object.keys(dicts.ru.cases.tags);

  for (const [index, slug] of tagSlugs.entries()) {
    const { rows } = await client.query(
      `INSERT INTO tags (slug, title_ru, title_uz, title_en, sort_order)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (slug) DO UPDATE
         SET title_ru = EXCLUDED.title_ru,
             title_uz = EXCLUDED.title_uz,
             title_en = EXCLUDED.title_en
       RETURNING id`,
      [
        slug,
        dicts.ru.cases.tags[slug],
        dicts.uz.cases.tags[slug],
        dicts.en.cases.tags[slug],
        index + 1,
      ]
    );
    tagIds.set(slug, rows[0].id);
  }

  /* --- работы ----------------------------------------------------- */
  for (const [index, item] of legacy.items.entries()) {
    const { rows } = await client.query(
      `INSERT INTO cases (slug, url, image_url, image_width, image_height,
                          title_ru, title_uz, title_en,
                          description_ru, description_uz, description_en,
                          sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (slug) DO UPDATE
         SET url = EXCLUDED.url,
             image_url = EXCLUDED.image_url,
             image_width = EXCLUDED.image_width,
             image_height = EXCLUDED.image_height,
             title_ru = EXCLUDED.title_ru,
             title_uz = EXCLUDED.title_uz,
             title_en = EXCLUDED.title_en,
             description_ru = EXCLUDED.description_ru,
             description_uz = EXCLUDED.description_uz,
             description_en = EXCLUDED.description_en
       RETURNING id`,
      [
        item.id,
        item.url,
        `/${item.image}`,
        item.width,
        item.height,
        item.title.ru,
        item.title.uz,
        item.title.en,
        item.description.ru,
        item.description.uz,
        item.description.en,
        index + 1,
      ]
    );

    const caseId = rows[0].id;

    await client.query('DELETE FROM case_categories WHERE case_id = $1', [caseId]);
    await client.query('DELETE FROM case_tags WHERE case_id = $1', [caseId]);

    for (const slug of item.categories) {
      await client.query(
        'INSERT INTO case_categories (case_id, category_id) VALUES ($1, $2)',
        [caseId, categoryIds.get(slug)]
      );
    }
    for (const slug of item.tags) {
      await client.query('INSERT INTO case_tags (case_id, tag_id) VALUES ($1, $2)', [
        caseId,
        tagIds.get(slug),
      ]);
    }
  }

  await client.query('COMMIT');

  console.log(`  ✓ Перенесено: ${legacy.items.length} работ, ${categoryIds.size} вкладок, ${tagIds.size} тэгов`);
} catch (error) {
  await client.query('ROLLBACK');
  console.error('  ✗ Перенос не удался, база осталась в прежнем виде:', error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
