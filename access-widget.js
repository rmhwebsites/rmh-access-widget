/*!
 * RMH Access Widget v2.0.1
 * A self-contained accessibility layer for Webflow (or any) site:
 * user preference panel + automatic WCAG remediation engine.
 *
 * Install (Webflow): Project Settings -> Custom Code -> Footer Code:
 *   <script src="https://YOUR-CDN/access-widget.js" defer
 *           data-accent="#165b91"
 *           data-brand="#165b91"
 *           data-position="bottom-left"
 *           data-statement-url="/accessibility-statement"
 *           data-feedback-email="access@example.com"></script>
 *
 * Configuration (all optional):
 *   data-accent          UI color for active states and header (auto-darkened
 *                        until white text on it passes WCAG 4.5:1)
 *   data-brand           trigger button color (icon only needs 3:1)
 *   data-position        "bottom-left" (default) | "bottom-right"
 *   data-offset-x/y      pixel offsets from the corner (default 20)
 *   data-statement-url   link to your accessibility statement
 *   data-feedback-email  adds a "Report an issue" mailto link
 *   data-lang            widget UI language: "en" (default) | "es"
 *   data-page-lang       lang set on <html> when missing (default "en")
 *   data-storage-key     localStorage key for saved preferences
 *   data-fixes           "off" disables the auto-remediation engine
 *   data-skip-fixes      comma list of fixer ids to skip, e.g. "alt,viewport"
 *
 * Console API: window.RMHAccess -> { version, open(), close(), reset(),
 *   report(), state() }
 *
 * The remediation engine improves real WCAG 2.1/2.2 AA failures at runtime
 * (landmarks, zoom lock, focus visibility, unlabeled controls, live regions),
 * but no script can make a site fully conformant. Fix the source too.
 */
(function () {
  'use strict';

  if (window.RMHAccess && window.RMHAccess.loaded) return;

  var SCRIPT = document.currentScript;
  var DS = (SCRIPT && SCRIPT.dataset) || {};
  var HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

  /* ---------------- color utilities (WCAG contrast math) ---------------- */

  function expandHex(h) {
    return h.length === 4 ? '#' + h[1] + h[1] + h[2] + h[2] + h[3] + h[3] : h;
  }
  function luminance(hex) {
    var n = parseInt(hex.slice(1), 16);
    var f = function (v) {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f((n >> 16) & 255) + 0.7152 * f((n >> 8) & 255) + 0.0722 * f(n & 255);
  }
  function contrast(a, b) {
    var l1 = luminance(a), l2 = luminance(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  }
  function darken(hex, amt) {
    var n = parseInt(hex.slice(1), 16);
    var d = function (c) { return Math.max(0, Math.round(c * (1 - amt))); };
    return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255]
      .map(function (c) { return d(c).toString(16).padStart(2, '0'); }).join('');
  }

  /* ---------------------------- configuration --------------------------- */

  /* Defaults match cleaverdermatologyandaesthetics.com design tokens:      */
  /* --colors--dark-blue #165b91 (7.1:1 on white, passes AA unmodified).    */
  var CONFIG = {
    accent: HEX.test(DS.accent || '') ? expandHex(DS.accent) : '#165b91',
    brand: HEX.test(DS.brand || '') ? expandHex(DS.brand) : '#165b91',
    position: DS.position === 'bottom-right' ? 'bottom-right' : 'bottom-left',
    offsetX: parseInt(DS.offsetX, 10) || 20,
    offsetY: parseInt(DS.offsetY, 10) || 20,
    statementUrl: DS.statementUrl || '',
    feedbackEmail: DS.feedbackEmail || '',
    lang: DS.lang === 'es' ? 'es' : 'en',
    pageLang: DS.pageLang || 'en',
    storageKey: DS.storageKey || 'rmh-a11y-prefs-v2',
    fixesEnabled: DS.fixes !== 'off',
    skipFixes: (DS.skipFixes || '').split(',').map(function (s) { return s.trim(); })
  };

  /* Contrast guard: the accent carries white text in the UI, so darken it
     until white-on-accent passes WCAG AA for normal text (4.5:1). */
  var UI = CONFIG.accent;
  for (var g = 0; contrast(UI, '#ffffff') < 4.5 && g < 24; g++) UI = darken(UI, 0.07);

  /* ------------------------------- i18n --------------------------------- */

  var I18N = {
    en: {
      title: 'Accessibility options', close: 'Close accessibility options',
      openLabel: 'Accessibility options (Alt+A)',
      textSize: 'Text size', decrease: 'Decrease text size', increase: 'Increase text size',
      resetAll: 'Reset all', statement: 'Accessibility statement', feedback: 'Report an issue',
      structure: 'Page structure', structureTitle: 'Page structure', back: 'Back to options',
      headings: 'Headings', landmarks: 'Landmarks', noHeadings: 'No headings found on this page',
      menu: 'Menu', prevSlide: 'Previous slide', nextSlide: 'Next slide', slide: 'Slide',
      newTab: 'opens in new tab', embedded: 'Embedded content', viewImage: 'View image',
      enabled: 'enabled', disabled: 'disabled', resetDone: 'All accessibility settings reset',
      textSizeSet: 'Text size set to', profileOn: 'profile enabled', profileOff: 'profile disabled',
      secProfiles: 'Profiles', secText: 'Text', secColor: 'Color',
      secReading: 'Reading & navigation', secTools: 'Tools',
      profiles: {
        vision: 'Vision impaired', seizure: 'Seizure safe',
        adhd: 'ADHD friendly', cognitive: 'Dyslexia friendly'
      },
      toggles: {
        lh: 'Line height', ls: 'Letter spacing', font: 'Readable font',
        dyslexia: 'Dyslexia font', left: 'Left-align text', links: 'Highlight links',
        heads: 'Highlight headings', dark: 'Dark contrast', light: 'Light contrast',
        invert: 'Invert colors', gray: 'Grayscale', lowsat: 'Low saturation',
        hisat: 'High saturation', cursor: 'Big cursor', guide: 'Reading guide',
        mask: 'Reading mask', pause: 'Pause animations', noimg: 'Hide images',
        mute: 'Mute media', focus: 'Focus highlight', targets: 'Bigger targets',
        tts: 'Read aloud on click'
      }
    },
    es: {
      title: 'Opciones de accesibilidad', close: 'Cerrar opciones de accesibilidad',
      openLabel: 'Opciones de accesibilidad (Alt+A)',
      textSize: 'Tamaño de texto', decrease: 'Reducir tamaño de texto', increase: 'Aumentar tamaño de texto',
      resetAll: 'Restablecer todo', statement: 'Declaración de accesibilidad', feedback: 'Informar un problema',
      structure: 'Estructura de la página', structureTitle: 'Estructura de la página', back: 'Volver a opciones',
      headings: 'Encabezados', landmarks: 'Regiones', noHeadings: 'No se encontraron encabezados',
      menu: 'Menú', prevSlide: 'Diapositiva anterior', nextSlide: 'Diapositiva siguiente', slide: 'Diapositiva',
      newTab: 'se abre en una pestaña nueva', embedded: 'Contenido incrustado', viewImage: 'Ver imagen',
      enabled: 'activado', disabled: 'desactivado', resetDone: 'Configuración de accesibilidad restablecida',
      textSizeSet: 'Tamaño de texto', profileOn: 'perfil activado', profileOff: 'perfil desactivado',
      secProfiles: 'Perfiles', secText: 'Texto', secColor: 'Color',
      secReading: 'Lectura y navegación', secTools: 'Herramientas',
      profiles: {
        vision: 'Baja visión', seizure: 'Anticonvulsivo',
        adhd: 'TDAH', cognitive: 'Dislexia'
      },
      toggles: {
        lh: 'Interlineado', ls: 'Espaciado de letras', font: 'Fuente legible',
        dyslexia: 'Fuente para dislexia', left: 'Alinear a la izquierda', links: 'Resaltar enlaces',
        heads: 'Resaltar encabezados', dark: 'Contraste oscuro', light: 'Contraste claro',
        invert: 'Invertir colores', gray: 'Escala de grises', lowsat: 'Saturación baja',
        hisat: 'Saturación alta', cursor: 'Cursor grande', guide: 'Guía de lectura',
        mask: 'Máscara de lectura', pause: 'Pausar animaciones', noimg: 'Ocultar imágenes',
        mute: 'Silenciar medios', focus: 'Resaltar foco', targets: 'Botones más grandes',
        tts: 'Leer en voz alta'
      }
    }
  };
  var STR = I18N[CONFIG.lang];

  /* ------------------------- feature definitions ------------------------ */

  var FONT_LEVELS = [1, 1.1, 1.25, 1.4, 1.6];
  var COLOR_MODES = ['dark', 'light', 'invert', 'gray', 'lowsat', 'hisat'];
  var FONT_MODES = ['font', 'dyslexia'];
  /* Filter-based modes live on <html>: the root element is spec-exempt from
     filter's containing-block rule, so fixed positioning keeps working. */
  var ROOT_LEVEL = { invert: true, gray: true, lowsat: true, hisat: true };

  var TOGGLE_KEYS = ['lh', 'ls', 'font', 'dyslexia', 'left', 'links', 'heads',
    'dark', 'light', 'invert', 'gray', 'lowsat', 'hisat',
    'cursor', 'guide', 'mask', 'pause', 'noimg', 'mute', 'focus', 'targets', 'tts'];

  var SECTIONS = [
    { id: 'secText', keys: ['lh', 'ls', 'font', 'dyslexia', 'left', 'links', 'heads'] },
    { id: 'secColor', keys: ['dark', 'light', 'invert', 'gray', 'lowsat', 'hisat'] },
    { id: 'secReading', keys: ['cursor', 'guide', 'mask', 'pause', 'noimg', 'mute', 'focus', 'targets', 'tts'] }
  ];

  var PROFILES = {
    vision: { fs: 2, on: ['font', 'links', 'focus', 'cursor'] },
    seizure: { on: ['pause', 'lowsat', 'mute'] },
    adhd: { on: ['mask', 'pause', 'mute'] },
    cognitive: { on: ['dyslexia', 'lh', 'ls', 'heads', 'guide'] }
  };

  function defaultState() {
    var s = { fs: 0, profile: '', on: {} };
    TOGGLE_KEYS.forEach(function (k) { s.on[k] = false; });
    return s;
  }

  var state = loadState();

  function loadState() {
    try {
      var raw = localStorage.getItem(CONFIG.storageKey);
      if (!raw) return defaultState();
      var p = JSON.parse(raw);
      var s = defaultState();
      if (typeof p.fs === 'number' && p.fs >= 0 && p.fs < FONT_LEVELS.length) s.fs = p.fs;
      if (typeof p.profile === 'string' && (p.profile === '' || PROFILES[p.profile])) s.profile = p.profile;
      TOGGLE_KEYS.forEach(function (k) { s.on[k] = !!(p.on && p.on[k]); });
      return s;
    } catch (e) { return defaultState(); }
  }

  function saveState() {
    try { localStorage.setItem(CONFIG.storageKey, JSON.stringify(state)); } catch (e) { /* private mode */ }
  }

  /* --------------------------- page-level CSS --------------------------- */

  var CURSOR_SVG = "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='44' height='44' viewBox='0 0 24 24'><path d='M4 2 L20 13 L12.5 14 L16 21.5 L13 23 L9.5 15.5 L4 20 Z' fill='black' stroke='white' stroke-width='1.6'/></svg>\") 4 2, auto";

  /* Exclusions keep icon fonts (Font Awesome, Material, Webflow's w-icon-*)
     rendering when a replacement font is active. */
  var FONT_EXCLUDE = ':not(i):not([class*="fa-"]):not([class*="fa "]):not([class*="icon"]):not([class*="material-"]):not([class*="w-icon"])';
  var CONTRAST_EXCLUDE = ':not(img):not(video):not(svg):not(svg *):not(picture):not(iframe)';

  var PAGE_CSS = [
    '.abw-skip{position:fixed;left:16px;top:-120px;z-index:2147483646;background:#111;color:#fff;',
    'padding:12px 20px;border-radius:8px;font:600 16px/1.2 Arial,sans-serif;text-decoration:none;transition:top .15s}',
    '.abw-skip:focus{top:16px;outline:3px solid #ffd54a;outline-offset:2px}',
    '.abw-sr{position:absolute!important;width:1px!important;height:1px!important;overflow:hidden!important;',
    'clip:rect(0 0 0 0)!important;white-space:nowrap!important;border:0!important;padding:0!important;margin:-1px!important}',

    /* Always-on focus repair: many templates suppress outlines entirely.   */
    /* :focus-visible only, so mouse users see no change. (WCAG 2.4.7)     */
    'body :focus-visible{outline:3px solid ' + UI + '!important;outline-offset:2px!important}',

    /* Text adjustments */
    'body.abw-lh p,body.abw-lh li,body.abw-lh h1,body.abw-lh h2,body.abw-lh h3,body.abw-lh h4,',
    'body.abw-lh h5,body.abw-lh h6,body.abw-lh a,body.abw-lh span,body.abw-lh td,body.abw-lh th,',
    'body.abw-lh blockquote,body.abw-lh label,body.abw-lh dd,body.abw-lh dt{line-height:1.9!important}',

    'body.abw-ls *{letter-spacing:.12em!important;word-spacing:.16em!important}',

    'body.abw-font *' + FONT_EXCLUDE + '{font-family:Arial,Verdana,Helvetica,sans-serif!important}',
    'body.abw-dyslexia *' + FONT_EXCLUDE + '{font-family:"Comic Sans MS","Comic Sans",Verdana,Arial,sans-serif!important}',

    'body.abw-left p,body.abw-left h1,body.abw-left h2,body.abw-left h3,body.abw-left h4,',
    'body.abw-left h5,body.abw-left h6,body.abw-left li,body.abw-left td,body.abw-left blockquote,',
    'body.abw-left figcaption{text-align:left!important}',

    'body.abw-links a{text-decoration:underline!important;text-decoration-thickness:2px!important;',
    'background-color:#fff59d!important;color:#00237a!important}',

    'body.abw-heads h1,body.abw-heads h2,body.abw-heads h3,body.abw-heads h4,body.abw-heads h5,',
    'body.abw-heads h6,body.abw-heads [role="heading"]{background-color:#e3f2fd!important;',
    'color:#0d3b8f!important;box-shadow:inset 6px 0 0 #0d3b8f!important;padding-left:10px!important}',

    /* Contrast modes: background images removed so text never sits on an   */
    /* unreadable photo. Form fields restyled explicitly.                   */
    'body.abw-dark,body.abw-dark ' + CONTRAST_EXCLUDE,
    '{background-color:#121212!important;color:#fff!important;border-color:rgba(255,255,255,.4)!important;',
    'background-image:none!important;text-shadow:none!important}',
    'body.abw-dark a' + CONTRAST_EXCLUDE + ',body.abw-dark a ' + CONTRAST_EXCLUDE,
    '{color:#8ab4ff!important;text-decoration:underline!important}',
    'body.abw-dark input,body.abw-dark textarea,body.abw-dark select',
    '{background-color:#1e1e1e!important;color:#fff!important;border:1px solid #888!important}',
    'body.abw-dark ::placeholder{color:#b5b5b5!important}',

    'body.abw-light,body.abw-light ' + CONTRAST_EXCLUDE,
    '{background-color:#fff!important;color:#000!important;border-color:rgba(0,0,0,.55)!important;',
    'background-image:none!important;text-shadow:none!important}',
    'body.abw-light a' + CONTRAST_EXCLUDE + ',body.abw-light a ' + CONTRAST_EXCLUDE,
    '{color:#0000c8!important;text-decoration:underline!important}',
    'body.abw-light input,body.abw-light textarea,body.abw-light select',
    '{background-color:#fff!important;color:#000!important;border:1px solid #444!important}',

    'html.abw-invert{filter:invert(1) hue-rotate(180deg)!important}',
    'html.abw-invert img,html.abw-invert video,html.abw-invert picture,html.abw-invert iframe',
    '{filter:invert(1) hue-rotate(180deg)!important}',
    'html.abw-gray{filter:grayscale(1)!important}',
    'html.abw-lowsat{filter:saturate(.4)!important}',
    'html.abw-hisat{filter:saturate(2)!important}',

    /* Reading and navigation */
    'body.abw-cursor,body.abw-cursor *{cursor:' + CURSOR_SVG + '!important}',

    /* Near-zero duration instead of animation:none, so Webflow IX2-style   */
    /* opacity/transform animations finish at their end state and content   */
    /* stays visible.                                                       */
    'body.abw-pause *,body.abw-pause *::before,body.abw-pause *::after',
    '{transition:none!important;animation-duration:.001s!important;animation-delay:0s!important;',
    'animation-iteration-count:1!important;scroll-behavior:auto!important}',

    'body.abw-noimg img,body.abw-noimg video,body.abw-noimg picture,body.abw-noimg svg',
    '{visibility:hidden!important}',
    'body.abw-noimg *{background-image:none!important}',

    'body.abw-focus :focus{outline:4px solid #e65100!important;outline-offset:3px!important}',

    'body.abw-tts p:hover,body.abw-tts h1:hover,body.abw-tts h2:hover,body.abw-tts h3:hover,',
    'body.abw-tts h4:hover,body.abw-tts h5:hover,body.abw-tts h6:hover,body.abw-tts li:hover,',
    'body.abw-tts blockquote:hover{outline:2px dashed ' + UI + '!important;outline-offset:2px;cursor:pointer}'
  ].join('');

  /* ------------------------ remediation engine -------------------------- */
  /* Each fixer is idempotent (checks before writing, marks what it fixed)  */
  /* and re-runs via MutationObserver as Webflow injects dynamic content.   */

  var report = {};
  function count(key, n) { report[key] = (report[key] || 0) + (n === undefined ? 1 : n); }

  function humanize(str) {
    var s = (str || '');
    try { s = decodeURIComponent(s); } catch (e) { /* malformed escape */ }
    s = s.replace(/\.[a-z0-9]+$/i, '')
      .replace(/[-_+]+/g, ' ')               /* before hex strip: _ defeats \b */
      .replace(/\b[0-9a-f]{16,}\b/gi, ' ')   /* Webflow asset ids and hashes */
      .replace(/\s+/g, ' ').trim();
    /* A label with almost no letters is gibberish; better a clean generic. */
    return s.replace(/[^a-zA-Z]/g, '').length >= 3 ? s : '';
  }

  var SOCIAL = [
    ['facebook.com', 'Facebook'], ['instagram.com', 'Instagram'],
    ['twitter.com', 'Twitter'], ['x.com', 'X (Twitter)'],
    ['linkedin.com', 'LinkedIn'], ['youtube.com', 'YouTube'],
    ['tiktok.com', 'TikTok'], ['pinterest.com', 'Pinterest'],
    ['yelp.com', 'Yelp'], ['goo.gl/maps', 'Google Maps'],
    ['google.com/maps', 'Google Maps'], ['maps.app', 'Google Maps'],
    ['wa.me', 'WhatsApp'], ['t.me', 'Telegram'], ['mailto:', 'Email'],
    ['tel:', 'Phone']
  ];

  var FIXERS = {
    /* 3.1.1 Language of Page */
    lang: function () {
      var html = document.documentElement;
      if (!html.getAttribute('lang')) { html.setAttribute('lang', CONFIG.pageLang); count('langSet'); }
    },

    /* 1.4.4 Resize Text: remove zoom locks from the viewport meta */
    viewport: function () {
      var vp = document.querySelector('meta[name="viewport"]');
      if (!vp || vp.dataset.abwFixed) return;
      var c = vp.getAttribute('content') || '';
      var fixed = c.replace(/,?\s*user-scalable\s*=\s*(no|0)/gi, '')
                   .replace(/,?\s*maximum-scale\s*=\s*[\d.]+/gi, '')
                   .replace(/^\s*,/, '');
      if (fixed !== c) { vp.setAttribute('content', fixed); count('viewportUnlocked'); }
      vp.dataset.abwFixed = '1';
    },

    /* 1.1.1: images with no alt attribute announce their filename; empty   */
    /* alt marks them decorative instead. Image-only links get a real name. */
    alt: function () {
      document.querySelectorAll('img:not([alt])').forEach(function (img) {
        if (img.closest('[data-abw-ui]')) return;
        img.setAttribute('alt', '');
        count('imgAltAdded');
      });
    },

    /* 2.4.4 / 4.1.2: links and buttons with no accessible name */
    names: function () {
      /* Text that is display:none, visibility:hidden, or aria-hidden does   */
      /* not reach screen readers. Webflow templates hide label text this    */
      /* way constantly (animated tabs/menus), leaving nameless controls.    */
      function visibleText(node) {
        var out = '';
        (function walk(n) {
          if (n.nodeType === 3) { out += n.nodeValue; return; }
          if (n.nodeType !== 1) return;
          if (n.getAttribute('aria-hidden') === 'true') return;
          var cs = getComputedStyle(n);
          if (cs.display === 'none' || cs.visibility === 'hidden') return;
          for (var i = 0; i < n.childNodes.length; i++) walk(n.childNodes[i]);
        })(node);
        return out.replace(/\s+/g, ' ').trim();
      }
      document.querySelectorAll('a[href],button,[role="button"]').forEach(function (el) {
        if (el.dataset.abwNamed || el.closest('[data-abw-ui]')) return;
        var hasText = visibleText(el).length > 0;
        var hasLabel = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby');
        var img = el.querySelector('img[alt]');
        var hasImgAlt = img && img.getAttribute('alt').trim().length > 0;
        if (hasText || hasLabel || hasImgAlt) { el.dataset.abwNamed = '1'; return; }
        /* First choice: the element's own hidden text is the intended label. */
        var label = (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80) ||
          el.getAttribute('title') || '';
        var href = el.getAttribute('href') || '';
        if (!label && href) {
          for (var i = 0; i < SOCIAL.length; i++) {
            if (href.indexOf(SOCIAL[i][0]) !== -1) { label = SOCIAL[i][1]; break; }
          }
        }
        if (!label) {
          var innerImg = el.querySelector('img[src]');
          if (innerImg) label = humanize(innerImg.getAttribute('src').split('/').pop());
        }
        if (!label && href && href !== '#') {
          label = humanize(href.replace(/[#?].*$/, '').split('/').filter(Boolean).pop() || '');
        }
        /* Last resort for image-only links whose filename was gibberish. */
        if (!label && el.querySelector('img,svg')) label = STR.viewImage;
        if (label) {
          el.setAttribute('aria-label', label);
          count('controlsNamed');
        }
        el.dataset.abwNamed = '1';
      });
    },

    /* 3.2 advisory + security: warn about new-tab links, add noopener */
    newtab: function () {
      document.querySelectorAll('a[target="_blank"]').forEach(function (a) {
        if (a.dataset.abwNewtab || a.closest('[data-abw-ui]')) return;
        a.dataset.abwNewtab = '1';
        var rel = (a.getAttribute('rel') || '').split(/\s+/);
        if (rel.indexOf('noopener') === -1) { rel.push('noopener'); a.setAttribute('rel', rel.join(' ').trim()); }
        var ariaLabel = a.getAttribute('aria-label');
        if (ariaLabel) {
          a.setAttribute('aria-label', ariaLabel + ' (' + STR.newTab + ')');
        } else {
          var sr = document.createElement('span');
          sr.className = 'abw-sr';
          sr.textContent = ' (' + STR.newTab + ')';
          a.appendChild(sr);
        }
        count('newTabLabeled');
      });
    },

    /* 4.1.2: Webflow's .w--current styling has no programmatic equivalent */
    current: function () {
      document.querySelectorAll('a.w--current:not([aria-current])').forEach(function (a) {
        a.setAttribute('aria-current', 'page');
        count('currentMarked');
      });
    },

    /* 2.1.1 / 4.1.2: Webflow hamburger nav buttons are divs */
    navbutton: function () {
      document.querySelectorAll('.w-nav-button').forEach(function (btn) {
        if (btn.dataset.abwNav) {
          btn.setAttribute('aria-expanded', btn.classList.contains('w--open') ? 'true' : 'false');
          return;
        }
        btn.dataset.abwNav = '1';
        if (!btn.hasAttribute('role')) btn.setAttribute('role', 'button');
        if (!btn.hasAttribute('tabindex')) btn.setAttribute('tabindex', '0');
        if (!btn.getAttribute('aria-label')) btn.setAttribute('aria-label', STR.menu);
        btn.setAttribute('aria-expanded', btn.classList.contains('w--open') ? 'true' : 'false');
        btn.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); btn.click(); }
        });
        btn.addEventListener('click', function () {
          setTimeout(function () {
            btn.setAttribute('aria-expanded', btn.classList.contains('w--open') ? 'true' : 'false');
          }, 80);
        });
        count('navButtonsFixed');
      });
    },

    /* 4.1.2: Webflow dropdown toggles */
    dropdown: function () {
      document.querySelectorAll('.w-dropdown-toggle').forEach(function (t) {
        if (t.dataset.abwDd) {
          t.setAttribute('aria-expanded', t.classList.contains('w--open') ? 'true' : 'false');
          return;
        }
        t.dataset.abwDd = '1';
        if (!t.hasAttribute('aria-haspopup')) t.setAttribute('aria-haspopup', 'menu');
        t.setAttribute('aria-expanded', t.classList.contains('w--open') ? 'true' : 'false');
        t.addEventListener('click', function () {
          setTimeout(function () {
            t.setAttribute('aria-expanded', t.classList.contains('w--open') ? 'true' : 'false');
          }, 80);
        });
        count('dropdownsFixed');
      });
    },

    /* 1.1.1 / 4.1.2: Webflow slider arrows and dots use icon fonts with no name */
    slider: function () {
      document.querySelectorAll('.w-slider-arrow-left:not([aria-label])').forEach(function (el) {
        el.setAttribute('aria-label', STR.prevSlide); count('sliderControlsNamed');
      });
      document.querySelectorAll('.w-slider-arrow-right:not([aria-label])').forEach(function (el) {
        el.setAttribute('aria-label', STR.nextSlide); count('sliderControlsNamed');
      });
      document.querySelectorAll('.w-slider-nav').forEach(function (nav) {
        var dots = nav.querySelectorAll('.w-slider-dot');
        dots.forEach(function (dot, i) {
          if (!dot.getAttribute('aria-label')) {
            dot.setAttribute('aria-label', STR.slide + ' ' + (i + 1) + ' / ' + dots.length);
            count('sliderControlsNamed');
          }
        });
      });
    },

    /* 3.3.2 / 4.1.3: unlabeled form fields, silent form feedback */
    forms: function () {
      document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]),select,textarea')
        .forEach(function (field) {
          if (field.dataset.abwForm || field.closest('[data-abw-ui]')) return;
          field.dataset.abwForm = '1';
          var id = field.id;
          var hasLabel = (id && document.querySelector('label[for="' + (window.CSS && CSS.escape ? CSS.escape(id) : id) + '"]')) ||
            field.closest('label') || field.getAttribute('aria-label') || field.getAttribute('aria-labelledby');
          if (hasLabel) return;
          var name = field.getAttribute('placeholder') || humanize(field.getAttribute('name'));
          if (name) { field.setAttribute('aria-label', name); count('fieldsLabeled'); }
        });
      document.querySelectorAll('.w-form-done:not([role])').forEach(function (el) {
        el.setAttribute('role', 'status'); count('formAlertsWired');
      });
      document.querySelectorAll('.w-form-fail:not([role])').forEach(function (el) {
        el.setAttribute('role', 'alert'); count('formAlertsWired');
      });
    },

    /* 4.1.2: iframes with no title */
    iframes: function () {
      document.querySelectorAll('iframe:not([title])').forEach(function (f) {
        var label = STR.embedded;
        try {
          var host = new URL(f.src, location.href).hostname.replace(/^www\./, '');
          if (host) label = STR.embedded + ': ' + host;
        } catch (e) { /* about:blank etc */ }
        f.setAttribute('title', label);
        count('iframesTitled');
      });
    }
  };

  function runFixers() {
    if (!CONFIG.fixesEnabled) return;
    Object.keys(FIXERS).forEach(function (id) {
      if (CONFIG.skipFixes.indexOf(id) !== -1) return;
      try { FIXERS[id](); } catch (e) { /* one broken fixer never kills the rest */ }
    });
  }

  /* ------------------- font scaling (never compounds) -------------------- */

  var TEXT_SELECTOR = 'p,h1,h2,h3,h4,h5,h6,a,li,td,th,dt,dd,span,em,strong,small,label,legend,' +
    'button,input,textarea,select,blockquote,figcaption,cite,summary,time,code,pre,div';
  var fontSeen = (typeof WeakSet !== 'undefined') ? new WeakSet() : null;
  var fontRecs = [];

  function hasDirectText(el) {
    for (var i = 0; i < el.childNodes.length; i++) {
      var n = el.childNodes[i];
      if (n.nodeType === 3 && n.nodeValue && n.nodeValue.trim()) return true;
    }
    return false;
  }

  function captureFonts() {
    var els = document.body.querySelectorAll(TEXT_SELECTOR);
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (fontSeen && fontSeen.has(el)) continue;
      if (el.closest && el.closest('[data-abw-ui]')) continue;
      if (el.className && String(el.className).indexOf('abw-') !== -1) continue;
      var isFormEl = /^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(el.tagName);
      if (!isFormEl && !hasDirectText(el)) continue;
      var px = parseFloat(window.getComputedStyle(el).fontSize);
      if (!px) continue;
      if (fontSeen) fontSeen.add(el);
      fontRecs.push({ el: el, base: px, inline: el.style.fontSize });
    }
  }

  function applyFontScale(scale) {
    if (scale > 1) captureFonts();
    for (var j = 0; j < fontRecs.length; j++) {
      var r = fontRecs[j];
      r.el.style.fontSize = (scale === 1) ? r.inline : (r.base * scale).toFixed(2) + 'px';
    }
  }

  /* --------------------- reading guide / reading mask -------------------- */

  var guideEl = null, maskTop = null, maskBot = null;
  var MASK_BAND = 140;

  function onGuideMove(e) {
    if (guideEl) guideEl.style.top = (e.clientY - 34) + 'px';
    if (maskTop) {
      var half = MASK_BAND / 2;
      maskTop.style.height = Math.max(0, e.clientY - half) + 'px';
      maskBot.style.top = (e.clientY + half) + 'px';
    }
  }
  function pointerTracking() {
    if (guideEl || maskTop) document.addEventListener('mousemove', onGuideMove, { passive: true });
    else document.removeEventListener('mousemove', onGuideMove);
  }
  function setGuide(on) {
    if (on && !guideEl) {
      guideEl = document.createElement('div');
      guideEl.setAttribute('aria-hidden', 'true');
      guideEl.setAttribute('data-abw-ui', '');
      guideEl.style.cssText = 'position:fixed;left:0;right:0;top:40%;height:14px;' +
        'background:rgba(255,213,74,.85);border-top:2px solid #b8860b;border-bottom:2px solid #b8860b;' +
        'pointer-events:none;z-index:2147483644;';
      document.documentElement.appendChild(guideEl);
    } else if (!on && guideEl) { guideEl.remove(); guideEl = null; }
    pointerTracking();
  }
  function setMask(on) {
    if (on && !maskTop) {
      var mk = function (pos) {
        var d = document.createElement('div');
        d.setAttribute('aria-hidden', 'true');
        d.setAttribute('data-abw-ui', '');
        d.style.cssText = 'position:fixed;left:0;right:0;' + pos +
          'background:rgba(10,10,10,.6);pointer-events:none;z-index:2147483643;';
        document.documentElement.appendChild(d);
        return d;
      };
      maskTop = mk('top:0;height:35%;');
      maskBot = mk('top:calc(35% + ' + MASK_BAND + 'px);bottom:0;height:auto;');
    } else if (!on && maskTop) {
      maskTop.remove(); maskBot.remove(); maskTop = maskBot = null;
    }
    pointerTracking();
  }

  /* -------------------------- bigger targets ----------------------------- */
  /* 2.5.8 Target Size: pads pointer targets smaller than 24x24 CSS px.     */

  var targetRecs = [];
  function setTargets(on) {
    if (on && !targetRecs.length) {
      document.body.querySelectorAll('a[href],button,[role="button"],input[type="checkbox"],input[type="radio"]')
        .forEach(function (el) {
          if (el.closest('[data-abw-ui]')) return;
          var r = el.getBoundingClientRect();
          if (!r.width && !r.height) return;
          if (r.width < 24 || r.height < 24) {
            targetRecs.push({ el: el, pad: el.style.padding, disp: el.style.display });
            if (getComputedStyle(el).display === 'inline') el.style.display = 'inline-block';
            el.style.padding = '6px';
          }
        });
    } else if (!on && targetRecs.length) {
      targetRecs.forEach(function (r) { r.el.style.padding = r.pad; r.el.style.display = r.disp; });
      targetRecs = [];
    }
  }

  /* ----------------------------- media mute ------------------------------ */

  var mutedEls = [];
  function setMute(on) {
    if (on) {
      document.querySelectorAll('video,audio').forEach(function (m) {
        if (!m.muted) { mutedEls.push(m); m.muted = true; }
        try { if (!m.paused && m.tagName === 'AUDIO') m.pause(); } catch (e) {}
      });
    } else {
      mutedEls.forEach(function (m) { m.muted = false; });
      mutedEls = [];
    }
  }

  /* --------------------------- text to speech ---------------------------- */

  function speak(text) {
    if (!('speechSynthesis' in window) || !text) return;
    try {
      window.speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(text.slice(0, 2000));
      u.lang = document.documentElement.lang || CONFIG.pageLang;
      window.speechSynthesis.speak(u);
    } catch (e) { /* unsupported */ }
  }
  function stopSpeech() {
    try { window.speechSynthesis.cancel(); } catch (e) {}
  }
  function onTtsClick(e) {
    var path = e.composedPath ? e.composedPath() : [];
    if (host && path.indexOf(host) !== -1) return;
    var t = e.target && e.target.closest &&
      e.target.closest('p,h1,h2,h3,h4,h5,h6,li,blockquote,figcaption,td,th,dt,dd,label,a,button,span,div');
    if (!t) return;
    var text = (t.innerText || t.textContent || '').trim();
    if (text) speak(text);
  }
  function setTts(on) {
    if (on) document.addEventListener('click', onTtsClick, true);
    else { document.removeEventListener('click', onTtsClick, true); stopSpeech(); }
  }

  /* --------------------------- apply state ------------------------------- */

  function applyState() {
    var body = document.body;
    var root = document.documentElement;
    TOGGLE_KEYS.forEach(function (k) {
      (ROOT_LEVEL[k] ? root : body).classList.toggle('abw-' + k, !!state.on[k]);
    });
    applyFontScale(FONT_LEVELS[state.fs]);
    setGuide(!!state.on.guide);
    setMask(!!state.on.mask);
    setTargets(!!state.on.targets);
    setMute(!!state.on.mute);
    setTts(!!state.on.tts);
    if (state.on.pause) {
      document.querySelectorAll('video').forEach(function (v) { try { v.pause(); } catch (e) {} });
    }
    saveState();
  }

  /* ----------------------------- skip link ------------------------------- */

  function injectSkipLink() {
    if (document.querySelector('.abw-skip')) return;
    var main = document.querySelector('main,[role="main"]') ||
      document.querySelector('#main,#content,.main-content,.page-wrapper,.main-wrapper');
    if (!main) {
      var h1 = document.querySelector('h1');
      if (h1) main = h1;
    }
    if (!main) return;
    if (main.tagName !== 'MAIN' && !main.getAttribute('role') &&
        /wrapper|content|main/i.test(main.className || '') && main.tagName === 'DIV') {
      main.setAttribute('role', 'main');
      count('mainLandmark');
    }
    if (!main.id) main.id = 'abw-main';
    if (!main.hasAttribute('tabindex')) main.setAttribute('tabindex', '-1');
    var skip = document.createElement('a');
    skip.className = 'abw-skip';
    skip.setAttribute('data-abw-ui', '');
    skip.href = '#' + main.id;
    skip.textContent = CONFIG.lang === 'es' ? 'Saltar al contenido principal' : 'Skip to main content';
    skip.addEventListener('click', function (e) {
      e.preventDefault();
      main.focus();
      main.scrollIntoView();
    });
    document.body.insertBefore(skip, document.body.firstChild);
    count('skipLink');
  }

  /* --------------------------- widget UI (shadow) ------------------------ */

  var sideProp = CONFIG.position === 'bottom-right' ? 'right' : 'left';
  var OX = CONFIG.offsetX + 'px', OY = CONFIG.offsetY + 'px';

  var WIDGET_CSS = [
    ':host{all:initial}',
    '*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}',
    'button{font:inherit;cursor:pointer;background:none;border:0;color:inherit}',
    '.trigger{position:fixed;bottom:' + OY + ';' + sideProp + ':' + OX + ';z-index:2147483646;',
    'width:56px;height:56px;border-radius:50%;background:' + CONFIG.brand + ';color:#fff;',
    'display:flex;align-items:center;justify-content:center;box-shadow:0 4px 14px rgba(0,0,0,.35);',
    'border:2px solid #fff;transition:transform .15s}',
    '.trigger:hover{transform:scale(1.07)}',
    '.trigger:focus-visible,.panel button:focus-visible,.panel a:focus-visible',
    '{outline:3px solid #111;outline-offset:2px;border-radius:6px}',
    '.trigger svg{width:32px;height:32px}',
    '.panel{position:fixed;bottom:calc(' + OY + ' + 70px);' + sideProp + ':' + OX + ';z-index:2147483646;',
    'width:360px;max-width:calc(100vw - 32px);max-height:min(76vh,660px);overflow-y:auto;',
    'background:#fff;color:#1a1a1a;border-radius:16px;box-shadow:0 10px 40px rgba(0,0,0,.4);',
    'font:15px/1.45 Arial,Helvetica,sans-serif;display:none}',
    '.panel.open{display:block}',
    '.hd{display:flex;align-items:center;justify-content:space-between;gap:8px;',
    'padding:14px 18px;background:' + UI + ';color:#fff;position:sticky;top:0;z-index:2}',
    '.hd h2{font-size:17px;font-weight:700}',
    '.iconbtn{min-width:44px;min-height:44px;border-radius:8px;font-size:20px;line-height:1;color:#fff;',
    'display:inline-flex;align-items:center;justify-content:center}',
    '.iconbtn:hover{background:rgba(255,255,255,.22)}',
    '.sec{padding:12px 18px 2px}',
    '.sec h3{font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;',
    'color:#50555e;margin-bottom:8px}',
    '.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}',
    '.tgl{border:2px solid #6b7280;border-radius:10px;padding:8px;text-align:center;',
    'font-weight:600;font-size:13.5px;color:#1a1a1a;background:#fff;min-height:44px}',
    '.tgl:hover{border-color:' + UI + ';box-shadow:inset 0 0 0 1px ' + UI + '}',
    '.tgl[aria-pressed="true"]{background:' + UI + ';border-color:' + UI + ';color:#fff}',
    '.wide{grid-column:1 / -1}',
    '.fsrow{display:flex;align-items:center;gap:8px;border:2px solid #6b7280;border-radius:10px;',
    'padding:6px 8px;margin-bottom:8px}',
    '.fsrow .lbl{flex:1;font-weight:600;font-size:13.5px}',
    '.fsrow output{min-width:52px;text-align:center;font-weight:700}',
    '.stp{width:44px;height:44px;border-radius:8px;border:2px solid #6b7280;font-size:20px;font-weight:700}',
    '.stp:hover:not(:disabled){border-color:' + UI + ';color:' + UI + '}',
    '.stp:disabled{opacity:.4;cursor:not-allowed}',
    '.ft{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px;',
    'padding:12px 18px 14px;border-top:1px solid #d6d9df;margin-top:10px}',
    '.reset{font-weight:700;color:#a4211a;padding:10px 12px;border-radius:8px;min-height:44px}',
    '.reset:hover{background:#fdecea}',
    '.ftlink{font-size:13px;color:#24313f;text-decoration:underline;padding:8px 4px;display:inline-block}',
    '.ver{width:100%;font-size:11px;color:#5b626b;text-align:center;padding-bottom:4px}',
    '.view{display:none}.view.on{display:block}',
    '.stitem{display:block;width:100%;text-align:left;border:0;border-bottom:1px solid #e3e6ea;',
    'padding:10px 8px;font-size:14px;color:#1a1a1a;border-radius:6px;min-height:44px}',
    '.stitem:hover{background:#eef2f7}',
    '.stitem .tag{display:inline-block;min-width:34px;font-weight:700;color:' + UI + ';margin-right:6px}',
    '.stempty{padding:12px 8px;color:#50555e;font-size:14px}',
    '.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}',
    '@media (prefers-reduced-motion:reduce){.trigger{transition:none}}'
  ].join('');

  var open = false;
  var host, shadow, panel, trigger, liveRegion, mainView, structView, structList;
  var toggleBtns = {}, profileBtns = {};
  var fsOut, fsMinus, fsPlus, closeBtn, backBtn;

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function svgIcon() {
    var NS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'currentColor');
    svg.setAttribute('aria-hidden', 'true');
    var circle = document.createElementNS(NS, 'circle');
    circle.setAttribute('cx', '12'); circle.setAttribute('cy', '4'); circle.setAttribute('r', '2');
    var path = document.createElementNS(NS, 'path');
    path.setAttribute('d', 'M21.2 6.6c-2.8.9-5.9 1.4-9.2 1.4S5.6 7.5 2.8 6.6l-.6 1.9c1.9.6 4 1 6.3 1.2v2.9L6 20.3l1.9.6 2.4-7h1.4l2.4 7 1.9-.6-2.5-7.7v-2.9c2.3-.2 4.4-.6 6.3-1.2z');
    svg.appendChild(circle); svg.appendChild(path);
    return svg;
  }

  function makeToggle(key, label, wide) {
    var btn = el('button', 'tgl' + (wide ? ' wide' : ''), label);
    btn.setAttribute('aria-pressed', 'false');
    btn.addEventListener('click', function () { toggleFeature(key); });
    toggleBtns[key] = btn;
    return btn;
  }

  function buildWidget() {
    host = document.createElement('rmh-access-widget');
    host.setAttribute('data-abw-ui', '');
    shadow = host.attachShadow({ mode: 'open' });

    var style = el('style');
    style.textContent = WIDGET_CSS;
    shadow.appendChild(style);

    trigger = el('button', 'trigger');
    trigger.setAttribute('aria-label', STR.openLabel);
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.appendChild(svgIcon());
    shadow.appendChild(trigger);

    panel = el('div', 'panel');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-label', STR.title);

    /* Header */
    var hd = el('div', 'hd');
    hd.appendChild(el('h2', null, STR.title));
    closeBtn = el('button', 'iconbtn', '✕');
    closeBtn.setAttribute('aria-label', STR.close);
    hd.appendChild(closeBtn);
    panel.appendChild(hd);

    /* ---- main view ---- */
    mainView = el('div', 'view on');

    /* Profiles */
    var secP = el('div', 'sec');
    secP.appendChild(el('h3', null, STR.secProfiles));
    var gridP = el('div', 'grid');
    Object.keys(PROFILES).forEach(function (pk) {
      var b = el('button', 'tgl', STR.profiles[pk]);
      b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', function () { toggleProfile(pk); });
      profileBtns[pk] = b;
      gridP.appendChild(b);
    });
    secP.appendChild(gridP);
    mainView.appendChild(secP);

    /* Feature sections */
    SECTIONS.forEach(function (section, idx) {
      var sec = el('div', 'sec');
      sec.appendChild(el('h3', null, STR[section.id]));
      if (idx === 0) {
        var row = el('div', 'fsrow');
        row.appendChild(el('span', 'lbl', STR.textSize));
        fsMinus = el('button', 'stp', '−');
        fsMinus.setAttribute('aria-label', STR.decrease);
        fsOut = el('output', null, '100%');
        fsPlus = el('button', 'stp', '+');
        fsPlus.setAttribute('aria-label', STR.increase);
        row.appendChild(fsMinus); row.appendChild(fsOut); row.appendChild(fsPlus);
        sec.appendChild(row);
        fsMinus.addEventListener('click', function () { stepFont(-1); });
        fsPlus.addEventListener('click', function () { stepFont(1); });
      }
      var grid = el('div', 'grid');
      section.keys.forEach(function (k) {
        grid.appendChild(makeToggle(k, STR.toggles[k], false));
      });
      sec.appendChild(grid);
      mainView.appendChild(sec);
    });

    /* Tools */
    var secT = el('div', 'sec');
    secT.appendChild(el('h3', null, STR.secTools));
    var gridT = el('div', 'grid');
    var structBtn = el('button', 'tgl wide', STR.structure);
    structBtn.addEventListener('click', showStructure);
    gridT.appendChild(structBtn);
    secT.appendChild(gridT);
    mainView.appendChild(secT);

    /* Footer */
    var ft = el('div', 'ft');
    var resetBtn = el('button', 'reset', STR.resetAll);
    resetBtn.addEventListener('click', resetAll);
    ft.appendChild(resetBtn);
    if (CONFIG.statementUrl) {
      var stmt = el('a', 'ftlink', STR.statement);
      stmt.href = CONFIG.statementUrl;
      ft.appendChild(stmt);
    }
    if (CONFIG.feedbackEmail) {
      var fb = el('a', 'ftlink', STR.feedback);
      fb.href = 'mailto:' + CONFIG.feedbackEmail;
      ft.appendChild(fb);
    }
    ft.appendChild(el('div', 'ver', 'RMH Access v2.0.1'));
    mainView.appendChild(ft);
    panel.appendChild(mainView);

    /* ---- structure view ---- */
    structView = el('div', 'view');
    var secS = el('div', 'sec');
    backBtn = el('button', 'tgl wide', '← ' + STR.back);
    backBtn.addEventListener('click', showMain);
    secS.appendChild(backBtn);
    secS.appendChild(el('h3', null, STR.structureTitle));
    structList = el('div');
    secS.appendChild(structList);
    structView.appendChild(secS);
    panel.appendChild(structView);

    liveRegion = el('div', 'sr');
    liveRegion.setAttribute('aria-live', 'polite');
    panel.appendChild(liveRegion);

    shadow.appendChild(panel);

    /* Events */
    trigger.addEventListener('click', function () { open ? closePanel() : openPanel(); });
    closeBtn.addEventListener('click', closePanel);

    shadow.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && open) { closePanel(); return; }
      if (e.key === 'Tab' && open) trapFocus(e);
    });

    document.addEventListener('click', function (e) {
      if (!open) return;
      var path = e.composedPath ? e.composedPath() : [];
      if (path.indexOf(host) === -1) closePanel();
    });

    /* Alt+A (Option+A on Mac) opens/closes the panel from anywhere.
       e.code checks the physical key: on macOS, Option+A produces
       key "å", so matching e.key alone breaks for every Mac user. */
    document.addEventListener('keydown', function (e) {
      if (e.altKey && !e.ctrlKey && !e.metaKey &&
          (e.code === 'KeyA' || e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        open ? closePanel() : openPanel();
      }
    });

    /* Mounted on <html>, outside <body>, so body-level effects (contrast
       overrides, hidden images) never touch the widget, and body-level CSS
       filters cannot break its fixed positioning. */
    document.documentElement.appendChild(host);
    syncUI();
  }

  /* ------------------------- structure navigator ------------------------- */

  function isVisible(node) {
    if (!node.getClientRects || !node.getClientRects().length) return false;
    var cs = getComputedStyle(node);
    return cs.visibility !== 'hidden';
  }

  function jumpTo(node) {
    closePanel();
    node.scrollIntoView({ block: 'center' });
    if (!node.hasAttribute('tabindex')) node.setAttribute('tabindex', '-1');
    try { node.focus({ preventScroll: true }); } catch (e) { node.focus(); }
  }

  function showStructure() {
    while (structList.firstChild) structList.removeChild(structList.firstChild);

    var lms = document.querySelectorAll('header,nav,main,aside,footer,[role="banner"],[role="navigation"],[role="main"],[role="contentinfo"],[role="search"]');
    if (lms.length) {
      structList.appendChild(el('h3', null, STR.landmarks));
      lms.forEach(function (lm) {
        if (lm.closest('[data-abw-ui]') || !isVisible(lm)) return;
        var name = lm.getAttribute('aria-label') || lm.getAttribute('role') || lm.tagName.toLowerCase();
        var item = el('button', 'stitem');
        item.appendChild(el('span', 'tag', lm.tagName.toLowerCase()));
        item.appendChild(document.createTextNode(name));
        item.addEventListener('click', function () { jumpTo(lm); });
        structList.appendChild(item);
      });
    }

    structList.appendChild(el('h3', null, STR.headings));
    var heads = document.querySelectorAll('h1,h2,h3,h4,h5,h6');
    var any = false;
    heads.forEach(function (h) {
      if (h.closest('[data-abw-ui]') || !isVisible(h)) return;
      var text = (h.textContent || '').trim();
      if (!text) return;
      any = true;
      var level = parseInt(h.tagName.slice(1), 10);
      var item = el('button', 'stitem');
      item.style.paddingLeft = (8 + (level - 1) * 14) + 'px';
      item.appendChild(el('span', 'tag', 'H' + level));
      item.appendChild(document.createTextNode(text.length > 60 ? text.slice(0, 57) + '…' : text));
      item.addEventListener('click', function () { jumpTo(h); });
      structList.appendChild(item);
    });
    if (!any) structList.appendChild(el('div', 'stempty', STR.noHeadings));

    mainView.classList.remove('on');
    structView.classList.add('on');
    backBtn.focus();
  }

  function showMain() {
    structView.classList.remove('on');
    mainView.classList.add('on');
    closeBtn.focus();
  }

  /* ---------------------------- interactions ----------------------------- */

  function toggleFeature(key) {
    var turningOn = !state.on[key];
    if (turningOn && COLOR_MODES.indexOf(key) !== -1) {
      COLOR_MODES.forEach(function (m) { state.on[m] = false; });
    }
    if (turningOn && FONT_MODES.indexOf(key) !== -1) {
      FONT_MODES.forEach(function (m) { state.on[m] = false; });
    }
    state.on[key] = turningOn;
    applyState();
    syncUI();
    announce(STR.toggles[key] + ' ' + (turningOn ? STR.enabled : STR.disabled));
  }

  function toggleProfile(pk) {
    var def = PROFILES[pk];
    if (state.profile === pk) {
      def.on.forEach(function (k) { state.on[k] = false; });
      if (def.fs !== undefined) state.fs = 0;
      state.profile = '';
      announce(STR.profiles[pk] + ' ' + STR.profileOff);
    } else {
      if (state.profile && PROFILES[state.profile]) {
        PROFILES[state.profile].on.forEach(function (k) { state.on[k] = false; });
        if (PROFILES[state.profile].fs !== undefined) state.fs = 0;
      }
      def.on.forEach(function (k) {
        if (COLOR_MODES.indexOf(k) !== -1) COLOR_MODES.forEach(function (m) { state.on[m] = false; });
        if (FONT_MODES.indexOf(k) !== -1) FONT_MODES.forEach(function (m) { state.on[m] = false; });
        state.on[k] = true;
      });
      if (def.fs !== undefined) state.fs = def.fs;
      state.profile = pk;
      announce(STR.profiles[pk] + ' ' + STR.profileOn);
    }
    applyState();
    syncUI();
  }

  function stepFont(dir) {
    var next = Math.min(FONT_LEVELS.length - 1, Math.max(0, state.fs + dir));
    if (next === state.fs) return;
    state.fs = next;
    applyState();
    syncUI();
    announce(STR.textSizeSet + ' ' + Math.round(FONT_LEVELS[state.fs] * 100) + '%');
  }

  function resetAll() {
    state = defaultState();
    applyState();
    syncUI();
    announce(STR.resetDone);
  }

  function syncUI() {
    TOGGLE_KEYS.forEach(function (k) {
      if (toggleBtns[k]) toggleBtns[k].setAttribute('aria-pressed', state.on[k] ? 'true' : 'false');
    });
    Object.keys(profileBtns).forEach(function (pk) {
      profileBtns[pk].setAttribute('aria-pressed', state.profile === pk ? 'true' : 'false');
    });
    fsOut.textContent = Math.round(FONT_LEVELS[state.fs] * 100) + '%';
    fsMinus.disabled = state.fs === 0;
    fsPlus.disabled = state.fs === FONT_LEVELS.length - 1;
  }

  function announce(msg) {
    liveRegion.textContent = '';
    setTimeout(function () { liveRegion.textContent = msg; }, 30);
  }

  function openPanel() {
    open = true;
    panel.classList.add('open');
    trigger.setAttribute('aria-expanded', 'true');
    showMain();
  }

  function closePanel() {
    open = false;
    panel.classList.remove('open');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.focus();
  }

  function trapFocus(e) {
    var view = structView.classList.contains('on') ? structView : mainView;
    var focusables = [closeBtn].concat(
      Array.prototype.slice.call(view.querySelectorAll('button:not(:disabled),a[href]')));
    if (!focusables.length) return;
    var first = focusables[0];
    var last = focusables[focusables.length - 1];
    var active = shadow.activeElement;
    if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && (active === last || active === null)) { e.preventDefault(); first.focus(); }
  }

  /* ------------------------------ observer ------------------------------- */

  var moTimer = null;
  function startObserver() {
    if (!window.MutationObserver) return;
    var mo = new MutationObserver(function () {
      if (moTimer) return;
      moTimer = setTimeout(function () {
        moTimer = null;
        runFixers();
        if (state.fs > 0) applyFontScale(FONT_LEVELS[state.fs]);
        if (state.on.mute) setMute(true);
      }, 400);
    });
    mo.observe(document.body, { childList: true, subtree: true });
  }

  /* -------------------------------- init --------------------------------- */

  function init() {
    var pageStyle = el('style');
    pageStyle.id = 'abw-page-styles';
    pageStyle.textContent = PAGE_CSS;
    document.head.appendChild(pageStyle);

    runFixers();
    injectSkipLink();
    buildWidget();
    applyState(); /* restore saved preferences */
    startObserver();

    window.RMHAccess = {
      loaded: true,
      version: '2.0.1',
      open: openPanel,
      close: closePanel,
      reset: resetAll,
      report: function () { return JSON.parse(JSON.stringify(report)); },
      state: function () { return JSON.parse(JSON.stringify(state)); }
    };

    if (CONFIG.fixesEnabled && Object.keys(report).length && window.console && console.info) {
      console.info('[RMH Access] auto-remediation:', JSON.parse(JSON.stringify(report)));
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
