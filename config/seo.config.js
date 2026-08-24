import { url } from '../resources/api'
import {
  getLocalBlogRoutes,
  getLocalDynamicRoutes,
  noIndexRoutes
} from './routes.config'

// Routes that exist in the build but must stay out of the sitemap: the noindex
// set, plus the two dev-only pages, plus blog pagination beyond page 1 (thin
// listing pages that compete with the posts themselves).
const sitemapExclude = [
  ...noIndexRoutes,
  '/test',
  '/style-guide',
  '/blog/page/*'
]

export const siteMap = {
  path: '/sitemap.xml',
  hostname: url,
  gzip: true,
  lastmod: new Date(),
  sitemaps: [
    {
      path: '/sitemap-pages.xml',
      exclude: sitemapExclude,
      defaults: {
        changefreq: 'weekly',
        priority: 0.7,
        lastmod: new Date()
      },
      // The pages sub-sitemap must enumerate the file-based routes AND the
      // pages.json-driven routes. Passing `routes` overrides the module's
      // generate.routes default entirely, so the dynamic routes have to be
      // listed here explicitly or they silently vanish from the sitemap.
      //
      // `exclude` only filters routes the module discovers itself, not entries
      // handed to it via `routes` — so the noindex set has to be filtered out
      // of this list directly.
      routes: () => [
        { url: '/', priority: 1.0, changefreq: 'weekly' },
        { url: '/about', priority: 0.8 },
        { url: '/treatments', priority: 0.9 },
        { url: '/contact', priority: 0.9 },
        { url: '/faq', priority: 0.7 },
        { url: '/get-started', priority: 0.8 },
        { url: '/accessibility', priority: 0.2 },
        { url: '/privacy-policy', priority: 0.2 },
        ...getLocalDynamicRoutes()
          .filter(route => !noIndexRoutes.includes(route))
          .map(route => ({ url: route, priority: 0.7 }))
      ]
    },
    {
      path: '/blog/sitemap-blog.xml',
      exclude: ['/**'],
      defaults: {
        changefreq: 'monthly',
        priority: 0.5,
        lastmod: new Date()
      },
      // Local mirror only — the live WordPress API lives on the domain this
      // site replaces and disappears at cutover.
      routes: () => getLocalBlogRoutes()
        .filter(route => !route.startsWith('/blog/page/'))
        .concat('/blog/page/1')
    }
  ]
}

export const setRobots = {
  UserAgent: '*',
  // An empty Disallow means "allow everything". This was `'/'` (blocking the
  // entire site) for the whole staging period — do not reintroduce that.
  Disallow: '',
  Sitemap: url + 'sitemap.xml'
}
