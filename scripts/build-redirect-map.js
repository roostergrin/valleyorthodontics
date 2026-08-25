#!/usr/bin/env node
/**
 * Build the launch redirect map from the URLs the *live* WordPress site actually
 * has indexed — not from what happens to exist locally.
 *
 *   node scripts/fetch-legacy-urls.js     # capture the live site first
 *   node scripts/build-redirect-map.js
 *
 * Inputs, captured from the live site by scripts/fetch-legacy-urls.js:
 *   test/fixtures/legacy-urls.json     every indexed URL, per sub-sitemap
 *   test/fixtures/legacy-parents.json  attachment -> parent page/post
 *
 * Also reads:
 *   infra/redirect-rules.txt  the editorial decisions already made about which
 *                      legacy page maps to which new page (the source of truth)
 *   dist/              to confirm every destination is a real generated route
 *
 * Output: infra/redirect-map.json, in the shape the shared edge redirect handler
 * consumes.
 *
 * Pre-cutover tool: the inputs are a snapshot of a WordPress site that stops
 * existing at launch, so this cannot be re-run afterwards and the map is frozen
 * at that point. The input contract the output has to satisfy — key shape,
 * bucket-name key, absolute destinations — is documented in
 * test/redirect-map.spec.js, which is what enforces it and what outlives this
 * script.
 */

const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const DOMAIN = 'valleyorthodontics'

// Attachment pages are excluded by default — see the comment on
// shouldRedirectAttachment below. --all-attachments restores them for auditing.
const ALL_ATTACHMENTS = process.argv.includes('--all-attachments')

// A relative destination is resolved against a .com host — and this site is .net.
// Absolute destinations are passed through untouched, so every destination here is
// absolute.
const SITE = 'https://www.valleyorthodontics.net'

// The lookup is exact, and the handler is shared across every site so it will not
// be changed to normalise. It does not need to: URL completion upstream means the
// path is always in /index.html form by the time the map is consulted, so that is
// the only key shape emitted.

const legacy = require(path.join(ROOT, 'test', 'fixtures', 'legacy-urls.json'))
const parentsFixture = require(path.join(ROOT, 'test', 'fixtures', 'legacy-parents.json'))
const parents = parentsFixture.parents || {}

const norm = p => (String(p).split(/[#?]/)[0].replace(/\/+$/, '') || '/').toLowerCase()
const withTrailingSlash = p => (norm(p) === '/' ? '/' : `${norm(p)}/`)
/** Destinations are absolute; compare them against local routes by path. */
const localPath = d => norm(String(d).replace(SITE, '')) || '/'

/** Destinations use the trailing-slash form the new site serves, #fragment last. */
const destForm = (target) => {
  const [pathPart, ...rest] = String(target).split(/(?=[#?])/)
  return withTrailingSlash(pathPart) + rest.join('')
}

// ------------------------------------------------------------ new site routes

const generatedRoutes = new Set()
const walkDist = (dir, prefix = '') => {
  if (!fs.existsSync(dir)) { return }
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '_nuxt') { continue }
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walkDist(full, `${prefix}/${entry.name}`)
    } else if (entry.name === 'index.html') {
      generatedRoutes.add(prefix || '/')
    }
  }
}
walkDist(path.join(ROOT, 'dist'))

// --------------------------------- editorial decisions in infra/redirect-rules

const editorial = new Map()
const editorialPrefix = new Map()
for (const raw of fs.readFileSync(path.join(ROOT, 'infra', 'redirect-rules.txt'), 'utf8').split('\n')) {
  const line = raw.trim()
  if (!line || line.startsWith('#')) { continue }
  const [from, to] = line.split(/\s+/)
  if (!from || !to) { continue }
  if (from.includes(':')) {
    editorialPrefix.set(norm(from.slice(0, from.indexOf(':'))), to)
  } else {
    editorial.set(norm(from), to)
  }
}

// ------------------------------------------------------------------ resolution

/**
 * Where does a legacy page/post path land?
 *   string    -> redirect here
 *   null      -> slug unchanged, no redirect needed
 *   undefined -> no idea, needs a human
 */
const resolvePage = (legacyPath) => {
  const key = norm(legacyPath)
  if (editorial.has(key)) { return editorial.get(key) }
  if (generatedRoutes.has(key)) { return null }
  if (generatedRoutes.has(`/blog${key}`)) { return `/blog${key}` }
  return undefined
}

/**
 * Should a legacy WordPress attachment page get a redirect?
 *
 * Usually not. On the live site these URLs already 301 to the raw media file —
 * /team-photo/ serves team-photo.jpg, not an HTML page. They were never
 * indexable pages, so there is no page-level equity to carry over, and pointing
 * one at a marketing page changes what the URL means for anyone following an old
 * link. Left alone they 404, Google drops them, and that is the correct outcome
 * for a URL that genuinely no longer exists.
 *
 * Two cases still earn a rule:
 *   - Documents. A PDF is the kind of thing a patient bookmarks or a referring
 *     dentist emails, so it keeps a redirect to the page that offers the form.
 *   - A hand-written rule in infra/redirect-rules.txt that names a *specific*
 *     destination — someone judged that URL worth keeping (e.g. /7-questions/,
 *     a shortlink to a blog post).
 *
 * A hand-written rule pointing at "/" is not a judgement, it is a shrug: there
 * was nothing better to send it to. Those are dropped with everything else.
 */
const shouldRedirectAttachment = (attachmentPath) => {
  const key = norm(attachmentPath)
  if (ALL_ATTACHMENTS) { return true }
  if ((parents[key] || {}).mimeType === 'application/pdf') { return true }
  const rule = editorial.get(key)
  return !!rule && norm(rule) !== '/'
}

const orphanAttachments = []
const droppedAttachments = []

const resolveAttachment = (attachmentPath) => {
  const key = norm(attachmentPath)

  if (editorial.has(key)) { return editorial.get(key) }
  for (const [base, target] of editorialPrefix) {
    if (key.startsWith(`${base}/`)) { return target }
  }

  // Land on the page the image belonged to rather than dumping everything on the
  // homepage. WordPress reports that parent via /wp/v2/media.
  const parent = parents[key]
  if (parent && parent.slug) {
    const parentPath = parent.type === 'post' ? `/blog/${parent.slug}` : `/${parent.slug}`
    const resolved = resolvePage(parentPath)
    if (resolved) { return resolved }
    if (resolved === null) { return parentPath }
  }

  orphanAttachments.push(attachmentPath)
  return '/'
}

// ----------------------------------------------------------------------- build

const map = {}
const carriedOver = []
const needsReview = []
const selfReferential = []
const queryOnly = []

const isQueryUrl = p => /[?#]/.test(p)

const add = (fromPath, rawTarget) => {
  const bare = norm(fromPath)
  const target = SITE + destForm(rawTarget)

  // A source that redirects to itself loops forever at the edge; on the homepage
  // that takes the whole site down.
  if (bare === localPath(target)) {
    selfReferential.push({ from: fromPath, to: target })
    return
  }

  map[`${bare === '/' ? '' : bare}/index.html`] = target
}

for (const p of [...legacy.pages, ...legacy.posts, ...legacy.categories]) {
  if (isQueryUrl(p)) { queryOnly.push(p); continue }
  const target = resolvePage(p)
  if (target === null) { carriedOver.push(p); continue }
  if (target === undefined) { needsReview.push(p); add(p, '/'); continue }
  add(p, target)
}

for (const p of legacy.attachments) {
  if (isQueryUrl(p)) { queryOnly.push(p); continue }
  if (!shouldRedirectAttachment(p)) { droppedAttachments.push(p); continue }
  add(p, resolveAttachment(p))
}

// ------------------------------------------------------------- collapse chains

// No destination may itself be a redirect source: a two-hop 301 leaks link equity,
// and if the intermediate exists only as a rule it breaks outright.
let collapsed = 0
// Mirrors the upstream URL completion, so a destination is looked up under the
// same key shape the edge would actually ask for. Probing the bare path instead
// would silently match nothing and let chains through.
const completeUri = (p) => {
  const local = norm(String(p).replace(SITE, '')) || '/'
  if (local.split('/').pop().includes('.')) { return local }
  return `${local === '/' ? '' : local}/index.html`
}

const lookup = to => map[completeUri(to)]

for (const from of Object.keys(map)) {
  const seen = new Set([norm(from)])
  let to = map[from]
  while (lookup(to) !== undefined) {
    const next = lookup(to)
    if (seen.has(norm(next))) { break }
    seen.add(norm(next))
    to = next
    collapsed += 1
  }
  map[from] = to
}

for (const [from, to] of Object.entries(map)) {
  if (norm(from) === localPath(to)) {
    selfReferential.push({ from, to })
    delete map[from]
  }
}

// -------------------------------------------------------------------- validate

const destinations = [...new Set(Object.values(map))]
const brokenDestinations = destinations.filter(d => !generatedRoutes.has(localPath(d)))

const sorted = Object.keys(map).sort().reduce((acc, k) => {
  acc[k] = map[k]
  return acc
}, {})

fs.mkdirSync(path.join(ROOT, 'infra'), { recursive: true })
fs.writeFileSync(
  path.join(ROOT, 'infra', 'redirect-map.json'),
  JSON.stringify({ [DOMAIN]: sorted }, null, 2) + '\n'
)

// ---------------------------------------------------------------------- report

const line = (label, value) => console.log(`  ${String(label).padEnd(44)} ${value}`)
const total = legacy.pages.length + legacy.posts.length + legacy.categories.length + legacy.attachments.length

console.log(`\nLIVE INDEXED URLS  (captured ${legacy._capturedAt} from ${legacy._source})`)
line('pages', legacy.pages.length)
line('posts', legacy.posts.length)
line('categories', legacy.categories.length)
line('attachments', legacy.attachments.length)
line('total', total)

console.log('\nRESULT')
line('distinct source URLs redirected', Object.keys(map).filter(k => !k.endsWith('/index.html') && !k.endsWith('/')).length)
line('map entries', Object.keys(map).length)
line('key form', '/path/index.html')
line('carried over unchanged, no redirect', carriedOver.length)
line('attachment stubs left to 404', droppedAttachments.length)
line('attachments with no parent -> /', orphanAttachments.length)
line('chained hops collapsed', collapsed)
line('self-referential entries dropped', selfReferential.length)
line('query-string URLs excluded', queryOnly.length)
line('destinations that are NOT real routes', brokenDestinations.length)

if (brokenDestinations.length) {
  console.log('\n  BROKEN DESTINATIONS:')
  brokenDestinations.forEach(d => console.log(`      ${d}`))
}
if (needsReview.length) {
  console.log('\n  NEEDS A HUMAN DECISION (pointed at / for now):')
  needsReview.forEach(p => console.log(`      ${p}`))
}
if (queryOnly.length) {
  console.log('\n  EXCLUDED — query string, not expressible as a path key:')
  queryOnly.forEach(p => console.log(`      ${p}`))
  console.log('      Already resolves to a real page; the canonical tag consolidates it.')
}

console.log(`\nWrote infra/redirect-map.json  (${Object.keys(map).length} entries)`)
