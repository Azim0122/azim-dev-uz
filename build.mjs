/**
 * build.mjs — статический генератор сайта azim-dev.uz
 *
 * Собирает три языковые версии одной страницы (RU / UZ / EN) из данных
 * в папке content/ и кладёт готовый сайт в dist/.
 *
 *   node build.mjs
 *
 * Никакого PHP и базы данных: контент — это JSON-файлы, которые лежат
 * рядом с кодом и версионируются в Git.
 *
 *   content/site.json   — общие настройки: домен, контакты
 *   content/ru|uz|en.json — все тексты интерфейса
 *   content/cases.json  — карточки работ (у каждой свои переводы)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(ROOT, 'dist');

const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));

const site = read('content/site.json');
const cases = read('content/cases.json');
const dicts = Object.fromEntries(site.languages.map((l) => [l, read(`content/${l}.json`)]));

/* ------------------------------------------------------------------ */
/* Утилиты                                                             */
/* ------------------------------------------------------------------ */

/** Экранирование текста, который попадает внутрь HTML. */
const esc = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** Префикс языка в адресе: у русской версии его нет — она в корне. */
const base = (lang) => (lang === site.defaultLang ? '/' : `/${lang}/`);

/** Полный адрес языковой версии — для canonical и hreflang. */
const absolute = (lang) => site.domain + base(lang);

/** Ссылка в мессенджер с приветствием на нужном языке. */
const messengerLink = (url, greeting) => `${url}?text=${encodeURIComponent(greeting)}`;

/* ------------------------------------------------------------------ */
/* Блоки страницы                                                      */
/* ------------------------------------------------------------------ */

const langSwitcher = (lang) => {
  const t = dicts[lang];
  const links = site.languages
    .map((code) => {
      const active = code === lang ? ' is-active' : '';
      const current = code === lang ? ' aria-current="true"' : '';
      return `<li><a class="lang-switcher__link${active}" href="${base(code)}" hreflang="${code}" lang="${code}"${current}>${esc(dicts[code].short)}</a></li>`;
    })
    .join('');
  return `<nav class="lang-switcher" aria-label="${esc(t.a11y.langSwitcher)}">
        <ul class="lang-switcher__list">${links}</ul>
      </nav>`;
};

const icon = (id, size, label) =>
  `<svg width="${size}" height="${size}" fill="currentColor" role="img" aria-label="${esc(label)}">
          <use xlink:href="/assets/img/sprite.svg#${id}"></use>
        </svg>`;

const header = (lang) => {
  const t = dicts[lang];
  const tg = messengerLink(site.contacts.telegram, t.cta.greeting);
  const wa = messengerLink(site.contacts.whatsapp, t.cta.greeting);
  const nav = ['cases', 'services', 'expertise', 'developments', 'team', 'contacts']
    .map((key) => `<li><a href="#${key}">${esc(t.nav[key])}</a></li>`)
    .join('\n        ');

  return `<header class="header easy">
  <div class="header__wrapper flex-c easy">
    <a class="header__logo flex" href="${base(lang)}">
      <img width="104" height="28" src="/assets/img/content/1.png" alt="${esc(t.a11y.logo)}">
    </a>
    <ul class="header__navigation flex-c main-text regular">
        ${nav}
    </ul>
    ${langSwitcher(lang)}
    <button class="header__button button button-primary form-open" type="button" data-fancybox data-src="#messengers-content" href="javascript:;">
      <span>${esc(t.cta.discuss)}</span>
    </button>
    <div class="header__links">
      <a class="flex-c" href="${tg}" target="_blank" rel="noopener">
        ${icon('icon-tg-2', 24, t.a11y.telegram)}
      </a>
      <a class="flex-c" href="${wa}" target="_blank" rel="noopener">
        ${icon('icon-wa-2', 24, t.a11y.whatsapp)}
      </a>
      <a class="flex-c" href="${site.contacts.phoneHref}">
        ${icon('icon-phone', 24, t.a11y.phone)}
      </a>
    </div>
  </div>
</header>`;
};

const hero = (lang) => {
  const t = dicts[lang];
  const tags = t.hero.tags.map((tag) => `<li>${esc(tag)}</li>`).join('\n          ');
  return `<section class="hero">
  <div class="container">
    <div class="hero__wrapper">
      <div class="hero__content">
        <ul class="hero__tags tags tags-grey flex small-text medium">
          ${tags}
        </ul>
        <div class="hero__title h2 easy">
          <p class="medium">${esc(t.hero.titleLine1)}</p>
          <p>${esc(t.hero.titleLine2)}</p>
          <p class="semi-bold"><span>${esc(t.hero.titleAccent)}</span>${esc(t.hero.titleTail)}</p>
        </div>
        <p class="hero__text main-text medium">${esc(t.hero.text)}</p>
        <div class="hero__showreel">
          <div class="hero__showreel-video">
            <div class="hero__video-wrapper easy">
              <button class="hero__video-button-close easy" type="button" aria-label="${esc(t.a11y.closeVideo)}"></button>
              <div class="hero__video">
                <video data-src-mini="/assets/video/showreel_mini.mp4" data-src-full="/assets/video/showreel_2026.mp4" width="370" height="162" poster="/assets/img/content/poster_showreel.png" muted loop playsinline></video>
              </div>
            </div>
            <div class="hero__anchor"></div>
          </div>
          <button class="hero__showreel-button flex small-text medium easy">
            <span class="hero__showreel-button-icon easy"></span>
            <span>${esc(t.hero.showreel)}</span>
          </button>
        </div>
      </div>
      <div class="hero__image hero__image-tag">
        <picture>
          <source type="image/webp" srcset="/assets/img/content/tag-02.webp">
          <img src="/assets/img/content/tag-02.png" width="674" height="674" loading="lazy" alt="${esc(t.a11y.decorTag)}">
        </picture>
      </div>
      <div class="hero__image hero__image-bird">
        <picture>
          <source type="image/webp" srcset="/assets/img/content/bird-black.webp">
          <img src="/assets/img/content/bird-black.png" width="613" height="613" loading="lazy" alt="${esc(t.a11y.decorBird)}">
        </picture>
      </div>
    </div>
  </div>
</section>`;
};

const caseItem = (item, lang) => {
  const t = dicts[lang];
  const tags = item.tags.map((key) => `<li>${esc(t.cases.tags[key] || key)}</li>`).join('');
  const video = item.video
    ? `<div class="cases__item-video easy">
                      <video data-src="${esc(item.video)}" width="631" height="378" muted loop playsinline poster="/${esc(item.image)}"></video>
                    </div>`
    : '';

  return `                <div class="cases__item">
                  <div class="cases__item-content">
                    <div class="cases__item-top flex-sb">
                      <ul class="cases__item-tags tags tags-white flex small-text medium">${tags}</ul>
                      <p class="cases__item-desc main-text medium">${esc(item.description[lang])}</p>
                    </div>
                    <a class="cases__item-link h3" href="#" data-href="${esc(item.url)}" target="_blank" rel="noopener">${esc(item.title[lang])}</a>
                  </div>
                  <div class="cases__item-image">
                    <picture>
                      <img class="easy" src="/${esc(item.image)}" width="${item.width}" height="${item.height}" loading="lazy" alt="${esc(item.title[lang])}">
                    </picture>
                  </div>
                  ${video}
                </div>`;
};

const casesSection = (lang) => {
  const t = dicts[lang];
  const tabs = cases.categories
    .map((key, i) => {
      const active = i === 0 ? ' is-active' : '';
      return `          <li class="${active.trim()}" data-tabs="tab"><span class="easy">${esc(t.cases.categories[key] || key)}</span></li>`;
    })
    .join('\n');

  const panes = cases.categories
    .map((key, i) => {
      const active = i === 0 ? ' is-active' : '';
      const items = cases.items
        .filter((item) => item.categories.includes(key))
        .map((item) => caseItem(item, lang))
        .join('\n');
      return `        <div class="cases__tab easy${active}" data-tabs="tab-content">
          <div class="cases__list">
${items}
          </div>
        </div>`;
    })
    .join('\n');

  return `<section class="cases" id="cases">
  <div class="container">
    <div class="cases__wrapper" data-tabs="tabs">
      <div class="cases__top">
        <div class="cases__title title title-dark easy">
          <h2 class="small-text medium">${esc(t.cases.heading)}</h2>
        </div>
        <ul class="cases__tags flex no-scrollbar h5 medium" data-lenis-prevent>
${tabs}
        </ul>
      </div>
      <div class="cases__tabs h2">
${panes}
      </div>
    </div>
  </div>
</section>`;
};

const services = (lang) => {
  const t = dicts[lang];
  const items = t.services.items
    .map(
      (item, i) => `        <div class="services__item" data-accordion="accordion-item">
          <div class="services__item-top flex" data-accordion="accordion-item-top">
            <span class="services__item-count small-text medium easy">${String(i + 1).padStart(2, '0')}</span>
            <span class="services__item-title h4 medium easy">${esc(item.title)}</span>
            <button class="services__item-button button" type="button" aria-label="${esc(t.a11y.toggle)}">
              ${icon('icon-arrow-1', 16, t.a11y.arrow)}
            </button>
          </div>
          <div class="services__item-bottom" data-accordion="accordion-item-bottom">
            <div class="services__item-bottom-wrapper easy">
              <div class="services__item-bottom-content">
                <span class="services__item-tag small-text medium">${esc(item.title)}</span>
                <p class="main-text regular">${esc(item.text)}</p>
              </div>
              <div class="services__item-bottom-image">
                <picture>
                  <img src="/assets/img/content/poster_showreel.png" width="494" height="218" loading="lazy" alt="">
                </picture>
              </div>
            </div>
          </div>
        </div>`
    )
    .join('\n');

  return `<section class="services" id="services">
  <div class="container">
    <div class="services__wrapper">
      <div class="services__top">
        <div class="services__title title title-dark easy">
          <h2 class="small-text medium">${esc(t.services.heading)}</h2>
        </div>
        <p class="h2 medium easy">${esc(t.services.leadStart)} <br> ${esc(t.services.leadMiddle)} <span>${esc(t.services.leadAccent)}</span></p>
      </div>
      <div class="services__list" data-accordion="accordion">
${items}
      </div>
    </div>
  </div>
</section>`;
};

const expertise = (lang) => {
  const t = dicts[lang];
  const items = t.expertise.items
    .map((label, i) => {
      const media = site.expertiseMedia[i] || {};
      // У ниши может не быть ролика — тогда показываем только постер,
      // а если нет и его, блок с видео просто не выводим.
      // Есть ролик — показываем видео; есть только постер — обычную
      // картинку (пустой <video> без источника роняет консоль ошибкой).
      let media_html = '';
      if (media.video) {
        const poster = media.poster ? ` poster="${media.poster}"` : '';
        media_html = `              <div class="expertise__item-video easy">
                <video data-src="${media.video}"${poster} width="148" height="99" muted loop playsinline></video>
              </div>\n`;
      } else if (media.poster) {
        media_html = `              <div class="expertise__item-video easy">
                <img src="${media.poster}" width="148" height="99" loading="lazy" alt="">
              </div>\n`;
      }
      const video = media_html;
      return `            <div class="expertise__item flex">
${video}              <span class="h1 medium">${esc(label)}</span>
            </div>`;
    })
    .join('\n');
  const tags = t.expertise.tags.map((tag) => `            <li class="easy">${esc(tag)}</li>`).join('\n');

  return `<section class="expertise" id="expertise">
  <div class="container">
    <div class="expertise__wrapper">
      <div class="expertise__top">
        <div class="expertise__title title title-light">
          <h2 class="small-text medium">${esc(t.expertise.heading)}</h2>
        </div>
        <div class="expertise__top-text flex-sb">
          <p class="h5 medium">${esc(t.expertise.lead)}</p>
          <p class="main-text regular">${esc(t.expertise.text)}</p>
        </div>
      </div>
      <div class="expertise__bottom">
        <div class="expertise__messenger-checker">
          <a class="expertise__messenger flex" data-fancybox data-src="#messengers-content" href="javascript:;">
            <div class="expertise__messenger-logo flex-c">
              <img src="/assets/img/content/1.png" width="104" height="28" alt="">
            </div>
            <div class="expertise__messenger-content">
              <p class="main-text semi-bold easy">${esc(t.expertise.messengerTitle)}</p>
              <p class="small-text medium">${esc(t.expertise.messengerSub)}</p>
            </div>
          </a>
        </div>
        <div class="expertise__content">
          <div class="expertise__list">
${items}
          </div>
          <p class="expertise__content-text small-text medium">${esc(t.expertise.more)}</p>
          <ul class="expertise__tags flex h5 medium">
${tags}
          </ul>
        </div>
      </div>
    </div>
  </div>
</section>`;
};

const developments = (lang) => {
  const t = dicts[lang];
  return `<section class="developments" id="developments">
  <div class="container">
    <div class="developments__wrapper">
      <div class="developments__content">
        <div class="developments__title title title-dark">
          <h2 class="small-text medium">${esc(t.developments.heading)}</h2>
        </div>
        <div class="developments__list">
          <div class="developments__item">
            <p class="h4 medium">${esc(t.developments.item1Title)}</p>
            <p class="big-text medium">${esc(t.developments.item1Text)}</p>
          </div>
          <div class="developments__item">
            <p class="h4 medium">${esc(t.developments.item2Title)}</p>
          </div>
        </div>
      </div>
      <div class="developments__image">
        <picture>
          <source type="image/webp" srcset="/assets/img/content/tag-02.webp">
          <img src="/assets/img/content/tag-02.png" width="190" height="190" loading="lazy" alt="${esc(t.a11y.decorTag)}">
        </picture>
      </div>
    </div>
  </div>
</section>`;
};

const ticker = (lang) => {
  const t = dicts[lang];
  const row = `    <div class="decoration__ticker-item flex">
      <p>${esc(t.ticker)}</p>
      <p>${esc(t.ticker)}</p>
    </div>`;
  return `<div class="decoration">
  <div class="decoration__ticker-list">
${[row, row, row].join('\n')}
  </div>
  <div class="decoration__image">
    <picture>
      <source type="image/webp" srcset="/assets/img/content/bird-black.webp">
      <img src="/assets/img/content/bird-black.png" width="736" height="736" loading="lazy" alt="${esc(t.a11y.decorBird)}">
    </picture>
  </div>
</div>`;
};

const team = (lang) => {
  const t = dicts[lang];
  const stats = t.team.stats
    .map(
      (stat) => `                    <div class="team__about-item">
                        <span class="h5 medium">${esc(stat.value)}</span>
                        <p class="small-text medium">${esc(stat.text)}</p>
                    </div>`
    )
    .join('\n');
  const items = t.team.items
    .map(
      (item) => `                    <div class="team__item team__item--w-info">
                        <span class="team__item-info footnote medium">${esc(item.label)}</span>
                        <div class="team__item-content">
                            <span class="main-text medium">${esc(item.tech)}</span>
                            <p class="small-text medium">${esc(item.text)}</p>
                        </div>
                    </div>`
    )
    .join('\n');

  return `<section class="team" id="team">
    <div class="container">
        <div class="team__wrapper">
            <div class="team__left">
                <div class="team__title title title-light">
                    <h2 class="small-text medium">${esc(t.team.heading)}</h2>
                </div>
                <div class="team__about-list">
                    <div class="team__about-item team__about-item--w-info">
                        <span class="team__about-item-info footnote medium">${esc(t.team.aboutLabel)}</span>
                        <span class="h3 semi-bold">${esc(t.team.yearsValue)}</span>
                        <p class="main-text medium"><span>${esc(t.team.yearsAccent)}</span> ${esc(t.team.yearsTail)}</p>
                    </div>
${stats}
                </div>
            </div>
            <div class="team__right">
                <div class="team__right-top flex-sb">
                    <p class="h5 medium">${esc(t.team.rightTitle)}</p>
                    <div class="team__vacancy">
                        <p class="main-text regular">${esc(t.team.rightText)}</p>
                        <button data-fancybox data-src="#messengers-content" href="javascript:;" type="button"
                            class="team__vacancy-button flex easy small-text medium border-none bg-transparent team_button_border">
                            <span class="team__vacancy-button-text flex-c easy">${esc(t.cta.discuss)}</span>
                        </button>
                    </div>
                </div>
                <div class="team__list">
${items}
                </div>
            </div>
        </div>
    </div>
</section>`;
};

const footer = (lang) => {
  const t = dicts[lang];
  const tags = t.footer.tags.map((tag) => `          <li>${esc(tag)}</li>`).join('\n');
  return `<footer class="footer" id="footer">
  <div class="container">
    <div class="footer__wrapper">
      <div class="footer__left-top">
        <ul class="footer__tags tags tags-grey flex small-text medium">
${tags}
        </ul>
        <div class="footer__title title title-dark">
          <h2 class="small-text medium">${esc(t.footer.heading)}</h2>
        </div>
      </div>
      <div class="footer__right">
        <div class="footer__contacts flex-sb">
          <div class="footer__contacts-links h2 semi-bold">
            <a href="mailto:${esc(site.contacts.email)}" class="footer__contacts-links__mail">
              <span>${esc(site.contacts.email)}</span>
              ${icon('icon-copy', 48, t.a11y.copy)}
            </a>
            <a href="${esc(site.contacts.phoneHref)}">${esc(site.contacts.phoneDisplay)}</a>
          </div>
          <div class="footer__contacts-messengers h5 semi-bold">
            <a class="footer__tg flex" data-fancybox data-src="#messengers-tg" href="javascript:;">
              ${icon('icon-tg', 30, t.a11y.telegram)}
              <span>Telegram</span>
              ${icon('icon-arrow-2', 22, t.a11y.arrow)}
            </a>
            <a class="footer__wa flex" data-fancybox data-src="#messengers-wa" href="javascript:;">
              ${icon('icon-wa', 30, t.a11y.whatsapp)}
              <span>WhatsApp</span>
              ${icon('icon-arrow-2', 24, t.a11y.arrow)}
            </a>
          </div>
        </div>
      </div>
      <div class="footer__left-bottom">
        <a class="main-text medium" href="/assets/files/private_policy.pdf" target="_blank" rel="noopener">${esc(t.footer.policy)}</a>
        <div class="small-text easy">
          <span class="semi-bold">${esc(t.footer.author)}</span>
          <br>
          <span class="regular">© ${esc(site.copyrightYears)}</span>
        </div>
      </div>
    </div>
  </div>
</footer>`;
};

const messengers = (lang) => {
  const t = dicts[lang];
  const tg = messengerLink(site.contacts.telegram, t.cta.greeting);
  const wa = messengerLink(site.contacts.whatsapp, t.cta.greeting);

  return `<div class="messengers" id="messengers-content" style="display: none;">
    <p class="messengers__title">${esc(t.messengers.title)}</p>
    <div class="messengers__grid">
      <a class="messengers__tg-link" href="${tg}" target="_blank" rel="nofollow noopener">
        ${icon('icon-tg-2', 24, t.a11y.telegram)}
        <span>${esc(t.messengers.telegramDesktop)}</span>
      </a>
      <a class="messengers__wa-link" href="${wa}" target="_blank" rel="nofollow noopener">
        ${icon('icon-wa-2', 24, t.a11y.whatsapp)}
        <span>${esc(t.messengers.whatsappDesktop)}</span>
      </a>
      <div class="messengers__text">
        <p>${esc(t.messengers.orQr)}</p>
      </div>
      <div class="messengers__qr-wrapper">
        <picture>
          <source type="image/webp" srcset="/assets/img/qrs/qr-tg.webp">
          <img src="/assets/img/qrs/qr-tg.jpg" width="170" height="170" loading="lazy" alt="${esc(t.a11y.qrTelegram)}">
        </picture>
        <picture>
          <source type="image/webp" srcset="/assets/img/qrs/qr-wa.webp">
          <img src="/assets/img/qrs/qr-wa.jpg" width="170" height="170" loading="lazy" alt="${esc(t.a11y.qrWhatsapp)}">
        </picture>
      </div>
    </div>
  </div>

  <div class="messengers" id="messengers-wa" style="display: none;">
    <p class="messengers__title">${esc(t.messengers.titleWhatsapp)}</p>
    <div class="messengers__grid">
      <a class="messengers__wa-link" href="${wa}" target="_blank" rel="nofollow noopener">
        ${icon('icon-wa-modal', 20, t.a11y.whatsapp)}
        <span>${esc(t.messengers.whatsappDesktop)}</span>
      </a>
      <div class="messengers__text">
        <p>${esc(t.messengers.orQr)}</p>
      </div>
      <picture>
        <source type="image/webp" srcset="/assets/img/qrs/qr-wa.webp">
        <img src="/assets/img/qrs/qr-wa.jpg" width="170" height="170" loading="lazy" alt="${esc(t.a11y.qrWhatsapp)}">
      </picture>
    </div>
  </div>

  <div class="messengers" id="messengers-tg" style="display: none;">
    <p class="messengers__title">${esc(t.messengers.titleTelegram)}</p>
    <div class="messengers__grid">
      <a class="messengers__tg-link" href="${tg}" target="_blank" rel="nofollow noopener">
        ${icon('icon-tg-modal', 20, t.a11y.telegram)}
        <span>${esc(t.messengers.telegramDesktop)}</span>
      </a>
      <div class="messengers__text">
        <p>${esc(t.messengers.orQr)}</p>
      </div>
      <picture>
        <source type="image/webp" srcset="/assets/img/qrs/qr-tg.webp">
        <img src="/assets/img/qrs/qr-tg.jpg" width="170" height="170" loading="lazy" alt="${esc(t.a11y.qrTelegram)}">
      </picture>
    </div>
  </div>`;
};

/* ------------------------------------------------------------------ */
/* Страница целиком                                                    */
/* ------------------------------------------------------------------ */

const page = (lang) => {
  const t = dicts[lang];
  const cssV = site.assets.cssVersion;
  const jsV = site.assets.jsVersion;

  const alternates = site.languages
    .map((code) => `  <link rel="alternate" hreflang="${code}" href="${absolute(code)}">`)
    .join('\n');

  return `<!DOCTYPE html>
<html lang="${t.htmlLang}">

<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">

  <title>${esc(t.meta.title)}</title>
  <meta name="description" content="${esc(t.meta.description)}">
  <meta name="keywords" content="${esc(t.meta.keywords)}">
  <meta name="author" content="${esc(t.meta.author)}">
  <meta name="robots" content="index, follow">
  <meta name="theme-color" content="#111111">

  <link rel="canonical" href="${absolute(lang)}">
${alternates}
  <link rel="alternate" hreflang="x-default" href="${absolute(site.defaultLang)}">

  <meta property="og:type" content="website">
  <meta property="og:url" content="${absolute(lang)}">
  <meta property="og:locale" content="${t.ogLocale}">
  <meta property="og:title" content="${esc(t.meta.ogTitle)}">
  <meta property="og:description" content="${esc(t.meta.ogDescription)}">
  <meta property="og:image" content="${site.domain}/assets/img/preview.jpg">
  <meta property="og:site_name" content="Azim">

  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(t.meta.twitterTitle)}">
  <meta name="twitter:description" content="${esc(t.meta.twitterDescription)}">
  <meta name="twitter:image" content="${site.domain}/assets/img/preview.jpg">

  <link rel="icon" href="/assets/img/favicon/favicon.ico" type="image/x-icon">
  <link rel="apple-touch-icon" href="/assets/img/favicon/apple-touch-icon.png">
  <link rel="icon" type="image/png" sizes="192x192" href="/assets/img/favicon/android-chrome-192x192.png">
  <link rel="icon" type="image/png" sizes="32x32" href="/assets/img/favicon/favicon-32x32.png">

  <link rel="stylesheet" href="/assets/libs/fancybox/fancybox.css?v=${cssV}">
  <link rel="stylesheet" href="/assets/css/main.css?v=${cssV}">
  <link rel="stylesheet" href="/assets/css/mobile.css?v=${cssV}">
  <link rel="stylesheet" href="/assets/css/lang-switcher.css?v=${cssV}">
</head>

<body class="easy">

  <div class="wrapper">
    ${header(lang)}
    <div class="header__bg"></div>
    <main class="main">
      <a class="main__logo flex" href="${base(lang)}">
        <img class="only-desk" width="104" height="28" src="/assets/img/content/2.png" alt="${esc(t.a11y.logo)}">
        <img class="only-mob" width="104" height="28" src="/assets/img/content/1.png" alt="${esc(t.a11y.logo)}">
      </a>
      <span class="main__logo-circle"></span>
      <button class="header__button-burger only-mob" type="button" aria-label="${esc(t.a11y.menu)}">
        <svg class="burger-icon" width="24" height="10" fill="currentColor" role="img" aria-label="${esc(t.a11y.menu)}">
          <use xlink:href="/assets/img/sprite.svg#icon-burger-open"></use>
        </svg>
        <svg class="close-icon" width="24" height="24" fill="currentColor" role="img" aria-label="${esc(t.a11y.menu)}" style="display: none;">
          <use xlink:href="/assets/img/sprite.svg#icon-burger-close"></use>
        </svg>
      </button>
      <button class="main__button button button-primary form-open" type="button" data-fancybox data-src="#messengers-content" href="javascript:;">
        <span>${esc(t.cta.discuss)}</span>
      </button>
      <h1 class="visually-hidden">${esc(t.hero.h1)}</h1>
${hero(lang)}
${casesSection(lang)}
${services(lang)}
${expertise(lang)}
${developments(lang)}
${ticker(lang)}
${team(lang)}
<div id="contacts"></div>
    </main>

    ${footer(lang)}

  ${messengers(lang)}

    <div class="custom-cursor-main hidden"></div>
    <div class="overlay easy"></div>
    <div id="form-modal"></div>
  </div>

  <script>window.__I18N = ${JSON.stringify(t.js)};</script>

  <script src="/assets/libs/fancybox/fancybox.umd.js?v=${jsV}"></script>
  <script src="/assets/libs/lenis/lenis.min.js?v=${jsV}"></script>
  <script src="/assets/libs/gsap/gsap.min.js?v=${jsV}"></script>
  <script src="/assets/libs/gsap/ScrollTrigger.min.js?v=${jsV}"></script>
  <script src="/assets/libs/gsap/SplitText.min.js?v=${jsV}"></script>
  <script src="/assets/libs/gsap/ScrambleTextPlugin.min.js?v=${jsV}"></script>
  <script src="/assets/js/main.js?v=${jsV}"></script>
  <script src="/assets/js/animation.js?v=${jsV}"></script>

</body>

</html>
`;
};

/* ------------------------------------------------------------------ */
/* Служебные файлы                                                     */
/* ------------------------------------------------------------------ */

const sitemap = () => {
  const urls = site.languages
    .map((lang) => {
      const alt = site.languages
        .map((code) => `    <xhtml:link rel="alternate" hreflang="${code}" href="${absolute(code)}"/>`)
        .join('\n');
      return `  <url>
    <loc>${absolute(lang)}</loc>
${alt}
    <changefreq>monthly</changefreq>
    <priority>${lang === site.defaultLang ? '1.0' : '0.8'}</priority>
  </url>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls}
</urlset>
`;
};

const robots = () => `User-agent: *
Allow: /

Sitemap: ${site.domain}/sitemap.xml
`;

/* ------------------------------------------------------------------ */
/* Сборка                                                              */
/* ------------------------------------------------------------------ */

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });

fs.cpSync(path.join(ROOT, 'assets'), path.join(DIST, 'assets'), { recursive: true });
fs.cpSync(path.join(ROOT, 'uploads'), path.join(DIST, 'uploads'), { recursive: true });

for (const lang of site.languages) {
  const dir = lang === site.defaultLang ? DIST : path.join(DIST, lang);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), page(lang));
  console.log(`  ✓ ${base(lang)}index.html`);
}

fs.writeFileSync(path.join(DIST, 'sitemap.xml'), sitemap());
fs.writeFileSync(path.join(DIST, 'robots.txt'), robots());
console.log('  ✓ sitemap.xml, robots.txt');
console.log(`\nГотово: ${cases.items.length} работ × ${site.languages.length} языка.`);
