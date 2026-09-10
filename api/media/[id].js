/**
 * GET /api/media/12.webp — картинка, загруженная через админку, когда
 * она хранится в базе (см. media/upload.js).
 *
 * Адрес отдаётся без авторизации: это обложка на публичной странице.
 * Содержимое по конкретному адресу никогда не меняется — новая
 * загрузка получает новый id, — поэтому кешируем навсегда.
 */

import { queryOne } from '../_lib/db.js';
import { badRequest, methods, notFound } from '../_lib/http.js';

export default methods({
  GET: async (req, res) => {
    // Расширение в адресе нужно браузерам и превью в мессенджерах,
    // для поиска в базе берём только число перед точкой.
    const id = Number(String(req.query?.id ?? '').split('.')[0]);
    if (!Number.isInteger(id) || id < 1) throw badRequest('Неверный адрес картинки');

    const row = await queryOne('SELECT mime, bytes FROM media WHERE id = $1', [id]);
    if (!row) throw notFound('Картинка не найдена');

    res.setHeader('Content-Type', row.mime);
    res.setHeader('Content-Length', row.bytes.length);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.status(200).send(row.bytes);
  },
});
