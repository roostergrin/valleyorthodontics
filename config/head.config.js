import { url } from '../resources/api'
import { buildPracticeSchema, buildWebSiteSchema } from '../resources/structured-data'
import globalData from '../data/globalData.json'

// Measurement IDs, verified against the live site's own tags. Google Ads
// (AW-16625950169) is not listed here because it fires from inside GTM, not from
// the page — confirm it is still in one of these containers before launch.
const GA4_ID = 'G-TV4GGB5LJQ'
const GTM_IDS = ['GTM-KDN4NRNP', 'GTM-T3RF7MX6']

// Sitewide JSON-LD. The site shipped no structured data at all, while
// data/globalData.json already held the full NAP, coordinates and opening hours.
const practiceSchema = buildPracticeSchema(globalData)
const webSiteSchema = buildWebSiteSchema(globalData)

export const siteHead = (meta, theme = {}) => {
  // Themeable, but defaults to the same-origin copy so a cold CDN cache or a
  // theme with no favicon still resolves.
  const faviconUrl = theme?.default?.favicon_url || '/favicon-32x32.png'
  const ogImage = meta.seo.social_meta?.og_meta?.image

  return {
    htmlAttrs: { lang: 'en' },
    title: meta.seo.page_title ? meta.seo.page_title : meta.title,
    meta: [
      { charset: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { name: 'referrer', content: 'strict-origin-when-cross-origin' },
      // NOTE: this was `noindex, nofollow` for the whole staging period, which
      // blocked every page in the build. Pages that genuinely must not be
      // indexed opt in per-page via seo.noindex (see setMeta in resources/utils.js).
      { hid: 'robots', name: 'robots', content: 'index, follow' },
      { hid: 'description', name: 'description', content: meta.seo.page_description },
      { hid: 'keywords', name: 'keywords', content: meta.seo.page_keywords ? meta.seo.page_keywords : '' },
      // OG Meta
      { hid: 'og:type', property: 'og:type', content: 'website' },
      { hid: 'og:site_name', property: 'og:site_name', content: 'Valley Orthodontics' },
      { hid: 'og:locale', property: 'og:locale', content: 'en_US' },
      meta.seo.social_meta.og_meta.title && { hid: 'og:title', property: 'og:title', content: meta.seo.social_meta.og_meta.title },
      meta.seo.social_meta.og_meta.description && { hid: 'og:description', property: 'og:description', content: meta.seo.social_meta.og_meta.description },
      ogImage && { hid: 'og:image', property: 'og:image', content: ogImage },
      { hid: 'og:url', property: 'og:url', content: url },
      // Twitter cards — none existed before, so shares fell back to a bare link.
      { hid: 'twitter:card', name: 'twitter:card', content: 'summary_large_image' },
      meta.seo.social_meta.og_meta.title && { hid: 'twitter:title', name: 'twitter:title', content: meta.seo.social_meta.og_meta.title },
      meta.seo.social_meta.og_meta.description && { hid: 'twitter:description', name: 'twitter:description', content: meta.seo.social_meta.og_meta.description },
      ogImage && { hid: 'twitter:image', name: 'twitter:image', content: ogImage }
    ].filter(Boolean),
    link: [
      // Every icon entry carries an explicit size. An earlier revision paired an
      // unsized themed favicon with `rel="alternate icon"` at /favicon.ico, and
      // Chrome picked the unsized .ico — which still held the RoosterGrin
      // template's tooth mark, not the practice's VO logo. static/favicon.ico is
      // now a real multi-size icon (16/32/48) cut from the 512px site icon, so
      // every request path resolves to the same mark.
      { rel: 'icon', type: 'image/png', sizes: '32x32', href: faviconUrl },
      { rel: 'icon', type: 'image/png', sizes: '192x192', href: '/favicon-192x192.png' },
      { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' },
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: 'anonymous' },
      { hid: 'canonical', rel: 'canonical', href: url }
    ],
    script: [
      {
        hid: 'ld-practice',
        type: 'application/ld+json',
        innerHTML: JSON.stringify(practiceSchema)
      },
      {
        hid: 'ld-website',
        type: 'application/ld+json',
        innerHTML: JSON.stringify(webSiteSchema)
      },
      // Analytics must match the live site's tags exactly. The template shipped
      // with G-EP9BQ2J5P8, which belongs to a different RoosterGrin practice and
      // is not one of this site's tags — measurement would have started in the
      // wrong property on day one.
      {
        hid: 'gtag',
        src: `https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`,
        async: true
      },
      {
        hid: 'gtag-config',
        type: 'text/javascript',
        innerHTML: `
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA4_ID}');
        `
      },
      // Two containers, matching the live site. Google Ads (AW-16625950169) fires
      // from inside one of them rather than from the page, so it comes back with
      // these and needs no separate snippet.
      {
        hid: 'gtm',
        type: 'text/javascript',
        innerHTML: `
          ${GTM_IDS.map(id => `
          (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
          new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
          j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
          'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
          })(window,document,'script','dataLayer','${id}');`).join('')}
        `
      }
    ],
    __dangerouslyDisableSanitizersByTagID: {
      'gtag-config': ['innerHTML'],
      gtm: ['innerHTML'],
      'ld-practice': ['innerHTML'],
      'ld-website': ['innerHTML']
    }
  }
}
