/**
 * verify.mjs — проверка собранного сайта перед деплоем.
 *
 *   node scripts/verify.mjs
 *
 * Что проверяем:
 *   1. Все три языковые версии собрались.
 *   2. Каждый локальный файл (css/js/img/video), на который ссылается
 *      разметка, реально лежит в dist.
 *   3. В нерусских версиях не осталось кириллицы (недопереведённые куски).
 *   4. На каждой странице есть title, description, canonical и hreflang.
 *   5. Все карточки работ на месте и число тегов совпадает по языкам.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIST = path.join(ROOT, 'dist');
const site = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/site.json'), 'utf8'));
const cases = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/cases.json'), 'utf8'));

const errors = [];
const warnings = [];
const fail = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

const pages = site.languages.map((lang) => ({
  lang,
  file: lang === site.defaultLang ? 'index.html' : `${lang}/index.html`,
}));

for (const { lang, file } of pages) {
  const full = path.join(DIST, file);
  if (!fs.existsSync(full)) {
    fail(`${lang}: нет файла ${file}`);
    continue;
  }
  const html = fs.readFileSync(full, 'utf8');

  /* --- ссылки на локальные файлы --- */
  const refs = new Set();
  for (const re of [
    /(?:src|href)="(\/[^"#?]+)"/g,
    /srcset="(\/[^"#?\s]+)"/g,
    /data-src(?:-mini|-full)?="(\/[^"#?]+)"/g,
    /poster="(\/[^"#?]+)"/g,
  ]) {
    for (const m of html.matchAll(re)) refs.add(m[1].split('?')[0]);
  }
  for (const ref of refs) {
    if (ref === '/' || ref.startsWith('/uz/') || ref.startsWith('/en/')) continue;
    if (!fs.existsSync(path.join(DIST, ref))) fail(`${lang}: файл не найден — ${ref}`);
  }

  /* --- обязательные SEO-теги --- */
  if (!/<title>.+<\/title>/.test(html)) fail(`${lang}: пустой <title>`);
  if (!/name="description" content=".{50,}"/.test(html)) fail(`${lang}: слабый description`);
  if (!html.includes(`<link rel="canonical" href="${site.domain}${lang === site.defaultLang ? '/' : `/${lang}/`}"`))
    fail(`${lang}: неверный canonical`);
  for (const code of site.languages) {
    if (!html.includes(`hreflang="${code}"`)) fail(`${lang}: нет hreflang="${code}"`);
  }
  if (!html.includes('hreflang="x-default"')) fail(`${lang}: нет hreflang="x-default"`);
  if (!new RegExp(`<html lang="${lang}"`).test(html)) fail(`${lang}: неверный lang у <html>`);

  /* --- карточки работ --- */
  const cardCount = (html.match(/class="cases__item"/g) || []).length;
  const expected = cases.categories.reduce(
    (sum, key) => sum + cases.items.filter((i) => i.categories.includes(key)).length,
    0
  );
  if (cardCount !== expected) fail(`${lang}: карточек ${cardCount}, ожидалось ${expected}`);

  /* --- переключатель языка --- */
  if ((html.match(/lang-switcher__link/g) || []).length !== site.languages.length)
    fail(`${lang}: переключатель языка собран неверно`);

  /* --- кириллица в нерусских версиях --- */
  if (lang !== 'ru') {
    const body = html
      .replace(/<script[\s\S]*?<\/script>/g, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<[^>]+>/g, ' ');
    const cyr = [...new Set(body.match(/[А-Яа-яЁё][А-Яа-яЁё\- ]{2,40}/g) || [])];
    if (cyr.length) warn(`${lang}: найдена кириллица — ${cyr.slice(0, 8).join(' | ')}`);
  }
}

/* --- картинки работ --- */
for (const item of cases.items) {
  if (!fs.existsSync(path.join(DIST, item.image))) fail(`работа «${item.id}»: нет картинки ${item.image}`);
  for (const lang of site.languages) {
    if (!item.title[lang]) fail(`работа «${item.id}»: нет названия для ${lang}`);
    if (!item.description[lang]) fail(`работа «${item.id}»: нет описания для ${lang}`);
  }
}

/* --- отчёт --- */
for (const w of warnings) console.log(`  ⚠︎  ${w}`);
for (const e of errors) console.log(`  ✗  ${e}`);

if (errors.length === 0) {
  console.log(`\n  ✓ Проверка пройдена: ${pages.length} страницы, ${cases.items.length} работ.`);
  if (warnings.length) console.log(`    (предупреждений: ${warnings.length})`);
} else {
  console.log(`\n  Ошибок: ${errors.length}`);
  process.exit(1);
}
