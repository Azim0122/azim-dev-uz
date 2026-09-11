/**
 * export-sql.mjs — собирает схему и стартовые данные в один SQL-файл.
 *
 *   npm run db:sql            → печатает SQL в консоль
 *   npm run db:sql > init.sql → сохраняет в файл
 *
 * Нужен, когда базу заполняют через веб-редактор SQL (Neon, Supabase),
 * а не скриптом: строка подключения при этом нигде не участвует.
 * Результат идемпотентен — повторный запуск обновит записи, а не
 * создаст дубли.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(here);

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const legacy = readJson(path.join(here, 'legacy-cases.json'));
const dicts = Object.fromEntries(
  ['ru', 'uz', 'en'].map((lang) => [lang, readJson(path.join(root, 'content', `${lang}.json`))])
);

/** Строка для SQL: одинарные кавычки удваиваются, как требует стандарт. */
const q = (value) => `'${String(value).replace(/'/g, "''")}'`;

const out = [];
out.push(fs.readFileSync(path.join(here, 'schema.sql'), 'utf8'));
out.push('\n-- =====================================================================');
out.push('-- Стартовые данные: вкладки, тэги, работы');
out.push('-- =====================================================================\n');
out.push('BEGIN;\n');

/* --- вкладки ---------------------------------------------------------- */
for (const [index, slug] of legacy.categories.entries()) {
  out.push(
    `INSERT INTO categories (slug, title_ru, title_uz, title_en, sort_order) VALUES (` +
      [
        q(slug),
        q(dicts.ru.cases.categories[slug]),
        q(dicts.uz.cases.categories[slug]),
        q(dicts.en.cases.categories[slug]),
        index + 1,
      ].join(', ') +
      `)\nON CONFLICT (slug) DO UPDATE SET title_ru = EXCLUDED.title_ru, ` +
      `title_uz = EXCLUDED.title_uz, title_en = EXCLUDED.title_en;\n`
  );
}

/* --- тэги ------------------------------------------------------------- */
const tagSlugs = Object.keys(dicts.ru.cases.tags);
for (const [index, slug] of tagSlugs.entries()) {
  out.push(
    `INSERT INTO tags (slug, title_ru, title_uz, title_en, sort_order) VALUES (` +
      [
        q(slug),
        q(dicts.ru.cases.tags[slug]),
        q(dicts.uz.cases.tags[slug]),
        q(dicts.en.cases.tags[slug]),
        index + 1,
      ].join(', ') +
      `)\nON CONFLICT (slug) DO UPDATE SET title_ru = EXCLUDED.title_ru, ` +
      `title_uz = EXCLUDED.title_uz, title_en = EXCLUDED.title_en;\n`
  );
}

/* --- работы ----------------------------------------------------------- */
for (const [index, item] of legacy.items.entries()) {
  out.push(
    `INSERT INTO cases (slug, url, image_url, image_width, image_height,\n` +
      `                   title_ru, title_uz, title_en,\n` +
      `                   description_ru, description_uz, description_en, sort_order)\nVALUES (` +
      [
        q(item.id),
        q(item.url),
        q(`/${item.image}`),
        item.width,
        item.height,
        q(item.title.ru),
        q(item.title.uz),
        q(item.title.en),
        q(item.description.ru),
        q(item.description.uz),
        q(item.description.en),
        index + 1,
      ].join(', ') +
      `)\nON CONFLICT (slug) DO UPDATE SET url = EXCLUDED.url, image_url = EXCLUDED.image_url,\n` +
      `  image_width = EXCLUDED.image_width, image_height = EXCLUDED.image_height,\n` +
      `  title_ru = EXCLUDED.title_ru, title_uz = EXCLUDED.title_uz, title_en = EXCLUDED.title_en,\n` +
      `  description_ru = EXCLUDED.description_ru, description_uz = EXCLUDED.description_uz,\n` +
      `  description_en = EXCLUDED.description_en;\n`
  );

  // Связи пересобираем целиком: так повторный запуск не оставит лишнего.
  out.push(`DELETE FROM case_categories WHERE case_id = (SELECT id FROM cases WHERE slug = ${q(item.id)});`);
  out.push(`DELETE FROM case_tags WHERE case_id = (SELECT id FROM cases WHERE slug = ${q(item.id)});`);

  for (const slug of item.categories) {
    out.push(
      `INSERT INTO case_categories (case_id, category_id)\n` +
        `  SELECT c.id, k.id FROM cases c, categories k WHERE c.slug = ${q(item.id)} AND k.slug = ${q(slug)};`
    );
  }
  for (const slug of item.tags) {
    out.push(
      `INSERT INTO case_tags (case_id, tag_id)\n` +
        `  SELECT c.id, t.id FROM cases c, tags t WHERE c.slug = ${q(item.id)} AND t.slug = ${q(slug)};`
    );
  }
  out.push('');
}

out.push('COMMIT;');

console.log(out.join('\n'));
