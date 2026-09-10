/**
 * admin.js — интерфейс админки.
 *
 * Всё на обычном JavaScript, без фреймворков и сборки: файл лежит
 * рядом со страницей и правится без установки чего бы то ни было.
 *
 * Данные приходят из /api/*, разметка перерисовывается целиком при
 * каждом изменении — списков тут десятки строк, экономить не на чем,
 * зато состояние на экране всегда совпадает с состоянием в базе.
 */

const LANGS = [
  { code: 'ru', label: 'Русский' },
  { code: 'uz', label: 'O‘zbekcha' },
  { code: 'en', label: 'English' },
];

const state = {
  user: null,
  cases: [],
  categories: [],
  tags: [],
};

/* ================================================================== */
/* Мелкие помощники                                                    */
/* ================================================================== */

const $ = (selector) => document.querySelector(selector);
const el = (id) => document.getElementById(id);

/** Экранирование — всё, что пришло из базы, попадает в разметку через неё. */
const esc = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

let toastTimer;
function toast(message, isError = false) {
  const node = el('toast');
  node.textContent = message;
  node.className = isError ? 'toast toast--error' : 'toast';
  node.hidden = false;

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    node.hidden = true;
  }, isError ? 5000 : 2600);
}

/** Запрос к API. Ошибку с понятным текстом бросаем наверх как есть. */
async function api(path, { method = 'GET', body, raw, query } = {}) {
  const isLogin = path === '/auth/login';
  const url = new URL(`/api${path}`, location.origin);
  for (const [key, value] of Object.entries(query || {})) url.searchParams.set(key, value);

  const options = { method, headers: {} };

  if (raw) {
    options.body = raw;
    options.headers['Content-Type'] = 'application/octet-stream';
  } else if (body !== undefined) {
    options.body = JSON.stringify(body);
    options.headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, options);

  // 401 на самой форме входа — это просто неверный пароль, а не
  // истёкшая сессия: разводим случаи, иначе форма покажет не тот текст.
  if (response.status === 401 && !isLogin) {
    state.user = null;
    showLogin();
    throw new Error('Сессия закончилась — войдите заново');
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Ошибка ${response.status}`);

  return data;
}

/* ================================================================== */
/* Экраны                                                             */
/* ================================================================== */

function showLogin() {
  el('screen-app').hidden = true;
  el('screen-login').hidden = false;
  $('#login-form input[name="login"]').focus();
}

function showApp() {
  el('screen-login').hidden = true;
  el('screen-app').hidden = false;
}

function switchView(name) {
  for (const tab of document.querySelectorAll('.tabs__item')) {
    tab.classList.toggle('is-active', tab.dataset.view === name);
  }
  for (const view of document.querySelectorAll('.view')) {
    view.classList.toggle('is-active', view.id === `view-${name}`);
  }
}

/* ================================================================== */
/* Загрузка данных                                                    */
/* ================================================================== */

async function loadAll() {
  const [cases, categories, tags] = await Promise.all([
    api('/cases'),
    api('/categories'),
    api('/tags'),
  ]);

  state.cases = cases.items;
  state.categories = categories.items;
  state.tags = tags.items;

  renderCases();
  renderTaxonomy('categories');
  renderTaxonomy('tags');
}

/* ================================================================== */
/* Список работ                                                       */
/* ================================================================== */

function renderCases() {
  const container = el('cases-list');

  if (!state.cases.length) {
    container.innerHTML = '<div class="list__empty">Работ пока нет. Нажмите «Добавить работу».</div>';
    return;
  }

  const categoryById = new Map(state.categories.map((item) => [item.id, item]));

  container.innerHTML = state.cases
    .map((item, index) => {
      const badges = (item.categoryIds || [])
        .map((id) => categoryById.get(id))
        .filter(Boolean)
        .map((category) => `<span class="badge">${esc(category.title.ru)}</span>`)
        .join('');

      const missing = LANGS.filter(
        (lang) => !item.title[lang.code]?.trim() || !item.description[lang.code]?.trim()
      ).map((lang) => lang.code.toUpperCase());

      const warning = missing.length
        ? `<span class="badge badge--warn">нет перевода: ${missing.join(', ')}</span>`
        : '';

      return `
        <div class="row${item.isPublished ? '' : ' row--muted'}" data-id="${item.id}">
          <div class="row__move">
            <button type="button" data-move="up" data-id="${item.id}" ${index === 0 ? 'disabled' : ''} aria-label="Выше">▲</button>
            <button type="button" data-move="down" data-id="${item.id}" ${index === state.cases.length - 1 ? 'disabled' : ''} aria-label="Ниже">▼</button>
          </div>
          <img class="row__thumb" src="${esc(item.image)}" alt="" loading="lazy">
          <div class="row__main">
            <div class="row__title">${esc(item.title.ru || item.slug)}</div>
            <div class="row__meta">${esc(item.url)}</div>
            <div class="row__badges">${badges}${warning}${item.isPublished ? '' : '<span class="badge">скрыта</span>'}</div>
          </div>
          <div class="row__actions">
            <button class="button button--ghost button--small" type="button" data-toggle="${item.id}">
              ${item.isPublished ? 'Скрыть' : 'Показать'}
            </button>
            <button class="button button--ghost button--small" type="button" data-edit="${item.id}">Изменить</button>
            <button class="button button--danger button--small" type="button" data-delete="${item.id}">Удалить</button>
          </div>
        </div>`;
    })
    .join('');
}

async function moveCase(id, direction) {
  const order = state.cases.map((item) => item.id);
  const from = order.indexOf(id);
  const to = direction === 'up' ? from - 1 : from + 1;
  if (to < 0 || to >= order.length) return;

  [order[from], order[to]] = [order[to], order[from]];

  // Переставляем сразу на экране, не дожидаясь ответа: так список не
  // «прыгает». Ответ сервера всё равно перезапишет состояние.
  state.cases = order.map((itemId) => state.cases.find((item) => item.id === itemId));
  renderCases();

  const result = await api('/cases/reorder', { method: 'POST', body: { ids: order } });
  state.cases = result.items;
  renderCases();
}

/* ================================================================== */
/* Модальное окно                                                     */
/* ================================================================== */

let onSave = null;

function openModal(title, html, saveHandler) {
  el('modal-title').textContent = title;
  el('modal-body').innerHTML = html;
  el('modal-error').hidden = true;
  el('modal').hidden = false;
  onSave = saveHandler;

  const firstInput = $('#modal-body input, #modal-body textarea');
  if (firstInput) firstInput.focus();
}

function closeModal() {
  el('modal').hidden = true;
  el('modal-body').innerHTML = '';
  onSave = null;
}

function modalError(message) {
  const node = el('modal-error');
  node.textContent = message;
  node.hidden = !message;
}

/**
 * Блок из трёх языковых вкладок.
 * `fields` — описание полей: [{ name, label, type, hint }].
 */
function langBlock(fields, values = {}) {
  const tabs = LANGS.map(
    (lang, index) =>
      `<button class="lang-tabs__item${index === 0 ? ' is-active' : ''}" type="button" data-lang-tab="${lang.code}">${lang.label}</button>`
  ).join('');

  const panes = LANGS.map((lang, index) => {
    const inputs = fields
      .map((field) => {
        const value = esc(values[field.name]?.[lang.code] ?? '');
        const id = `${field.name}_${lang.code}`;
        const control =
          field.type === 'textarea'
            ? `<textarea class="field__textarea" id="${id}" data-lang-field="${field.name}" data-lang="${lang.code}">${value}</textarea>`
            : `<input class="field__input" type="text" id="${id}" data-lang-field="${field.name}" data-lang="${lang.code}" value="${value}">`;

        return `<label class="field">
            <span class="field__label">${esc(field.label)}</span>
            ${control}
            ${field.hint ? `<span class="field__hint">${esc(field.hint)}</span>` : ''}
          </label>`;
      })
      .join('');

    return `<div class="lang-pane${index === 0 ? ' is-active' : ''}" data-lang-pane="${lang.code}">${inputs}</div>`;
  }).join('');

  return `<div class="lang-tabs">${tabs}
      <button class="lang-tabs__copy" type="button" data-copy-ru>Скопировать из русского</button>
    </div>${panes}`;
}

/** Собирает значения языковых полей обратно в { ru, uz, en }. */
function readLangField(name) {
  const result = {};
  for (const lang of LANGS) {
    const node = $(`[data-lang-field="${name}"][data-lang="${lang.code}"]`);
    result[lang.code] = node ? node.value.trim() : '';
  }
  return result;
}

/** Отмечает точкой вкладки языка, где что-то не заполнено. */
function markEmptyLangs(fieldNames) {
  for (const lang of LANGS) {
    const empty = fieldNames.some((name) => {
      const node = $(`[data-lang-field="${name}"][data-lang="${lang.code}"]`);
      return node && !node.value.trim();
    });
    $(`[data-lang-tab="${lang.code}"]`)?.classList.toggle('is-empty', empty);
  }
}

/* ================================================================== */
/* Форма работы                                                       */
/* ================================================================== */

function checkboxes(items, name, selected = []) {
  return items
    .map(
      (item) => `<label class="check">
        <input type="checkbox" data-${name}="${item.id}" ${selected.includes(item.id) ? 'checked' : ''}>
        <span>${esc(item.title.ru)}</span>
      </label>`
    )
    .join('');
}

function openCaseForm(existing = null) {
  const item = existing || {
    title: {},
    description: {},
    url: '',
    image: '',
    width: 1680,
    height: 909,
    categoryIds: [],
    tagIds: [],
    isPublished: true,
  };

  const cover = item.image
    ? `<img class="cover__preview" id="cover-preview" src="${esc(item.image)}" alt="">`
    : '<div class="cover__empty" id="cover-preview">Нет картинки</div>';

  openModal(
    existing ? 'Изменить работу' : 'Новая работа',
    `
    <div class="section-label">Обложка</div>
    <div class="cover">
      ${cover}
      <div class="cover__body">
        <p class="cover__status" id="cover-status">
          ${item.image ? `${item.width}×${item.height}` : 'Файл сожмётся до 1680 px и станет webp прямо в браузере'}
        </p>
        <input class="cover__file" type="file" id="cover-file" accept="image/png,image/jpeg,image/webp">
        <button class="button button--ghost button--small" type="button" id="cover-pick">
          ${item.image ? 'Заменить картинку' : 'Выбрать картинку'}
        </button>
        <input type="hidden" id="cover-url" value="${esc(item.image)}">
        <input type="hidden" id="cover-width" value="${item.width}">
        <input type="hidden" id="cover-height" value="${item.height}">
      </div>
    </div>

    <div class="section-label">Тексты</div>
    ${langBlock(
      [
        { name: 'title', label: 'Название работы', type: 'text' },
        { name: 'description', label: 'Короткое описание', type: 'textarea' },
      ],
      item
    )}

    <div class="section-label">Ссылка</div>
    <label class="field">
      <span class="field__label">Адрес сайта</span>
      <input class="field__input" type="url" id="case-url" value="${esc(item.url)}" placeholder="https://example.com">
      <span class="field__hint">Куда ведёт карточка при клике</span>
    </label>

    <div class="section-label">Вкладки</div>
    <div class="checks">${checkboxes(state.categories, 'category', item.categoryIds || [])}</div>

    <div class="section-label">Тэги</div>
    <div class="checks">${checkboxes(state.tags, 'tag', item.tagIds || [])}</div>

    <div class="section-label">Показ</div>
    <label class="check">
      <input type="checkbox" id="case-published" ${item.isPublished ? 'checked' : ''}>
      <span>Показывать на сайте</span>
    </label>
  `,
    async () => {
      const body = {
        title: readLangField('title'),
        description: readLangField('description'),
        url: el('case-url').value.trim(),
        image: el('cover-url').value,
        width: Number(el('cover-width').value),
        height: Number(el('cover-height').value),
        isPublished: el('case-published').checked,
        categoryIds: [...document.querySelectorAll('[data-category]:checked')].map((node) =>
          Number(node.dataset.category)
        ),
        tagIds: [...document.querySelectorAll('[data-tag]:checked')].map((node) =>
          Number(node.dataset.tag)
        ),
      };

      if (!body.image) throw new Error('Загрузите обложку');

      if (existing) {
        await api(`/cases/${existing.id}`, { method: 'PATCH', body });
      } else {
        await api('/cases', { method: 'POST', body });
      }

      const refreshed = await api('/cases');
      state.cases = refreshed.items;
      renderCases();
      toast(existing ? 'Сохранено' : 'Работа добавлена');
    }
  );

  markEmptyLangs(['title', 'description']);
  setupCoverUpload();
}

/* ------------------------------------------------------------------ */
/* Загрузка обложки                                                    */
/* ------------------------------------------------------------------ */

/**
 * Сжатие в браузере: исходник с телефона может весить 8 МБ, а на сайте
 * карточка показывается шириной около 840 px. Уменьшаем до 1680 px
 * (двойная плотность для ретины) и переводим в webp — на сервер уходит
 * уже готовый файл, и ему не нужны библиотеки обработки картинок.
 */
function shrinkImage(file, maxWidth = 1680) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const scale = Math.min(1, maxWidth / image.naturalWidth);
      const width = Math.round(image.naturalWidth * scale);
      const height = Math.round(image.naturalHeight * scale);

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(image, 0, 0, width, height);

      canvas.toBlob(
        (blob) => (blob ? resolve({ blob, width, height }) : reject(new Error('Не удалось обработать картинку'))),
        'image/webp',
        0.82
      );
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Файл не похож на картинку'));
    };

    image.src = objectUrl;
  });
}

function setupCoverUpload() {
  const input = el('cover-file');
  const pick = el('cover-pick');
  const status = el('cover-status');

  pick.addEventListener('click', () => input.click());

  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;

    try {
      pick.disabled = true;
      status.textContent = 'Обрабатываю картинку…';

      const { blob, width, height } = await shrinkImage(file);

      status.textContent = `Загружаю ${Math.round(blob.size / 1024)} КБ…`;
      const uploaded = await api('/media/upload', {
        method: 'POST',
        raw: blob,
        query: { name: file.name },
      });

      el('cover-url').value = uploaded.url;
      el('cover-width').value = width;
      el('cover-height').value = height;

      const preview = el('cover-preview');
      const image = document.createElement('img');
      image.className = 'cover__preview';
      image.id = 'cover-preview';
      image.src = uploaded.url;
      image.alt = '';
      preview.replaceWith(image);

      status.textContent = `${width}×${height}, ${Math.round(blob.size / 1024)} КБ`;
      pick.textContent = 'Заменить картинку';
    } catch (error) {
      status.textContent = '';
      modalError(error.message);
    } finally {
      pick.disabled = false;
      input.value = '';
    }
  });
}

/* ================================================================== */
/* Вкладки и тэги                                                     */
/* ================================================================== */

const TAXONOMY_LABELS = {
  categories: { one: 'вкладку', title: 'Вкладка' },
  tags: { one: 'тэг', title: 'Тэг' },
};

function renderTaxonomy(kind) {
  const container = el(`${kind}-list`);
  const items = state[kind];

  if (!items.length) {
    container.innerHTML = `<div class="list__empty">Пока пусто.</div>`;
    return;
  }

  container.innerHTML = items
    .map((item) => {
      const hidden = item.isActive === false;
      const usage = item.usedBy
        ? `<span class="badge">в ${item.usedBy} карточках</span>`
        : '<span class="badge">не используется</span>';

      return `
        <div class="row${hidden ? ' row--muted' : ''}">
          <div class="row__main">
            <div class="row__title">${esc(item.title.ru)}</div>
            <div class="row__meta">${esc(item.title.uz)} · ${esc(item.title.en)} · код: ${esc(item.slug)}</div>
            <div class="row__badges">${usage}${hidden ? '<span class="badge">скрыта</span>' : ''}</div>
          </div>
          <div class="row__actions">
            ${
              kind === 'categories'
                ? `<button class="button button--ghost button--small" type="button" data-taxonomy-toggle="${kind}:${item.id}">${hidden ? 'Показать' : 'Скрыть'}</button>`
                : ''
            }
            <button class="button button--ghost button--small" type="button" data-taxonomy-edit="${kind}:${item.id}">Изменить</button>
            <button class="button button--danger button--small" type="button" data-taxonomy-delete="${kind}:${item.id}">Удалить</button>
          </div>
        </div>`;
    })
    .join('');
}

function openTaxonomyForm(kind, existing = null) {
  const labels = TAXONOMY_LABELS[kind];
  const item = existing || { title: {} };

  openModal(
    existing ? `${labels.title}: изменить` : `Новая ${labels.one}`,
    langBlock([{ name: 'title', label: 'Название', type: 'text' }], item),
    async () => {
      const body = { title: readLangField('title') };

      if (existing) {
        await api(`/${kind}/${existing.id}`, { method: 'PATCH', body });
      } else {
        await api(`/${kind}`, { method: 'POST', body });
      }

      const refreshed = await api(`/${kind}`);
      state[kind] = refreshed.items;
      renderTaxonomy(kind);
      toast('Сохранено');
    }
  );

  markEmptyLangs(['title']);
}

async function deleteTaxonomy(kind, id) {
  const item = state[kind].find((entry) => entry.id === id);
  if (!confirm(`Удалить «${item.title.ru}»?`)) return;

  try {
    await api(`/${kind}/${id}`, { method: 'DELETE' });
  } catch (error) {
    // Сервер отказал, потому что справочник ещё используется —
    // спрашиваем ещё раз и удаляем вместе со связями.
    if (!/используется/.test(error.message)) throw error;
    if (!confirm(`${error.message}`)) return;
    await api(`/${kind}/${id}`, { method: 'DELETE', query: { force: '1' } });
  }

  const [refreshed, cases] = await Promise.all([api(`/${kind}`), api('/cases')]);
  state[kind] = refreshed.items;
  state.cases = cases.items;
  renderTaxonomy(kind);
  renderCases();
  toast('Удалено');
}

/* ================================================================== */
/* События                                                            */
/* ================================================================== */

el('login-form').addEventListener('submit', async (event) => {
  event.preventDefault();

  const form = event.target;
  const error = el('login-error');
  const submit = form.querySelector('button[type="submit"]');

  error.hidden = true;
  submit.disabled = true;

  try {
    const result = await api('/auth/login', {
      method: 'POST',
      body: { login: form.login.value, password: form.password.value },
    });

    state.user = result.user;
    form.reset();
    showApp();
    await loadAll();
  } catch (loginError) {
    error.textContent = loginError.message;
    error.hidden = false;
  } finally {
    submit.disabled = false;
  }
});

el('logout').addEventListener('click', async () => {
  await api('/auth/logout', { method: 'POST' });
  state.user = null;
  showLogin();
});

el('tabs').addEventListener('click', (event) => {
  const tab = event.target.closest('.tabs__item');
  if (tab) switchView(tab.dataset.view);
});

el('case-add').addEventListener('click', () => {
  if (!state.categories.length) {
    toast('Сначала добавьте хотя бы одну вкладку', true);
    switchView('categories');
    return;
  }
  openCaseForm();
});

/** Один обработчик на весь документ: разметка перерисовывается, а он живёт. */
document.addEventListener('click', async (event) => {
  const target = event.target.closest('[data-move], [data-edit], [data-delete], [data-toggle], [data-add-taxonomy], [data-taxonomy-edit], [data-taxonomy-delete], [data-taxonomy-toggle], [data-close-modal], [data-lang-tab], [data-copy-ru]');
  if (!target) return;

  try {
    /* --- модалка и языковые вкладки --- */
    if (target.hasAttribute('data-close-modal')) return closeModal();

    if (target.dataset.langTab) {
      const code = target.dataset.langTab;
      for (const tab of document.querySelectorAll('[data-lang-tab]')) {
        tab.classList.toggle('is-active', tab.dataset.langTab === code);
      }
      for (const pane of document.querySelectorAll('[data-lang-pane]')) {
        pane.classList.toggle('is-active', pane.dataset.langPane === code);
      }
      return;
    }

    if (target.hasAttribute('data-copy-ru')) {
      const active = $('[data-lang-pane].is-active')?.dataset.langPane;
      if (!active || active === 'ru') return toast('Это и есть русская вкладка');

      for (const node of document.querySelectorAll(`[data-lang="${active}"]`)) {
        const source = $(`[data-lang-field="${node.dataset.langField}"][data-lang="ru"]`);
        if (source) node.value = source.value;
      }
      markEmptyLangs(['title', 'description']);
      return toast('Скопировано — переведите текст');
    }

    /* --- работы --- */
    if (target.dataset.move) return await moveCase(Number(target.dataset.id), target.dataset.move);

    if (target.dataset.edit) {
      const item = state.cases.find((entry) => entry.id === Number(target.dataset.edit));
      return openCaseForm(item);
    }

    if (target.dataset.toggle) {
      const id = Number(target.dataset.toggle);
      const item = state.cases.find((entry) => entry.id === id);
      await api(`/cases/${id}`, { method: 'PATCH', body: { isPublished: !item.isPublished } });
      const refreshed = await api('/cases');
      state.cases = refreshed.items;
      renderCases();
      return toast(item.isPublished ? 'Скрыта с сайта' : 'Показана на сайте');
    }

    if (target.dataset.delete) {
      const id = Number(target.dataset.delete);
      const item = state.cases.find((entry) => entry.id === id);
      if (!confirm(`Удалить работу «${item.title.ru || item.slug}»?`)) return;

      await api(`/cases/${id}`, { method: 'DELETE' });
      state.cases = state.cases.filter((entry) => entry.id !== id);
      renderCases();
      return toast('Удалено');
    }

    /* --- справочники --- */
    if (target.dataset.addTaxonomy) return openTaxonomyForm(target.dataset.addTaxonomy);

    if (target.dataset.taxonomyEdit) {
      const [kind, id] = target.dataset.taxonomyEdit.split(':');
      const item = state[kind].find((entry) => entry.id === Number(id));
      return openTaxonomyForm(kind, item);
    }

    if (target.dataset.taxonomyDelete) {
      const [kind, id] = target.dataset.taxonomyDelete.split(':');
      return await deleteTaxonomy(kind, Number(id));
    }

    if (target.dataset.taxonomyToggle) {
      const [kind, id] = target.dataset.taxonomyToggle.split(':');
      const item = state[kind].find((entry) => entry.id === Number(id));
      await api(`/${kind}/${id}`, { method: 'PATCH', body: { isActive: !item.isActive } });
      const refreshed = await api(`/${kind}`);
      state[kind] = refreshed.items;
      renderTaxonomy(kind);
      return toast('Сохранено');
    }
  } catch (error) {
    toast(error.message, true);
  }
});

/** Точка и подсветка пустых языков обновляются по ходу набора текста. */
document.addEventListener('input', (event) => {
  if (event.target.dataset?.langField) markEmptyLangs(['title', 'description']);
});

el('modal-save').addEventListener('click', async () => {
  if (!onSave) return;

  const button = el('modal-save');
  button.disabled = true;
  modalError('');

  try {
    await onSave();
    closeModal();
  } catch (error) {
    modalError(error.message);
  } finally {
    button.disabled = false;
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !el('modal').hidden) closeModal();
});

/* ================================================================== */
/* Старт                                                              */
/* ================================================================== */

try {
  const { user } = await api('/auth/session');
  if (user) {
    state.user = user;
    showApp();
    await loadAll();
  } else {
    showLogin();
  }
} catch {
  showLogin();
}
