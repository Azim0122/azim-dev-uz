-- =====================================================================
-- Схема базы данных сайта azim-dev.uz
--
-- Три языка хранятся колонками (title_ru / title_uz / title_en), а не
-- отдельной таблицей переводов: языков ровно три, они заданы заранее,
-- и такой вариант читается и пишется одним запросом без join'ов.
--
-- Применяется скриптом:  npm run db:migrate
-- Повторный запуск безопасен.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Вкладки в блоке «Мои работы»
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
    id          SERIAL PRIMARY KEY,
    slug        TEXT        NOT NULL UNIQUE,
    title_ru    TEXT        NOT NULL,
    title_uz    TEXT        NOT NULL,
    title_en    TEXT        NOT NULL,
    sort_order  INTEGER     NOT NULL DEFAULT 0,
    is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- Тэги на карточках («Лого», «UX/UI», «Разработка» …)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tags (
    id          SERIAL PRIMARY KEY,
    slug        TEXT        NOT NULL UNIQUE,
    title_ru    TEXT        NOT NULL,
    title_uz    TEXT        NOT NULL,
    title_en    TEXT        NOT NULL,
    sort_order  INTEGER     NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- Карточки работ
--
-- image_url хранит либо путь к файлу в репозитории (/uploads/img/...),
-- либо полный адрес картинки, загруженной через админку в хранилище.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cases (
    id             SERIAL PRIMARY KEY,
    slug           TEXT        NOT NULL UNIQUE,
    url            TEXT        NOT NULL,
    image_url      TEXT        NOT NULL,
    image_width    INTEGER     NOT NULL DEFAULT 1680,
    image_height   INTEGER     NOT NULL DEFAULT 909,
    video_url      TEXT,
    title_ru       TEXT        NOT NULL,
    title_uz       TEXT        NOT NULL,
    title_en       TEXT        NOT NULL,
    description_ru TEXT        NOT NULL DEFAULT '',
    description_uz TEXT        NOT NULL DEFAULT '',
    description_en TEXT        NOT NULL DEFAULT '',
    is_published   BOOLEAN     NOT NULL DEFAULT TRUE,
    sort_order     INTEGER     NOT NULL DEFAULT 0,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Одна карточка может стоять в нескольких вкладках сразу
CREATE TABLE IF NOT EXISTS case_categories (
    case_id     INTEGER NOT NULL REFERENCES cases(id)      ON DELETE CASCADE,
    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    PRIMARY KEY (case_id, category_id)
);

CREATE TABLE IF NOT EXISTS case_tags (
    case_id INTEGER NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    tag_id  INTEGER NOT NULL REFERENCES tags(id)  ON DELETE CASCADE,
    PRIMARY KEY (case_id, tag_id)
);

-- ---------------------------------------------------------------------
-- Вход в админку. Пароль хранится как scrypt-хэш, в открытом виде
-- нигде не сохраняется. Пользователь заводится скриптом db:admin.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_users (
    id            SERIAL PRIMARY KEY,
    login         TEXT        NOT NULL UNIQUE,
    password_hash TEXT        NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_login_at TIMESTAMPTZ
);

-- Индексы под запросы, которые делает публичная страница
CREATE INDEX IF NOT EXISTS idx_cases_published ON cases (is_published, sort_order, id);
CREATE INDEX IF NOT EXISTS idx_categories_active ON categories (is_active, sort_order, id);
CREATE INDEX IF NOT EXISTS idx_case_categories_category ON case_categories (category_id);

-- updated_at проставляется базой, а не приложением: так значение
-- остаётся верным при любой правке, откуда бы она ни пришла.
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['categories', 'tags', 'cases'] LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS trg_%1$s_touch ON %1$s', t);
        EXECUTE format(
            'CREATE TRIGGER trg_%1$s_touch BEFORE UPDATE ON %1$s
             FOR EACH ROW EXECUTE FUNCTION touch_updated_at()', t);
    END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- Картинки, загруженные через админку.
--
-- Основное хранилище — Vercel Blob (переменная BLOB_READ_WRITE_TOKEN).
-- Если оно не подключено, файл кладётся сюда: обложка после сжатия в
-- браузере весит около сотни килобайт, десятки таких строк базе
-- незаметны, зато админка работает сразу, без настройки хранилища.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS media (
    id         SERIAL PRIMARY KEY,
    filename   TEXT        NOT NULL,
    mime       TEXT        NOT NULL,
    bytes      BYTEA       NOT NULL,
    width      INTEGER,
    height     INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
