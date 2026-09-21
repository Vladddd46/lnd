/**
 * Config — змінюйте лише ці значення
 */
const TELEGRAM_BOT_URL = 'https://t.me/procervabot';
const META_PIXEL_ID = '1752873129327418';
const LEAD_API_URL = 'https://procerva.duckdns.org/web-lead';

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
    window.fbq('track', 'Contact');
  } catch (err) {
    // Pixel не повинен ламати UX
  }
}

function trackLeadEvent() {
  if (typeof window.fbq !== 'function') return;
  try {
    window.fbq('track', 'Lead');
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

const MIN_PHONE_DIGITS = 8;
const MAX_PHONE_DIGITS = 15;
const PHONE_ERROR_TEXT = 'Введіть, будь ласка, коректний номер телефону.';
const PHONE_SUBMIT_ERROR_TEXT = 'Не вдалося надіслати номер. Спробуйте ще раз.';
const PHONE_SUBMIT_IDLE_TEXT = 'Залишити номер';
const PHONE_SUBMIT_LOADING_TEXT = 'Надсилаємо...';

function normalizePhone(raw) {
  const value = String(raw || '').trim();
  const digits = value.replace(/\D/g, '');
  if (value.startsWith('+')) return `+${digits}`;
  return digits;
}

function isValidPhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  return digits.length >= MIN_PHONE_DIGITS && digits.length <= MAX_PHONE_DIGITS;
}

async function submitPhoneLead(phone) {
  const response = await fetch(LEAD_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      phone: phone,
      source: 'website',
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to submit lead');
  }

  return await response.json();
}

function setLeadFormError(input, errorEl, message) {
  if (!errorEl) return;
  errorEl.hidden = !message;
  errorEl.textContent = message || '';

  if (!message) {
    input?.classList.remove('is-invalid');
    input?.removeAttribute('aria-invalid');
    return;
  }

  const isValidationError = message === PHONE_ERROR_TEXT;
  input?.classList.toggle('is-invalid', isValidationError);
  if (isValidationError) input?.setAttribute('aria-invalid', 'true');
  else input?.removeAttribute('aria-invalid');
}

function initPhoneLeadForm() {
  const form = document.getElementById('phone-lead-form');
  const input = document.getElementById('lead-phone');
  const submit = document.getElementById('lead-phone-submit');
  const errorEl = document.getElementById('lead-phone-error');
  const successEl = document.getElementById('lead-phone-success');
  if (!form || !input || !submit || !errorEl || !successEl) return;

  input.addEventListener('input', () => {
    if (errorEl.hidden) return;
    if (isValidPhone(input.value)) setLeadFormError(input, errorEl, '');
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const phone = input.value.trim();
    if (!phone || !isValidPhone(phone)) {
      setLeadFormError(input, errorEl, PHONE_ERROR_TEXT);
      input.focus();
      return;
    }

    setLeadFormError(input, errorEl, '');
    submit.disabled = true;
    submit.textContent = PHONE_SUBMIT_LOADING_TEXT;

    try {
      await submitPhoneLead(normalizePhone(phone));
      trackLeadEvent();
      form.hidden = true;
      successEl.hidden = false;
    } catch (err) {
      submit.disabled = false;
      submit.textContent = PHONE_SUBMIT_IDLE_TEXT;
      setLeadFormError(input, errorEl, PHONE_SUBMIT_ERROR_TEXT);
    }
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
  initPhoneLeadForm();
  initMobileMenu();
  initHeaderScroll();
  initAccordion();
  initRevealAnimations();
  initSmoothAnchors();
  setFooterYear();
});
