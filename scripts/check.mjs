/**
 * check.mjs — проверка перед публикацией.
 *
 *   npm run check
 *
 * Что смотрим:
 *   1. Все три языковые версии собираются и содержат нужные SEO-теги.
 *   2. Каждый локальный файл, на который ссылается разметка, есть в public/.
 *   3. В узбекской и английской версиях не осталось кириллицы.
 *   4. У всех работ, вкладок и тэгов заполнены три перевода.
 *
 * Запускается на данных из той базы, что указана в DATABASE_URL.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PUBLIC = path.join(ROOT, 'public');

/* --- .env, чтобы команду можно было запускать без экспорта вручную --- */
const envFile = path.join(ROOT, '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
    }
  }
}

const { loadCases, site } = await import('../api/_lib/content.js');
const { renderPage } = await import('../api/_lib/render.js');
const { query } = await import('../api/_lib/db.js');

const errors = [];
const warnings = [];

const data = await loadCases();

/* ------------------------------------------------------------------ */
/* Страницы                                                            */
/* ------------------------------------------------------------------ */

for (const lang of site.languages) {
  const html = renderPage(lang, data);
  const base = lang === site.defaultLang ? '/' : `/${lang}/`;

  /* ссылки на локальные файлы */
  const refs = new Set();
  for (const re of [
    /(?:src|href)="(\/[^"#?]+)"/g,
    /srcset="(\/[^"#?\s]+)"/g,
    /data-src(?:-mini|-full)?="(\/[^"#?]+)"/g,
    /poster="(\/[^"#?]+)"/g,
  ]) {
    for (const match of html.matchAll(re)) refs.add(match[1].split('?')[0]);
  }

  for (const ref of refs) {
    if (ref === '/' || ref.startsWith('/uz/') || ref.startsWith('/en/')) continue;
    // Картинки из базы отдаёт функция, файла на диске для них нет
    if (ref.startsWith('/api/media/')) continue;
    if (!fs.existsSync(path.join(PUBLIC, ref))) errors.push(`${lang}: нет файла ${ref}`);
  }

  /* обязательные теги */
  if (!/<title>.+<\/title>/.test(html)) errors.push(`${lang}: пустой <title>`);
  if (!/name="description" content=".{50,}"/.test(html)) errors.push(`${lang}: слабый description`);
  if (!html.includes(`<link rel="canonical" href="${site.domain}${base}"`)) {
    errors.push(`${lang}: неверный canonical`);
  }
  for (const code of [...site.languages, 'x-default']) {
    if (!html.includes(`hreflang="${code}"`)) errors.push(`${lang}: нет hreflang="${code}"`);
  }
  if (!new RegExp(`<html lang="${lang}"`).test(html)) errors.push(`${lang}: неверный lang у <html>`);
  if ((html.match(/lang-switcher__link/g) || []).length !== site.languages.length) {
    errors.push(`${lang}: переключатель языка собран неверно`);
  }

  /* кириллица там, где её быть не должно */
  if (lang !== 'ru') {
    const text = html
      .replace(/<script[\s\S]*?<\/script>/g, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<[^>]+>/g, ' ');
    const found = [...new Set(text.match(/[А-Яа-яЁё][А-Яа-яЁё\- ]{2,40}/g) || [])];
    if (found.length) warnings.push(`${lang}: кириллица — ${found.slice(0, 6).join(' | ')}`);
  }
}

/* ------------------------------------------------------------------ */
/* Полнота переводов в базе                                            */
/* ------------------------------------------------------------------ */

const incomplete = await query(`
  SELECT 'работа' AS kind, slug FROM cases
  WHERE is_published AND (
    title_ru = '' OR title_uz = '' OR title_en = '' OR
    description_ru = '' OR description_uz = '' OR description_en = '')
  UNION ALL
  SELECT 'вкладка', slug FROM categories
  WHERE is_active AND (title_ru = '' OR title_uz = '' OR title_en = '')
  UNION ALL
  SELECT 'тэг', slug FROM tags
  WHERE title_ru = '' OR title_uz = '' OR title_en = ''
`);

for (const row of incomplete) warnings.push(`${row.kind} «${row.slug}»: заполнены не все языки`);

/* ------------------------------------------------------------------ */
/* Итог                                                                */
/* ------------------------------------------------------------------ */

for (const warning of warnings) console.log(`  ⚠︎  ${warning}`);
for (const error of errors) console.log(`  ✗  ${error}`);

if (errors.length) {
  console.log(`\n  Ошибок: ${errors.length}`);
  process.exit(1);
}

console.log(
  `\n  ✓ Проверка пройдена: ${site.languages.length} языка, ${data.items.length} работ, ${data.categories.length} вкладок.`
);
if (warnings.length) console.log(`    Предупреждений: ${warnings.length}`);
process.exit(0);
