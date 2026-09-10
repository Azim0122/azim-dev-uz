let lenis;

function initLenis() {
  lenis = new Lenis({
    lerp: 0.08,
    smooth: true,
  });

  lenis.on('scroll', ScrollTrigger.update);

  gsap.ticker.add((time) => {
    lenis.raf(time * 1000);
  });

  gsap.ticker.lagSmoothing(0);

  return lenis;
}

function animateHero() {
  const heroTags = document.querySelector('.hero__tags');
  const titleLines = document.querySelectorAll('.hero__title p');
  const heroText = document.querySelector('.hero__text');
  const heroShowreel = document.querySelector('.hero__showreel');

  const tl = gsap.timeline();

  if (heroTags) {
    tl.from(heroTags, {
      opacity: 0,
      scale: 0,
      duration: 0.8,
      ease: "power2.out",
      clearProps: "all"
    }, 0);
  }

  if (titleLines.length) {
    tl.from(titleLines, {
      yPercent: 100,
      opacity: 0,
      duration: 3,
      ease: "power4.out",
      stagger: 0.4,
      clearProps: "all"
    }, '0.6');
  }

  if (heroText) {
    tl.from(heroText, {
      y: 50,
      opacity: 0,
      duration: 1,
      ease: "power3.out",
      clearProps: "all"
    }, "1.8");
  }

  if (heroShowreel) {
    tl.from(heroShowreel, {
      y: 50,
      opacity: 0,
      duration: 1,
      ease: "power3.out",
      clearProps: "all"
    }, "1.8");
  }
}

function initTypewriter() {
  const titles = document.querySelectorAll('.title');

  if (!titles.length) return;

  titles.forEach((title) => {
    const split = new SplitText(title, { type: 'chars' });

    gsap.set(split.chars, { opacity: 0 });

    const tl = gsap.timeline({
      defaults: { duration: 0.05 },
      scrollTrigger: {
        trigger: title,
        start: "top 95%",
        end: "bottom 20%",
        toggleActions: "play none none none",
      }
    });

    tl.to(split.chars, {
      opacity: 1,
      stagger: 0.1,
      ease: "none"
    });
  });
}

function animateCasesTags() {
  const tags = document.querySelector('.cases__tags');
  const tagsItems = document.querySelectorAll('.cases__tags li');

  if (!tagsItems.length) return;

  gsap.set(tagsItems, {
    opacity: 0,
    scale: 0
  });

  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: tags,
      start: 'top 90%',
      end: 'top 80%',
      toggleActions: "play none none none",
    }
  });

  tl.to(tagsItems, {
    opacity: 1,
    scale: 1,
    duration: 1.6,
    stagger: 0.1,
    ease: "back.out(1.2)",
  });
}

function animateTextLines(selector) {
  const elements = document.querySelectorAll(selector);

  if (!elements.length) return;

  elements.forEach((element) => {
    const split = new SplitText(element, {
      type: "lines",
      linesClass: "split-line"
    });

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: element,
        start: "top 90%",
        end: "top 50%",
        toggleActions: "play none none none",
      }
    });

    tl.fromTo(split.lines,
      {
        opacity: 0,
        y: 50
      },
      {
        opacity: 1,
        y: 0,
        duration: 1.4,
        stagger: 0.4,
        ease: "power2.out"
      }
    );
  });
}

function animateServicesItems() {
  const items = document.querySelectorAll('.services__item');

  if (!items.length) return;

  items.forEach((item, index) => {
    gsap.set(item, {
      opacity: 0,
      y: 30,
      filter: "blur(10px)"
    });

    gsap.to(item, {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      clearProps: "all",
      onComplete: () => {
        item.classList.add('easy');
      },
      scrollTrigger: {
        trigger: item,
        start: 'top 90%',
        end: 'top 70%',
        scrub: 1,
        once: true,
        toggleActions: "play none none none",
      },
      delay: index * 0.15
    });
  });
}

function animateExpertiseItems() {
  const items = document.querySelectorAll('.expertise__item');

  if (!items.length) return;

  items.forEach((item) => {
    gsap.set(item, {
      opacity: 0,
      x: 100
    });

    gsap.to(item, {
      opacity: 1,
      x: 0,
      duration: 0.8,
      ease: "power3.out",
      scrollTrigger: {
        trigger: item,
        start: "top 90%",
        end: "top 60%",
        toggleActions: "play none none none",
      }
    });
  });
}

function animateValue() {
  const video = document.querySelector('.value__video');
  const content = document.querySelector('.value__content');

  if (!video || !content) return;

  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: '.value',
      start: 'top 80%',
      end: 'top 30%',
      scrub: 1,
      once: true
    }
  });

  gsap.set(video, {
    scale: 0.8,
    filter: "blur(5px)"
  });

  gsap.set(content, {
    opacity: 0,
    y: 30
  });

  tl.to(video, {
    scale: 1,
    filter: "blur(0px)",
    duration: 1.5,
    ease: "power2.out"
  })
    .to(content, {
      opacity: 1,
      y: 0,
      duration: 1,
      ease: "power2.out"
    }, "-=0.8");
}

function revealDevelopmentsList() {
  const list = document.querySelector('.developments__list');
  const textElements = list.querySelectorAll('.developments__item p');

  let allChars = [];

  textElements.forEach(element => {
    const splitWords = new SplitText(element, {
      type: 'words',
      preserveWhitespace: true
    });

    splitWords.words.forEach(word => {
      const splitChars = new SplitText(word, {
        type: 'chars',
        preserveWhitespace: true
      });
      allChars = [...allChars, ...splitChars.chars];
    });
  });

  gsap.set(allChars, { opacity: 0.2 });

  gsap.to(allChars, {
    opacity: 1,
    stagger: 0.15,
    ease: 'none',
    scrollTrigger: {
      trigger: list,
      start: 'top 95%',
      end: 'bottom 70%',
      scrub: 1,
    }
  });
}

function animateButton(selector) {
  const elements = document.querySelectorAll(selector);

  if (!elements.length) return;

  elements.forEach(element => {
    gsap.set(element, {
      y: 80,
      opacity: 0,
      scale: 0.9
    });

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: element,
        start: 'top 90%',
        end: 'top 80%',
        toggleActions: "play none none none",
        once: true
      }
    });

    tl.to(element, {
      y: 0,
      opacity: 1,
      scale: 1,
      duration: 0.5,
      ease: 'elastic.out(1, 0.3)'
    });
  });
}

function animateFadeIn(selector) {
  const elements = document.querySelectorAll(selector);

  if (!elements.length) return;

  elements.forEach(element => {
    gsap.set(element, {
      y: 80,
      opacity: 0,
    });

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: element,
        start: 'top 100%',
        end: 'top 80%',
        toggleActions: "play none none none",
        once: true
      }
    });

    tl.to(element, {
      y: 0,
      opacity: 1,
      duration: 1.2,
      ease: 'power2.out'
    });
  });
}

function animateTeam() {
  const aboutTeamList = document.querySelector('.team__about-list');
  const teamList = document.querySelector('.team__list');

  if (!aboutTeamList || !teamList) return;

  gsap.set(aboutTeamList, {
    opacity: 0,
    x: -100
  });

  const tlAbout = gsap.timeline({
    scrollTrigger: {
      trigger: aboutTeamList,
      start: 'top 80%',
      end: 'top 30%',
      toggleActions: "play none none none",
      once: true
    }
  });

  tlAbout.to(aboutTeamList, {
    opacity: 1,
    x: 0,
    duration: 2.2,
    ease: "power3.out"
  });

  gsap.set(teamList, {
    opacity: 0,
    x: 100
  });

  const tlTeam = gsap.timeline({
    scrollTrigger: {
      trigger: teamList,
      start: 'top 80%',
      end: 'top 30%',
      toggleActions: "play none none none",
      once: true
    }
  });

  tlTeam.to(teamList, {
    opacity: 1,
    x: 0,
    duration: 2.2,
    ease: "power3.out"
  });
}


document.addEventListener('DOMContentLoaded', () => {

  // Инициализирует плагины GSAP
  gsap.registerPlugin(ScrollTrigger, SplitText, ScrambleTextPlugin);


  // Инициализирует плавный скролл (Lenis в интеграции с GSAP's ScrollTrigger plugin)
  initLenis();


  // Анимации, не зависящие от текста, можно запускать сразу
  animateHero();
  animateServicesItems();
  animateExpertiseItems();
  animateButton('.developments__button, .team__vacancy-button');
  animateFadeIn('.cases__tags, .expertise__tags, .value__wrapper-container, .team__about-list, .team__list');

  // SplitText считает ширину каждой буквы по факту отрисованного шрифта.
  // Если запустить его до полной загрузки кастомных шрифтов, буквы
  // измеряются по временному fallback-шрифту, а после подключения
  // настоящего шрифта текст остаётся "склеенным" в исходных (неверных)
  // позициях — отсюда наплывающий друг на друга текст и разъезжающийся
  // макет. document.fonts.ready гарантирует, что шрифты уже готовы.
  document.fonts.ready.then(() => {
    initTypewriter();
    animateTextLines('.services__top p, .expertise__top-text p, .expertise__content-text, .team__right-top p');
    revealDevelopmentsList();
  });
});
