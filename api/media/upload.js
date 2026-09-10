/**
 * POST /api/media/upload?name=oshxona.webp — загрузка обложки.
 *
 * Тело запроса — сам файл (не multipart): админка перед отправкой уже
 * сжала картинку в браузере до 1680 px и перевела в webp, так что
 * серверу остаётся проверить тип и размер и положить файл в хранилище.
 *
 * Хранилищ два. Если в проекте подключён Vercel Blob, файл уходит
 * туда — это правильное место для статики. Если нет, картинка ложится
 * в таблицу media: так админка работает сразу после разворачивания,
 * без настройки отдельного хранилища, а перейти на Blob можно потом —
 * старые ссылки продолжат работать.
 */

import { put } from '@vercel/blob';
import { queryOne } from '../_lib/db.js';
import { requireAuth } from '../_lib/auth.js';
import { badRequest, methods, readBuffer, slugify, str } from '../_lib/http.js';

const MAX_BYTES = 8 * 1024 * 1024;

// Проверяем не заголовок Content-Type (его легко подделать), а
// сигнатуру в первых байтах файла.
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const SIGNATURES = [
  {
    type: 'image/webp',
    ext: 'webp',
    test: (b) =>
      b.slice(0, 4).toString('ascii') === 'RIFF' && b.slice(8, 12).toString('ascii') === 'WEBP',
  },
  { type: 'image/jpeg', ext: 'jpg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { type: 'image/png', ext: 'png', test: (b) => b.slice(0, 8).equals(PNG_MAGIC) },
];

function detectImage(buffer) {
  if (buffer.length < 12) throw badRequest('Файл пустой или слишком маленький');

  const found = SIGNATURES.find((signature) => signature.test(buffer));
  if (!found) throw badRequest('Поддерживаются только картинки: webp, jpg или png');

  return found;
}

export default requireAuth(
  methods({
    POST: async (req, res) => {
      const buffer = await readBuffer(req, MAX_BYTES);
      const image = detectImage(buffer);

      const requested = str(req.query?.name, 'Имя файла', { required: false, max: 120 });
      const base = slugify(requested.replace(/\.[a-z0-9]+$/i, '')) || 'case';
      const filename = `${base}.${image.ext}`;

      // Имя в Blob получает случайный суффикс: повторная загрузка не
      // затирает старую картинку, и уже сохранённая карточка не ломается.
      if (process.env.BLOB_READ_WRITE_TOKEN) {
        const blob = await put(`cases/${filename}`, buffer, {
          access: 'public',
          contentType: image.type,
          addRandomSuffix: true,
          cacheControlMaxAge: 31_536_000,
        });

        res.status(201).json({ url: blob.url, size: buffer.length, storage: 'blob' });
        return;
      }

      const row = await queryOne(
        'INSERT INTO media (filename, mime, bytes) VALUES ($1, $2, $3) RETURNING id',
        [filename, image.type, buffer]
      );

      res.status(201).json({
        url: `/api/media/${row.id}.${image.ext}`,
        size: buffer.length,
        storage: 'database',
      });
    },
  })
);

// Тело читаем сами, иначе Vercel попытается разобрать картинку как JSON
export const config = { api: { bodyParser: false } };
