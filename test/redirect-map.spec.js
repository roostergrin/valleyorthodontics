/**
 * Validates infra/redirect-map.json — the map consumed by the shared edge
 * redirect handler — against every URL the live WordPress site has indexed.
 *
 * This is the launch-critical test: the old site's 300 indexed URLs must each
 * either redirect to a real page or carry over unchanged. Nothing may 404, chain,
 * or loop.
 *
 * The handler is shared infrastructure, identical for every site, so the data has
 * to satisfy its input contract rather than the other way round:
 *
 *   - Top-level key is the S3 BUCKET NAME, not the domain.
 *   - Keys are the COMPLETED URI: a directory path has already been rewritten to
 *     `<path>/index.html` by the time the map is consulted, so a bare or
 *     trailing-slash key can never match. A path whose last segment holds a dot
 *     is not rewritten and is keyed literally. See completeUri below.
 *   - Destinations must be ABSOLUTE. A relative destination is resolved against a
 *     .com host, and this practice is .net, so it would point at a domain the
 *     practice does not own.
 */

const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const map = require('../infra/redirect-map.json').valleyorthodontics
const legacy = require('./fixtures/legacy-urls.json')

const SITE = 'https://www.valleyorthodontics.net'

const norm = p => (String(p).split(/[#?]/)[0].replace(/\/+$/, '') || '/').toLowerCase()
const localPath = d => norm(String(d).replace(SITE, '')) || '/'

/**
 * Mirrors the URL completion that runs upstream of the redirect lookup, so the
 * only URI shape the map is ever asked about is the completed one: a directory
 * path becomes `<path>/index.html`, and a path whose last segment has a file
 * extension is left alone. Matches the key form used throughout the shared map.
 */
const completeUri = (uri) => {
  const p = String(uri).replace(SITE, '') || '/'
  const [pathPart] = p.split(/[?#]/)
  if (pathPart.split('/').pop().includes('.')) { return pathPart }
  return `${pathPart.replace(/\/$/, '')}/index.html`
}

const lambdaLookup = uri => map[completeUri(uri)]

/** Canonical form of a source, for grouping the three key shapes. */
const sourceKey = k => (String(k).replace(/\/index\.html$/, '').replace(/\/+$/, '') || '/').toLowerCase()

// Routes the static build actually produced.
const routes = new Set()
const walk = (dir, prefix = '') => {
  if (!fs.existsSync(dir)) { return }
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '_nuxt') { continue }
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(full, `${prefix}/${entry.name}`)
    } else if (entry.name === 'index.html') {
      routes.add(prefix || '/')
    }
  }
}
walk(path.join(ROOT, 'dist'))

// Pages, posts and the category archive are the URLs that hold real equity and
// must all be accounted for. Attachment pages are deliberately NOT in this set:
// on the live WordPress site they already 301 to the raw media file, so they were
// never indexable pages. See shouldRedirectAttachment in the build script.
const mustBeHandled = [
  ...legacy.pages,
  ...legacy.posts,
  ...legacy.categories
].filter(u => !/[?#]/.test(u)) // query-string URLs cannot be path keys

const lookup = (u) => {
  const p = String(u).replace(SITE, '') || '/'
  return lambdaLookup(p) !== undefined
    ? lambdaLookup(p)
    : map[sourceKey(p)]
}

describe('redirect map', () => {
  it('was generated from a dist/ build', () => {
    expect(routes.size).toBeGreaterThan(40)
  })

  it('covers every live page, post and category URL', () => {
    const unhandled = mustBeHandled.filter(u => lookup(u) === undefined && !routes.has(norm(u)))
    expect(unhandled).toEqual([])
  })

  it('does not bulk-redirect attachment pages to the homepage', () => {
    // These already 301 to the raw file on the live site. Dumping hundreds of them
    // on "/" would be noise, not link-equity preservation.
    const dumped = Object.entries(map)
      .filter(([, to]) => localPath(to) === '/')
      .filter(([from]) => legacy.attachments.some(a => norm(a) === norm(from)))
    expect(dumped).toEqual([])
  })

  it('keeps the document (PDF) attachment URLs', () => {
    // A patient bookmarks a form; a referring dentist emails one.
    const pdfs = ['/parent-consult-checklist/', '/referral-slip/', '/referral-slip-1/']
    pdfs.forEach(u => expect(lookup(u)).toBeDefined())
  })

  it('never redirects a URL to itself', () => {
    const loops = Object.entries(map).filter(([from, to]) => norm(from) === localPath(to))
    expect(loops).toEqual([])
  })

  it('uses absolute destinations', () => {
    // A relative destination is resolved against a .com host. This site is .net,
    // so a relative destination would send visitors to a domain the practice does
    // not own.
    const relative = Object.entries(map).filter(([, to]) => !to.startsWith(`${SITE}/`))
    expect(relative).toEqual([])
  })

  it('keys every source in the completed-URI form the Lambda actually sees', () => {
    // A bare or trailing-slash key can never match: url completion runs first.
    const wrong = Object.keys(map)
      .filter(k => !k.endsWith('/index.html'))
      .filter(k => !k.split('/').pop().includes('.'))
    expect(wrong).toEqual([])
  })

  it('resolves every URI shape a visitor can type to the same destination', () => {
    const shapes = ['/about-us', '/about-us/', '/about-us/index.html']
    const targets = shapes.map(u => lambdaLookup(u))
    expect(targets.every(t => t === `${SITE}/about/`)).toBe(true)
  })

  it('never redirects into another redirect', () => {
    const chains = Object.entries(map).filter(([, to]) => lookup(to) !== undefined)
    expect(chains).toEqual([])
  })

  it('sends every redirect to a page that exists in the build', () => {
    const broken = [...new Set(Object.values(map))].filter(to => !routes.has(localPath(to)))
    expect(broken).toEqual([])
  })

  it('writes destinations in trailing-slash form', () => {
    const bad = [...new Set(Object.values(map))]
      .filter(to => !/\/(#.*)?$/.test(to))
    expect(bad).toEqual([])
  })

  describe('editorial decisions', () => {
    const expected = {
      '/about-us/': '/about/',
      '/invisalign/': '/clear-aligners/',
      '/privacypolicy/': '/privacy-policy/',
      '/accessibility-statement/': '/accessibility/',
      '/doctor-referals-slips/': '/doctor-referrals-slips/',
      '/what-to-expect-on-the-first-day-of-braces/': '/braces/',
      '/complimentary-consultation/': '/contact/#form',
      '/for-teens/': '/all-ages-treatments/#teens',
      '/for-adults/': '/all-ages-treatments/#adults',
      '/for-children/': '/all-ages-treatments/#children',
      '/category/all-posts/': '/blog/page/1/',
      '/patients-experiences/': '/'
    }

    Object.entries(expected).forEach(([from, to]) => {
      it(`${from} -> ${to}`, () => {
        expect(lookup(from)).toBe(SITE + to)
      })
    })
  })

  it('moves every legacy post slug under /blog/', () => {
    const wrong = legacy.posts
      .filter(u => norm(u) !== '/blog')
      .filter((u) => {
        const to = lookup(u)
        return !to || !localPath(to).startsWith('/blog/')
      })
    expect(wrong).toEqual([])
  })

  it('stays small enough to review by hand', () => {
    // One entry per real URL. A jump here means attachment stubs crept back in,
    // see shouldRedirectAttachment in scripts/build-redirect-map.js.
    const sources = new Set(Object.keys(map).map(sourceKey))
    expect(sources.size).toBeLessThan(80)
  })
})
