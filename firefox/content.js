(() => {
  'use strict';


  let settings = { cookieSkipEnabled: true, readTimeEnabled: true };
  let cookieObserver = null;
  let cookieInterval = null;
  let sweepQueued = false;

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
    } catch (e) {}
  }


  const VENDOR_RULES = [
    { reject: '#bbccookies button[id*="reject" i], #bbccookies [data-testid*="reject" i], #bbccookies [aria-label*="reject" i], #bbccookies [title="I do not agree" i], #bbccookies [aria-label="I do not agree" i]', container: '#bbccookies' },
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


  const REJECT_PHRASES = [
    'reject all', 'reject', 'decline all', 'decline', 'disagree', 'deny',
    'necessary only', 'only necessary', 'no thanks', 'do not accept', 'i do not agree',
    'use necessary cookies only', 'continue without accepting',
    'rifiuta tutto', 'rifiuta tutti', 'rifiuta', 'nega', 'solo necessari',
    'solo essenziali', 'no grazie', 'continua senza accettare', 'rifiuta i cookie',
    'rejeter tout', 'rejeter', 'refuser tout', 'refuser', 'uniquement nécessaire',
    'uniquement nécessaires', 'non merci', 'continuer sans accepter',
    'alle ablehnen', 'ablehnen', 'nur notwendige', 'nur erforderliche', 'nein danke',
    'rechazar todo', 'rechazar todas', 'rechazar', 'solo necesarias',
    'solo necesario', 'no gracias', 'continuar sin aceptar',
    'rejeitar tudo', 'rejeitar', 'recusar tudo', 'recusar',
    'apenas necessários', 'não obrigado', 'continuar sem aceitar',
    'alles weigeren', 'weigeren', 'alleen noodzakelijke', 'nee bedankt',
    'doorgaan zonder te accepteren',
    'odrzuć wszystkie', 'odrzuć', 'tylko niezbędne', 'nie dziękuję',
    'avvisa alla', 'avvisa', 'endast nödvändiga', 'nej tack',
    'afvis alle', 'afvis', 'kun nødvendige', 'nej tak',
    'avvis alle', 'avvis', 'nei takk'
  ];

  const ACCEPT_PHRASES = [
    'accept all', 'accept', 'i agree', 'agree', 'allow all', 'got it',
    'ok', 'okay', 'yes, i accept', 'yes i accept', 'allow cookies',
    'accetta tutto', 'accetta tutti', 'accetta', 'consenti tutti',
    'ho capito', 'va bene',
    "accepter tout", "j'accepte", 'accepter', "autoriser tout", "d'accord",
    'alle akzeptieren', 'akzeptieren', 'ich stimme zu', 'zustimmen', 'verstanden',
    'aceptar todo', 'aceptar todas', 'aceptar', 'de acuerdo', 'entendido',
    'aceitar tudo', 'aceitar', 'concordo', 'entendi',
    'alles accepteren', 'accepteren', 'akkoord', 'begrepen',
    'zaakceptuj wszystkie', 'akceptuj', 'zgadzam się', 'rozumiem',
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
    'consenso', 'informativa', 'questo sito (utilizza|usa)',
    'confidentialit\u00e9', 'ce site (utilise|web)',
    'datenschutz', 'diese website verwendet',
    'privacidad', 'este sitio (usa|utiliza)',
    'privacidade',
    'wij gebruiken cookies', 'beleid inzake cookies',
    'we value your privacy', 'this (site|website) uses'
  ].join('|'), 'i');

  let handledCount = 0;
  const handledElements = new WeakSet();

  function textOf(el) {
    return (el.innerText || el.textContent || '').trim();
  }


  function getControlText(el) {
    const raw = [
      el.innerText,
      el.textContent,
      el.getAttribute('aria-label'),
      el.getAttribute('title'),
      el.getAttribute('name'),
      el.id,
      el.className,
      el.value
    ].filter(Boolean).join(' ');
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

    const sampleText = normalizeText((document.body ? document.body.innerText : '').slice(0, 4000));
    return COOKIE_KEYWORDS.test(sampleText) || COOKIE_KEYWORDS.test(normalizeText(document.title));
  }

  function tryGenericRejectAnywhere(root = document) {

    if (!pageLooksLikeConsentContext()) return false;

    const candidates = root.querySelectorAll(
      'button, a[role="button"], [type="button"], div[role="button"], span[role="button"], [id*="cookie" i], [class*="cookie" i], [aria-label*="cookie" i]'
    );
    for (const el of candidates) {
      if (handledElements.has(el)) continue;
      if (!isVisible(el)) continue;
      const t = getControlText(el);
      if (!t || t.length > 60) continue;
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
      if (text.length > 4000 || text.length < 10) continue; 
      if (!COOKIE_KEYWORDS.test(text)) continue;

      const buttons = el.querySelectorAll('button, a[role="button"], [type="button"], div[role="button"], [id*="cookie" i], [class*="cookie" i], [aria-label*="cookie" i]');
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
   
      if (acceptBtn || true) {
        removeElement(el, 'generic-hide');
        return true;
      }
    }
    return false;
  }

  function tryBbcBanner(root = document) {
    const banner = root.querySelector('#bbccookies, [id*="bbc" i][id*="cookie" i]');
    if (!banner || !isVisible(banner)) return false;
    const reject = banner.querySelector('button[id*="reject" i], [data-testid*="reject" i], [aria-label*="reject" i]');
    if (reject && isVisible(reject)) reject.click();
    setTimeout(() => removeElement(banner, 'bbc'), 150);
    return true;
  }

  function sweepForBanners() {
    if (!settings.cookieSkipEnabled) return;
    const found = tryBbcBanner() || tryVendorRules() || tryGenericRejectAnywhere() || findGenericBanner();
    return found;
  }

  function queueBannerSweep() {
    if (sweepQueued) return;
    sweepQueued = true;
    requestAnimationFrame(() => {
      sweepQueued = false;
      sweepForBanners();
    });
  }

  function startCookieSweeper() {
    if (!settings.cookieSkipEnabled || cookieObserver) return;
    sweepForBanners();

    cookieObserver = new MutationObserver(queueBannerSweep);
    cookieObserver.observe(document.documentElement, { childList: true, subtree: true });

  
    let ticks = 0;
    cookieInterval = setInterval(() => {
      ticks += 1;
      sweepForBanners();
      if (ticks > 20) { 
        clearInterval(cookieInterval);
        cookieInterval = null;
        cookieObserver.disconnect();
        cookieObserver = null;
      }
    }, 500);
  }

  function stopCookieSweeper() {
    if (cookieInterval) clearInterval(cookieInterval);
    if (cookieObserver) cookieObserver.disconnect();
    cookieInterval = null;
    cookieObserver = null;
  }



  const WPM = 200;

  function estimateReadTime() {

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

  let badgeShownForUrl = null;

  function injectReadTimeBadge(force = false) {
    if (!settings.readTimeEnabled && !force) return;
    if (!force && badgeShownForUrl === location.href) return;
    if (document.getElementById('cookiecuttr-readtime-badge')) {
      if (!force) return;
      removeExistingBadge();
    }

    const { words, minutes } = estimateReadTime();
    if (words < 150 && !force) return;
    const alreadyCounted = badgeShownForUrl === location.href;
    badgeShownForUrl = location.href;

    const badge = document.createElement('div');
    badge.id = 'cookiecuttr-readtime-badge';
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
 
      if (badge.parentNode) badge.parentNode.removeChild(badge);
    };

    const closeBtn = badge.querySelector('.fr-close');

    closeBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); removeBadge(); });
    closeBtn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); removeBadge(); });

    requestAnimationFrame(() => badge.classList.add('fr-visible'));
    setTimeout(removeBadge, AUTO_CLOSE_MS);

    if (!alreadyCounted) sendStat('READ_BADGE_SHOWN');
  }

  function removeExistingBadge() {
    const existing = document.getElementById('cookiecuttr-readtime-badge');
    if (existing) existing.remove();
  }

  function watchForPageChanges() {
    let lastUrl = location.href;

    const onNavigate = () => {
      if (location.href === lastUrl) return;
      lastUrl = location.href;
      badgeShownForUrl = null;
      removeExistingBadge(); 
      setTimeout(injectReadTimeBadge, 500); 
    };

    
    const wrap = (fn) => function (...args) {
      const result = fn.apply(this, args);
      onNavigate();
      return result;
    };
    history.pushState = wrap(history.pushState);
    history.replaceState = wrap(history.replaceState);
    window.addEventListener('popstate', onNavigate);

    
    setInterval(onNavigate, 1000);
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.cookieSkipEnabled) {
      settings.cookieSkipEnabled = changes.cookieSkipEnabled.newValue !== false;
      if (settings.cookieSkipEnabled) startCookieSweeper();
      else stopCookieSweeper();
    }
    if (changes.readTimeEnabled) {
      settings.readTimeEnabled = changes.readTimeEnabled.newValue !== false;
      if (!settings.readTimeEnabled) removeExistingBadge();
      else injectReadTimeBadge();
    }
  });

  let readingMarkerClickHandler = null;

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message && message.type === 'ARM_READING_MARKER') {
      if (readingMarkerClickHandler) document.removeEventListener('click', readingMarkerClickHandler, true);
      const onClick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        document.removeEventListener('click', onClick, true);
        readingMarkerClickHandler = null;
        document.documentElement.style.cursor = '';
        chrome.runtime.sendMessage({
          type: 'SAVE_READING_MARKER',
          marker: {
            slot: Number(message.slot) || 0,
            url: location.href,
            x: window.scrollX,
            y: window.scrollY,
            timestampEnabled: Boolean(message.timestampEnabled),
            timestamp: typeof message.timestamp === 'string' ? message.timestamp.slice(0, 12) : ''
          }
        });
      };
      readingMarkerClickHandler = onClick;
      document.addEventListener('click', onClick, true);
      document.documentElement.style.cursor = 'crosshair';
      sendResponse({ armed: true });
    } else if (message && message.type === 'RETURN_TO_READING_MARKER') {
      if (message.marker?.url === location.href) window.scrollTo(message.marker.x || 0, message.marker.y || 0);
    } else if (message && message.type === 'FORCE_READ_BADGE') {
      injectReadTimeBadge(true);
      sendResponse({ shown: Boolean(document.getElementById('cookiecuttr-readtime-badge')) });
    }
  });

 
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
