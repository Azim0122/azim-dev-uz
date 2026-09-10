/**
 * Строки, которые скрипт подставляет во время работы, приходят из
 * window.__I18N — его печатает build.mjs в <head> каждой языковой версии.
 * Значения справа — запасной вариант, если объект почему-то не загрузился.
 */
const I18N = (typeof window !== 'undefined' && window.__I18N) || {};
const i18n = (key, fallback) => (I18N[key] !== undefined ? I18N[key] : fallback);

function initVideos() {
  const videos = document.querySelectorAll('video:not(.hero__video video)');

  videos.forEach(video => {
    const link = video.getAttribute('data-src');
    if (link) {
      // Если файл не загрузится (404 и т.п.) — не оставляем чёрный
      // прямоугольник, а прячем видео. Если задан poster — покажется он,
      // если нет — контейнер схлопнется по CSS-классу video-error.
      video.addEventListener('error', () => {
        video.style.display = 'none';
        video.closest('[class*="-video"]')?.classList.add('video-error');
      }, { once: true });

      video.setAttribute('src', link);
      video.removeAttribute('data-src');
    }
  });
}

function initHeroVideo() {
  const video = document.querySelector('.hero__video video');
  if (!video) return;

  const miniSrc = video.getAttribute('data-src-mini');

  if (miniSrc) {
    video.src = miniSrc;
    video.load();

    video.play().catch(() => {});
  }
}


function checkVideosInViewport(selector) {
  const videos = document.querySelectorAll(selector);

  videos.forEach(video => {
    const observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            video.play();
          } else {
            video.pause();
          }
        });
      }
    );

    observer.observe(video);
  });
}

function checkVideosOnHover(selector) {
  const wrappers = document.querySelectorAll(selector);

  wrappers.forEach(wrapper => {
    const video = wrapper.querySelector('video');

    if (!video) return;

    wrapper.addEventListener('mouseenter', () => {
      video.play();
    });

    wrapper.addEventListener('mouseleave', () => {
      video.pause();
    });
  });
}


function initSmoothScroll() {
  const links = document.querySelectorAll('.header__navigation a');

  if (links.length) {
    links.forEach(link => {
      link.addEventListener('click', e => {
        e.preventDefault();
        const target = document.querySelector(link.hash);
        if (target) target.scrollIntoView({ behavior: 'smooth' });
      });
    });
  }
}

function initTabs() {
  const tabsContainers = document.querySelectorAll('[data-tabs="tabs"]');

  tabsContainers.forEach(container => {
    const tabs = container.querySelectorAll('[data-tabs="tab"]');
    const tabsContent = container.querySelectorAll('[data-tabs="tab-content"]');

    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => {
        if (tab.classList.contains('is-active')) return;

        tabs.forEach(t => t.classList.remove('is-active'));

        // Важно: скрываем ВСЕ вкладки с is-active (querySelectorAll,
        // а не querySelector), а не только первую найденную. Если
        // переключить категорию быстро, не дожидаясь окончания
        // 800мс-анимации предыдущего переключения, то к этому моменту
        // is-active может быть сразу у двух вкладок — старой, которая
        // ещё не успела скрыться, и той, что была активна до неё.
        // querySelector находил только одну из них и терял ссылку на
        // вторую — она зависала на экране навсегда поверх новой
        // категории. Теперь обрабатываются все зависшие вкладки сразу.
        const activeContents = container.querySelectorAll('[data-tabs="tab-content"].is-active');

        activeContents.forEach(activeTabContent => {
          if (activeTabContent === tabsContent[index]) return;
          activeTabContent.classList.add('is-in-transition');
          setTimeout(() => {
            activeTabContent.classList.remove('is-active');
            activeTabContent.classList.remove('is-in-transition');
          }, 800);
        });

        tab.classList.add('is-active');
        tabsContent[index].classList.add('is-active');

        // Важно: у разных категорий разное количество карточек, поэтому
        // после переключения вкладки высота страницы меняется (иногда
        // сильно — например, если в новой категории карточек меньше).
        // GSAP ScrollTrigger не отслеживает такие изменения сам — он
        // пересчитывает позиции только по событию resize окна браузера,
        // а смена display:none/block внутри страницы этого события не
        // вызывает. Из-за этого триггеры анимаций для всех блоков ниже
        // (текст, секции и т.д.) оставались "закэшированными" под старую
        // высоту страницы и переставали срабатывать — что и выглядело
        // как "анимации не грузятся". Явно просим GSAP пересчитать все
        // позиции после того, как отработает CSS-анимация показа вкладки
        // (0.8s, см. .cases__tab.is-active в main.css) и картинки внутри
        // успеют встать на место.
        if (typeof ScrollTrigger !== 'undefined') {
          setTimeout(() => ScrollTrigger.refresh(), 850);
        }
      });
    });
  });
}

function initInversion(selector) {
  const elements = document.querySelectorAll(selector);

  if (elements.length > 0) {
    function checkVisibility() {
      let shouldInvert = false;
      const windowHeight = window.innerHeight;

      elements.forEach(element => {
        const rect = element.getBoundingClientRect();
        const visibleTop = Math.max(0, rect.top);
        const visibleBottom = Math.min(windowHeight, rect.bottom);
        const visibleHeight = visibleBottom - visibleTop;
        const viewportCoverage = (visibleHeight / windowHeight) * 100;

        if (viewportCoverage >= 80) {
          shouldInvert = true;
        }
      });

      if (shouldInvert) {
        document.documentElement.classList.add('is-inverse');
        document.body.classList.add('is-inverse');
      } else {
        document.documentElement.classList.remove('is-inverse');
        document.body.classList.remove('is-inverse');
      }
    }

    checkVisibility();
    window.addEventListener('scroll', checkVisibility);
  }
}

function clickableBlock(selector, excludeSelectors = []) {
  document.addEventListener('click', (event) => {
    const targetElement = event.target.closest(selector);

    if (targetElement) {
      const isExcluded = excludeSelectors.some(selector =>
        event.target.closest(selector) !== null
      );

      if (!isExcluded) {
        const link = targetElement.querySelector('a');

        if (link) {
          if (link.target === '_blank') {
            window.open(link.href, '_blank');
          } else {
            window.location.href = link.href;
          }
        }
      }
    }
  });
}

function handleHeaderScroll() {
  const header = document.querySelector('header');
  if (header) {
    const scrolling = window.scrollY > 100;

    header.classList.toggle('is-scrolling', scrolling);
  }
}

function initCasesVideo() {
  const casesItems = document.querySelectorAll('.cases__item');

  casesItems.forEach(item => {
    const video = item.querySelector('video');
    const videoContainer = item.querySelector('.cases__item-video');

    if (video && videoContainer) {
      // Если у видео нет рабочего источника (файл битый/отсутствует —
      // NotSupportedError), не пытаемся играть его повторно на каждое
      // пересечение viewport — это заваливало консоль однотипными
      // необработанными ошибками и подвешивало вкладку при быстрой
      // прокрутке категории с несколькими такими видео.
      let sourceIsBroken = false;
      video.addEventListener('error', () => {
        sourceIsBroken = true;
      });

      const observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(entry => {
            const casesItem = video.closest('.cases__item');
            
            const boundingRect = entry.boundingClientRect;
            const windowHeight = window.innerHeight;
            const containerTop = boundingRect.top;
            
            const isVisible = entry.intersectionRatio > 0;
            
            if (isVisible) {
              if (containerTop < windowHeight * 0.4) {
                casesItem.classList.remove('visible');
                video.pause();
              } else {
                casesItem.classList.add('visible');
                if (!sourceIsBroken) {
                  video.play().catch(() => {
                    sourceIsBroken = true;
                  });
                }
              }
            } else {
              casesItem.classList.remove('visible');
              video.pause();
            }
          });
        },
        {
          threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1] 
        }
      );
      observer.observe(videoContainer);
    }
  });
}

function initAccordion() {
  const accordions = document.querySelectorAll('[data-accordion="accordion"]');

  accordions.forEach(accordion => {
    const accordionItems = accordion.querySelectorAll('[data-accordion="accordion-item"]');

    accordionItems.forEach((item) => {
      const accordionTop = item.querySelector('[data-accordion="accordion-item-top"]');

      accordionTop.addEventListener("click", function () {
        const isOpening = !item.classList.contains("is-open");

        if (isOpening) {
          accordionItems.forEach(otherItem => {
            if (otherItem !== item) {
              otherItem.classList.remove("is-open");
            }
          });
        }

        item.classList.toggle("is-open");
      });
    });
  });
}

function initFaqAccordion() {
  const accordion = document.querySelector('.faq__accordion');
  if (!accordion) return;

  const items = accordion.querySelectorAll('.faq__accordion__item');

  items.forEach(item => {
    const top = item.querySelector('.faq__accordion__top');
    const button = item.querySelector('.faq__accordion__button');
    const textBlock = item.querySelector('.faq__accordion__text');
    
    if (!top || !textBlock) return;

    const clickElement = top;
    
    clickElement.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      item.classList.toggle('active');

      if (button) {
        const svgUse = button.querySelector('use');
        if (svgUse) {
          if (item.classList.contains('active')) {
            svgUse.setAttribute('xlink:href', '/media-temp/img/sprite.svg#icon-minus');
            svgUse.setAttribute('href', '/media-temp/img/sprite.svg#icon-minus');
          } else {
            svgUse.setAttribute('xlink:href', '/media-temp/img/sprite.svg#icon-plus');
            svgUse.setAttribute('href', '/media-temp/img/sprite.svg#icon-plus');
          }
        }
      }
    });
  });
}

function initFloatingElement() {
  const servicesItems = document.querySelectorAll('.services__item');
  const customCursor = document.querySelector('.custom-cursor-main');

  servicesItems.forEach(item => {
    const bottom = item.querySelector('.services__item-bottom');

    let lastX = 0;
    let lastY = 0;

    item.addEventListener('mouseenter', () => {
      bottom.style.transition = 'none';
      customCursor.classList.add('hidden');
    });

    item.addEventListener('mousemove', (e) => {
      const rect = item.getBoundingClientRect();
      const x = e.clientX - rect.left - bottom.offsetWidth / 2;
      const y = e.clientY - rect.top - bottom.offsetHeight / 2;

      lastX = x;
      lastY = y;

      bottom.style.transform = `translate(${x}px, ${y}px)`;

      setTimeout(() => {
        bottom.style.transition = 'transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
      }, 10);
    });

    item.addEventListener('mouseleave', (e) => {
      const rect = item.getBoundingClientRect();
      const exitX = e.clientX - rect.left - bottom.offsetWidth / 2;
      const exitY = e.clientY - rect.top - bottom.offsetHeight / 2;

      bottom.style.transform = `translate(${exitX}px, ${exitY}px)`;
      customCursor.classList.remove('hidden');
    });
  });
}

function initCustomCursor(selector) {
  const elements = document.querySelectorAll(selector);

  elements.forEach((element) => {
    if (element.querySelector('.custom-cursor')) return;

    const customCursor = document.createElement('div');
    customCursor.classList.add('custom-cursor');
    element.appendChild(customCursor);


    element.addEventListener('mouseenter', () => {
      customCursor.style.animation = 'zoomIn 0.3s ease-in-out forwards';
    });

    element.addEventListener('mouseleave', () => {
      customCursor.style.animation = 'zoomOut 0.3s ease-in-out forwards';
    });

    element.addEventListener('mousemove', (e) => {
      const rect = element.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      customCursor.style.left = `${x}px`;
      customCursor.style.top = `${y}px`;
    });
  });
}

function initCustomCursorMain() {
  const customCursorMain = document.querySelector('.custom-cursor-main');

  if (!customCursorMain) return;

  let mouseX = 0;
  let mouseY = 0;
  let cursorX = 0;
  let cursorY = 0;
  let isCursorVisible = false;

  const speed = 0.15;

  function showCursor() {
    if (!isCursorVisible) {
      customCursorMain.classList.remove('hidden');
      isCursorVisible = true;
    }
  }

  function hideCursor() {
    if (isCursorVisible) {
      customCursorMain.classList.add('hidden');
      isCursorVisible = false;
    }
  }

  function animate() {
    if (!isCursorVisible) return;

    const cursorBounds = customCursorMain.getBoundingClientRect();

    const dX = mouseX - (cursorBounds.left + 4);
    const dY = mouseY - (cursorBounds.top + 4);

    cursorX += dX * speed;
    cursorY += dY * speed;

    customCursorMain.style.transform = `translate3d(${cursorX}px, ${cursorY}px, 0)`;
  }

  function update() {
    animate();
    requestAnimationFrame(update);
  }

  function setCoords(e) {
    mouseX = e.clientX;
    mouseY = e.clientY;

    showCursor();
  }

  document.addEventListener('mousemove', setCoords);
  document.addEventListener('mouseleave', hideCursor);
  document.addEventListener('mouseenter', showCursor);

  update();
}

function setWrapperMargin() {
  const wrapper = document.querySelector('.wrapper');
  const footer = document.querySelector('.footer');

  if (wrapper && footer) {
    const footerHeight = footer.offsetHeight;
    wrapper.style.marginBottom = `${footerHeight}px`;
  }
}

function toggleShowreel() {
  const showreel = document.querySelector('.hero__showreel');
  const showreelVideoWrapper = document.querySelector('.hero__video-wrapper');
  const showreelVideo = document.querySelector('.hero__showreel-video');
  const showreelClose = document.querySelector('.hero__video-button-close');

  if (!showreel || !showreelVideoWrapper || !showreelVideo || !showreelClose) return;

  let originalAnchorY = null;
  let lastMiniTime = 0;

  const baseVideo = document.querySelector('.hero__video video');

  if (baseVideo) {
    baseVideo.addEventListener('timeupdate', () => {
      lastMiniTime = baseVideo.currentTime;
    });
  }

  function initAnchorPosition() {
    const anchor = document.querySelector('.hero__anchor');
    if (anchor) {
      originalAnchorY = anchor.getBoundingClientRect().top + window.pageYOffset;
    }
  }

  initAnchorPosition();

  showreel.addEventListener('click', function () {
    if (!showreelVideo.classList.contains('is-open')) {
      openShowreel(showreelVideo);
    }
  });

  showreelClose.addEventListener('click', function (event) {
    event.stopPropagation();
    closeShowreel(showreelVideo);
  });

  document.addEventListener('click', function (event) {
    if (showreelVideo.classList.contains('is-open')) {
      const isClickOnShowreel = event.target.closest('.hero__showreel');
      if (!isClickOnShowreel) {
        closeShowreel(showreelVideo);
      }
    }
  });

  function openShowreel(showreel) {
    showreel.classList.add('is-open');

    const video = showreelVideo.querySelector('video');
    const fullSrc = video.getAttribute('data-src-full');

    if (fullSrc && video.src !== fullSrc) {
      video.src = fullSrc;
      video.load();
    }

    const applyTimeAndPlay = () => {
      video.currentTime = lastMiniTime;
      video.play().catch(() => {});
      video.removeEventListener('canplay', applyTimeAndPlay);
    };

    if (video.readyState >= 2) {
      applyTimeAndPlay();
    } else {
      video.addEventListener('canplay', applyTimeAndPlay);
    }

    const start = window.pageYOffset;
    const duration = 800;
    const startTime = Date.now();

    function scrollAnimation() {
      const now = Date.now();
      const time = Math.min(1, (now - startTime) / duration);
      window.scrollTo(0, start * (1 - time));
      if (time < 1) {
        setTimeout(scrollAnimation, 16);
      }
    }

    scrollAnimation();
    repositionVideoWrapper();
    setTimeout(toggleScreen, 500);
    lenis.stop();
  }

  function closeShowreel(showreel) {
    showreel.classList.remove('is-open');
    const video = showreelVideo.querySelector('video');
    const miniSrc = video.getAttribute('data-src-mini');
    
    if (miniSrc) {
      const currentTime = video.currentTime;
      lastMiniTime = currentTime;
      
      video.pause();
      
      const oldVideo = video;
      const newVideo = oldVideo.cloneNode(true);
      newVideo.src = miniSrc;
      newVideo.currentTime = currentTime;
      newVideo.muted = true;
      newVideo.loop = true;
      newVideo.setAttribute('playsinline', '');
      
      oldVideo.parentNode.replaceChild(newVideo, oldVideo);
      
      const startVideo = () => {
        if (newVideo.readyState >= 2) {
          newVideo.play().catch(() => {
            const playOnInteraction = () => {
              newVideo.play().catch(() => {});
              document.removeEventListener('click', playOnInteraction);
              document.removeEventListener('touchstart', playOnInteraction);
            };
            document.addEventListener('click', playOnInteraction);
            document.addEventListener('touchstart', playOnInteraction);
          });
          newVideo.removeEventListener('canplay', startVideo);
        }
      };
      
      if (newVideo.readyState >= 2) {
        setTimeout(startVideo, 50);
      } else {
        newVideo.addEventListener('canplay', startVideo);
        setTimeout(() => {
          newVideo.removeEventListener('canplay', startVideo);
          if (newVideo.paused) {
            newVideo.play().catch(() => {});
          }
        }, 1000);
      }
      
      newVideo.load();
    }

    showreelVideoWrapper.style.transform = `translateX(-50%) translateY(0)`;
    toggleScreen();
    lenis.start();
    
    setTimeout(() => {
      const heroVideo = document.querySelector('.hero__video video');
      if (heroVideo && heroVideo.paused) {
        const rect = heroVideo.getBoundingClientRect();
        const isVisible = rect.top < window.innerHeight && rect.bottom > 0;
        
        if (isVisible) {
          heroVideo.play().catch(() => {});
        }
      }
    }, 200);
  }

  function repositionVideoWrapper() {
    const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize);

    if (window.innerWidth >= 1024) {
      if (originalAnchorY !== null) {
        const targetY = 12.4 * rootFontSize;
        const anchorY = originalAnchorY;
        const offsetY = Math.round(-(anchorY - targetY));
        showreelVideoWrapper.style.transform = `translateX(-50%) translateY(${offsetY}px)`;
      }
    }

    if (window.innerWidth < 1024) {
      const viewportHeight = window.innerHeight;
      const wrapperHeight = 23 * rootFontSize;
      const translateY = Math.round(-((viewportHeight / 2) - (wrapperHeight / 2)));
      showreelVideoWrapper.style.transform = `translateX(-50%) translateY(${translateY}px)`;
    }
  }
}

function toggleScreen() {
  const body = document.body;
  const overlay = document.querySelector('.overlay');

  body.classList.toggle('screen-lock');
  overlay.classList.toggle('is-active');
}

function initExpertiseObserver() {
  const element = document.querySelector('.expertise');
  if (!element || element.dataset.observed) return;

  const observer = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting && window.innerWidth >= 1024) {
      window.addEventListener('scroll', checkExpertiseScroll);
      checkExpertiseScroll();
    } else {
      window.removeEventListener('scroll', checkExpertiseScroll);
    }
  });

  observer.observe(element);
  element.dataset.observed = 'true';
}

function checkExpertiseScroll() {
  const messenger = document.querySelector('.expertise__messenger-checker');
  const expertise = document.querySelector('.expertise__bottom');

  if (!messenger || !expertise) return;

  const messengerRect = messenger.getBoundingClientRect();
  const expertiseRect = expertise.getBoundingClientRect();
  const windowHeight = window.innerHeight;
  const viewportBottom = windowHeight - 20;

  const messengerBottomPosition = messengerRect.bottom;
  if (messengerBottomPosition < viewportBottom) {
    messenger.classList.add('is-fixed');
  } else {
    messenger.classList.remove('is-fixed');
  }

  const expertiseBottomPosition = expertiseRect.bottom;
  if (expertiseBottomPosition < viewportBottom) {
    expertise.classList.remove('is-on-top');
  } else {
    expertise.classList.add('is-on-top');
  }
}

function createImageParallax(element, config = {}) {
  if (!element) return null;

  let isAnimating = false;
  let animationFrame = null;

  // Настройки по умолчанию
  const defaults = {
    base: 0,            // Базовый угол поворота
    floatAmplitude: 2,  // Амплитуда парения
    scrollFactor: 10,   // Интенсивность вращения от скролла
    mouseFactor: 0.2,   // Интенсивность вращения от мыши
    perspective: 800,   // Перспектива 3D
    direction: 1,       // Направление движения
    floatSpeed: 0.5,    // Скорость парения
    rotateFloatX: 0,    // Влияние парения на вращение по X
    rotateFloatY: 0,    // Влияние парения на вращение по Y
    rotateFloatZ: 1,    // Влияние парения на вращение по Z
    parallaxFactor: {   // Коэффициенты параллакса
      horizontal: 0.2,  // Горизонтальное смещение
      vertical: 0.15    // Вертикальное смещение
    },
    intersectionThreshold: 0.1,
    rootMargin: '50px'
  };

  // Мержим с пользовательскими настройками
  const settings = {
    ...defaults,
    ...config,
    parallaxFactor: {
      ...defaults.parallaxFactor,
      ...(config.parallaxFactor || {})
    }
  };

  // Observer для запуска анимации
  const observer = new IntersectionObserver((entries) => {
    const isVisible = entries[0].isIntersecting;

    if (isVisible) {
      startParallax();
    } else {
      stopParallax();
    }
  }, {
    threshold: settings.intersectionThreshold,
    rootMargin: settings.rootMargin
  });

  observer.observe(element);

  // Запуск параллакса
  function startParallax() {
    if (isAnimating) return;
    isAnimating = true;

    setup3DTransforms();
    animateFloating();

    window.addEventListener('scroll', handleParallax, { passive: true });
    document.addEventListener('mousemove', handleMouseMove);
  }

  // Настройка 3D перспективы
  function setup3DTransforms() {
    element.style.transition = 'transform 0.1s ease-out';
    element.style.willChange = 'transform';
  }

  // Остановка параллакса
  function stopParallax() {
    isAnimating = false;
    window.removeEventListener('scroll', handleParallax);
    document.removeEventListener('mousemove', handleMouseMove);

    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
      animationFrame = null;
    }

    resetTransforms();
  }

  // Анимация парения
  function animateFloating() {
    if (!isAnimating) return;

    const time = Date.now() / 1000;

    const scrollXRot = parseFloat(element.dataset.scrollRotateX || 0);
    const scrollYRot = parseFloat(element.dataset.scrollRotateY || 0);
    const mouseRotX = parseFloat(element.dataset.mouseRotateX || 0);
    const mouseRotY = parseFloat(element.dataset.mouseRotateY || 0);
    const scrollX = parseFloat(element.dataset.scrollX || 0);
    const scrollY = parseFloat(element.dataset.scrollY || 0);

    const floatY = Math.sin(time * settings.floatSpeed * 1.2) * (settings.floatAmplitude * 5);
    const floatRotate = Math.sin(time * settings.floatSpeed) * settings.floatAmplitude;

    const rotateX = scrollXRot + mouseRotX + settings.rotateFloatX * floatRotate;
    const rotateY = scrollYRot + mouseRotY + settings.rotateFloatY * floatRotate;
    const rotateZ = settings.base + floatRotate * settings.rotateFloatZ;

    element.style.transform = `
      perspective(${settings.perspective}px)
      translateX(${scrollX}px)
      translateY(${scrollY + floatY}px)
      translateZ(${Math.sin(time * 0.3) * 20}px)
      rotateX(${rotateX}deg)
      rotateY(${rotateY}deg)
      rotateZ(${rotateZ}deg)
      scale(${1 + Math.sin(time * 0.2) * 0.02})
    `;

    animationFrame = requestAnimationFrame(animateFloating);
  }

  // Параллакс при скролле
  function handleParallax() {
    if (!isAnimating) return;

    // Используем сам элемент для расчета прогресса скролла
    const rect = element.getBoundingClientRect();
    const viewportHeight = window.innerHeight;

    const scrollProgress = Math.max(-0.5, Math.min(1.5,
      (viewportHeight - rect.top) / (viewportHeight + rect.height)
    ));

    const offsetRange = 100;

    const scrollOffset = (scrollProgress - 0.5) * offsetRange * settings.parallaxFactor.horizontal * 2 * settings.direction;
    element.dataset.scrollX = scrollOffset;

    const scrollYOffset = (scrollProgress - 0.5) * 50 * settings.parallaxFactor.vertical * settings.direction;
    element.dataset.scrollY = scrollYOffset;

    const rotateX = (scrollProgress - 0.5) * settings.scrollFactor * 2;
    element.dataset.scrollRotateX = rotateX;

    const rotateY = (0.5 - scrollProgress) * settings.scrollFactor * 1.5 * settings.direction;
    element.dataset.scrollRotateY = rotateY;
  }

  // Вращение от движения мыши
  function handleMouseMove(e) {
    if (!isAnimating) return;

    const rect = element.getBoundingClientRect();

    if (e.clientX < rect.left || e.clientX > rect.right ||
      e.clientY < rect.top || e.clientY > rect.bottom) {
      return;
    }

    const mouseX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
    const mouseY = ((e.clientY - rect.top) / rect.height - 0.5) * 2;

    const mouseRotateY = mouseX * 25 * settings.mouseFactor * settings.direction;
    const mouseRotateX = -mouseY * 20 * settings.mouseFactor;

    element.dataset.mouseRotateX = mouseRotateX;
    element.dataset.mouseRotateY = mouseRotateY;

    const mouseOffsetX = mouseX * 30 * settings.direction;
    element.dataset.mouseOffsetX = mouseOffsetX;
  }

  // Сброс трансформаций
  function resetTransforms() {
    element.style.transform = `rotate(${settings.base}deg)`;

    delete element.dataset.scrollX;
    delete element.dataset.scrollY;
    delete element.dataset.scrollRotateX;
    delete element.dataset.scrollRotateY;
    delete element.dataset.mouseRotateX;
    delete element.dataset.mouseRotateY;
    delete element.dataset.mouseOffsetX;
  }

  return {
    start: startParallax,
    stop: stopParallax,
    destroy: () => {
      observer.disconnect();
      stopParallax();
    },
    updateConfig: (newConfig) => {
      Object.assign(settings, newConfig);
    }
  };
}

function showToolbar() {
  const toolbar = document.querySelector('.toolbar'); // может отсутствовать
  const setToolbar = (value) => { if (toolbar) toolbar.style.display = value; };;
  if (!toolbar) return;

  window.addEventListener('scroll', () => {
    toolbar.classList.toggle('is-visible', window.scrollY > 80);
  });
}


function initHrefs() {
  const hrefs = document.querySelectorAll('.cases__item-link');
  hrefs.forEach((href) => {
    href.setAttribute('href', href.getAttribute('data-href'));
  });
}


function openAllCards() {
  const buttons = document.querySelectorAll('.cases__button');
  buttons.forEach((button) => {
    button.addEventListener('click', function() {
      const listing = button.closest('.cases__tab');
      const listingElements = listing.querySelectorAll('.cases__list .cases__item');
      listingElements.forEach((element) => {
        element.style.display = 'block';
      });
      button.remove();
    });
  });
}

function initReviewsCollapse() {
    const reviewBlocks = document.querySelectorAll('.reviews__block');
    
    reviewBlocks.forEach(block => {
        const textElement = block.querySelector('.reviews__block__text');
        const button = block.querySelector('.reviews__block__button');
        
        if (!textElement || !button) return;
        
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);
        
        const checkHeight = () => {
            const isMobile = window.innerWidth <= 768;
            const wasExpanded = textElement.classList.contains('is-expanded');
            
            textElement.classList.remove('is-collapsed', 'is-expanded');
            
            const lineHeight = parseInt(getComputedStyle(textElement).lineHeight);
            const maxLines = isMobile ? 6 : 10;
            const maxHeight = lineHeight * maxLines;
            const textHeight = textElement.scrollHeight;
            
            if (textHeight > maxHeight) {
                newButton.classList.remove('is-hidden');
                if (!wasExpanded) {
                    textElement.classList.add('is-collapsed');
                } else {
                    textElement.classList.add('is-expanded');
                    newButton.querySelector('span').textContent = i18n('collapse', 'Скрыть');
                }
            } else {
                newButton.classList.add('is-hidden');
                textElement.classList.remove('is-collapsed', 'is-expanded');
            }
        };
        
        newButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            if (textElement.classList.contains('is-collapsed')) {
                textElement.classList.remove('is-collapsed');
                textElement.classList.add('is-expanded');
                newButton.querySelector('span').textContent = i18n('collapse', 'Скрыть');
            } else if (textElement.classList.contains('is-expanded')) {
                textElement.classList.remove('is-expanded');
                textElement.classList.add('is-collapsed');
                newButton.querySelector('span').textContent = i18n('readMore', 'Читать полностью');
            }
        });
        
        setTimeout(checkHeight, 100);
        window.addEventListener('load', checkHeight);
        
        let resizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                const wasExpanded = textElement.classList.contains('is-expanded');
                textElement.classList.remove('is-collapsed', 'is-expanded');
                checkHeight();
                if (wasExpanded) {
                    textElement.classList.add('is-expanded');
                    newButton.querySelector('span').textContent = i18n('collapse', 'Скрыть');
                }
            }, 250);
        });
    });
}

function initMobileTooltips() {
  if (window.matchMedia('(hover: hover)').matches) return;

  const icons = document.querySelectorAll('.tariff__block__spec__icon');

  icons.forEach(icon => {
    if (icon.classList.contains('tariff__block__spec__icon-grey')) return;

    icon.addEventListener('click', (e) => {
      const overlay = icon.querySelector('.tariff__block__spec__overlay');
      if (!overlay) return;

      icons.forEach(i => {
        if (i !== icon) i.classList.remove('active');
      });

      icon.classList.toggle('active');

      e.stopPropagation();
    });
  });

  document.addEventListener('click', () => {
    icons.forEach(i => i.classList.remove('active'));
  });
}

function showToast(duration = 3000) {
    const existingToast = document.querySelector('.toast-notification');
    if (existingToast) {
        existingToast.remove();
    }
    
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    
    toast.innerHTML = `
        <div class="toast-icon">
            <svg width="18" height="18" fill="currentColor" role="img" aria-label="Стрелочка.">
                <use xlink:href="/media-temp/img/sprite.svg#icon-copy"></use>
            </svg>
        </div>
        <span>E-mail скопирован</span>
    `;
    
    document.body.appendChild(toast);
    
    toast.offsetHeight; 
    
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, duration);
}

async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        showToast();
        return true;
    } catch (err) {
        console.warn('Clipboard API failed, using fallback:', err);
        
        try {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            
            textarea.style.position = 'fixed';
            textarea.style.top = '-9999px';
            textarea.style.left = '-9999px';
            textarea.style.opacity = '0';
            
            document.body.appendChild(textarea);
            
            textarea.focus();
            textarea.select();
            textarea.setSelectionRange(0, text.length);
            
            const success = document.execCommand('copy');
            document.body.removeChild(textarea);
            
            if (success) {
                showToast();
                return true;
            } else {
                throw new Error('execCommand copy failed');
            }
        } catch (fallbackErr) {
            console.error('Failed to copy:', fallbackErr);
            showToast(i18n('copyError', 'Не удалось скопировать'), 2000);
            return false;
        }
    }
}

function addCopyHandlers() {
    document.querySelectorAll('.form__bottom__mail__link').forEach(link => {
        if (link.hasAttribute('data-copy-handled')) return;
        
        link.setAttribute('data-copy-handled', 'true');
        
        link.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const href = link.getAttribute('href');
            const text = href ? href.replace('mailto:', '') : link.textContent.trim();
            
            await copyToClipboard(text, i18n('copySuccess', 'Email скопирован!'));
        });
    });
    
    document.querySelectorAll('.footer__contacts-links__mail').forEach(link => {
        if (link.hasAttribute('data-copy-handled')) return;
        
        link.setAttribute('data-copy-handled', 'true');
        
        link.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const text = link.href.replace('mailto:', '');
            await copyToClipboard(text, i18n('copySuccess', 'Email скопирован!'));
        });
    });
}

function initBurgerMenu() {
  const burgerBtn = document.querySelector('.header__button-burger');
  const header = document.querySelector('.header');
  const burgerIcon = document.querySelector('.burger-icon');
  const closeIcon = document.querySelector('.close-icon');
  const headerBg = document.querySelector('.header__bg');
  const toolbar = document.querySelector('.toolbar'); // может отсутствовать
  const setToolbar = (value) => { if (toolbar) toolbar.style.display = value; };
  
  const headerLinks = document.querySelectorAll('.header a, .header button');

  if (!burgerBtn || !header) return;

  function closeMenu() {
    if (header.classList.contains('header--open')) {
      header.classList.remove('header--open');
      burgerBtn.style.background = 'rgba(13, 13, 13, 0.80)';
      burgerIcon.style.display = 'block';
      closeIcon.style.display = 'none';
      headerBg.style.display = 'none';
      setToolbar('flex');
    }
  }

  function toggleHeader() {
    const isOpen = header.classList.contains('header--open');
    
    header.classList.toggle('header--open');
    
    if (!isOpen) {
      burgerBtn.style.background = 'var(--color-default-white)';
      burgerIcon.style.display = 'none';
      closeIcon.style.display = 'block';
      headerBg.style.display = 'block';
      setToolbar('none');
    } else {
      burgerBtn.style.background = 'rgba(13, 13, 13, 0.80)';
      burgerIcon.style.display = 'block';
      closeIcon.style.display = 'none';
      headerBg.style.display = 'none';
      setToolbar('flex');
    }
  }

  headerLinks.forEach(link => {
    link.addEventListener('click', closeMenu);
  });

  burgerBtn.addEventListener('click', toggleHeader);
}


document.addEventListener('DOMContentLoaded', () => {
  addCopyHandlers();

  const copyObserver = new MutationObserver(() => {
      addCopyHandlers();
  });
  copyObserver.observe(document.body, { childList: true, subtree: true });

  // Проставить ссылки
  initHrefs();

  // Открыть все карточки
  openAllCards();

  // Инициализирует видео
  initVideos();
  initHeroVideo();

  // Запускает видео в зоне видимости
  checkVideosInViewport('.hero__video video, .value__video video, .team__video video');

  // Инициализирует табы
  initTabs();

  // Инициализирует смену цвета
  initInversion('.cases');

  // Элемент становится кликабельным
  clickableBlock('.expertise__messenger, .cases__item');

  // Открытие/закрытие шоурила
  toggleShowreel();

  initFaqAccordion();
  
  initBurgerMenu();

  // Параллакс изображений
  const tagImage = createImageParallax(
    document.querySelector('.hero__image-tag'),
    {
      base: -12.9,
      floatAmplitude: 3,
      scrollFactor: 15,
      mouseFactor: 0.3,
      direction: 1,
      floatSpeed: 0.8,
      parallaxFactor: {
        horizontal: 0.2,
        vertical: 0.1
      }
    }
  );

  const birdImage = createImageParallax(
    document.querySelector('.hero__image-bird'),
    {
      base: -9.5,
      floatAmplitude: 2.5,
      scrollFactor: 12,
      mouseFactor: 0.25,
      direction: -1,
      floatSpeed: 0.7,
      rotateFloatX: 0.5,
      parallaxFactor: {
        horizontal: 0.18,
        vertical: 0.08
      }
    }
  );

  const developmentsImage = createImageParallax(
    document.querySelector('.developments__image'),
    {
      base: 5,
      floatAmplitude: 8,
      scrollFactor: 8,
      mouseFactor: 0.2,
      direction: 1,
      floatSpeed: 0.6,
      rotateFloatX: 0.3,
      rotateFloatY: 0.2,
      rotateFloatZ: 0.8,
      parallaxFactor: {
        horizontal: 0.15,
        vertical: 0.1
      }
    }
  );

  const decorationImage = createImageParallax(
    document.querySelector('.decoration__image'),
    {
      base: -8,
      floatAmplitude: 4,
      scrollFactor: 10,
      mouseFactor: 0.25,
      direction: -1,
      floatSpeed: 0.5,
      rotateFloatX: 0.4,
      rotateFloatY: 0.4,
      rotateFloatZ: 0.6,
      perspective: 1000,
      parallaxFactor: {
        horizontal: 0.2,
        vertical: 0.15
      }
    }
  );

  const principlesTagImage = createImageParallax (
    document.querySelector('.principles__image__tag'),
    {
      base: -12.9,
      floatAmplitude: 3,
      scrollFactor: 15,
      mouseFactor: 0.3,
      direction: 1,
      floatSpeed: 0.8,
      parallaxFactor: {
        horizontal: 0.2,
        vertical: 0.1
      }
    }
  );

  const bannerBirdImage = createImageParallax (
    document.querySelector('.banner__image__bird'),
    {
      base: -12.9,
      floatAmplitude: 3,
      scrollFactor: 15,
      mouseFactor: 0.3,
      direction: 1,
      floatSpeed: 0.8,
      parallaxFactor: {
        horizontal: 0.2,
        vertical: 0.1
      }
    }
  );

  // Очистка параллакс
  window.addEventListener('beforeunload', () => {
    [tagImage, birdImage, developmentsImage, decorationImage, principlesTagImage, bannerBirdImage].forEach(p => p?.destroy());
  });

  initReviewsCollapse();


  // ТОЛЬКО ПК
  if (window.innerWidth >= 1024) {

    // Проверяет скролл и добавляет/убирает класс шапке
    handleHeaderScroll();
    window.addEventListener('scroll', handleHeaderScroll);

    // Инициализирует плавный скролл при клике на ссылке в шапке
    initSmoothScroll();

    // Запускает видео при hover на родительском элементе
    checkVideosOnHover('.cases__item, .expertise__item');

    // Запускает плавное перемещение элемента за курсором
    initFloatingElement();

    // Отслеживает попадание блока в зону видимости и инициализирует sticky
    initExpertiseObserver();

    // Инициализирует кастомный курсор
    initCustomCursor('.cases__item');

    // Инициализируем основной кастомный курсор
    initCustomCursorMain();

    // Задает нижний марджин странице
    setWrapperMargin();

  }


  // ТОЛЬКО МОБ
  if (window.innerWidth < 1024) {

    // Запускает видео в кейсах
    initCasesVideo();

    // Инициализирует аккордеон
    initAccordion();

    // Отображает toolbar
    showToolbar();

    // Tooltips у специалистов в тарифах
    initMobileTooltips();
  }
});