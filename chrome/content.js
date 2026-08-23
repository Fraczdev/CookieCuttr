(() => {
  'use strict';

  // ---------- Settings (loaded async, default to enabled) ----------
  let settings = { cookieSkipEnabled: true, readTimeEnabled: true };

  const settingsReady = new Promise((resolve) => {
    try {
      chrome.storage.local.get(['cookieSkipEnabled', 'readTimeEnabled'], (res) => {
        if (res.cookieSkipEnabled !== undefined) settings.cookieSkipEnabled = res.cookieSkipEnabled;
        if (res.readTimeEnabled !== undefined) settings.readTimeEnabled = res.readTimeEnabled;
        resolve();
      });
    } catch (e) {
      resolve();
    }
  });

  function sendStat(type) {
    try {
      chrome.runtime.sendMessage({ type, url: location.hostname });
    } catch (e) {  }
  }


  const VENDOR_RULES = [
    { reject: '#onetrust-reject-all-handler', container: '#onetrust-banner-sdk, #onetrust-consent-sdk' },
    { reject: '.ot-pc-refuse-all-handler', container: '#onetrust-pc-sdk' },
    { reject: '#CybotCookiebotDialogBodyLevelButtonLevelOptinDeclineAll, #CybotCookiebotDialogBodyButtonDecline', container: '#CybotCookiebotDialog' },
    { reject: '.qc-cmp2-summary-buttons button[mode="secondary"]', container: '.qc-cmp2-container' },
    { reject: '.sp_choice_type_12, .message-component.sp_choice_type_13', container: '.message-container' },
    { reject: '#didomi-notice-disagree-button', container: '#didomi-host, #didomi-popup' },
    { reject: '.osano-cm-denyAll, .osano-cm-button--type_denyAll', container: '.osano-cm-window' },
    { reject: '.termly-styles-decline-button, [data-tid="banner-decline"]', container: '#termly-code-snippet-support' },
    { reject: '.cky-btn-reject', container: '.cky-consent-container' },
    { reject: '.cmplz-deny, .cmplz-btn.cmplz-deny', container: '#cmplz-cookiebanner-container' },
    { reject: '#cookie_action_close_header.cli_action_button[data-cli_action="reject"], .wt-cli-reject-btn', container: '#cookie-law-info-bar' },
    { reject: '._brlbs-btn.\\!bg-none, [data-borlabs-cookie-consent-decline]', container: '#BorlabsCookieBox' }
  ];

  // Multi-language phrase lists for the generic (non-vendor) fallback.
  // Buttons are matched on their full trimmed text, case-insensitively.
  const REJECT_PHRASES = [
    // English
    'reject all', 'reject', 'decline all', 'decline', 'disagree', 'deny',
    'necessary only', 'only necessary', 'no thanks', 'do not accept',
    'use necessary cookies only', 'continue without accepting',
    // Italian
    'rifiuta tutto', 'rifiuta tutti', 'rifiuta', 'nega', 'solo necessari',
    'solo essenziali', 'no grazie', 'continua senza accettare', 'rifiuta i cookie',
    // French
    'rejeter tout', 'rejeter', 'refuser tout', 'refuser', 'uniquement nécessaire',
    'uniquement nécessaires', 'non merci', 'continuer sans accepter',
    // German
    'alle ablehnen', 'ablehnen', 'nur notwendige', 'nur erforderliche', 'nein danke',
    // Spanish
    'rechazar todo', 'rechazar todas', 'rechazar', 'solo necesarias',
    'solo necesario', 'no gracias', 'continuar sin aceptar',
    // Portuguese
    'rejeitar tudo', 'rejeitar', 'recusar tudo', 'recusar',
    'apenas necessários', 'não obrigado', 'continuar sem aceitar',
    // Dutch
    'alles weigeren', 'weigeren', 'alleen noodzakelijke', 'nee bedankt',
    'doorgaan zonder te accepteren',
    // Polish
    'odrzuć wszystkie', 'odrzuć', 'tylko niezbędne', 'nie dziękuję',
    // Swedish / Danish / Norwegian
    'avvisa alla', 'avvisa', 'endast nödvändiga', 'nej tack',
    'afvis alle', 'afvis', 'kun nødvendige', 'nej tak',
    'avvis alle', 'avvis', 'nei takk'
  ];

  const ACCEPT_PHRASES = [
    // English
    'accept all', 'accept', 'i agree', 'agree', 'allow all', 'got it',
    'ok', 'okay', 'yes, i accept', 'yes i accept', 'allow cookies',
    // Italian
    'accetta tutto', 'accetta tutti', 'accetta', 'consenti tutti',
    'ho capito', 'va bene',
    // French
    "accepter tout", "j'accepte", 'accepter', "autoriser tout", "d'accord",
    // German
    'alle akzeptieren', 'akzeptieren', 'ich stimme zu', 'zustimmen', 'verstanden',
    // Spanish
    'aceptar todo', 'aceptar todas', 'aceptar', 'de acuerdo', 'entendido',
    // Portuguese
    'aceitar tudo', 'aceitar', 'concordo', 'entendi',
    // Dutch
    'alles accepteren', 'accepteren', 'akkoord', 'begrepen',
    // Polish
    'zaakceptuj wszystkie', 'akceptuj', 'zgadzam się', 'rozumiem',
    // Swedish / Danish / Norwegian
    'acceptera alla', 'acceptera', 'jag godkänner',
    'accepter alle', 'jeg accepterer',
    'godta alle', 'godta', 'jeg godtar'
  ];

  function normalizeText(t) {
    return (t || '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // Contains-based matching (not exact match): a button like "Reject all
  // non-essential cookies" or one with extra icon/whitespace inside still
  // matches, as long as one of these phrases appears anywhere in its text.
  // Word-boundaries matter here: without them, short phrases like "ok"
  // would false-positive inside unrelated words (e.g. "c-ok-ies").
  function buildBoundaryMatchers(phrases) {
    return phrases.map((p) => new RegExp(`\\b${escapeRegex(p)}\\b`, 'i'));
  }

  const REJECT_MATCHERS = buildBoundaryMatchers(REJECT_PHRASES);
  const ACCEPT_MATCHERS = buildBoundaryMatchers(ACCEPT_PHRASES);

  function isRejectText(t) {
    return REJECT_MATCHERS.some((re) => re.test(t));
  }

  function isAcceptText(t) {
    return ACCEPT_MATCHERS.some((re) => re.test(t));
  }

  const COOKIE_KEYWORDS = new RegExp([
    'cookie', 'cookies', 'consent', 'gdpr', 'rgpd', 'privacy',
    // Italian
    'consenso', 'informativa', 'questo sito (utilizza|usa)',
    // French
    'confidentialit\u00e9', 'ce site (utilise|web)',
    // German
    'datenschutz', 'diese website verwendet',
    // Spanish
    'privacidad', 'este sitio (usa|utiliza)',
    // Portuguese
    'privacidade',
    // Dutch
    'wij gebruiken cookies', 'beleid inzake cookies',
    // generic English phrasing
    'we value your privacy', 'this (site|website) uses'
  ].join('|'), 'i');

  let handledCount = 0;
  const handledElements = new WeakSet();

  function textOf(el) {
    return (el.innerText || el.textContent || '').trim();
  }

  // Buttons sometimes carry their label as an aria-label/value instead of
  // (or in addition to) visible text — e.g. icon-only buttons on Google
  // properties. Check all of them.
  function getControlText(el) {
    const raw = el.innerText || el.textContent || el.getAttribute('aria-label') || el.value || '';
    return normalizeText(raw);
  }

  function isVisible(el) {
    if (!el || !(el instanceof Element)) return false;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return false;
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
  }

  function restoreScroll() {
    // Many banners lock body scroll; undo common patterns.
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.classList.remove('no-scroll', 'overflow-hidden', 'modal-open');
  }

  function removeElement(el, label) {
    if (!el || handledElements.has(el)) return false;
    handledElements.add(el);
    el.remove();
    restoreScroll();
    handledCount += 1;
    sendStat('BANNER_BLOCKED');
    return true;
  }

  function tryVendorRules(root = document) {
    for (const rule of VENDOR_RULES) {
      const btn = root.querySelector(rule.reject);
      const container = rule.container ? root.querySelector(rule.container) : btn?.closest('div');
      if (btn && isVisible(btn)) {
        btn.click();
        // give it a tick then remove any leftover overlay
        setTimeout(() => {
          const leftover = rule.container ? root.querySelector(rule.container) : null;
          if (leftover) removeElement(leftover, 'vendor');
          else { handledCount += 1; sendStat('BANNER_BLOCKED'); }
          restoreScroll();
        }, 150);
        return true;
      }
    }
    return false;
  }

  function pageLooksLikeConsentContext() {
    // Gate for the broad, geometry-free search below: only go hunting for
    // any "reject"-labeled button on the page if the page actually mentions
    // cookies/consent/privacy somewhere near the top. Prevents accidentally
    // clicking an unrelated "Reject" button (e.g. on a form) on other pages.
    const sampleText = normalizeText((document.body ? document.body.innerText : '').slice(0, 4000));
    return COOKIE_KEYWORDS.test(sampleText) || COOKIE_KEYWORDS.test(normalizeText(document.title));
  }

  function tryGenericRejectAnywhere(root = document) {
    // Handles full-page consent screens (e.g. Google's consent.google.com,
    // YouTube's "Before you continue" screen) that don't look like a small
    // fixed/sticky banner and so are missed by the container-based check.
    if (!pageLooksLikeConsentContext()) return false;

    const candidates = root.querySelectorAll(
      'button, a[role="button"], [type="button"], div[role="button"], span[role="button"]'
    );
    for (const el of candidates) {
      if (handledElements.has(el)) continue;
      if (!isVisible(el)) continue;
      const t = getControlText(el);
      if (!t || t.length > 60) continue; // real button labels are short; skip stray text blocks
      if (isRejectText(t)) {
        handledElements.add(el);
        el.click();
        handledCount += 1;
        sendStat('BANNER_BLOCKED');
        setTimeout(restoreScroll, 150);
        return true;
      }
    }
    return false;
  }

  function findGenericBanner(root = document) {
    // Look at fixed/sticky, high z-index, viewport-anchored elements that
    // mention cookies/consent and contain an accept-or-reject button.
    const candidates = root.querySelectorAll('div, section, aside, [role="dialog"], [role="alertdialog"]');
    for (const el of candidates) {
      if (handledElements.has(el)) continue;
      if (!isVisible(el)) continue;
      const style = window.getComputedStyle(el);
      const isOverlayish = style.position === 'fixed' || style.position === 'sticky';
      if (!isOverlayish) continue;

      const rect = el.getBoundingClientRect();
      const nearEdge = rect.top < 40 || (window.innerHeight - rect.bottom) < 120;
      if (!nearEdge) continue;

      const text = normalizeText(textOf(el));
      if (text.length > 4000 || text.length < 10) continue; // too big = whole page; too small = noise
      if (!COOKIE_KEYWORDS.test(text)) continue;

      const buttons = el.querySelectorAll('button, a[role="button"], [type="button"], div[role="button"]');
      if (buttons.length === 0) continue;

      let rejectBtn = null;
      let acceptBtn = null;
      for (const b of buttons) {
        const t = getControlText(b);
        if (!t) continue;
        if (isRejectText(t)) rejectBtn = rejectBtn || b;
        else if (isAcceptText(t)) acceptBtn = acceptBtn || b;
      }

      if (rejectBtn) {
        rejectBtn.click();
        setTimeout(() => removeElement(el, 'generic-reject'), 150);
        return true;
      }
      // No explicit reject control found — don't consent on the user's
      // behalf by clicking accept. Just remove the nag and unlock scroll.
      if (acceptBtn || true) {
        removeElement(el, 'generic-hide');
        return true;
      }
    }
    return false;
  }

  function sweepForBanners() {
    if (!settings.cookieSkipEnabled) return;
    const found = tryVendorRules() || tryGenericRejectAnywhere() || findGenericBanner();
    return found;
  }

  function startCookieSweeper() {
    if (!settings.cookieSkipEnabled) return;
    sweepForBanners();

    const observer = new MutationObserver(() => sweepForBanners());
    observer.observe(document.documentElement, { childList: true, subtree: true });

    // Banners often arrive after async scripts; keep checking briefly, then stop.
    let ticks = 0;
    const interval = setInterval(() => {
      ticks += 1;
      sweepForBanners();
      if (ticks > 20) { // ~10s
        clearInterval(interval);
        observer.disconnect();
      }
    }, 500);
  }

  // =========================================================
  // FEATURE 2: Reading-time badge
  // =========================================================

  const WPM = 200;

  function estimateReadTime() {
    // Prefer <article>, else the largest text-dense block, else body.
    let source = document.querySelector('article');
    if (!source) {
      let best = null;
      let bestLen = 0;
      document.querySelectorAll('main, [role="main"], #content, .content, .post, .entry-content').forEach((el) => {
        const len = textOf(el).length;
        if (len > bestLen) { bestLen = len; best = el; }
      });
      source = best || document.body;
    }
    const text = textOf(source);
    const words = (text.match(/\S+/g) || []).length;
    return { words, minutes: Math.max(1, Math.round(words / WPM)) };
  }

  function injectReadTimeBadge() {
    if (!settings.readTimeEnabled) return;
    if (document.getElementById('frictionless-readtime-badge')) return;

    const { words, minutes } = estimateReadTime();
    if (words < 150) return; // not really an "article" page, skip noise

    const badge = document.createElement('div');
    badge.id = 'frictionless-readtime-badge';
    badge.innerHTML = `
      <span class="fr-clock">⏱</span>
      <span class="fr-text">${minutes} min read · ${words.toLocaleString()} words</span>
      <button class="fr-close" type="button" aria-label="Dismiss">×</button>
    `;
    (document.body || document.documentElement).appendChild(badge);

    const AUTO_CLOSE_MS = 8000;
    let removed = false;

    const removeBadge = () => {
      if (removed) return;
      removed = true;
      badge.classList.remove('fr-visible');
      // Remove immediately AND after the fade-out, so it disappears even if
      // the CSS transition doesn't run for any reason (e.g. reduced-motion).
      if (badge.parentNode) badge.parentNode.removeChild(badge);
    };

    const closeBtn = badge.querySelector('.fr-close');
    // Bind on both click and pointerdown as a safety net: some sites leave
    // behind global click interceptors (from the very cookie banners we
    // remove) that can swallow bare 'click' events.
    closeBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); removeBadge(); });
    closeBtn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); removeBadge(); });

    requestAnimationFrame(() => badge.classList.add('fr-visible'));
    setTimeout(removeBadge, AUTO_CLOSE_MS);

    sendStat('READ_BADGE_SHOWN');
  }

  function removeExistingBadge() {
    const existing = document.getElementById('frictionless-readtime-badge');
    if (existing) existing.remove();
  }

  function watchForPageChanges() {
    let lastUrl = location.href;

    const onNavigate = () => {
      if (location.href === lastUrl) return;
      lastUrl = location.href;
      removeExistingBadge(); // old page's estimate is stale — clear it right away
      setTimeout(injectReadTimeBadge, 500); // let the new view's content render, then re-estimate
    };

    // Full page loads already get a fresh content script (badge is gone
    // automatically). This covers single-page-app sites that swap content
    // via history.pushState/replaceState without a real navigation.
    const wrap = (fn) => function (...args) {
      const result = fn.apply(this, args);
      onNavigate();
      return result;
    };
    history.pushState = wrap(history.pushState);
    history.replaceState = wrap(history.replaceState);
    window.addEventListener('popstate', onNavigate);

    // Belt-and-suspenders for sites that change the URL via other means.
    setInterval(onNavigate, 1000);
  }

  // =========================================================
  // Boot
  // =========================================================

  settingsReady.then(() => {
    startCookieSweeper();
    watchForPageChanges();

    const onReady = () => injectReadTimeBadge();
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      setTimeout(onReady, 300);
    } else {
      document.addEventListener('DOMContentLoaded', () => setTimeout(onReady, 300));
    }
  });
})();
