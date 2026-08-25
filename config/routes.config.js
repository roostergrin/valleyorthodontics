import fs from 'fs'
import path from 'path'

const readJson = relative => JSON.parse(
  fs.readFileSync(path.join(process.cwd(), 'data', relative), 'utf8')
)

/**
 * Page keys served by their own pages/<name>/index.vue rather than by the
 * catch-all pages/_slug.vue, so they must not become dynamic routes.
 */
export const staticPageKeys = new Set([
  'Home', 'About', 'Get Started', 'Treatments', 'Contact', 'FAQ'
])

/**
 * Legacy WordPress slugs kept in pages.json for reference but deliberately not
 * built. Each one is a 301 source in the redirect map, and its content already
 * lives on the destination page — generating both created two indexable pages
 * competing for the same terms, with the redirect and the page contradicting
 * each other. Keeping the JSON means the copy is still recoverable.
 */
export const legacyDuplicateKeys = new Set([
  'about-us', // -> /about
  'accessibility-statement', // -> /accessibility
  'complimentary-consultation', // -> /contact#form
  'for-adults', // -> /all-ages-treatments#adults
  'for-children', // -> /all-ages-treatments#children
  'for-teens', // -> /all-ages-treatments#teens
  'invisalign', // -> /clear-aligners
  'privacypolicy', // -> /privacy-policy
  'what-to-expect-on-the-first-day-of-braces' // -> /braces
])

/**
 * Keys whose section data is consumed by a dedicated page component, so the key
 * must not also become a route of its own.
 *
 * `blog` holds the listing's sections, which pages/blog/page/_page.vue reads via
 * setJSONData('blog') to render /blog/page/N. The route /blog itself is only a
 * middleware redirect to /blog/page/1: its middleware runs before the page
 * component exists, so head() never merges and the pre-rendered file inherited
 * the global default verbatim, i.e. the homepage's title, description and
 * canonical. The edge 301s both /blog and /blog/index.html so that file was
 * unreachable, but there is no reason to ship a homepage duplicate to S3.
 *
 * This has to be filtered here rather than through generate.exclude: routes
 * returned by generate.routes() are merged in by decorateWithPayloads AFTER the
 * exclude filter runs, so an exclude pattern would never match this one.
 */
export const dataOnlyPageKeys = new Set(['blog'])

/**
 * Pages retired at launch. The staff bios were live and indexed on the old site
 * but were never linked from /meet-the-team, so they were orphans drawing search
 * traffic to a dead end. Their content stays in pages.json so it is recoverable;
 * their old URLs 301 to /meet-the-team (see infra/redirect-map.json).
 */
export const retiredPageKeys = new Set([
  'meet-carrie-our-patient-care-coordinator',
  'meet-abi-our-dental-assistant',
  'meet-alison-our-orthodontic-assistant',
  'meet-anna-our-practice-coordinator'
])

export const noIndexRoutes = [
  '/404',
  '/blog',
  '/thank-you'
]

export const getLocalDynamicRoutes = () => {
  const pages = readJson('pages.json')

  return Object.keys(pages)
    .filter(key => !staticPageKeys.has(key))
    .filter(key => !legacyDuplicateKeys.has(key))
    .filter(key => !retiredPageKeys.has(key))
    .filter(key => !dataOnlyPageKeys.has(key))
    // Keys containing a slash or uppercase (e.g. "category/all-posts") have no
    // matching generated route — pages/category/_slug.vue handles those.
    .filter(key => /^[a-z0-9-]+$/.test(key))
    .map(key => `/${key}`)
}

/**
 * Blog routes from the local data/posts.json mirror. The live WordPress API is
 * deliberately not consulted: it lives on the domain this site replaces, so it
 * disappears at cutover.
 */
export const getLocalBlogRoutes = () => {
  try {
    const postsData = readJson('posts.json')
    const posts = Array.isArray(postsData.posts) ? postsData.posts : []
    const routes = new Set(['/blog/page/1'])

    Object.keys(postsData.postsPerPage || {}).forEach((page) => {
      routes.add(`/blog/page/${page}`)
    })

    posts.forEach((post) => {
      if (post.slug) { routes.add(`/blog/${post.slug}`) }
    })

    return [...routes]
  } catch (e) {
    console.warn(`Could not read data/posts.json for blog routes: ${e}`)
    return ['/blog/page/1']
  }
}
