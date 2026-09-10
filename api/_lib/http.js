/**
 * http.js — общая обвязка для обработчиков API: маршрутизация по
 * методу, разбор тела запроса, единый формат ошибок и валидация.
 */

/** Ошибка, которую можно безопасно показать пользователю. */
export class ApiError extends Error {
  constructor(status, message, details = null) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const badRequest = (message, details) => new ApiError(400, message, details);
export const notFound = (message = 'Не найдено') => new ApiError(404, message);
export const conflict = (message) => new ApiError(409, message);

/**
 * Раскладывает обработчики по HTTP-методам и ловит всё, что упало.
 *
 *   export default methods({ GET: list, POST: create });
 */
export function methods(map) {
  return async (req, res) => {
    const handler = map[req.method];

    if (!handler) {
      res.setHeader('Allow', Object.keys(map).join(', '));
      res.status(405).json({ error: `Метод ${req.method} здесь не поддерживается` });
      return;
    }

    try {
      await handler(req, res);
    } catch (error) {
      if (error instanceof ApiError) {
        res.status(error.status).json({ error: error.message, details: error.details });
        return;
      }
      // Внутрь ошибки лезть не даём: в логи — подробности, наружу — общий текст
      console.error('Ошибка обработчика:', error);
      res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
  };
}

/**
 * Тело запроса. Vercel обычно разбирает JSON сам, но при загрузке
 * файлов и в локальном сервере тело приходит потоком — читаем сами.
 */
export async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw badRequest('Тело запроса — не корректный JSON');
  }
}

/** Сырое тело — для загрузки картинок. */
export async function readBuffer(req, limitBytes) {
  const chunks = [];
  let size = 0;

  for await (const chunk of req) {
    size += chunk.length;
    if (size > limitBytes) {
      throw badRequest(`Файл больше допустимых ${Math.round(limitBytes / 1024 / 1024)} МБ`);
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/* ------------------------------------------------------------------ */
/* Валидация                                                           */
/* ------------------------------------------------------------------ */

export const LANGS = ['ru', 'uz', 'en'];

export function str(value, field, { required = true, max = 500, min = 0 } = {}) {
  const text = typeof value === 'string' ? value.trim() : '';

  if (!text) {
    if (required) throw badRequest(`Поле «${field}» обязательно`);
    return '';
  }
  if (text.length < min) throw badRequest(`Поле «${field}»: минимум ${min} символов`);
  if (text.length > max) throw badRequest(`Поле «${field}»: максимум ${max} символов`);

  return text;
}

/** Три языковых поля разом: title_ru / title_uz / title_en. */
export function translations(source, field, options = {}) {
  const result = {};
  for (const lang of LANGS) {
    result[lang] = str(source?.[lang], `${field} (${lang.toUpperCase()})`, options);
  }
  return result;
}

export function int(value, field, { min = -2147483648, max = 2147483647, fallback = null } = {}) {
  if (value === undefined || value === null || value === '') {
    if (fallback !== null) return fallback;
    throw badRequest(`Поле «${field}» обязательно`);
  }

  const number = Number(value);
  if (!Number.isInteger(number)) throw badRequest(`Поле «${field}» должно быть целым числом`);
  if (number < min || number > max) {
    throw badRequest(`Поле «${field}»: допустимо от ${min} до ${max}`);
  }
  return number;
}

export function bool(value, fallback = false) {
  if (value === undefined || value === null) return fallback;
  return value === true || value === 'true' || value === 1 || value === '1';
}

/** Массив целых id — для связей карточки с категориями и тэгами. */
export function idList(value, field) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw badRequest(`Поле «${field}» должно быть списком`);

  return [...new Set(value.map((item) => int(item, field, { min: 1 })))];
}

/** Ссылка: разрешаем только http и https. */
export function url(value, field, { required = true } = {}) {
  const text = str(value, field, { required, max: 500 });
  if (!text) return '';

  let parsed;
  try {
    parsed = new URL(text);
  } catch {
    throw badRequest(`Поле «${field}»: это не похоже на адрес сайта`);
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw badRequest(`Поле «${field}»: допустимы только адреса http и https`);
  }
  return parsed.toString();
}

/**
 * Путь к картинке или видео. Допускаем три вида адресов:
 * файл в репозитории, картинку из базы (/api/media/12.webp)
 * и внешнюю ссылку на хранилище.
 */
export function mediaUrl(value, field, { required = true } = {}) {
  const text = str(value, field, { required, max: 500 });
  if (!text) return '';

  const localPrefixes = ['/uploads/', '/assets/', '/api/media/'];
  if (localPrefixes.some((prefix) => text.startsWith(prefix))) return text;

  return url(text, field);
}

/** Технический код: латиница, цифры и дефис. */
export function slug(value, field) {
  const text = str(value, field, { max: 120 }).toLowerCase();
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(text)) {
    throw badRequest(`Поле «${field}»: только латиница, цифры и дефис`);
  }
  return text;
}

/** Делает код из названия — для формы, где его не ввели руками. */
export function slugify(source) {
  const map = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i',
    й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't',
    у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '',
    э: 'e', ю: 'yu', я: 'ya',
  };

  return String(source)
    .toLowerCase()
    .replace(/[а-яё]/g, (char) => map[char] ?? '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}
