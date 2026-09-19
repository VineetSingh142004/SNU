import '@fontsource/cormorant-garamond/300.css';
import '@fontsource/cormorant-garamond/400.css';
import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/pinyon-script/400.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/gfs-didot/400.css';
import './styles.css';

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { emblemSVG } from './emblem.js';

gsap.registerPlugin(ScrollTrigger);

const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(pointer: fine)').matches;
const isSmall = () => innerWidth <= 900;
const lerp = (a, b, t) => a + (b - a) * t;

/* ------------------------------------------------------------------ */
/* Text splitting                                                      */
/* ------------------------------------------------------------------ */

function splitChars(el) {
  const walk = (node) => {
    [...node.childNodes].forEach((child) => {
      if (child.nodeType === 3) {
        const frag = document.createDocumentFragment();
        child.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) return frag.append(document.createTextNode(' '));
          const w = document.createElement('span');
          w.className = 'word';
          for (const ch of part) {
            const c = document.createElement('span');
            c.className = 'char';
            c.textContent = ch;
            w.append(c);
          }
          frag.append(w);
        });
        child.replaceWith(frag);
      } else if (child.nodeType === 1 && child.tagName !== 'BR') {
        walk(child);
      }
    });
  };
  el.setAttribute('aria-label', el.textContent.trim().replace(/\s+/g, ' '));
  walk(el);
  $$('.word', el).forEach((w) => w.setAttribute('aria-hidden', 'true'));
}

function splitWords(el) {
  const words = el.textContent.trim().split(/\s+/);
  el.setAttribute('aria-label', words.join(' '));
  el.innerHTML = words.map((w) => `<span class="word" aria-hidden="true">${w}</span>`).join(' ');
}

$$('[data-chars]').forEach(splitChars);
$$('[data-words]').forEach(splitWords);

/* ------------------------------------------------------------------ */
/* Smooth scroll                                                       */
/* ------------------------------------------------------------------ */

let lenis = null;
if (!reduced) {
  lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.9, smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  lenis.stop();
}
const scrollTo = (target) => {
  if (lenis) lenis.scrollTo(target, { duration: 1.8, easing: (t) => 1 - Math.pow(1 - t, 4) });
  else document.querySelector(target)?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
};

/* ------------------------------------------------------------------ */
/* Loader                                                              */
/* ------------------------------------------------------------------ */

document.body.classList.add('is-loading');
history.scrollRestoration = 'manual';
window.scrollTo(0, 0);

const emblemHost = $('[data-emblem]');
emblemHost.innerHTML = emblemSVG();
const emblemStrokes = $$('.emblem-stroke', emblemHost);
emblemStrokes.forEach((p) => {
  const len = p.getTotalLength?.() || 200;
  p.style.strokeDasharray = len;
  p.style.strokeDashoffset = len;
});
const draw = gsap.to(emblemStrokes, { strokeDashoffset: 0, duration: 2.2, ease: 'power2.inOut', stagger: 0.12 });

const progress = { shown: 0 };
const countEl = $('[data-count]');
const tasks = [];
const track = (p) => {
  tasks.push(p);
  p.finally(() => (p.done = true)).catch(() => {});
  return p;
};
const counter = gsap.ticker.add(() => {
  const done = tasks.filter((t) => t.done).length / Math.max(1, tasks.length);
  progress.shown += (done - progress.shown) * 0.08;
  countEl.textContent = String(Math.round(progress.shown * 100)).padStart(3, '0');
});

const imageReady = (src) =>
  new Promise((res) => {
    const i = new Image();
    i.onload = i.onerror = res;
    i.src = src;
  });

/* ------------------------------------------------------------------ */
/* The Serpent                                                         */
/* ------------------------------------------------------------------ */

let serpent = null;
const canvas = $('.serpent-canvas');

const POSES = {
  hero: { cx: 0, cy: 2.2, cz: 8.6, tx: 0, ty: 1.2, tz: 0.35, rot: 0, lift: 0 },
  heroClose: { cx: 1.2, cy: 2.6, cz: 3.0, tx: -0.05, ty: 2.3, tz: 1.5, rot: 0.1, lift: 0.1 },
  histA: { cx: -3.2, cy: 3.6, cz: 9.2, tx: -2.9, ty: 1.3, tz: 0.3, rot: 0.8, lift: 0 },
  histB: { cx: -2.9, cy: 2.2, cz: 10.4, tx: -2.9, ty: 1.4, tz: 0.2, rot: 2.3, lift: 0 },
  footA: { cx: 0, cy: 5.0, cz: 9.0, tx: 0, ty: 0.6, tz: 0, rot: -1.2, lift: 0 },
  footB: { cx: 0, cy: 2.6, cz: 8.6, tx: 0, ty: 2.0, tz: 0.3, rot: 0.15, lift: 0 },
};
// Phones: pull the camera back so the whole coil clears the title.
if (isSmall()) {
  Object.assign(POSES.hero, { cy: 3.0, cz: 11.2, ty: 0.9 });
  Object.assign(POSES.heroClose, { cz: 4.2, cx: 0.8 });
  Object.assign(POSES.histA, { cx: -0.6, cz: 12, tx: -0.4, ty: 2.4 });
  Object.assign(POSES.histB, { cx: -0.4, cz: 13, tx: -0.3, ty: 2.2 });
  Object.assign(POSES.footA, { cz: 13 });
  Object.assign(POSES.footB, { cz: 12.5, ty: 2.6 });
}
const setPose = (a, b, t) => {
  if (!serpent) return;
  const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  for (const k in a) serpent.state[k] = lerp(a[k], b[k], e);
};

const serpentReady = track(
  import('./serpent.js')
    .then(({ Serpent }) => {
      const lowPower = isSmall() || (navigator.hardwareConcurrency || 8) <= 4;
      serpent = new Serpent(canvas, { lowPower });
      Object.assign(serpent.state, POSES.hero);
      serpent.warmup();
      serpent.start();
    })
    .catch((err) => {
      // No WebGL? The site still works — the dark sections simply stay black.
      console.warn('Serpent unavailable:', err);
      canvas.style.display = 'none';
    })
);
track(document.fonts.ready);
track(imageReady('img/rush-card.webp'));
track(imageReady('img/legion-center.webp'));
track(new Promise((r) => setTimeout(r, reduced ? 200 : 2300)));

Promise.all(tasks).then(() => {
  gsap.ticker.remove(counter);
  countEl.textContent = '100';
  draw.progress(1);
  buildScroll();
  intro();
});

/* ------------------------------------------------------------------ */
/* Intro                                                               */
/* ------------------------------------------------------------------ */

function intro() {
  const tl = gsap.timeline({
    defaults: { ease: 'expo.out' },
    onComplete: () => {
      document.body.classList.remove('is-loading');
      $('.loader').remove();
      lenis?.start();
    },
  });
  tl.to('.loader__meta, .loader__mark', { opacity: 0, duration: 0.5, ease: 'power2.in' })
    .to('.loader__emblem', { scale: 1.6, opacity: 0, duration: 1.1, ease: 'power3.in' }, 0)
    .to('.loader', { clipPath: 'inset(0% 0% 100% 0%)', duration: 1.2, ease: 'expo.inOut' }, 0.55)
    .from('.header', { opacity: 0, y: -20, duration: 1.2 }, 1.2)
    .from('.hero__eyebrow span', { opacity: 0, y: 14, stagger: 0.1, duration: 1.2 }, 1.2)
    .from(
      '.hero__script .char',
      { opacity: 0, x: -18, filter: 'blur(10px)', stagger: 0.035, duration: 1.4, ease: 'power3.out' },
      1.25
    )
    .from('.hero__display .char', { yPercent: 70, opacity: 0, filter: 'blur(14px)', stagger: 0.06, duration: 1.6 }, 1.3)
    .from('.hero__card', { clipPath: 'inset(100% 0 0 0)', duration: 1.4 }, 1.6)
    .from('.hero__scroll, .hero__place', { opacity: 0, y: 16, duration: 1.2, stagger: 0.1 }, 1.8);
}

/* ------------------------------------------------------------------ */
/* Scroll choreography                                                 */
/* ------------------------------------------------------------------ */

function buildScroll() {
  /* --- which dark sections show the serpent --- */
  const active = new Set();
  $$('[data-serpent]').forEach((el) => {
    ScrollTrigger.create({
      trigger: el,
      start: 'top bottom',
      end: 'bottom top',
      onToggle: (self) => {
        self.isActive ? active.add(el) : active.delete(el);
        if (serpent) serpent.visible = active.size > 0;
      },
    });
  });

  /* --- 01 Hero: the title dissolves forward while the camera closes on the serpent's eye --- */
  const heroTl = gsap.timeline({
    scrollTrigger: {
      trigger: '.hero',
      start: 'top top',
      end: '+=120%',
      pin: true,
      scrub: true,
      onUpdate: (s) => setPose(POSES.hero, POSES.heroClose, s.progress),
    },
  });
  heroTl
    .to('.hero__title', { scale: 1.9, opacity: 0, filter: 'blur(14px)', ease: 'power1.in' }, 0)
    .to('.hero__card, .hero__place, .hero__scroll', { opacity: 0, y: 40, ease: 'power1.in', duration: 0.5 }, 0)
    .to('.hero__glow', { opacity: 0, duration: 0.6 }, 0);

  /* --- 02 Legion: centre frame zooms to full bleed --- */
  const legionFrom = isSmall() ? 'inset(40vh 16vw 8vh 16vw)' : 'inset(38vh 34vw 0vh 34vw)';
  gsap.set('.legion__center', { clipPath: legionFrom });
  gsap
    .timeline({ scrollTrigger: { trigger: '.legion', start: 'top top', end: '+=170%', pin: true, scrub: true } })
    .to('.legion__head', { yPercent: -70, opacity: 0, ease: 'power1.in', duration: 0.4 }, 0.05)
    .fromTo('.legion__center', { clipPath: legionFrom }, { clipPath: 'inset(0vh 0vw 0vh 0vw)', ease: 'power2.inOut', duration: 1 }, 0)
    .to('.legion__center img', { scale: 1, ease: 'power2.inOut', duration: 1 }, 0)
    .to('.legion__side--l', { xPercent: -130, yPercent: -25, ease: 'power2.in', duration: 0.8 }, 0)
    .to('.legion__side--r', { xPercent: 130, yPercent: -25, ease: 'power2.in', duration: 0.8 }, 0)
    .to('.legion__caption', { opacity: 1, duration: 0.25 }, 0.85)
    .from('.legion__caption .script', { yPercent: 40, filter: 'blur(10px)', duration: 0.35 }, 0.85);

  /* --- generic reveals --- */
  $$('[data-lines]').forEach((el) => {
    gsap.from($$('.line > span', el), {
      yPercent: 115,
      skewY: 5,
      duration: 1.4,
      ease: 'expo.out',
      stagger: 0.08,
      scrollTrigger: { trigger: el, start: 'top 85%' },
    });
  });
  $$('[data-chars]')
    .filter((el) => !el.closest('.hero'))
    .forEach((el) => {
      const script = el.classList.contains('script');
      gsap.from($$('.char', el), {
        opacity: 0,
        filter: 'blur(10px)',
        ...(script ? { x: -14 } : { yPercent: 60 }),
        duration: 1.3,
        ease: 'power3.out',
        stagger: script ? 0.04 : 0.05,
        scrollTrigger: { trigger: el, start: 'top 85%' },
      });
    });
  $$('[data-fade]').forEach((el) => {
    gsap.from(el, { opacity: 0, y: 30, duration: 1.4, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 88%' } });
  });
  $$('[data-parallax]').forEach((el) => {
    const v = parseFloat(el.dataset.parallax);
    gsap.fromTo(el, { yPercent: -v * 50 }, { yPercent: v * 50, ease: 'none', scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true } });
    const img = $('img', el);
    if (img) gsap.fromTo(img, { yPercent: -15 }, { yPercent: 0, ease: 'none', scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true } });
  });

  /* --- 04 Bonds: full-bleed images wipe up over each other --- */
  const bondImgs = $$('.bonds__img');
  const bt = gsap.timeline({
    scrollTrigger: { trigger: '.bonds', start: 'top top', end: () => `+=${(bondImgs.length - 1) * 85}%`, pin: true, scrub: true },
  });
  bondImgs.forEach((f, i) => {
    const img = $('img', f);
    if (i === 0) return bt.fromTo(img, { scale: 1.2 }, { scale: 1, ease: 'none', duration: 1 }, 0);
    bt.fromTo(f, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', ease: 'power1.inOut', duration: 1 }, i - 1);
    bt.fromTo(img, { scale: 1.35, yPercent: 12 }, { scale: 1, yPercent: 0, ease: 'none', duration: 1 }, i - 1);
  });
  gsap.from('.bonds__caption .eyebrow', { opacity: 0, y: 12, duration: 1.2, scrollTrigger: { trigger: '.bonds', start: 'top 40%' } });

  /* --- 05 History --- */
  ScrollTrigger.create({
    trigger: '.history',
    start: 'top bottom',
    end: 'bottom top',
    onUpdate: (s) => setPose(POSES.histA, POSES.histB, s.progress),
  });
  gsap.to('.history__words .word', {
    opacity: 1,
    stagger: 0.1,
    ease: 'none',
    scrollTrigger: { trigger: '.history__intro', start: 'top 70%', end: isSmall() ? 'bottom 60%' : 'bottom 85%', scrub: true },
  });
  if (!isSmall()) {
    gsap.fromTo(
      '.history__img',
      { yPercent: 60 },
      { yPercent: -70, ease: 'none', scrollTrigger: { trigger: '.history__intro', start: 'top bottom', end: 'bottom top', scrub: true } }
    );
  }
  gsap.from('.timeline li', {
    opacity: 0,
    y: 40,
    stagger: 0.12,
    duration: 1.3,
    ease: 'expo.out',
    scrollTrigger: { trigger: '.timeline', start: 'top 85%' },
  });
  gsap.fromTo(
    '.history__pano-frame img',
    { xPercent: 0 },
    { xPercent: -12, ease: 'none', scrollTrigger: { trigger: '.history__pano', start: 'top bottom', end: 'bottom top', scrub: true } }
  );
  gsap.from('.history__pano-frame', {
    clipPath: 'inset(0% 50% 0% 50%)',
    duration: 1.8,
    ease: 'expo.inOut',
    scrollTrigger: { trigger: '.history__pano', start: 'top 80%' },
  });

  /* --- 06 Honor --- */
  gsap.to('.honor__bg img', {
    scale: 1,
    ease: 'none',
    scrollTrigger: { trigger: '.honor', start: 'top bottom', end: 'bottom top', scrub: true },
  });
  gsap.fromTo('.honor__script', { '--shine': '0%' }, {
    '--shine': '100%',
    ease: 'none',
    scrollTrigger: { trigger: '.honor', start: 'top bottom', end: 'bottom top', scrub: true },
  });

  /* --- 07 House ring --- */
  buildRing();

  /* --- 08 Tenets: horizontal journey --- */
  buildTenets();

  /* --- 09 Calendar --- */
  ScrollTrigger.batch('.event', {
    start: 'top 90%',
    onEnter: (els) => gsap.from(els, { opacity: 0, y: 40, stagger: 0.08, duration: 1.2, ease: 'expo.out' }),
    once: true,
  });
  eventFloat();

  /* --- 10 Honors --- */
  $$('[data-counter]').forEach((el) => {
    const target = +el.dataset.counter;
    const suffix = el.dataset.suffix || '';
    const o = { v: target > 1000 ? target - 80 : 0 };
    el.textContent = Math.round(o.v) + suffix;
    gsap.to(o, {
      v: target,
      duration: 2.4,
      ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 88%' },
      onUpdate: () => (el.textContent = Math.round(o.v) + suffix),
    });
  });
  gsap.fromTo(
    '.honors__mark',
    { yPercent: -40, rotate: -6 },
    { yPercent: -60, rotate: 6, ease: 'none', scrollTrigger: { trigger: '.honors', start: 'top bottom', end: 'bottom top', scrub: true } }
  );
  gsap.from('.laurels li', {
    opacity: 0,
    y: 30,
    stagger: 0.1,
    duration: 1.2,
    ease: 'expo.out',
    scrollTrigger: { trigger: '.laurels', start: 'top 85%' },
  });

  /* --- 11 Brothers --- */
  ScrollTrigger.batch('.brother', {
    start: 'top 90%',
    once: true,
    onEnter: (els) => {
      gsap.from(els, { y: 60, opacity: 0, stagger: 0.1, duration: 1.4, ease: 'expo.out' });
      gsap.from(
        els.map((e) => $('figure', e)),
        { clipPath: 'inset(100% 0% 0% 0%)', stagger: 0.1, duration: 1.4, ease: 'expo.inOut' }
      );
    },
  });
  if (finePointer) tilt('.brother');

  /* --- 12 Creed --- */
  creedSlider();

  /* --- 13 Finale --- */
  gsap.to('.finale__bg img', {
    scale: 1,
    ease: 'none',
    scrollTrigger: { trigger: '.finale', start: 'top bottom', end: 'bottom top', scrub: true },
  });
  sparks();

  /* --- Footer: the serpent rises one last time --- */
  ScrollTrigger.create({
    trigger: '.footer',
    start: 'top bottom',
    end: 'bottom bottom',
    onUpdate: (s) => setPose(POSES.footA, POSES.footB, s.progress),
  });

  ScrollTrigger.refresh();
}

let tenetsTween;
function buildTenets() {
  const trackEl = $('.tenets__track');
  const dist = () => trackEl.scrollWidth - innerWidth;
  tenetsTween = gsap.to(trackEl, {
    x: () => -dist(),
    ease: 'none',
    scrollTrigger: {
      trigger: '.tenets',
      start: 'top top',
      end: () => `+=${dist()}`,
      pin: true,
      scrub: true,
      invalidateOnRefresh: true,
    },
  });
  $$('.tenets .tp__img img, .tenets .tp__bg img').forEach((img) => {
    gsap.fromTo(
      img,
      { xPercent: -14 },
      {
        xPercent: 0,
        ease: 'none',
        scrollTrigger: { trigger: img.closest('.tp'), containerAnimation: tenetsTween, start: 'left right', end: 'right left', scrub: true },
      }
    );
  });
  gsap.from('.tp__card', {
    yPercent: 100,
    ease: 'none',
    scrollTrigger: { trigger: '.tenets', start: 'top 90%', end: 'top top', scrub: true },
  });
  $$('.tp__head').forEach((h) => {
    gsap.from($$('span', h), {
      yPercent: 60,
      opacity: 0,
      filter: 'blur(8px)',
      stagger: 0.12,
      duration: 1.3,
      ease: 'expo.out',
      scrollTrigger: { trigger: h, containerAnimation: tenetsTween, start: 'left 85%' },
    });
  });
}

/* ------------------------------------------------------------------ */
/* House ring — images on the inside of a cylinder, sliced for a true curve */
/* ------------------------------------------------------------------ */

const HOUSE = [
  { src: 'img/g-sunset.webp', label: 'Golden hour' },
  { src: 'img/g-sparklers.webp', label: 'Formal night' },
  { src: 'img/g-field.webp', label: 'Intramurals' },
  { src: 'img/g-fire.webp', label: 'Bonfire season' },
  { src: 'img/g-slide.webp', label: 'Flunk Day' },
  { src: 'img/g-stadium.webp', label: 'Game day' },
  { src: 'img/g-talk.webp', label: 'Late conversations' },
  { src: 'img/g-fog.webp', label: 'Winter term' },
  { src: 'img/g-bridge.webp', label: 'Road trips' },
  { src: 'img/legion-center.webp', label: 'Brothers' },
];

function buildRing() {
  const ring = $('.ring');
  const trackEl = $('.ring__track');
  const SL = 7;
  const n = HOUSE.length;
  $('[data-ring-total]').textContent = String(n).padStart(2, '0');
  const slices = [];
  HOUSE.forEach((item, i) => {
    for (let k = 0; k < SL; k++) {
      const s = document.createElement('div');
      s.className = 'ring__slice';
      s.style.backgroundImage = `url(${item.src})`;
      trackEl.append(s);
      slices.push({ el: s, i, k, theta: 0 });
    }
  });

  let R = 0;
  let step = 0;
  const layout = () => {
    const cardW = isSmall() ? innerWidth * 0.66 : Math.min(innerWidth * 0.3, 560);
    const cardH = cardW / 1.42;
    const gap = cardW * 0.09;
    R = (n * (cardW + gap)) / (Math.PI * 2);
    step = (cardW + gap) / R;
    const sliceW = cardW / SL;
    const bgW = cardH * 1.5;
    ring.style.setProperty('--R', `${R}px`);
    slices.forEach((s) => {
      s.theta = s.i * step + ((s.k + 0.5) * sliceW - cardW / 2) / R;
      s.el.style.width = `${sliceW + 1}px`;
      s.el.style.height = `${cardH}px`;
      s.el.style.backgroundSize = `${bgW}px ${cardH}px`;
      s.el.style.backgroundPosition = `${-((bgW - cardW) / 2 + s.k * sliceW)}px 0`;
      s.el.style.transform = `rotateY(${-s.theta}rad) translateZ(${-R}px) translate(-50%, -50%)`;
      s.el.style.marginLeft = `0px`;
    });
  };
  layout();
  addEventListener('resize', layout);

  // scroll drives the rotation while pinned; drag adds on top with inertia
  const st = { scroll: 0, drag: 0, vel: 0 };
  ScrollTrigger.create({
    trigger: '.house',
    start: 'top top',
    end: '+=220%',
    pin: true,
    scrub: true,
    onUpdate: (s) => (st.scroll = s.progress * step * (n - 1)),
  });
  let down = false;
  let lastX = 0;
  ring.addEventListener('pointerdown', (e) => {
    down = true;
    lastX = e.clientX;
    ring.setPointerCapture(e.pointerId);
  });
  ring.addEventListener('pointermove', (e) => {
    if (!down) return;
    const dx = e.clientX - lastX;
    lastX = e.clientX;
    st.vel = (dx / R) * 1.1;
    st.drag += st.vel;
  });
  const up = () => (down = false);
  ring.addEventListener('pointerup', up);
  ring.addEventListener('pointercancel', up);

  const labelEl = $('[data-ring-label]');
  const idxEl = $('[data-ring-index]');
  let lastIdx = -1;
  let angle = 0;
  gsap.ticker.add(() => {
    if (!down) {
      st.drag += st.vel;
      st.vel *= 0.93;
    }
    const target = st.scroll - st.drag;
    angle += (target - angle) * 0.12;
    trackEl.style.transform = `translateZ(${R}px) rotateY(${angle}rad)`;
    for (const s of slices) {
      let a = s.theta - angle;
      a = Math.atan2(Math.sin(a), Math.cos(a));
      const vis = Math.abs(a) < 1.35;
      if (s.vis !== vis) {
        s.el.style.visibility = vis ? 'visible' : 'hidden';
        s.vis = vis;
      }
    }
    const idx = ((Math.round(angle / step) % n) + n) % n;
    if (idx !== lastIdx) {
      lastIdx = idx;
      labelEl.textContent = HOUSE[idx].label;
      idxEl.textContent = String(idx + 1).padStart(2, '0');
      gsap.fromTo(labelEl, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' });
    }
  });
}

/* ------------------------------------------------------------------ */
/* Calendar hover image                                                */
/* ------------------------------------------------------------------ */

function eventFloat() {
  if (!finePointer) return;
  const float = $('.event-float');
  const img = $('img', float);
  const xTo = gsap.quickTo(float, 'x', { duration: 0.7, ease: 'power3' });
  const yTo = gsap.quickTo(float, 'y', { duration: 0.7, ease: 'power3' });
  let px = -1;
  let py = -1;
  let current = null;
  // Re-evaluated on pointer move *and* on scroll, so the image never lingers
  // when the page scrolls out from under a stationary cursor.
  const check = () => {
    const ev = px < 0 ? null : document.elementFromPoint(px, py)?.closest('.event');
    if (ev === current) return;
    current = ev;
    if (ev) {
      if (img.getAttribute('src') !== ev.dataset.img) img.src = ev.dataset.img;
      gsap.to(float, { opacity: 1, scale: 1, rotate: gsap.utils.random(-4, 4), duration: 0.6, ease: 'expo.out' });
    } else {
      gsap.to(float, { opacity: 0, scale: 0.8, duration: 0.4 });
    }
  };
  addEventListener('pointermove', (e) => {
    px = e.clientX;
    py = e.clientY;
    xTo(px + 30);
    yTo(py - 150);
    check();
  });
  lenis ? lenis.on('scroll', check) : addEventListener('scroll', check, { passive: true });
}

/* ------------------------------------------------------------------ */
/* Portrait tilt                                                       */
/* ------------------------------------------------------------------ */

function tilt(sel) {
  $$(sel).forEach((card) => {
    const rx = gsap.quickTo(card, 'rotationX', { duration: 0.8, ease: 'power3' });
    const ry = gsap.quickTo(card, 'rotationY', { duration: 0.8, ease: 'power3' });
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      ry(((e.clientX - r.left) / r.width - 0.5) * 12);
      rx(-((e.clientY - r.top) / r.height - 0.5) * 10);
    });
    card.addEventListener('pointerleave', () => {
      rx(0);
      ry(0);
    });
  });
}

/* ------------------------------------------------------------------ */
/* Creed slider                                                        */
/* ------------------------------------------------------------------ */

function creedSlider() {
  const slides = $$('.creed__slide');
  const idxEl = $('[data-creed-index]');
  let cur = 0;
  let timer = null;
  let busy = false;
  const go = (next) => {
    if (busy || next === cur) return;
    busy = true;
    const a = slides[cur];
    const b = slides[next];
    gsap
      .timeline({ onComplete: () => (busy = false) })
      .to(a.children, { opacity: 0, y: -30, filter: 'blur(10px)', stagger: 0.06, duration: 0.6, ease: 'power2.in' })
      .add(() => {
        a.classList.remove('is-active');
        b.classList.add('is-active');
        idxEl.textContent = next + 1;
      })
      .fromTo(b.children, { opacity: 0, y: 30, filter: 'blur(10px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', stagger: 0.1, duration: 1.1, ease: 'expo.out' });
    cur = next;
  };
  const auto = () => {
    clearInterval(timer);
    timer = setInterval(() => go((cur + 1) % slides.length), 6000);
  };
  $('[data-creed="next"]').addEventListener('click', () => (go((cur + 1) % slides.length), auto()));
  $('[data-creed="prev"]').addEventListener('click', () => (go((cur - 1 + slides.length) % slides.length), auto()));
  ScrollTrigger.create({ trigger: '.creed', start: 'top 80%', end: 'bottom top', onToggle: (s) => (s.isActive ? auto() : clearInterval(timer)) });
}

/* ------------------------------------------------------------------ */
/* Finale sparks — gold embers rising over the fireworks               */
/* ------------------------------------------------------------------ */

function sparks() {
  const c = $('.finale__sparks');
  const g = c.getContext('2d');
  let w = 0;
  let h = 0;
  let on = false;
  const dpr = Math.min(devicePixelRatio, 2);
  const P = Array.from({ length: isSmall() ? 70 : 150 }, () => ({}));
  const reset = (p, init) => {
    p.x = Math.random() * w;
    p.y = init ? Math.random() * h : h + 10;
    p.r = 0.6 + Math.random() * 1.8;
    p.vy = 0.3 + Math.random() * 1.1;
    p.vx = (Math.random() - 0.5) * 0.3;
    p.life = Math.random() * Math.PI * 2;
  };
  const size = () => {
    w = c.clientWidth;
    h = c.clientHeight;
    c.width = w * dpr;
    c.height = h * dpr;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    P.forEach((p) => reset(p, true));
  };
  size();
  addEventListener('resize', size);
  ScrollTrigger.create({ trigger: '.finale', start: 'top bottom', end: 'bottom top', onToggle: (s) => (on = s.isActive) });
  gsap.ticker.add(() => {
    if (!on) return;
    g.clearRect(0, 0, w, h);
    g.globalCompositeOperation = 'lighter';
    for (const p of P) {
      p.y -= p.vy;
      p.x += p.vx + Math.sin(p.life) * 0.2;
      p.life += 0.03;
      if (p.y < -10) reset(p);
      const a = 0.35 + Math.sin(p.life * 3) * 0.3;
      const grd = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 4);
      grd.addColorStop(0, `rgba(255,226,160,${a})`);
      grd.addColorStop(1, 'rgba(201,164,92,0)');
      g.fillStyle = grd;
      g.beginPath();
      g.arc(p.x, p.y, p.r * 4, 0, Math.PI * 2);
      g.fill();
    }
  });
}

/* ------------------------------------------------------------------ */
/* Menu                                                                */
/* ------------------------------------------------------------------ */

const menu = $('.menu');
const menuBtn = $('.header__menu');
let menuOpen = false;
const setMenu = (open) => {
  menuOpen = open;
  document.body.classList.toggle('menu-open', open);
  menuBtn.setAttribute('aria-expanded', open);
  menu.setAttribute('aria-hidden', !open);
  $('.header__menu-label').textContent = open ? 'Close' : 'Menu';
  const r = menuBtn.getBoundingClientRect();
  const at = `${r.left + 11}px ${r.top + r.height / 2}px`;
  if (open) {
    lenis?.stop();
    gsap.set(menu, { visibility: 'visible' });
    gsap.fromTo(menu, { clipPath: `circle(0% at ${at})` }, { clipPath: `circle(150% at ${at})`, duration: 1.1, ease: 'expo.inOut' });
    gsap.fromTo('.menu__list li', { opacity: 0, y: 40 }, { opacity: 1, y: 0, stagger: 0.05, duration: 1, ease: 'expo.out', delay: 0.35 });
  } else {
    lenis?.start();
    gsap.to(menu, { clipPath: `circle(0% at ${at})`, duration: 0.8, ease: 'expo.inOut', onComplete: () => gsap.set(menu, { visibility: 'hidden' }) });
  }
};
menuBtn.addEventListener('click', () => setMenu(!menuOpen));
addEventListener('keydown', (e) => e.key === 'Escape' && menuOpen && setMenu(false));
$$('.menu__list a').forEach((a) =>
  a.addEventListener('pointerenter', () => {
    const img = $('.menu__preview img');
    if (img.getAttribute('src') === a.dataset.img) return;
    gsap.to(img, {
      opacity: 0,
      duration: 0.2,
      onComplete: () => {
        img.src = a.dataset.img;
        gsap.fromTo(img, { opacity: 0, scale: 1.08 }, { opacity: 1, scale: 1, duration: 0.8, ease: 'expo.out' });
      },
    });
  })
);

document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a) return;
  const id = a.getAttribute('href');
  if (id.length < 2 || !$(id)) return;
  e.preventDefault();
  if (menuOpen) {
    setMenu(false);
    setTimeout(() => scrollTo(id), 350);
  } else scrollTo(id);
});

/* ------------------------------------------------------------------ */
/* Cursor, mouse → serpent, scroll velocity → rattle                   */
/* ------------------------------------------------------------------ */

const cursor = $('.cursor');
const cursorLabel = $('.cursor__label');
if (finePointer) {
  const cx = gsap.quickTo(cursor, 'x', { duration: 0.35, ease: 'power3' });
  const cy = gsap.quickTo(cursor, 'y', { duration: 0.35, ease: 'power3' });
  addEventListener('pointermove', (e) => {
    cursor.style.opacity = 1;
    cx(e.clientX);
    cy(e.clientY);
    const t = e.target.closest?.('a, button, [data-cursor], input, select, textarea, label');
    const drag = t?.dataset?.cursor === 'drag';
    cursor.classList.toggle('is-drag', drag);
    cursor.classList.toggle('is-link', !!t && !drag);
    cursorLabel.textContent = drag ? 'Drag' : '';
  });
}
addEventListener('pointermove', (e) => {
  serpent?.setMouse((e.clientX / innerWidth) * 2 - 1, -((e.clientY / innerHeight) * 2 - 1));
});
lenis?.on('scroll', (e) => {
  if (Math.abs(e.velocity) > 38) serpent?.shake(0.9);
});

let rt;
addEventListener('resize', () => {
  clearTimeout(rt);
  rt = setTimeout(() => serpent?.resize(), 120);
});

/* ------------------------------------------------------------------ */
/* Rush form (front-end only — wire to a form service to receive entries) */
/* ------------------------------------------------------------------ */

const form = $('.rush__form');
form.addEventListener('submit', (e) => {
  e.preventDefault();
  let ok = true;
  $$('[required]', form).forEach((f) => {
    const valid = f.checkValidity() && f.value.trim() !== '';
    f.closest('.field').classList.toggle('is-invalid', !valid);
    ok &&= valid;
  });
  if (!ok) return;
  gsap.to($$('.field, .field-row, .button', form), {
    opacity: 0,
    y: -10,
    stagger: 0.04,
    duration: 0.4,
    onComplete: () => {
      $$('.field, .field-row, .button', form).forEach((el) => (el.style.display = 'none'));
      const t = $('.rush__thanks', form);
      t.hidden = false;
      gsap.from(t, { opacity: 0, y: 20, duration: 1, ease: 'expo.out' });
    },
  });
});

/* ------------------------------------------------------------------ */
/* Photo credits                                                       */
/* ------------------------------------------------------------------ */

const dialog = $('.credits');
$('[data-credits]').addEventListener('click', async () => {
  const list = $('.credits__list');
  if (!list.children.length) {
    const credits = await fetch('credits.json').then((r) => r.json());
    list.innerHTML = credits
      .map((c) => {
        const who = c.creator ? ` — ${c.creator}` : '';
        return `<li><a href="${c.source}" target="_blank" rel="noopener">${c.title}</a>${who} <i>(${c.license})</i></li>`;
      })
      .join('');
  }
  dialog.showModal();
  lenis?.stop();
});
$('[data-credits-close]').addEventListener('click', () => dialog.close());
dialog.addEventListener('close', () => lenis?.start());
