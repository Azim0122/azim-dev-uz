/**
 * content.js — сборка данных для публичной страницы.
 *
 * Тексты интерфейса (меню, услуги, экспертиза, футер) лежат в
 * content/*.json и меняются в коде. Всё, что редактируется через
 * админку — работы, вкладки и тэги — читается из базы.
 */

import fs from 'node:fs';
import path from 'node:path';
import { query } from './db.js';

const ROOT = path.join(process.cwd(), 'content');
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));

export const site = readJson('site.json');
export const dictionaries = Object.fromEntries(
  site.languages.map((lang) => [lang, readJson(`${lang}.json`)])
);

/**
 * Работы, вкладки и тэги одним походом в базу.
 *
 * Три отдельных запроса вместо одного с join'ами: строк здесь
 * десятки, а не тысячи, зато не нужно разбирать дублирующиеся
 * строки после join и данные приходят сразу в нужной форме.
 */
export async function loadCases() {
  const [categories, cases, links] = await Promise.all([
    query(`
      SELECT id, slug, title_ru, title_uz, title_en
      FROM categories
      WHERE is_active = TRUE
      ORDER BY sort_order, id
    `),
    query(`
      SELECT id, slug, url, image_url, image_width, image_height, video_url,
             title_ru, title_uz, title_en,
             description_ru, description_uz, description_en
      FROM cases
      WHERE is_published = TRUE
      ORDER BY sort_order, id
    `),
    query(`
      SELECT cc.case_id, cc.category_id,
             ct.tag_id, t.slug AS tag_slug,
             t.title_ru AS tag_ru, t.title_uz AS tag_uz, t.title_en AS tag_en,
             t.sort_order AS tag_order
      FROM case_categories cc
      FULL OUTER JOIN case_tags ct ON ct.case_id = cc.case_id
      LEFT JOIN tags t ON t.id = ct.tag_id
      ORDER BY t.sort_order NULLS LAST, t.id
    `),
  ]);

  const categoriesByCase = new Map();
  const tagsByCase = new Map();

  for (const row of links) {
    const caseId = row.case_id;
    if (caseId == null) continue;

    if (row.category_id != null) {
      if (!categoriesByCase.has(caseId)) categoriesByCase.set(caseId, new Set());
      categoriesByCase.get(caseId).add(row.category_id);
    }
    if (row.tag_id != null) {
      if (!tagsByCase.has(caseId)) tagsByCase.set(caseId, []);
      const list = tagsByCase.get(caseId);
      if (!list.some((tag) => tag.id === row.tag_id)) {
        list.push({
          id: row.tag_id,
          slug: row.tag_slug,
          title: { ru: row.tag_ru, uz: row.tag_uz, en: row.tag_en },
        });
      }
    }
  }

  const items = cases.map((row) => ({
    id: row.id,
    slug: row.slug,
    url: row.url,
    image: row.image_url,
    width: row.image_width,
    height: row.image_height,
    video: row.video_url,
    title: { ru: row.title_ru, uz: row.title_uz, en: row.title_en },
    description: { ru: row.description_ru, uz: row.description_uz, en: row.description_en },
    categoryIds: categoriesByCase.get(row.id) ?? new Set(),
    tags: tagsByCase.get(row.id) ?? [],
  }));

  return {
    categories: categories.map((row) => ({
      id: row.id,
      slug: row.slug,
      title: { ru: row.title_ru, uz: row.title_uz, en: row.title_en },
      items: items.filter((item) => item.categoryIds.has(row.id)),
    })),
    items,
  };
}
