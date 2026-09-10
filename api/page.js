/**
 * GET /            → русская версия
 * GET /uz/, /en/   → остальные языки
 *
 * Страница собирается на лету из базы, поэтому правка в админке видна
 * без пересборки сайта. Чтобы каждый посетитель не будил базу, готовый
 * HTML на минуту кладётся в кеш CDN, а дальше ещё сутки отдаётся
 * «устаревшая» копия, пока в фоне готовится свежая. Практический
 * итог: правка появляется в течение минуты, а база получает
 * примерно один запрос в минуту независимо от посещаемости.
 */

import { loadCases, site } from './_lib/content.js';
import { renderPage } from './_lib/render.js';

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    res.status(405).send('Method Not Allowed');
    return;
  }

  const requested = String(req.query?.lang || site.defaultLang);
  const lang = site.languages.includes(requested) ? requested : site.defaultLang;

  try {
    const data = await loadCases();
    const html = renderPage(lang, data);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=86400');
    res.status(200).send(html);
  } catch (error) {
    // База недоступна — показываем страницу без блока работ, а не
    // ошибку целиком: остальной сайт от этого не зависит.
    console.error('Не удалось собрать страницу:', error);

    const html = renderPage(lang, { categories: [], items: [] });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).send(html);
  }
}
