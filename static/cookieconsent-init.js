/*!
 * Cookie consent banner (opt-out) — powered by CookieConsent v3 (https://github.com/orestbida/cookieconsent)
 * Installed by Rooster Grin. Load this file synchronously in <head>, BEFORE Google Tag Manager / gtag,
 * so Google Consent Mode defaults reflect a returning visitor's saved choice.
 */
(function () {
  var SITE = {
    name: 'Valley Orthodontics',
    primary: '#27615a',        // button / accent background
    primaryText: '#ffffff',
    primaryHover: '#1d4944',
    privacyUrl: '/privacy-policy',     // '' = no link
    side: 'left'               // 'left' (default) or 'right' — use right when a chat widget sits bottom-left
  };
  var CC_VERSION = '3.1.0';
  var CDN = 'https://cdn.jsdelivr.net/npm/vanilla-cookieconsent@' + CC_VERSION + '/dist/';
  var COOKIE = 'cc_cookie';

  // ---- 1. Google Consent Mode defaults (opt-out: granted unless visitor previously opted out) ----
  window.dataLayer = window.dataLayer || [];
  function gtag () { window.dataLayer.push(arguments); }
  function saved () {
    var m = document.cookie.match(new RegExp('(?:^|; )' + COOKIE + '=([^;]*)'));
    if (!m) return null;
    try { return JSON.parse(decodeURIComponent(m[1])).categories || []; } catch (e) { return null; }
  }
  function consentState (cats) {
    var a = !cats || cats.indexOf('analytics') > -1;
    var m = !cats || cats.indexOf('marketing') > -1;
    return {
      analytics_storage: a ? 'granted' : 'denied',
      ad_storage: m ? 'granted' : 'denied',
      ad_user_data: m ? 'granted' : 'denied',
      ad_personalization: m ? 'granted' : 'denied'
    };
  }
  // Global Privacy Control (CCPA opt-out preference signal): treat as opted out unless the visitor made an explicit choice.
  var GPC = navigator.globalPrivacyControl === true;
  var prior = saved();
  gtag('consent', 'default', consentState(prior || (GPC ? ['necessary'] : null)));

  // ---- 2. Load CookieConsent from CDN, then run ----
  function css (href) {
    var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; document.head.appendChild(l);
  }
  function theme () {
    var s = document.createElement('style');
    s.textContent =
      '#cc-main{--cc-btn-primary-bg:' + SITE.primary + ';--cc-btn-primary-border-color:' + SITE.primary +
      ';--cc-btn-primary-color:' + SITE.primaryText + ';--cc-btn-primary-hover-bg:' + SITE.primaryHover +
      ';--cc-btn-primary-hover-border-color:' + SITE.primaryHover + ';--cc-btn-primary-hover-color:' + SITE.primaryText +
      ';--cc-toggle-on-bg:' + SITE.primary + ';--cc-link-color:' + SITE.primary + ';--cc-font-family:inherit;z-index:2147483647!important}' +
      '#cc-main .cm__title{font-size:1.05em}' +
      '#rg-cc-settings{position:fixed;' + SITE.side + ':14px;bottom:14px;z-index:2147482999;width:40px;height:40px;border-radius:50%;border:0;cursor:pointer;' +
      'background:' + SITE.primary + ';color:' + SITE.primaryText + ';box-shadow:0 2px 10px rgba(0,0,0,.25);display:none;align-items:center;justify-content:center;padding:0}' +
      '#rg-cc-settings svg{width:22px;height:22px}#rg-cc-settings:focus-visible{outline:3px solid ' + SITE.primaryHover + ';outline-offset:2px}' +
      'body.rg-cc-ready #rg-cc-settings{display:flex}@media print{#rg-cc-settings{display:none!important}}';
    document.head.appendChild(s);
  }
  function settingsButton () {
    var b = document.createElement('button');
    b.id = 'rg-cc-settings'; b.type = 'button';
    b.setAttribute('aria-label', 'Cookie settings'); b.title = 'Cookie settings';
    b.setAttribute('data-cc', 'show-preferencesModal');
    b.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5zm-3.5 7a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm1 6a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm6 1a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/></svg>';
    b.addEventListener('click', function () { window.CookieConsent && window.CookieConsent.showPreferences(); });
    document.body.appendChild(b);
  }
  function sync () {
    var CC = window.CookieConsent;
    gtag('consent', 'update', consentState([
      CC.acceptedCategory('analytics') ? 'analytics' : '', CC.acceptedCategory('marketing') ? 'marketing' : ''
    ]));
  }
  // Show the cookie-settings button; if a chat / accessibility widget covers it, nudge it upward.
  function place () {
    var b = document.getElementById('rg-cc-settings');
    if (!b || getComputedStyle(b).display === 'none') return;
    var bottom = 14; b.style.bottom = bottom + 'px';
    for (var i = 0; i < 8; i++) {
      var r = b.getBoundingClientRect();
      var el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      if (!el || el === b || b.contains(el)) return;
      bottom += 56; b.style.bottom = bottom + 'px';
    }
  }
  var placeTimer, readyDone = false;
  function ready () {
    document.body.classList.add('rg-cc-ready');
    if (readyDone) { setTimeout(place, 50); return; }
    readyDone = true;
    [50, 2500, 6000].forEach(function (t) { setTimeout(place, t); });
    window.addEventListener('resize', function () { clearTimeout(placeTimer); placeTimer = setTimeout(place, 300); });
  }
  function run () {
    var policy = SITE.privacyUrl ? ' See our <a href="' + SITE.privacyUrl + '">Privacy Policy</a>.' : '';
    var gpcNote = GPC ? ' <strong>Your browser\'s Global Privacy Control signal has been honored: analytics and marketing cookies are off.</strong>' : '';
    window.CookieConsent.run({
      mode: 'opt-out',
      autoShow: !(GPC && !prior),
      revision: 1,
      cookie: { name: COOKIE, expiresAfterDays: 365 },
      guiOptions: {
        consentModal: { layout: 'box inline', position: 'bottom ' + SITE.side, equalWeightButtons: false, flipButtons: false },
        preferencesModal: { layout: 'box', equalWeightButtons: true }
      },
      onConsent: sync,
      onChange: sync,
      onModalHide: ready,
      categories: {
        necessary: { enabled: true, readOnly: true },
        analytics: {
          enabled: true,
          autoClear: { cookies: [{ name: /^_ga/ }, { name: '_gid' }, { name: /^_hj/ }, { name: /^_clck|^_clsk/ }] }
        },
        marketing: {
          enabled: true,
          autoClear: { cookies: [{ name: /^_fbp/ }, { name: /^_gcl/ }, { name: /^_uet/ }, { name: 'IDE' }] }
        }
      },
      language: {
        default: 'en',
        translations: {
          en: {
            consentModal: {
              title: 'We value your privacy',
              description: SITE.name + ' uses cookies to analyze site traffic and improve your experience. ' +
                'You can opt out of analytics and marketing cookies at any time.' + policy,
              acceptAllBtn: 'Accept',
              acceptNecessaryBtn: 'Opt out',
              showPreferencesBtn: 'Manage preferences'
            },
            preferencesModal: {
              title: 'Cookie preferences',
              acceptAllBtn: 'Accept all',
              acceptNecessaryBtn: 'Opt out of all',
              savePreferencesBtn: 'Save preferences',
              closeIconLabel: 'Close',
              sections: [
                {
                  title: 'Your choices',
                  description: 'We use cookies to keep this site working and to understand how it is used. ' +
                    'Analytics and marketing cookies are on by default; turn them off below to opt out, ' +
                    'including of the sale or sharing of personal information under California law.' + gpcNote + policy
                },
                {
                  title: 'Strictly necessary',
                  description: 'Required for the website to function. These cannot be turned off.',
                  linkedCategory: 'necessary'
                },
                {
                  title: 'Analytics',
                  description: 'Help us understand how visitors use the site (e.g. Google Analytics).',
                  linkedCategory: 'analytics'
                },
                {
                  title: 'Marketing',
                  description: 'Used to measure advertising and show relevant ads (e.g. Google Ads, Meta).',
                  linkedCategory: 'marketing'
                }
              ]
            }
          }
        }
      }
    }).then(function () {
      var CC = window.CookieConsent;
      // GPC visitor with no saved choice: record an opt-out (necessary only) without showing the banner.
      if (GPC && !CC.validConsent()) CC.acceptCategory([]);
      if (CC.validConsent()) ready();
    });
  }
  function boot () {
    if (window.__rgCookieConsent) return; window.__rgCookieConsent = true;
    css(CDN + 'cookieconsent.css'); theme(); settingsButton();
    var s = document.createElement('script');
    s.src = CDN + 'cookieconsent.umd.js'; s.async = true; s.onload = run;
    document.head.appendChild(s);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
