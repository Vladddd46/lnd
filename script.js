/**
 * Config — змінюйте лише ці значення
 */
const TELEGRAM_BOT_URL = 'https://t.me/procervabot';
const META_PIXEL_ID = '1752873129327418';

/**
 * UTM state
 */
const utmState = {
  source: '',
  medium: '',
  campaign: '',
  content: '',
  term: '',
};

function readUtmParams() {
  const params = new URLSearchParams(window.location.search);
  utmState.source = params.get('utm_source') || '';
  utmState.medium = params.get('utm_medium') || '';
  utmState.campaign = params.get('utm_campaign') || '';
  utmState.content = params.get('utm_content') || '';
  utmState.term = params.get('utm_term') || '';
}

/**
 * Telegram start payload: лише A-Za-z0-9_ , max 64 chars
 * Приклад: meta_campaign1_ad2
 * Без UTM: landing
 */
function sanitizeStartPart(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

function shortenPart(value, maxLen) {
  const clean = sanitizeStartPart(value);
  if (!clean) return '';
  return clean.slice(0, maxLen);
}

function buildStartParam() {
  const source = shortenPart(utmState.source, 12);
  const campaign = shortenPart(utmState.campaign, 20);
  const content = shortenPart(utmState.content, 16);

  const parts = [source, campaign, content].filter(Boolean);
  if (!parts.length) return 'landing';

  let start = parts.join('_');
  if (start.length > 64) start = start.slice(0, 64).replace(/_+$/g, '');
  return start || 'landing';
}

function buildTelegramDeepLink() {
  const base = TELEGRAM_BOT_URL.replace(/\/+$/, '');
  const start = buildStartParam();
  return `${base}?start=${encodeURIComponent(start)}`;
}

/**
 * Meta Pixel
 */
function initMetaPixel() {
  const pixelId = String(META_PIXEL_ID || '').trim();
  if (!pixelId) return;

  /* eslint-disable */
  !(function (f, b, e, v, n, t, s) {
    if (f.fbq) return;
    n = f.fbq = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    };
    if (!f._fbq) f._fbq = n;
    n.push = n;
    n.loaded = !0;
    n.version = '2.0';
    n.queue = [];
    t = b.createElement(e);
    t.async = !0;
    t.src = v;
    s = b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t, s);
  })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
  /* eslint-enable */

  window.fbq('init', pixelId);
  window.fbq('track', 'PageView');
}

function trackTelegramCtaClick() {
  if (typeof window.fbq !== 'function') return;
  try {
    // Contact — клік CTA → Telegram.
    // Lead відправляється вже в боті після реальної заявки.
    window.fbq('track', 'Contact');
  } catch (err) {
    // Pixel не повинен ламати UX
  }
}

function handleTelegramCtaClick(event) {
  event.preventDefault();

  const link = buildTelegramDeepLink();
  const start = buildStartParam();

  console.log('[CTA debug]', {
    start,
    source: utmState.source || null,
    campaign: utmState.campaign || null,
    content: utmState.content || null,
    medium: utmState.medium || null,
    term: utmState.term || null,
    deepLink: link,
    cta: event.currentTarget.getAttribute('data-cta') || 'unknown',
  });

  trackTelegramCtaClick();
  window.open(link, '_blank', 'noopener,noreferrer');
}

function bindTelegramCtas() {
  const deepLink = buildTelegramDeepLink();
  document.querySelectorAll('.js-telegram-cta').forEach((el) => {
    el.setAttribute('href', deepLink);
    el.addEventListener('click', handleTelegramCtaClick);
  });
}

/**
 * Mobile menu
 */
function initMobileMenu() {
  const toggle = document.getElementById('menu-toggle');
  const nav = document.getElementById('site-nav');
  if (!toggle || !nav) return;

  const closeMenu = () => {
    nav.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Відкрити меню');
  };

  toggle.addEventListener('click', () => {
    const open = !nav.classList.contains('is-open');
    nav.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Закрити меню' : 'Відкрити меню');
  });

  nav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', closeMenu);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeMenu();
  });
}

/**
 * Sticky header state
 */
function initHeaderScroll() {
  const header = document.querySelector('.site-header');
  if (!header) return;

  const onScroll = () => {
    header.classList.toggle('is-scrolled', window.scrollY > 8);
  };

  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
}

/**
 * FAQ accordion
 */
function initAccordion() {
  const root = document.querySelector('[data-accordion]');
  if (!root) return;

  root.querySelectorAll('.accordion-item').forEach((item) => {
    const trigger = item.querySelector('.accordion-trigger');
    const panel = item.querySelector('.accordion-panel');
    if (!trigger || !panel) return;

    trigger.addEventListener('click', () => {
      const isOpen = trigger.getAttribute('aria-expanded') === 'true';

      root.querySelectorAll('.accordion-trigger').forEach((btn) => {
        btn.setAttribute('aria-expanded', 'false');
      });
      root.querySelectorAll('.accordion-panel').forEach((p) => {
        p.hidden = true;
      });

      if (!isOpen) {
        trigger.setAttribute('aria-expanded', 'true');
        panel.hidden = false;
      }
    });
  });
}

/**
 * Reveal on scroll
 */
function initRevealAnimations() {
  const nodes = document.querySelectorAll('.reveal');
  if (!nodes.length) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) {
    nodes.forEach((node) => node.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        obs.unobserve(entry.target);
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
  );

  nodes.forEach((node) => observer.observe(node));
}

/**
 * Smooth scroll for in-page anchors (fallback + offset awareness)
 */
function initSmoothAnchors() {
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', (event) => {
      const href = anchor.getAttribute('href');
      if (!href || href === '#' || anchor.classList.contains('js-telegram-cta')) return;

      const target = document.querySelector(href);
      if (!target) return;

      event.preventDefault();
      const header = document.querySelector('.site-header');
      const offset = header ? header.offsetHeight + 8 : 0;
      const top = target.getBoundingClientRect().top + window.scrollY - offset;

      window.scrollTo({
        top,
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      });
    });
  });
}

function setFooterYear() {
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());
}

document.addEventListener('DOMContentLoaded', () => {
  readUtmParams();
  initMetaPixel();
  bindTelegramCtas();
  initMobileMenu();
  initHeaderScroll();
  initAccordion();
  initRevealAnimations();
  initSmoothAnchors();
  setFooterYear();
});
