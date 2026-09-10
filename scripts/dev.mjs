/**
 * dev.mjs — локальный сервер, повторяющий маршрутизацию Vercel.
 *
 *   npm run dev      →  http://localhost:3000
 *
 * Нужен, чтобы проверять сайт и админку на своей машине, не публикуя
 * ничего наружу. Разбирает те же правила, что описаны в vercel.json:
 * статика из public/, функции из api/, плюс переписывание адресов
 * языковых версий.
 *
 * Перед запуском нужны переменные окружения — проще всего положить их
 * в файл .env рядом с package.json (см. .env.example).
 */

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PUBLIC = path.join(ROOT, 'public');
const PORT = Number(process.env.PORT) || 3000;

/* --- .env ---------------------------------------------------------- */
const envFile = path.join(ROOT, '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
    }
  }
}

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.pdf': 'application/pdf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

/* --- переписывание адресов, как в vercel.json ---------------------- */
const REWRITES = [
  [/^\/$/, '/api/page', { lang: 'ru' }],
  [/^\/uz\/?$/, '/api/page', { lang: 'uz' }],
  [/^\/en\/?$/, '/api/page', { lang: 'en' }],
];

/**
 * Подбирает файл обработчика: /api/cases/12 → api/cases/[id].js,
 * /api/cases → api/cases/index.js.
 */
function resolveFunction(pathname) {
  const segments = pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean);
  const params = {};

  let dir = path.join(ROOT, 'api');

  for (const [index, segment] of segments.entries()) {
    const isLast = index === segments.length - 1;

    if (isLast) {
      const direct = path.join(dir, `${segment}.js`);
      if (fs.existsSync(direct)) return { file: direct, params };

      const asIndex = path.join(dir, segment, 'index.js');
      if (fs.existsSync(asIndex)) return { file: asIndex, params };
    } else if (fs.existsSync(path.join(dir, segment))) {
      dir = path.join(dir, segment);
      continue;
    }

    // Динамический сегмент: [id].js
    const dynamic = fs.existsSync(dir)
      ? fs.readdirSync(dir).find((name) => name.startsWith('[') && name.endsWith('].js'))
      : null;

    if (dynamic && isLast) {
      params[dynamic.slice(1, -4)] = segment;
      return { file: path.join(dir, dynamic), params };
    }
    return null;
  }

  const rootIndex = path.join(dir, 'index.js');
  return fs.existsSync(rootIndex) ? { file: rootIndex, params } : null;
}

/** Мини-обёртка над res, повторяющая методы Vercel (status/json/send). */
function decorate(res) {
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(data));
  };
  res.send = (body) => res.end(body);
  return res;
}

function serveStatic(res, file) {
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}

const server = http.createServer(async (req, res) => {
  decorate(res);

  const url = new URL(req.url, `http://localhost:${PORT}`);
  let pathname = decodeURIComponent(url.pathname);
  const query = Object.fromEntries(url.searchParams);

  for (const [pattern, destination, extra] of REWRITES) {
    if (pattern.test(pathname)) {
      pathname = destination;
      Object.assign(query, extra);
      break;
    }
  }

  /* --- функции --- */
  if (pathname.startsWith('/api')) {
    const match = resolveFunction(pathname);
    if (!match) {
      res.status(404).json({ error: `Нет обработчика для ${pathname}` });
      return;
    }

    try {
      // Импорт с меткой времени: правки в самом обработчике
      // подхватываются на лету. Файлы из api/_lib кэшируются Node —
      // после их правки сервер нужно перезапустить.
      const module = await import(`${pathToFileURL(match.file).href}?t=${Date.now()}`);
      req.query = { ...query, ...match.params };
      await module.default(req, res);
    } catch (error) {
      console.error(`\n  ✗ ${req.method} ${pathname}\n`, error);
      if (!res.headersSent) res.status(500).json({ error: error.message });
    }
    return;
  }

  /* --- статика --- */
  const candidates = [
    path.join(PUBLIC, pathname),
    path.join(PUBLIC, pathname, 'index.html'),
    path.join(PUBLIC, `${pathname}.html`),
  ];

  for (const candidate of candidates) {
    if (candidate.startsWith(PUBLIC) && fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      serveStatic(res, candidate);
      return;
    }
  }

  res.status(404).send(`404 — ${pathname}`);
});

server.listen(PORT, () => {
  console.log(`\n  Сайт:    http://localhost:${PORT}`);
  console.log(`  Узбекский: http://localhost:${PORT}/uz/`);
  console.log(`  Английский: http://localhost:${PORT}/en/`);
  console.log(`  Админка: http://localhost:${PORT}/admin/\n`);
});
