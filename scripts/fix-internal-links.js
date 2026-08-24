#!/usr/bin/env node
/**
 * Normalize internal links inside data/*.json so none of them point at a route
 * that no longer exists or that only 301s somewhere else.
 *
 *   node scripts/fix-internal-links.js [--dry-run]
 *
 * Scoped to href="..." values only. Some blog posts print the site URL as
 * visible text, which must not be rewritten.
 */

const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const DATA_FILES = ['pages.json', 'posts.json', 'globalData.json']
const DRY_RUN = process.argv.includes('--dry-run')
const ORIGIN = 'https://www.valleyorthodontics.net'

// Applied in order to each href value. Legacy slugs resolve to their live
// destination directly rather than relying on a 301 hop.
const rewrite = (href) => {
  let out = href.trim()

  // Absolute self-references become root-relative.
  if (out === ORIGIN || out === `${ORIGIN}/`) { return '/' }
  if (out.startsWith(`${ORIGIN}/`)) { out = out.slice(ORIGIN.length) }

  const map = {
    '/invisalign': '/clear-aligners',
    '/complimentary-consultation': '/contact#form',
    '/for-teens': '/all-ages-treatments#teens',
    '/for-adults': '/all-ages-treatments#adults',
    '/for-children': '/all-ages-treatments#children',
    '/about-us': '/about',
    '/accessibility-statement': '/accessibility',
    '/privacypolicy': '/privacy-policy',
    '/what-to-expect-on-the-first-day-of-braces': '/braces',
    '/category/all-posts': '/blog/page/1',
    // /blog is a middleware-only redirect, not a generated page.
    '/blog': '/blog/page/1'
  }

  // Only internal paths from here on. External URLs are left exactly as authored —
  // their trailing slashes are the remote site's business, not ours.
  if (!out.startsWith('/')) { return out }

  // Compare without a trailing slash; keep any #fragment or ?query intact.
  const [pathPart, ...rest] = out.split(/(?=[#?])/)
  const bare = pathPart.replace(/\/+$/, '') || '/'

  if (map[bare]) { return map[bare] + rest.join('') }
  // Drop needless trailing slashes on internal paths so they don't take an
  // extra normalize hop through the edge redirect function.
  if (bare !== '/' && pathPart.endsWith('/')) { return bare + rest.join('') }

  return out
}

let grandTotal = 0

for (const file of DATA_FILES) {
  const abs = path.join(ROOT, 'data', file)
  const before = fs.readFileSync(abs, 'utf8')
  const changes = []

  // hrefs appear escaped inside JSON strings: href=\"...\"
  const text = before.replace(/href=\\"([^"\\]*)\\"/g, (match, href) => {
    const next = rewrite(href)
    if (next === href) { return match }
    changes.push(`${href}  ->  ${next}`)
    return `href=\\"${next}\\"`
  })

  if (!changes.length) {
    console.log(`${file}: no changes`)
    continue
  }

  try {
    JSON.parse(text)
  } catch (e) {
    console.error(`${file}: rewrite produced invalid JSON, aborting — ${e.message}`)
    process.exit(1)
  }

  console.log(`${file}: ${changes.length} link(s)`)
  const seen = new Set()
  changes.forEach((c) => {
    if (seen.has(c)) { return }
    seen.add(c)
    console.log(`  ${c}`)
  })
  grandTotal += changes.length

  if (!DRY_RUN) { fs.writeFileSync(abs, text) }
}

console.log(`\n${grandTotal} internal link(s) ${DRY_RUN ? 'would be ' : ''}rewritten.`)
