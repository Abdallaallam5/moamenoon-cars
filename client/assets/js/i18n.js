/**
 * i18n.js
 * -----------------------------------------------------------------------
 * Initializes i18next (with the HTTP backend + browser language detector
 * plugins loaded via CDN in each page's <head>), applies translations to
 * every element carrying a `data-i18n` / `data-i18n-placeholder` attribute,
 * and flips the document direction (RTL for Arabic, LTR for English).
 *
 * Usage in markup:
 *   <span data-i18n="nav.home">Home</span>
 *   <input data-i18n-placeholder="newsletter.placeholder" placeholder="..." />
 *
 * Language toggle: any element with id="langSwitch" calls window.toggleLanguage()
 * -----------------------------------------------------------------------
 */

(function () {
  const STORAGE_KEY = 'moamenoon_lang';
  const SUPPORTED = ['en', 'ar'];

  function getSavedLang() {
    const saved = localStorage.getItem(STORAGE_KEY);
    return SUPPORTED.includes(saved) ? saved : null;
  }

  function detectBrowserLang() {
    const nav = (navigator.language || 'en').slice(0, 2);
    return SUPPORTED.includes(nav) ? nav : 'en';
  }

  const initialLang = getSavedLang() || detectBrowserLang();

  /**
   * Applies the current i18next resources to the DOM.
   */
  function applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      const translated = window.i18next.t(key);
      // Preserve any child icon elements (e.g. <i class="fa-solid ..."></i>) that
      // sit alongside translatable text inside the same element by only
      // replacing text nodes, unless the element has ONLY text.
      if (el.children.length === 0) {
        el.textContent = translated;
      } else {
        // Find the direct text node (if any) and replace just that,
        // otherwise fall back to setting textContent on a dedicated span.
        let replaced = false;
        el.childNodes.forEach((node) => {
          if (node.nodeType === Node.TEXT_NODE && node.textContent.trim() !== '') {
            node.textContent = ' ' + translated;
            replaced = true;
          }
        });
        if (!replaced) el.textContent = translated;
      }
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      const key = el.getAttribute('data-i18n-placeholder');
      el.setAttribute('placeholder', window.i18next.t(key));
    });

    // Update <html lang> / <html dir>
    const dir = window.i18next.language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.setAttribute('lang', window.i18next.language);
    document.documentElement.setAttribute('dir', dir);

    // Update the language-switch button label to show the OTHER language
    document.querySelectorAll('#langSwitchLabel').forEach((el) => {
      el.textContent = window.i18next.language === 'ar' ? 'English' : 'العربية';
    });
  }

  function initI18n() {
    window.i18next
      .use(window.i18nextHttpBackend)
      .init(
        {
          lng: initialLang,
          fallbackLng: 'en',
          supportedLngs: SUPPORTED,
          backend: {
            // Path is relative to each HTML page inside /client/pages/
            loadPath: '../assets/locales/{{lng}}/translation.json',
          },
          interpolation: { escapeValue: false },
        },
        (err) => {
          if (err) {
            console.error('i18next initialization failed:', err);
            return;
          }
          applyTranslations();
          document.dispatchEvent(new CustomEvent('i18n:ready'));
        }
      );
  }

  /**
   * Toggles between English and Arabic, persists the choice, and re-applies
   * translations across the current page without a full reload.
   */
  window.toggleLanguage = function toggleLanguage() {
    const next = window.i18next.language === 'ar' ? 'en' : 'ar';
    window.i18next.changeLanguage(next, () => {
      localStorage.setItem(STORAGE_KEY, next);
      applyTranslations();
    });
  };

  document.addEventListener('DOMContentLoaded', () => {
    initI18n();

    document.querySelectorAll('#langSwitch').forEach((btn) => {
      btn.addEventListener('click', window.toggleLanguage);
    });
  });
})();
